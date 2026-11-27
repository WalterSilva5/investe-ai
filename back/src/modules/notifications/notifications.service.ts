import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateNotification {
  kind: string;
  title: string;
  body: string;
  url?: string;
  dedupeKey: string;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cria (idempotente por dedupeKey) uma notificação. Sinais "quentes" do
   * mesmo tema no mesmo dia não se repetem — evita spam no mesmo assunto.
   */
  async notify(tenantId: string, notification: CreateNotification) {
    const day = new Date().toISOString().slice(0, 10);
    const dedupeKey = `${notification.dedupeKey}:${day}`;
    return this.prisma.notification.upsert({
      where: { tenantId_dedupeKey: { tenantId, dedupeKey } },
      create: {
        tenantId,
        kind: notification.kind,
        title: notification.title,
        body: notification.body,
        url: notification.url,
        dedupeKey,
      },
      update: {},
    });
  }

  list(tenantId: string, take = 30) {
    return this.prisma.notification.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(take, 1), 60),
    });
  }

  async unreadCount(tenantId: string) {
    const unread = await this.prisma.notification.count({
      where: { tenantId, read: false },
    });
    return { unread };
  }

  async markRead(tenantId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: { id, tenantId },
      data: { read: true },
    });
    return { ok: true };
  }

  async markAllRead(tenantId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { tenantId, read: false },
      data: { read: true },
    });
    return { ok: true, updated: result.count };
  }
}
