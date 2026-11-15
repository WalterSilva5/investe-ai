import {
  BadRequestException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { createReadStream, promises as fs } from 'fs';
import { basename, extname, join } from 'path';
import { PDFParse } from 'pdf-parse';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDocumentDto } from './dto/create-document.dto';

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TEXT_CHARS = 30_000;

const TEXT_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/csv',
  'text/x-markdown',
]);

const EXT_BY_MIME: Record<string, string> = {
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'text/markdown': '.md',
  'text/x-markdown': '.md',
  'text/csv': '.csv',
  'application/csv': '.csv',
};

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.document.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
      take: 200,
      include: {
        attachments: {
          select: { id: true, filename: true, mimeType: true, size: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  create(tenantId: string, dto: CreateDocumentDto) {
    return this.prisma.document.create({
      data: {
        tenantId,
        title: dto.title,
        body: dto.body,
        tags: dto.tags,
      },
    });
  }

  async get(tenantId: string, id: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, tenantId },
      include: {
        attachments: {
          select: { id: true, filename: true, mimeType: true, size: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!document) throw new NotFoundException('Documento não encontrado.');
    return document;
  }

  async remove(tenantId: string, id: string) {
    const document = await this.get(tenantId, id);
    const attachments = await this.prisma.documentAttachment.findMany({
      where: { documentId: document.id },
    });
    await this.prisma.document.delete({ where: { id: document.id } });
    await Promise.all(attachments.map((a) => fs.unlink(a.storagePath).catch(() => undefined)));
    return { ok: true };
  }

  search(tenantId: string, query: string, limit = 8) {
    const q = query.trim();
    if (!q) return [];
    return this.prisma.document.findMany({
      where: {
        tenantId,
        OR: [
          { title: { contains: q } },
          { body: { contains: q } },
          { tags: { contains: q } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  }

  async addAttachment(
    tenantId: string,
    documentId: string,
    file: Express.Multer.File,
  ) {
    const document = await this.get(tenantId, documentId);
    if (!file?.buffer?.length) throw new BadRequestException('Nenhum arquivo enviado.');
    if (file.size > MAX_FILE_BYTES) {
      throw new BadRequestException('Arquivo excede o limite de 8 MB.');
    }

    const ext = (extname(file.originalname) || EXT_BY_MIME[file.mimetype] || '').toLowerCase();
    const isPdf = file.mimetype === 'application/pdf' || ext === '.pdf';
    const isText = TEXT_TYPES.has(file.mimetype) || ['.txt', '.md', '.markdown', '.csv'].includes(ext);
    if (!isPdf && !isText) {
      throw new BadRequestException('Tipo não suportado. Envie PDF, TXT, MD ou CSV.');
    }

    const textContent = await this.extractText(file.buffer, isPdf);
    const dir = join(process.cwd(), 'data', 'attachments', tenantId);
    await fs.mkdir(dir, { recursive: true });
    const safe = basename(file.originalname).replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80) || 'anexo';
    const storagePath = join(dir, `${document.id}-${Date.now()}-${safe}`);
    await fs.writeFile(storagePath, file.buffer);

    return this.prisma.documentAttachment.create({
      data: {
        documentId: document.id,
        tenantId,
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storagePath,
        textContent: textContent || undefined,
      },
      select: { id: true, filename: true, mimeType: true, size: true, createdAt: true },
    });
  }

  listAttachments(tenantId: string, documentId: string) {
    return this.get(tenantId, documentId).then((d) => d.attachments);
  }

  async downloadAttachment(
    tenantId: string,
    documentId: string,
    attachmentId: string,
  ): Promise<{ stream: StreamableFile; filename: string; mimeType: string }> {
    const attachment = await this.prisma.documentAttachment.findFirst({
      where: { id: attachmentId, documentId, tenantId },
    });
    if (!attachment) throw new NotFoundException('Anexo não encontrado.');
    return {
      stream: new StreamableFile(createReadStream(attachment.storagePath)),
      filename: attachment.filename,
      mimeType: attachment.mimeType,
    };
  }

  async removeAttachment(tenantId: string, documentId: string, attachmentId: string) {
    const attachment = await this.prisma.documentAttachment.findFirst({
      where: { id: attachmentId, documentId, tenantId },
    });
    if (!attachment) throw new NotFoundException('Anexo não encontrado.');
    await this.prisma.documentAttachment.delete({ where: { id: attachment.id } });
    await fs.unlink(attachment.storagePath).catch(() => undefined);
    return { ok: true };
  }

  /** Notas recentes com texto dos anexos — contexto para as dicas do diário. */
  async recentWithAttachments(tenantId: string, limit = 10) {
    const documents = await this.prisma.document.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: {
        attachments: {
          select: { filename: true, textContent: true },
        },
      },
    });
    return documents.map((d) => ({
      title: d.title,
      body: d.body.slice(0, 4000),
      tags: d.tags,
      updatedAt: d.updatedAt,
      attachments: d.attachments
        .filter((a) => a.textContent)
        .map((a) => ({
          filename: a.filename,
          text: (a.textContent as string).slice(0, 6000),
        })),
    }));
  }

  private async extractText(buffer: Buffer, isPdf: boolean): Promise<string | null> {
    try {
      const raw = isPdf ? await this.extractPdfText(buffer) : buffer.toString('utf-8');
      const clean = raw.replace(/\r/g, '').trim().slice(0, MAX_TEXT_CHARS);
      return clean || null;
    } catch {
      if (isPdf) {
        throw new BadRequestException(
          'Não foi possível extrair texto do PDF. PDFs escaneados (imagem) exigem OCR.',
        );
      }
      throw new BadRequestException('Não foi possível ler o arquivo como texto.');
    }
  }

  private async extractPdfText(buffer: Buffer): Promise<string> {
    let parser: PDFParse | undefined;
    try {
      parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser?.destroy();
    }
  }
}
