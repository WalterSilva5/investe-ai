import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';

export interface NotificationItem {
  id: string;
  kind: string;
  title: string;
  body: string;
  url?: string | null;
  read: boolean;
  createdAt: string;
}

/**
 * Centro de notificações: busca periódica, badge de não lidas e
 * notificação do navegador (Notification API) para itens "quentes" novos.
 */
@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly api = inject(ApiService);

  readonly items = signal<NotificationItem[]>([]);
  readonly unread = signal(0);

  private timer: ReturnType<typeof setInterval> | null = null;
  private lastNotifiedKey = localStorage.getItem('wsi.notifiedKey') || '';

  constructor() {
    this.load();
    this.startTimer();
  }

  load() {
    this.api.get<NotificationItem[]>('/notifications?take=30').subscribe({
      next: (items) => {
        this.items.set(items || []);
        this.unread.set((items || []).filter((item) => !item.read).length);
        this.browserNotify(items || []);
      },
      error: () => undefined,
    });
  }

  markRead(id: string) {
    this.api.post(`/notifications/${id}/read`, {}).subscribe({
      next: () => this.load(),
    });
  }

  markAllRead() {
    this.api.post('/notifications/read-all', {}).subscribe({
      next: () => this.load(),
    });
  }

  /** Pede permissão para notificações do navegador (bom cancelar o prompt se negado). */
  requestPermission() {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') this.browserNotify(this.items());
      });
    }
  }

  permission(): string {
    return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
  }

  private startTimer() {
    if (this.timer) return;
    this.timer = setInterval(() => this.load(), 120_000);
  }

  /**
   * Mostra notificação do navegador para itens não lidos mais novos que a
   * última marcação (evita repetir o mesmo aviso a cada poll).
   */
  private browserNotify(items: NotificationItem[]) {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const hot = items
      .filter((item) => !item.read && item.createdAt > this.lastNotifiedKey)
      .filter((item) => item.kind.startsWith('hot'))
      .slice(0, 3);
    for (const item of hot) {
      try {
        new Notification(item.title, { body: item.body });
      } catch {
        // alguns navegadores exigem service worker: ignora silenciosamente
      }
    }
    if (hot.length) {
      this.lastNotifiedKey = hot[0].createdAt;
      localStorage.setItem('wsi.notifiedKey', this.lastNotifiedKey);
    }
  }
}
