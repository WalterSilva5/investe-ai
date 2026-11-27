import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { BadgeModule } from 'primeng/badge';
import { NotificationsService } from '../core/notifications.service';

/**
 * Sino de notificações: badge de não lidas, painel com as oportunidades
 * quentes e opção de ativar notificações do navegador.
 */
@Component({
  selector: 'app-notifications-bell',
  imports: [DatePipe, RouterLink, ButtonModule, BadgeModule],
  template: `
    <div class="notif-wrap">
      <button class="notif-bell" type="button" (click)="toggle()" title="Notificações">
        <i class="pi pi-bell"></i>
        @if (notifications.unread() > 0) {
          <span class="notif-badge">{{ notifications.unread() > 9 ? '9+' : notifications.unread() }}</span>
        }
      </button>

      @if (open()) {
        <div class="notif-panel" role="dialog" aria-label="Notificações">
          <div class="notif-panel-head">
            <strong>Notificações</strong>
            <button class="notif-link" type="button" (click)="markAll()">marcar todas como lidas</button>
          </div>

          @if (notifications.permission() === 'default') {
            <div class="notif-permission">
              <span>Receber avisos do navegador quando surgir oportunidade quente?</span>
              <button class="notif-link" type="button" (click)="notifications.requestPermission()">
                ativar
              </button>
            </div>
          }

          <div class="notif-list">
            @for (item of notifications.items(); track item.id) {
              <div class="notif-item" [class.unread]="!item.read" (click)="openItem(item)">
                <div class="notif-title">{{ item.title }}</div>
                <div class="notif-body">{{ item.body }}</div>
                <div class="notif-time">{{ item.createdAt | date: 'dd/MM HH:mm' }}</div>
              </div>
            } @empty {
              <div class="notif-item muted">Sem notificações ainda. O radar avisa quando surgir algo quente.</div>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class NotificationsBellComponent {
  private readonly router = inject(Router);
  readonly notifications = inject(NotificationsService);
  readonly open = signal(false);

  toggle() {
    this.open.update((value) => !value);
    if (this.open()) this.notifications.load();
  }

  openItem(item: { id: string; url?: string | null }) {
    this.notifications.markRead(item.id);
    this.open.set(false);
    if (item.url) this.router.navigateByUrl(item.url);
  }

  markAll() {
    this.notifications.markAllRead();
  }
}
