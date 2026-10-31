import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from './encryption.service';
import {
  OpenAICompatibleProvider,
  ProviderConfig,
} from './openai-compatible.provider';
import { findProvider, PROVIDER_CATALOG, ProviderDefinition } from './provider.catalog';
import { SaveCredentialDto } from './dto/save-credential.dto';
import { TestProviderDto } from './dto/test-provider.dto';

export interface ResolvedProvider {
  providerId: string;
  model: string;
  provider: OpenAICompatibleProvider;
}

@Injectable()
export class AiProviderRegistry {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly encryption: EncryptionService,
  ) {}

  catalog() {
    return PROVIDER_CATALOG;
  }

  async listForTenant(tenantId: string) {
    const credentials = await this.prisma.providerCredential.findMany({
      where: { tenantId },
    });
    const byId = new Map(credentials.map((c) => [c.providerId, c]));
    const envOpenCode = Boolean(this.config.get<string>('OPENCODE_API_KEY'));

    return PROVIDER_CATALOG.map((def) => {
      const cred = byId.get(def.id);
      const configured = Boolean(cred?.enabled) || (def.id === 'opencode' && envOpenCode);
      return {
        id: def.id,
        name: def.name,
        kind: def.kind,
        configured,
        model: cred?.model || (def.id === 'opencode' ? this.config.get('OPENCODE_MODEL') : '') || def.defaultModel,
        baseUrl: cred?.baseUrl || def.baseUrl,
        docs: def.docs,
      };
    });
  }

  async resolve(
    tenantId: string,
    providerId?: string,
    model?: string,
  ): Promise<ResolvedProvider> {
    const id = (providerId || this.config.get<string>('AI_DEFAULT_PROVIDER') || 'opencode').toLowerCase();
    const def = findProvider(id);
    if (!def) throw new NotFoundException(`Provedor desconhecido: ${id}`);

    const credential = await this.prisma.providerCredential.findUnique({
      where: { tenantId_providerId: { tenantId, providerId: id } },
    });

    let apiKey = '';
    let baseUrl = def.baseUrl;
    let finalModel = model || def.defaultModel;

    if (credential?.enabled) {
      apiKey = this.encryption.decrypt({
        encryptedKey: credential.encryptedKey,
        iv: credential.iv,
        authTag: credential.authTag,
      });
      baseUrl = credential.baseUrl || def.baseUrl;
      finalModel = model || credential.model || def.defaultModel;
    } else if (id === 'opencode') {
      apiKey = this.config.get<string>('OPENCODE_API_KEY') || '';
      baseUrl = this.config.get<string>('OPENCODE_BASE_URL') || def.baseUrl;
      finalModel = model || this.config.get<string>('OPENCODE_MODEL') || def.defaultModel;
    }

    if (!apiKey) {
      throw new BadRequestException(
        `Configure a chave do provedor "${def.name}" em Configurações.`,
      );
    }
    if (!finalModel) {
      throw new BadRequestException(
        `Defina um modelo para o provedor "${def.name}".`,
      );
    }

    return this.makeProvider(def, apiKey, baseUrl, finalModel, tenantId);
  }

  private makeProvider(
    def: ProviderDefinition,
    apiKey: string,
    baseUrl: string,
    model: string,
    tenantId: string,
  ): ResolvedProvider {
    const config: ProviderConfig = { baseUrl, apiKey, defaultModel: model };

    if (def.id === 'opencode') {
      config.extraHeaders = {
        'x-opencode-session': createHash('sha256')
          .update(`wsi-invest-ai:${tenantId}`)
          .digest('hex')
          .slice(0, 32),
        'User-Agent': 'wsi-invest-ai/0.1',
      };
    }

    return {
      providerId: def.id,
      model,
      provider: new OpenAICompatibleProvider(config),
    };
  }

  async saveCredential(
    tenantId: string,
    userId: string,
    providerId: string,
    dto: SaveCredentialDto,
  ) {
    const def = findProvider(providerId);
    if (!def) throw new NotFoundException(`Provedor desconhecido: ${providerId}`);

    const enc = this.encryption.encrypt(dto.apiKey);
    await this.prisma.providerCredential.upsert({
      where: { tenantId_providerId: { tenantId, providerId: def.id } },
      create: {
        tenantId,
        userId,
        providerId: def.id,
        encryptedKey: enc.encryptedKey,
        iv: enc.iv,
        authTag: enc.authTag,
        baseUrl: dto.baseUrl || def.baseUrl,
        model: dto.model || def.defaultModel,
      },
      update: {
        encryptedKey: enc.encryptedKey,
        iv: enc.iv,
        authTag: enc.authTag,
        baseUrl: dto.baseUrl || def.baseUrl,
        model: dto.model || def.defaultModel,
        enabled: true,
      },
    });

    return { ok: true, providerId: def.id };
  }

  async test(tenantId: string, providerId: string, dto?: TestProviderDto) {
    const def = findProvider(providerId);
    if (!def) throw new NotFoundException(`Provedor desconhecido: ${providerId}`);

    let resolved: ResolvedProvider;
    if (dto?.apiKey) {
      const model = dto.model || def.defaultModel;
      if (!model) {
        throw new BadRequestException(`Defina um modelo para o provedor "${def.name}".`);
      }
      resolved = this.makeProvider(
        def,
        dto.apiKey,
        dto.baseUrl || def.baseUrl,
        model,
        tenantId,
      );
    } else {
      resolved = await this.resolve(tenantId, providerId);
    }

    const result = await resolved.provider.testConnection();
    return { ...result, providerId: resolved.providerId, model: resolved.model };
  }

  async listModels(tenantId: string, providerId: string) {
    const resolved = await this.resolve(tenantId, providerId);
    return resolved.provider.listModels();
  }
}
