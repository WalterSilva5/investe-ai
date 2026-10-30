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
        <a routerLink="/app/portfolio" routerLinkActive="active">Carteira</a>
        <a routerLink="/app/analysis" routerLinkActive="active">Análise</a>
        <a routerLink="/app/fixed-income" routerLinkActive="active">Renda fixa</a>
        <a routerLink="/app/alerts" routerLinkActive="active">Alertas</a>
        <a routerLink="/app/chat" routerLinkActive="active">Chat / análise</a>
        <a routerLink="/app/notes" routerLinkActive="active">Notas</a>
        <a routerLink="/app/memories" routerLinkActive="active">Memórias</a>
        <a routerLink="/app/security" routerLinkActive="active">Segurança</a>
        <a routerLink="/app/admin" routerLinkActive="active">Admin</a>
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
