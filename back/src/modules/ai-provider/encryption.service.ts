import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

export interface EncryptedValue {
  encryptedKey: string;
  iv: string;
  authTag: string;
}

/**
 * AES-256-GCM para chaves de provedores.
 *
 * `AI_ENCRYPTION_KEY` deve ter 32 bytes (base64 ou hex).
 * Em desenvolvimento, se ausente, deriva de `JWT_ACCESS_SECRET` com aviso.
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const raw = config.get<string>('AI_ENCRYPTION_KEY') || '';
    this.key = this.resolveKey(raw, config);
  }

  encrypt(plain: string): EncryptedValue {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return {
      encryptedKey: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
    };
  }

  decrypt(value: EncryptedValue): string {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key,
      Buffer.from(value.iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(value.authTag, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(value.encryptedKey, 'base64')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }

  private resolveKey(raw: string, config: ConfigService): Buffer {
    if (raw) {
      const base64 = Buffer.from(raw, 'base64');
      if (base64.length === 32) return base64;
      const hex = Buffer.from(raw, 'hex');
      if (hex.length === 32) return hex;
      this.logger.warn('AI_ENCRYPTION_KEY inválida (use 32 bytes em base64/hex).');
    }

    if (config.get<string>('NODE_ENV') === 'production') {
      throw new Error(
        'AI_ENCRYPTION_KEY ausente/inválida: defina uma chave de 32 bytes (base64/hex) via env.',
      );
    }

    const fallback = config.get<string>('JWT_ACCESS_SECRET') || 'dev-only';
    this.logger.warn(
      'AI_ENCRYPTION_KEY ausente: usando derivação de desenvolvimento (não use em produção).',
    );
    return createHash('sha256').update(fallback).digest();
  }
}
