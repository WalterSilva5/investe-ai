import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Insight, InsightsService } from '../../core/insights.service';

interface Category {
  key: string;
  label: string;
}

const CATEGORIES: Category[] = [
  { key: '', label: 'Todos' },
  { key: 'MACRO', label: 'Macro' },
  { key: 'RENDA_FIXA', label: 'Renda fixa' },
  { key: 'ACOES', label: 'Ações' },
  { key: 'CRIPTO', label: 'Cripto' },
  { key: 'CARTEIRA', label: 'Carteira' },
  { key: 'GERAL', label: 'Geral' },
];

@Component({
  selector: 'app-insights',
  imports: [DatePipe],
  template: `
    <h1 class="page-title">Insights de IA</h1>
    <p class="page-sub">
      Dicas geradas a partir de notícias, indicadores (Selic, IPCA, CDI) e da sua carteira.
      Conteúdo educacional — não é recomendação de investimento.
    </p>

    <div class="insights-toolbar">
      <div class="chips">
        @for (category of categories; track category.key) {
          <button
            class="chip"
            [class.active]="filter() === category.key"
            (click)="setFilter(category.key)"
          >
            {{ category.label }}
          </button>
        }
      </div>
      <div class="insights-actions">
        <button class="btn secondary" (click)="markAllRead()">Marcar todas como lidas</button>
        <button class="btn" (click)="refresh()" [disabled]="refreshing()">
          {{ refreshing() ? 'Gerando…' : 'Atualizar agora' }}
        </button>
      </div>
    </div>

    @if (error()) {
      <div class="alert error">{{ error() }}</div>
    }

    @if (loading()) {
      <div class="muted">Carregando…</div>
    } @else if (filtered().length === 0) {
      <div class="row">
        <div>
          <div class="name">Nenhum insight</div>
          <div class="meta">
            {{ filter() ? 'Nenhum nesta categoria.' : 'Clique em "Atualizar agora" para gerar (exige provedor de IA).' }}
          </div>
        </div>
      </div>
    } @else {
      <div class="list">
        @for (insight of filtered(); track insight.id) {
          <div class="insight" [class.unread]="!insight.isRead">
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
  `,
})
export class InsightsComponent {
  readonly service = inject(InsightsService);

  readonly categories = CATEGORIES;
  readonly insights = signal<Insight[]>([]);
  readonly loading = signal(true);
  readonly refreshing = signal(false);
  readonly error = signal<string | null>(null);
  readonly filter = signal('');

  constructor() {
    this.load();
    this.service.refreshUnread();
  }

  load() {
    this.loading.set(true);
    this.service.load().subscribe({
      next: (items) => {
        this.insights.set(items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  setFilter(key: string) {
    this.filter.set(key);
  }

  filtered(): Insight[] {
    const current = this.filter();
    if (!current) return this.insights();
    return this.insights().filter((insight) => insight.category === current);
  }

  refresh() {
    this.refreshing.set(true);
    this.error.set(null);
    this.service.refresh().subscribe({
      next: () => {
        this.refreshing.set(false);
        this.load();
        this.service.refreshUnread();
      },
      error: (err) => {
        this.refreshing.set(false);
        this.error.set(err?.error?.message || 'Não foi possível gerar.');
      },
    });
  }

  markAllRead() {
    this.service.markAllRead().subscribe({
      next: () => {
        this.load();
        this.service.refreshUnread();
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
