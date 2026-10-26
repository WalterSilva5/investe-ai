import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="layout">
      <aside class="sidebar">
        <div class="logo">wsi<span>-invest-ai</span></div>
        <a routerLink="/app/overview" routerLinkActive="active">Visão geral</a>
        <a routerLink="/app/chat" routerLinkActive="active">Chat / análise</a>
        <a routerLink="/app/settings" routerLinkActive="active">Provedores de IA</a>
        <div class="spacer"></div>
        <div class="who">{{ auth.user()?.email }}</div>
        <a href="javascript:void(0)" (click)="logout()">Sair</a>
      </aside>
      <main class="content">
        <router-outlet />
      </main>
    </div>
  `,
})
export class ShellComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
