import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Insight, InsightsService } from '../../core/insights.service';
import { AllocationDonutComponent } from '../../shared/charts/allocation-donut.component';

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

interface AllocationItem {
  type?: string;
  value: number;
  pct: number;
}

@Component({
  selector: 'app-overview',
  imports: [
    RouterLink,
    DatePipe,
    CardModule,
    ButtonModule,
    TagModule,
    SkeletonModule,
    AllocationDonutComponent,
  ],
  template: `
    <h1 class="page-title">Visão geral</h1>
    <p class="page-sub">Seu espaço de análise financeira. Comece pela carteira e pelo provedor de IA.</p>

    <div class="cards">
      <p-card header="Workspace">
        <div class="stat-value">{{ tenantName() }}</div>
        <div class="stat-hint">Tenant ativo · {{ workspaceCount() }} workspace(s)</div>
      </p-card>
      <p-card header="Provedores configurados">
        <div class="stat-value">{{ configured() }} / {{ providers().length }}</div>
        <div class="stat-hint">OpenCode é o padrão inicial</div>
      </p-card>
      <p-card header="Uso de IA no mês">
        <div class="stat-value">{{ usageLabel() }}</div>
        <div class="stat-hint">{{ usageHint() }}</div>
      </p-card>
      <p-card header="Insights não lidos">
        <div class="stat-value">{{ insights.unread() }}</div>
        <div class="stat-hint">dicas de IA por notícias e métricas</div>
      </p-card>
    </div>

    <section class="section">
      <h2>Mercado</h2>
      @if (!loadedMarket()) {
        <div class="cards">
          <p-skeleton width="100%" height="110px" />
          <p-skeleton width="100%" height="110px" />
          <p-skeleton width="100%" height="110px" />
        </div>
      } @else {
        <div class="cards">
          @for (rate of fxRates(); track rate.pair) {
            <p-card [header]="rate.pair">
              <div class="stat-value">R$ {{ rate.bid.toFixed(2) }}</div>
              <div class="stat-hint">
                <p-tag
                  [value]="(rate.pctChange >= 0 ? '+' : '') + rate.pctChange.toFixed(2) + '%'"
                  [severity]="rate.pctChange >= 0 ? 'success' : 'danger'"
                />
              </div>
            </p-card>
          }
          @if (gold().price) {
            <p-card header="Ouro (XAU)">
              <div class="stat-value">US$ {{ gold().price!.toFixed(0) }}</div>
              <div class="stat-hint">≈ R$ {{ gold().brl?.toFixed(0) || '—' }}</div>
            </p-card>
          }
        </div>
      }
    </section>

    @if (allocation().length) {
      <section class="section">
        <h2>Alocação da carteira</h2>
        <p-card styleClass="chart-card">
          <app-allocation-donut [data]="allocation()" title="Por tipo de ativo" />
          <div style="text-align:center;margin-top:4px">
            <a routerLink="/app/portfolio" class="small">Ver carteira</a>
          </div>
        </p-card>
      </section>
    }

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
          <p-button label="Ver todos" severity="secondary" [outlined]="true" routerLink="/app/insights" />
          <p-button
            label="Atualizar agora"
            [loading]="refreshing()"
            loadingIcon="pi pi-spin pi-spinner"
            (onClick)="refreshInsights()"
          />
        </div>
      </div>

      @if (latest().length === 0) {
        <p-card>
          <div class="name">Nenhum insight ainda</div>
          <div class="meta muted small">Configure um provedor de IA e clique em "Atualizar agora".</div>
        </p-card>
      } @else {
        <div class="list">
          @for (insight of latest(); track insight.id) {
            <p-card>
              <div class="insight-top">
                <p-tag [value]="categoryLabel(insight.category)" [severity]="categorySeverity(insight.category)" />
                <span class="muted small">{{ insight.generatedAt | date: 'dd/MM/yyyy HH:mm' }}</span>
              </div>
              <div class="insight-title" style="margin-top:8px">{{ insight.title }}</div>
              <div class="insight-body muted">{{ insight.content }}</div>
            </p-card>
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
          <p-button label="Configurar" severity="secondary" [outlined]="true" routerLink="/app/settings" />
        </div>
        <div class="row">
          <div>
            <div class="name">2. Converse com o agente</div>
            <div class="meta">Peça explicações e comparações. Sem recomendação de compra/venda.</div>
          </div>
          <p-button label="Abrir chat" severity="secondary" [outlined]="true" routerLink="/app/chat" />
        </div>
        <div class="row">
          <div>
            <div class="name">3. Cadastre sua carteira</div>
            <div class="meta">Ativos, transações, posições e alocação.</div>
          </div>
          <p-button label="Abrir carteira" severity="secondary" [outlined]="true" routerLink="/app/portfolio" />
        </div>
        <div class="row">
          <div>
            <div class="name">4. Compare renda fixa</div>
            <div class="meta">CDB, LCI/LCA e Tesouro com IR e isenções.</div>
          </div>
          <p-button label="Comparar" severity="secondary" [outlined]="true" routerLink="/app/fixed-income" />
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
  readonly loadedMarket = signal(false);
  readonly allocation = signal<Array<{ name: string; value: number }>>([]);

  readonly workspaceCount = computed(() => this.auth.memberships().length);

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
      next: (data) => {
        this.international.set(data);
        this.loadedMarket.set(true);
      },
      error: () => this.loadedMarket.set(true),
    });
    this.loadInsights();
    this.insights.refreshUnread();
    this.loadAllocation();
  }

  tenantName(): string {
    const current = this.auth.tenantId();
    const found = this.auth.memberships().find((m) => m.tenantId === current);
    return found?.tenant?.name || this.auth.memberships()[0]?.tenant?.name || '—';
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

  loadAllocation() {
    this.api.get<Array<{ id: string; isDefault: boolean }>>('/portfolios').subscribe({
      next: (list) => {
        const preferred = list.find((p) => p.isDefault) || list[0];
        if (!preferred) return;
        this.api
          .get<{ allocation: { byType: AllocationItem[] } }>(`/portfolios/${preferred.id}/summary`)
          .subscribe({
            next: (s) =>
              this.allocation.set(
                (s.allocation?.byType || []).map((a) => ({
                  name: this.typeLabel(a.type || ''),
                  value: a.pct,
                })),
              ),
          });
      },
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

  typeLabel(type: string): string {
    const labels: Record<string, string> = {
      STOCK: 'Ações',
      FII: 'FIIs',
      ETF: 'ETFs',
      FIXED_INCOME: 'Renda fixa',
      CRYPTO: 'Cripto',
      CASH: 'Caixa',
    };
    return labels[type] || type || 'Outros';
  }

  categoryLabel(category: string): string {
    const labels: Record<string, string> = {
      MACRO: 'Macro',
      RENDA_FIXA: 'Renda fixa',
      ACOES: 'Ações',
      CRIPTO: 'Cripto',
      CARTEIRA: 'Carteira',
      DIARIO: 'Diário',
      GERAL: 'Geral',
    };
    return labels[category] || 'Geral';
  }

  categorySeverity(category: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (category) {
      case 'MACRO':
      case 'DIARIO':
        return 'info';
      case 'RENDA_FIXA':
        return 'success';
      case 'ACOES':
        return 'danger';
      case 'CRIPTO':
        return 'warn';
      case 'CARTEIRA':
        return 'info';
      default:
        return 'secondary';
    }
  }
}
