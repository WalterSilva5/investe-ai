import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import * as argon2 from 'argon2';
import { generateSecret, generateURI, verify } from 'otplib';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new ConflictException('E-mail já cadastrado.');

    const passwordHash = await argon2.hash(dto.password);
    const tenantName = dto.name?.trim() || email.split('@')[0];
    const slug = await this.uniqueSlug(tenantName);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { email, passwordHash, name: dto.name?.trim() },
      });
      const tenant = await tx.tenant.create({
        data: { name: tenantName, slug },
      });
      await tx.membership.create({
        data: { userId: created.id, tenantId: tenant.id, role: 'OWNER' },
      });
      return created;
    });

    const tokens = await this.issueTokens(user.id, user.email);
    return { user: this.publicUser(user), ...tokens };
  }

  async login(dto: LoginDto) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }
    const ok = await argon2.verify(user.passwordHash, dto.password);
    if (!ok) throw new UnauthorizedException('Credenciais inválidas.');

    if (user.twoFactorEnabled) {
      const valid = dto.twoFactorCode
        ? await verify({ token: dto.twoFactorCode, secret: user.twoFactorSecret || '' })
        : false;
      if (!valid) {
        throw new UnauthorizedException('Código 2FA inválido ou ausente.');
      }
    }

    const tokens = await this.issueTokens(user.id, user.email);
    return { user: this.publicUser(user), ...tokens };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: { sub: string; email: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido.');
    }

    const hash = this.hash(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hash },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token inválido.');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(payload.sub, payload.email);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: {
            tenant: {
              select: { id: true, name: true, slug: true, plan: true, kind: true, cnpj: true },
            },
          },
        },
      },
    });
    if (!user) throw new UnauthorizedException('Usuário não encontrado.');
    return {
      ...this.publicUser(user),
      twoFactorEnabled: user.twoFactorEnabled,
      memberships: user.memberships,
    };
  }

  async logout(refreshToken: string) {
    const hash = this.hash(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  async setup2FA(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Usuário não encontrado.');
    const secret = generateSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret },
    });
    return {
      secret,
      otpauthUrl: generateURI({ secret, label: user.email, issuer: 'wsi-invest-ai' }),
    };
  }

  async confirm2FA(userId: string, code: string) {
    if (!/^\d{6}$/.test(code || '')) {
      throw new UnauthorizedException('Código 2FA inválido.');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.twoFactorSecret) throw new UnauthorizedException('2FA não iniciado.');
    if (!(await verify({ token: code, secret: user.twoFactorSecret }))) {
      throw new UnauthorizedException('Código 2FA inválido.');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });
    return { ok: true };
  }

  async disable2FA(userId: string, code: string) {
    if (!/^\d{6}$/.test(code || '')) {
      throw new UnauthorizedException('Código 2FA inválido.');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.twoFactorSecret) throw new UnauthorizedException('2FA não está ativo.');
    if (!(await verify({ token: code, secret: user.twoFactorSecret }))) {
      throw new UnauthorizedException('Código 2FA inválido.');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });
    return { ok: true };
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash) throw new UnauthorizedException('Usuário não encontrado.');
    const ok = await argon2.verify(user.passwordHash, oldPassword);
    if (!ok) throw new UnauthorizedException('Senha atual incorreta.');
    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      this.prisma.refreshToken.updateMany({
        where: { userId },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { ok: true };
  }

  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (user) {
      const raw = randomBytes(32).toString('hex');
      await this.prisma.token.create({
        data: {
          userId: user.id,
          type: 'RESET_PASSWORD',
          tokenHash: this.hash(raw),
          expiresAt: new Date(Date.now() + 3_600_000),
        },
      });
      const link = `${this.config.get('FRONTEND_URL') || 'http://localhost:4200'}/reset?token=${raw}`;
      this.logger.log(`Reset de senha (${user.email}): ${link}`);
    }
    return { ok: true };
  }

  async resetPassword(token: string, newPassword: string) {
    const hash = this.hash(token);
    const stored = await this.prisma.token.findUnique({ where: { tokenHash: hash } });
    if (
      !stored ||
      stored.consumedAt ||
      stored.expiresAt < new Date() ||
      stored.type !== 'RESET_PASSWORD'
    ) {
      throw new UnauthorizedException('Token inválido ou expirado.');
    }
    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: stored.userId }, data: { passwordHash } }),
      this.prisma.token.update({ where: { id: stored.id }, data: { consumedAt: new Date() } }),
      this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { ok: true };
  }

  /** Usado pelo login Google. */
  async findOrCreateGoogleUser(input: {
    email: string;
    name?: string;
    googleId: string;
  }) {
    const email = input.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (!existing.googleId) {
        await this.prisma.user.update({
          where: { id: existing.id },
          data: { googleId: input.googleId },
        });
      }
      return existing;
    }

    const tenantName = input.name?.trim() || email.split('@')[0];
    const slug = await this.uniqueSlug(tenantName);
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          name: input.name,
          googleId: input.googleId,
          emailVerifiedAt: new Date(),
        },
      });
      const tenant = await tx.tenant.create({ data: { name: tenantName, slug } });
      await tx.membership.create({
        data: { userId: created.id, tenantId: tenant.id, role: 'OWNER' },
      });
      return created;
    });
  }

  async issueTokens(userId: string, email: string): Promise<TokenPair> {
    const payload = { sub: userId, email, jti: randomUUID() };
    const accessTtl = (this.config.get<string>('JWT_ACCESS_TTL') || '15m') as any;
    const refreshTtl = (this.config.get<string>('JWT_REFRESH_TTL') || '7d') as any;
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: accessTtl,
    });
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: refreshTtl,
    });

    const decoded = this.jwt.decode(refreshToken) as { exp: number };
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hash(refreshToken),
        expiresAt: new Date(decoded.exp * 1000),
      },
    });

    return { accessToken, refreshToken };
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private publicUser(user: { id: string; email: string; name: string | null }) {
    return { id: user.id, email: user.email, name: user.name };
  }

  private async uniqueSlug(base: string): Promise<string> {
    const normalized = base
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 40) || 'workspace';

    for (let i = 0; i < 5; i += 1) {
      const slug = i === 0 ? normalized : `${normalized}-${randomBytes(3).toString('hex')}`;
      const exists = await this.prisma.tenant.findUnique({ where: { slug } });
      if (!exists) return slug;
    }
    return `${normalized}-${randomBytes(6).toString('hex')}`;
  }
}
