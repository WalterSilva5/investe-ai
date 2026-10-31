import { DatePipe } from '@angular/common';
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

interface AiUsage {
  quota: number;
  used: number;
  remaining: number;
  percent: number;
  unlimited: boolean;
}

interface InsightSource {
  title: string;
  url: string;
  source?: string;
}

interface Insight {
  id: string;
  category: string;
  title: string;
  content: string;
  sources?: InsightSource[] | null;
  generatedAt: string;
  isRead: boolean;
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
        <h3>Próxima fase</h3>
        <div class="value">Insights</div>
        <div class="hint">dicas geradas por IA com notícias e métricas</div>
      </div>
    </div>

    <section class="section">
      <div class="insights-head">
        <div>
          <h2>Insights de IA</h2>
          <p class="muted small">
            Gerados a partir de notícias, indicadores (Selic, IPCA, CDI) e da sua carteira.
            Conteúdo educacional — não é recomendação de investimento.
          </p>
        </div>
        <button class="btn secondary" (click)="refreshInsights()" [disabled]="refreshing()">
          {{ refreshing() ? 'Gerando…' : 'Atualizar agora' }}
        </button>
      </div>

      @if (insightsLoading()) {
        <div class="muted">Carregando…</div>
      } @else if (insights().length === 0) {
        <div class="row">
          <div>
            <div class="name">Nenhum insight ainda</div>
            <div class="meta">Clique em "Atualizar agora" para gerar (exige um provedor de IA configurado).</div>
          </div>
        </div>
      } @else {
        <div class="list">
          @for (insight of insights(); track insight.id) {
            <div class="insight">
              <div class="insight-top">
                <span class="badge {{ categoryClass(insight.category) }}">
                  {{ categoryLabel(insight.category) }}
                </span>
                <span class="muted small">{{ insight.generatedAt | date: 'dd/MM/yyyy HH:mm' }}</span>
              </div>
              <div class="insight-title">{{ insight.title }}</div>
              <div class="insight-body">{{ insight.content }}</div>
              @if (insight.sources?.length) {
                <div class="insight-sources">
                  <span class="muted small">Fontes:</span>
                  @for (source of insight.sources; track source.url) {
                    <a [href]="source.url" target="_blank" rel="noopener">
                      {{ source.source || source.title }}
                    </a>
                  }
                </div>
              }
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

  readonly providers = signal<Provider[]>([]);
  readonly configured = signal(0);
  readonly usage = signal<AiUsage | null>(null);

  readonly insights = signal<Insight[]>([]);
  readonly insightsLoading = signal(true);
  readonly refreshing = signal(false);
  readonly refreshError = signal<string | null>(null);

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
    this.loadInsights();
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
    this.insightsLoading.set(true);
    this.api.get<Insight[]>('/insights').subscribe({
      next: (items) => {
        this.insights.set(items);
        this.insightsLoading.set(false);
      },
      error: () => this.insightsLoading.set(false),
    });
  }

  refreshInsights() {
    this.refreshing.set(true);
    this.refreshError.set(null);
    this.api.post<{ generated: number }>('/insights/refresh', {}).subscribe({
      next: () => {
        this.refreshing.set(false);
        this.loadInsights();
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
