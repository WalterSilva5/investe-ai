import { SlicePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api.service';

interface Overview {
  counts: { users: number; tenants: number; portfolios: number; transactions: number };
  aiUsage: { tokensIn: number; tokensOut: number; cost: number };
  recentAudits: Array<{
    id: string;
    action: string;
    entity?: string;
    createdAt: string;
    tenantId: string;
  }>;
}

interface AdminUser {
  id: string;
  email: string;
  name?: string;
  status: string;
  createdAt: string;
  tokensThisMonth: number;
  memberships: Array<{ role: string; tenant: { id: string; name: string } }>;
}

interface UsageRow {
  tenantId: string;
  tenantName: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
}

@Component({
  selector: 'app-admin',
  imports: [SlicePipe],
  template: `
    <h1 class="page-title">Admin</h1>
    <p class="page-sub">Visão geral de usuários, tenants e uso de IA.</p>

    @if (error()) {
      <div class="alert error">{{ error() }}</div>
    }

    @if (overview(); as o) {
      <div class="cards">
        <div class="card">
          <h3>Usuários</h3>
          <div class="value">{{ o.counts.users }}</div>
        </div>
        <div class="card">
          <h3>Tenants</h3>
          <div class="value">{{ o.counts.tenants }}</div>
        </div>
        <div class="card">
          <h3>Carteiras</h3>
          <div class="value">{{ o.counts.portfolios }}</div>
        </div>
        <div class="card">
          <h3>Transações</h3>
          <div class="value">{{ o.counts.transactions }}</div>
        </div>
        <div class="card">
          <h3>Tokens de IA (mês)</h3>
          <div class="value">{{ o.aiUsage.tokensIn + o.aiUsage.tokensOut }}</div>
          <div class="hint">in {{ o.aiUsage.tokensIn }} · out {{ o.aiUsage.tokensOut }}</div>
        </div>
      </div>

      <section class="section">
        <h2>Usuários</h2>
        <div class="card" style="padding:0;overflow:auto">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="text-align:left;background:#f9fafb">
                <th style="padding:10px 12px">E-mail</th>
                <th style="padding:10px 12px">Nome</th>
                <th style="padding:10px 12px">Tenant</th>
                <th style="padding:10px 12px">Papel</th>
                <th style="padding:10px 12px">Tokens/mês</th>
                <th style="padding:10px 12px">Criado</th>
              </tr>
            </thead>
            <tbody>
              @for (user of users(); track user.id) {
                <tr style="border-top:1px solid var(--border)">
                  <td style="padding:9px 12px">{{ user.email }}</td>
                  <td style="padding:9px 12px">{{ user.name || '—' }}</td>
                  <td style="padding:9px 12px">{{ user.memberships[0]?.tenant?.name || '—' }}</td>
                  <td style="padding:9px 12px">{{ user.memberships[0]?.role || '—' }}</td>
                  <td style="padding:9px 12px">{{ user.tokensThisMonth }}</td>
                  <td style="padding:9px 12px">{{ user.createdAt | slice:0:10 }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <div class="grid-2" style="margin-top:20px">
        <section class="card">
          <h3>Uso de IA por tenant (mês)</h3>
          <div class="list" style="margin-top:10px">
            @for (row of usage(); track row.tenantId) {
              <div class="row">
                <div>
                  <div class="name">{{ row.tenantName }}</div>
                  <div class="meta">in {{ row.tokensIn }} · out {{ row.tokensOut }}</div>
                </div>
                <strong>{{ row.tokensIn + row.tokensOut }}</strong>
              </div>
            } @empty {
              <p class="muted small">Sem uso no mês.</p>
            }
          </div>
        </section>

        <section class="card">
          <h3>Auditoria recente</h3>
          <div class="list" style="margin-top:10px">
            @for (event of o.recentAudits; track event.id) {
              <div class="row">
                <div>
                  <div class="name">{{ event.action }}</div>
                  <div class="meta">{{ event.entity || '—' }} · {{ event.createdAt | slice:0:16 }}</div>
                </div>
              </div>
            } @empty {
              <p class="muted small">Sem eventos.</p>
            }
          </div>
        </section>
      </div>
    } @else if (!error()) {
      <p class="muted">Carregando…</p>
    }
  `,
})
export class AdminComponent {
  private readonly api = inject(ApiService);

  readonly overview = signal<Overview | null>(null);
  readonly users = signal<AdminUser[]>([]);
  readonly usage = signal<UsageRow[]>([]);
  readonly error = signal<string | null>(null);

  constructor() {
    this.api.get<Overview>('/admin/overview').subscribe({
      next: (overview) => this.overview.set(overview),
      error: (err) => this.fail(err),
    });
    this.api.get<AdminUser[]>('/admin/users').subscribe({
      next: (users) => this.users.set(users),
      error: (err) => this.fail(err),
    });
    this.api.get<UsageRow[]>('/admin/usage').subscribe({
      next: (usage) => this.usage.set(usage),
      error: (err) => this.fail(err),
    });
  }

  private fail(err: any) {
    this.error.set(
      err?.status === 403
        ? 'Acesso restrito. Defina ADMIN_EMAILS no .env e reinicie a API.'
        : err?.error?.message || 'Falha ao carregar o admin.',
    );
  }
}
