import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { InsightsService } from '../../core/insights.service';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule],
  template: `
    <div class="layout">
      <aside class="sidebar">
        <div class="logo">wsi<span>-invest-ai</span></div>

        <div class="workspace">
          <select
            class="input"
            style="background:#1d2939;color:#d0d5dd;border-color:#344054"
            [value]="auth.tenantId() || ''"
            (change)="onWorkspaceChange($event)"
            title="Workspace ativo"
          >
            @for (member of auth.memberships(); track member.tenantId) {
              <option [value]="member.tenantId">
                {{ member.tenant.kind === 'COMPANY' ? '🏢' : '🏠' }} {{ member.tenant.name }}
              </option>
            }
          </select>
          <button class="workspace-add" (click)="showCompanyForm.set(!showCompanyForm())">+ empresa</button>
        </div>

        @if (showCompanyForm()) {
          <div class="company-form">
            <input class="input" style="background:#1d2939;color:#d0d5dd;border-color:#344054"
              [(ngModel)]="companyName" placeholder="Nome da empresa" />
            <input class="input" style="background:#1d2939;color:#d0d5dd;border-color:#344054"
              [(ngModel)]="companyCnpj" placeholder="CNPJ (opcional)" />
            @if (companyError()) {
              <div class="small" style="color:#f97066">{{ companyError() }}</div>
            }
            <button class="btn" style="width:100%" [disabled]="!companyName.trim() || creating()" (click)="createCompany()">
              {{ creating() ? 'Criando…' : 'Criar empresa' }}
            </button>
          </div>
        }

        <a routerLink="/app/overview" routerLinkActive="active">Visão geral</a>
        <a routerLink="/app/insights" routerLinkActive="active">
          Insights de IA
          @if (insights.unread() > 0) {
            <span class="nav-badge">{{ insights.unread() }}</span>
          }
        </a>
        <a routerLink="/app/opportunities" routerLinkActive="active">Radar de oportunidades</a>
        <a routerLink="/app/business" routerLinkActive="active">Oportunidades de negócio</a>
        <a routerLink="/app/portfolio" routerLinkActive="active">Carteira</a>
        <a routerLink="/app/banking" routerLinkActive="active">Extratos</a>
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
  readonly insights = inject(InsightsService);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly showCompanyForm = signal(false);
  readonly creating = signal(false);
  readonly companyError = signal<string | null>(null);
  companyName = '';
  companyCnpj = '';

  constructor() {
    this.insights.refreshUnread();
  }

  onWorkspaceChange(event: Event) {
    const id = (event.target as HTMLSelectElement).value;
    if (id && id !== this.auth.tenantId()) {
      this.auth.selectTenant(id);
      window.location.reload();
    }
  }

  createCompany() {
    if (!this.companyName.trim()) return;
    this.creating.set(true);
    this.companyError.set(null);
    this.api
      .post<{ id: string }>('/tenants', {
        name: this.companyName.trim(),
        cnpj: this.companyCnpj.trim() || undefined,
        kind: 'COMPANY',
      })
      .subscribe({
        next: (tenant) => {
          this.auth.selectTenant(tenant.id);
          window.location.reload();
        },
        error: (err) => {
          this.creating.set(false);
          this.companyError.set(err?.error?.message || 'Falha ao criar a empresa.');
        },
      });
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
