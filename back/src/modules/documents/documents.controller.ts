import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';

@ApiTags('documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.documents.list(tenantId);
  }

  @Post()
  create(@TenantId() tenantId: string, @Body() dto: CreateDocumentDto) {
    return this.documents.create(tenantId, dto);
  }

  @Get('search')
  search(@TenantId() tenantId: string, @Query('q') q: string) {
    return this.documents.search(tenantId, q || '');
  }

  @Get(':id')
  get(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.documents.get(tenantId, id);
  }

  @Delete(':id')
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.documents.remove(tenantId, id);
  }

  @Post(':id/attachments')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024, files: 1 },
    }),
  )
  addAttachment(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.documents.addAttachment(tenantId, id, file);
  }

  @Get(':id/attachments')
  listAttachments(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.documents.listAttachments(tenantId, id);
  }

  @Get(':id/attachments/:attachmentId/download')
  async download(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.documents.downloadAttachment(tenantId, id, attachmentId);
    res.set({
      'Content-Type': file.mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(file.filename)}"`,
    });
    return file.stream;
  }

  @Delete(':id/attachments/:attachmentId')
  removeAttachment(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.documents.removeAttachment(tenantId, id, attachmentId);
  }
}
