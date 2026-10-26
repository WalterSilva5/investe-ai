import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';

interface Provider {
  id: string;
  name: string;
  configured: boolean;
  model: string;
}

@Component({
  selector: 'app-overview',
  imports: [RouterLink],
  template: `
    <h1 class="page-title">Visão geral</h1>
    <p class="page-sub">Seu espaço de análise financeira. Comece pela carteira e pelo provedor de IA.</p>

    <div class="cards">
      <div class="card">
        <h3>Workspace</h3>
        <div class="value">{{ tenantName() }}</div>
        <div class="hint">Tenant ativo</div>
      </div>
      <div class="card">
        <h3>Provedores configurados</h3>
        <div class="value">{{ configured() }} / {{ providers().length }}</div>
        <div class="hint">OpenCode é o padrão inicial</div>
      </div>
      <div class="card">
        <h3>Próxima fase</h3>
        <div class="value">Alertas</div>
        <div class="hint">alertas, relatórios e importação</div>
      </div>
    </div>

    <section class="section">
      <h2>Comece por aqui</h2>
      <div class="list">
        <div class="row">
          <div>
            <div class="name">1. Configure um provedor</div>
            <div class="meta">Adicione sua chave do OpenCode ou de outro provedor.</div>
          </div>
          <a routerLink="/app/settings" class="btn secondary">Configurar</a>
        </div>
        <div class="row">
          <div>
            <div class="name">2. Converse com o agente</div>
            <div class="meta">Peça explicações e comparações. Sem recomendação de compra/venda.</div>
          </div>
          <a routerLink="/app/chat" class="btn secondary">Abrir chat</a>
        </div>
        <div class="row">
          <div>
            <div class="name">3. Cadastre sua carteira</div>
            <div class="meta">Ativos, transações, posições e alocação.</div>
          </div>
          <a routerLink="/app/portfolio" class="btn secondary">Abrir carteira</a>
        </div>
        <div class="row">
          <div>
            <div class="name">4. Compare renda fixa</div>
            <div class="meta">CDB, LCI/LCA e Tesouro com IR e isenções.</div>
          </div>
          <a routerLink="/app/fixed-income" class="btn secondary">Comparar</a>
        </div>
      </div>
    </section>
  `,
})
export class OverviewComponent {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);

  readonly providers = signal<Provider[]>([]);
  readonly configured = signal(0);

  constructor() {
    this.api.get<Provider[]>('/ai/providers').subscribe({
      next: (items) => {
        this.providers.set(items);
        this.configured.set(items.filter((p) => p.configured).length);
      },
    });
  }

  tenantName(): string {
    return this.auth.memberships()[0]?.tenant?.name || '—';
  }
}
