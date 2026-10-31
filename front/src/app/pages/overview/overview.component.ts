import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Insight, InsightsService } from '../../core/insights.service';

interface Provider {
  id: string;
  name: string;
  configured: boolean;
  model: string;
}

interface AiUsage {
  quota: number;
  used: number;
  remaining: number;
  percent: number;
  unlimited: boolean;
}

interface FxQuote {
  pair: string;
  code: string;
  codein: string;
  bid: number;
  ask: number;
  pctChange: number;
  name: string;
}

interface GoldData {
  price?: number;
  currency?: string;
  brl?: number;
  name?: string;
}

interface International {
  fx: { available: boolean; rates: FxQuote[] };
  gold: GoldData;
}

@Component({
  selector: 'app-overview',
  imports: [RouterLink, DatePipe],
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
        <h3>Uso de IA no mês</h3>
        <div class="value">{{ usageLabel() }}</div>
        <div class="hint">{{ usageHint() }}</div>
      </div>
      <div class="card">
        <h3>Insights não lidos</h3>
        <div class="value">{{ insights.unread() }}</div>
        <div class="hint">dicas de IA geradas por notícias e métricas</div>
      </div>
    </div>

    <section class="section">
      <h2>Mercado</h2>
      <div class="cards">
        @for (rate of fxRates(); track rate.pair) {
          <div class="card">
            <h3>{{ rate.pair }}</h3>
            <div class="value">R$ {{ rate.bid.toFixed(2) }}</div>
            <div class="hint {{ rate.pctChange >= 0 ? 'up' : 'down' }}">
              {{ rate.pctChange >= 0 ? '+' : '' }}{{ rate.pctChange.toFixed(2) }}%
            </div>
          </div>
        }
        @if (gold().price) {
          <div class="card">
            <h3>Ouro (XAU)</h3>
            <div class="value">US$ {{ gold().price!.toFixed(0) }}</div>
            <div class="hint">≈ R$ {{ gold().brl?.toFixed(0) || '—' }}</div>
          </div>
        }
      </div>
    </section>

    <section class="section">
      <div class="insights-head">
        <div>
          <h2>Insights de IA</h2>
          <p class="muted small">
            Dicas geradas a partir de notícias, indicadores (Selic, IPCA, CDI) e da sua carteira.
            Conteúdo educacional — não é recomendação de investimento.
          </p>
        </div>
        <div class="insights-actions">
          <a routerLink="/app/insights" class="btn secondary">Ver todos</a>
          <button class="btn" (click)="refreshInsights()" [disabled]="refreshing()">
            {{ refreshing() ? 'Gerando…' : 'Atualizar agora' }}
          </button>
        </div>
      </div>

      @if (latest().length === 0) {
        <div class="row">
          <div>
            <div class="name">Nenhum insight ainda</div>
            <div class="meta">Configure um provedor de IA e clique em "Atualizar agora".</div>
          </div>
        </div>
      } @else {
        <div class="list">
          @for (insight of latest(); track insight.id) {
            <div class="insight">
              <div class="insight-top">
                <span class="badge {{ categoryClass(insight.category) }}">
                  {{ categoryLabel(insight.category) }}
                </span>
                <span class="muted small">{{ insight.generatedAt | date: 'dd/MM/yyyy HH:mm' }}</span>
              </div>
              <div class="insight-title">{{ insight.title }}</div>
              <div class="insight-body">{{ insight.content }}</div>
            </div>
          }
        </div>
      }

      @if (refreshError()) {
        <div class="alert error">{{ refreshError() }}</div>
      }
    </section>

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
  readonly insights = inject(InsightsService);

  readonly providers = signal<Provider[]>([]);
  readonly configured = signal(0);
  readonly usage = signal<AiUsage | null>(null);
  readonly latestInsights = signal<Insight[]>([]);
  readonly refreshing = signal(false);
  readonly refreshError = signal<string | null>(null);
  readonly international = signal<International | null>(null);

  constructor() {
    this.api.get<Provider[]>('/ai/providers').subscribe({
      next: (items) => {
        this.providers.set(items);
        this.configured.set(items.filter((p) => p.configured).length);
      },
    });
    this.api.get<AiUsage>('/ai/usage').subscribe({
      next: (usage) => this.usage.set(usage),
    });
    this.api.get<International>('/market/international').subscribe({
      next: (data) => this.international.set(data),
    });
    this.loadInsights();
    this.insights.refreshUnread();
  }

  tenantName(): string {
    return this.auth.memberships()[0]?.tenant?.name || '—';
  }

  usageLabel(): string {
    const usage = this.usage();
    if (!usage) return '—';
    return usage.unlimited ? '∞' : `${usage.percent.toFixed(0)}%`;
  }

  usageHint(): string {
    const usage = this.usage();
    if (!usage) return 'carregando';
    if (usage.unlimited) return 'sem limite configurado';
    return `${usage.used} / ${usage.quota} tokens`;
  }

  loadInsights() {
    this.insights.load().subscribe({
      next: (items) => this.latestInsights.set(items),
    });
  }

  latest(): Insight[] {
    return this.latestInsights().slice(0, 3);
  }

  fxRates(): FxQuote[] {
    return this.international()?.fx?.rates || [];
  }

  gold(): GoldData {
    return this.international()?.gold || {};
  }

  refreshInsights() {
    this.refreshing.set(true);
    this.refreshError.set(null);
    this.insights.refresh().subscribe({
      next: () => {
        this.refreshing.set(false);
        this.loadInsights();
        this.insights.refreshUnread();
      },
      error: (err) => {
        this.refreshing.set(false);
        this.refreshError.set(
          err?.error?.message || 'Não foi possível gerar. Verifique o provedor de IA.',
        );
      },
    });
  }

  categoryLabel(category: string): string {
    const labels: Record<string, string> = {
      MACRO: 'Macro',
      RENDA_FIXA: 'Renda fixa',
      ACOES: 'Ações',
      CRIPTO: 'Cripto',
      CARTEIRA: 'Carteira',
      GERAL: 'Geral',
    };
    return labels[category] || 'Geral';
  }

  categoryClass(category: string): string {
    return 'cat-' + (category || 'GERAL').toLowerCase();
  }
}
