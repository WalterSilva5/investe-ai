import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TableModule } from 'primeng/table';
import { ApiService } from '../../core/api.service';
import { PriceChartComponent } from '../../shared/charts/price-chart.component';

interface Indicators {
  symbol: string;
  currency: string;
  source: string;
  current: number;
  asOf: string;
  changed: Record<string, number | null>;
  min: number;
  max: number;
  ma20: number | null;
  ma50: number | null;
  vsMa20Pct: number | null;
  vsMa50Pct: number | null;
  rsi14: number | null;
  volatilityAnnualPct: number | null;
  supports: number[];
  resistances: number[];
  distSupportPct: number | null;
  distResistancePct: number | null;
  points: Array<{ date: string; close: number }>;
}

interface Outlook {
  symbol: string;
  currency: string;
  current: number;
  asOf: string;
  read: {
    trend: 'alta' | 'baixa' | 'lateral';
    score: number;
    label: 'Favorável' | 'Neutro' | 'Desfavorável';
    rsi14: number | null;
    volatility: number | null;
    target: number | null;
    stop: number | null;
    upsidePct: number | null;
    downsidePct: number | null;
    ratio: number | null;
  };
  bullets: string[];
  verdict?: {
    signal: 'Oportunidade' | 'Aguardar' | 'Evitar';
    headline: string;
    trigger: string;
    invalidation: string;
  };
  halving?: {
    appliesTo?: string;
    lastHalving: { date: string; daysAgo: number };
    nextHalving: { date: string; daysAhead: number; estimated: boolean };
    daysBeforeNext: number;
    phase: string;
    phaseNote: string;
    reference: Array<{
      halving: string;
      priceAtHalvingUsd: number;
      topUsdApprox: number | null;
      daysHalvingToTop: number | null;
      followingDrawdownPct: number | null;
    }>;
  } | null;
  pattern: {
    label: string;
    winRate10: number | null;
    avgReturn10: number | null;
    completed10: number;
    winRate20: number | null;
    avgReturn20: number | null;
    completed20: number;
  };
  calibration?: {
    rule: string | null;
    ruleLabel: string | null;
    direction: string | null;
    committed: number;
    hitRate: number | null;
    adjustment: number;
    learned: boolean;
  };
  disclaimer: string;
}

interface Position {
  symbol: string;
  name: string;
  currentValue: number;
  pnlPct: number;
}

const REFRESH_MS = 60_000;

@Component({
  selector: 'app-tracking',
  imports: [FormsModule, DatePipe, CardModule, ButtonModule, SelectModule, TagModule, TableModule, PriceChartComponent],
  template: `
    <h1 class="page-title">Tracking de ações</h1>
    <p class="page-sub">
      Tendência, médias, suportes/resistências e momentum num só gráfico. Atualiza sozinho a cada 60s
      (cotações de fechamento/intradiárias do provedor público — não é tick a tick).
    </p>

    <!-- Seletor: chips de troca rápida + busca de ticker novo -->
    <div class="track-picker">
      <div class="chips" style="margin-bottom:0">
        @for (option of watchOptions(); track option.symbol) {
          <button
            class="chip"
            [class.active]="symbol === option.symbol"
            (click)="switchTo(option.symbol)"
          >
            {{ option.symbol }}
          </button>
        }
      </div>
      <div class="track-search">
        <input
          class="input"
          [(ngModel)]="custom"
          placeholder="Buscar ticker…"
          (keyup.enter)="viewCustom()"
          (input)="onSearchInput($event)"
          [style.width.px]="searchWidth()"
        />
        @if (searchResults().length) {
          <div class="track-results">
            @for (result of searchResults(); track result.symbol) {
              <button class="track-result" (click)="selectFromSearch(result.symbol)">
                <strong>{{ result.symbol }}</strong>
                <span class="muted small">{{ result.name }}</span>
              </button>
            }
          </div>
        }
      </div>
    </div>

    <div class="toolbar">
      <div class="group">
        <p-select [options]="ranges" [(ngModel)]="range" (onChange)="load()" appendTo="body" styleClass="track-range" />
      </div>
      <div class="group">
        @if (data(); as d) {
          <span class="muted small">Atualizado {{ lastRefresh() | date: 'HH:mm:ss' }} · fonte {{ d.source }}</span>
        }
        <p-button
          [label]="auto() ? 'Auto 60s: ligado' : 'Auto 60s: desligado'"
          [severity]="auto() ? 'success' : 'secondary'"
          [outlined]="!auto()"
          size="small"
          (onClick)="toggleAuto()"
        />
        <p-button label="Atualizar" size="small" [loading]="loading()" (onClick)="load()" />
      </div>
    </div>

    @if (error()) {
      <div class="alert error">{{ error() }}</div>
    }

    @if (outlook(); as o) {
      <p-card styleClass="mt-card outlook-card">
        <div class="insights-head" style="margin-bottom:8px">
          <div>
            <h2 style="margin:0 0 2px;font-size:17px">Resumo e perspectiva — {{ o.symbol }}</h2>
            <p class="muted small" style="margin:0">
              Leitura do estado atual (tendência, momentum, níveis) e do histórico do padrão. Não é previsão.
            </p>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <p-tag [value]="'Tendência ' + o.read.trend" [severity]="trendSeverity(o.read.trend)" />
            <p-tag [value]="scoreText(o)" [severity]="scoreSeverity(o.read.score)" />
            @if (o.verdict) {
              <p-tag [value]="o.verdict.signal" [severity]="verdictSeverity(o.verdict.signal)" />
            }
          </div>
        </div>

        <div class="thermo-bar" style="margin-bottom:12px">
          <div class="thermo-fill" [style.width.%]="o.read.score"></div>
        </div>

        @if (o.verdict) {
          <div class="insight" style="margin-bottom:12px">
            <div class="insight-title">{{ o.verdict.headline }}</div>
            <div class="meta" style="margin-top:6px"><strong>Confirma se:</strong> {{ o.verdict.trigger }}</div>
            <div class="meta"><strong>Invalida se:</strong> {{ o.verdict.invalidation }}</div>
          </div>
        }

        <ul class="small" style="margin:0 0 12px;padding-left:20px">
          @for (line of o.bullets; track $index) {
            <li style="margin-bottom:3px">{{ line }}</li>
          }
        </ul>

        <div class="grid-2">
          <div class="thermo">
            <div class="thermo-head">
              <span><strong>Possibilidade de ganho</strong> até a resistência</span>
              <span class="badge {{ (o.read.upsidePct ?? 0) >= 0 ? 'read-bullish' : 'read-bearish' }}">
                {{ pct(o.read.upsidePct) }}
              </span>
            </div>
            <div class="thermo-head">
              <span>Risco até o suporte</span>
              <span class="badge read-bearish">−{{ o.read.downsidePct != null ? o.read.downsidePct.toFixed(2) : '—' }}%</span>
            </div>
            <div class="thermo-head">
              <span>Relação ganho/risco</span>
              <span class="badge {{ (o.read.ratio ?? 0) >= 1 ? 'read-bullish' : 'read-neutro' }}">
                {{ o.read.ratio != null ? o.read.ratio.toFixed(2) + ' : 1' : 'indefinida' }}
              </span>
            </div>
            <div class="hint">
              Alvo {{ o.read.target != null ? money(o.read.target) : '—' }} · piso
              {{ o.read.stop != null ? money(o.read.stop) : '—' }}
            </div>
          </div>

          <div class="thermo">
            <div class="thermo-head">
              <span><strong>Padrão que o papel vive agora</strong></span>
            </div>
            <div class="hint" style="margin-bottom:6px">{{ o.pattern.label }}</div>
            <div class="thermo-head">
              <span>Funcionou em +10 pregões</span>
              <span class="badge {{ (o.pattern.winRate10 ?? 0) >= 50 ? 'read-bullish' : 'read-neutro' }}">
                {{ o.pattern.winRate10 != null ? o.pattern.winRate10.toFixed(0) + '%' : '—' }}
                ({{ o.pattern.completed10 }} casos)
              </span>
            </div>
            <div class="thermo-head">
              <span>Retorno médio em +10 / +20</span>
              <span class="badge read-neutro">
                {{ pct(o.pattern.avgReturn10) }} / {{ pct(o.pattern.avgReturn20) }}
                ({{ o.pattern.completed20 }} casos em 20)
              </span>
            </div>
          </div>
        </div>

        <p class="disclaimer" style="margin-top:10px">{{ o.disclaimer }}</p>

        @if (o.halving) {
          <div class="insight" style="margin-top:12px">
            <div class="insight-top">
              <span class="badge mode-growth">Ciclo do halving</span>
              <span class="muted small">
                próximo halving: {{ o.halving.nextHalving.date }}
                {{ o.halving.nextHalving.estimated ? '(estimado)' : '' }}
              </span>
            </div>
            <div class="insight-title" style="margin-top:6px">
              {{ o.halving.phase }} — faltam ~{{ o.halving.daysBeforeNext }} dias
            </div>
            <div class="insight-body small">{{ o.halving.phaseNote }}</div>
            <p-table [value]="o.halving.reference" stripedRows size="small" styleClass="mt-2">
              <ng-template #header>
                <tr>
                  <th>Halving</th>
                  <th>Preço no halving</th>
                  <th>Topo aprox.</th>
                  <th>Dias até o topo</th>
                  <th>Queda seguinte</th>
                </tr>
              </ng-template>
              <ng-template #body let-row>
                <tr>
                  <td>{{ row.halving }}</td>
                  <td>{{ row.priceAtHalvingUsd ? 'US$ ' + row.priceAtHalvingUsd : '—' }}</td>
                  <td>{{ row.topUsdApprox ? 'US$ ' + row.topUsdApprox : 'em andamento' }}</td>
                  <td>{{ row.daysHalvingToTop ?? '—' }}</td>
                  <td>{{ row.followingDrawdownPct != null ? row.followingDrawdownPct + '%' : '—' }}</td>
                </tr>
              </ng-template>
            </p-table>
            <p class="disclaimer" style="margin-top:6px">
              Datas e preços históricos aproximados; o próximo halving é estimado (~210 mil blocos). Padrão observado
              não é garantia do próximo ciclo.
            </p>
          </div>
        }

        @if (o.calibration?.rule) {
          <div class="hint" style="margin-top:6px">
            <strong>Aprendizado:</strong>
            @if (o.calibration!.learned) {
              regra "{{ o.calibration!.ruleLabel }}" acerta {{ o.calibration!.hitRate }}% em
              {{ o.calibration!.committed }} casos avaliados — score ajustado em
              {{ o.calibration!.adjustment >= 0 ? '+' : '' }}{{ o.calibration!.adjustment }}
              (base {{ o.read.score - o.calibration!.adjustment }}).
            } @else {
              regra "{{ o.calibration!.ruleLabel }}" ainda em calibração
              ({{ o.calibration!.committed }}/6 casos avaliados) — score sem ajuste por enquanto.
            }
          </div>
        }
      </p-card>
    }

    @if (data(); as d) {
      <div class="cards">
        <p-card header="Preço">
          <div class="stat-value">{{ money(d.current) }}</div>
          <div class="stat-hint">
            <p-tag
              [value]="pct(d.changed['d1']) + ' no dia'"
              [severity]="(d.changed['d1'] ?? 0) >= 0 ? 'success' : 'danger'"
            />
            <span style="margin-left:6px">{{ d.asOf }}</span>
          </div>
        </p-card>
        <p-card header="RSI (14)">
          <div class="stat-value">{{ d.rsi14 ?? '—' }}</div>
          <div class="stat-hint">
            <p-tag [value]="rsiLabel(d.rsi14)" [severity]="rsiSeverity(d.rsi14)" />
          </div>
        </p-card>
        <p-card header="Médias">
          <div class="stat-value">{{ d.ma20 ? money(d.ma20) : '—' }}</div>
          <div class="stat-hint">
            MM20 · MM50 {{ d.ma50 ? money(d.ma50) : '—' }} ·
            <p-tag
              [value]="pct(d.vsMa50Pct) + ' vs MM50'"
              [severity]="(d.vsMa50Pct ?? 0) >= 0 ? 'success' : 'danger'"
            />
          </div>
        </p-card>
        <p-card header="Suporte / resistência">
          <div class="stat-value">{{ d.supports[0] ? money(d.supports[0]) : '—' }}</div>
          <div class="stat-hint">
            suporte a {{ pct(d.distSupportPct) }} · resistência {{ d.resistances[0] ? money(d.resistances[0]) : '—' }}
            ({{ pct(d.distResistancePct) }})
          </div>
        </p-card>
        <p-card header="Volatilidade anual">
          <div class="stat-value">{{ pct(d.volatilityAnnualPct, false) }}</div>
          <div class="stat-hint">desvio-padrão dos retornos × √252</div>
        </p-card>
      </div>

      <p-card styleClass="chart-card mt-card">
        <app-price-chart
          [labels]="labels()"
          [values]="values()"
          [supports]="d.supports"
          [resistances]="d.resistances"
          [title]="d.symbol + ' (' + d.currency + ')'"
        />
      </p-card>

      <div class="grid-2" style="margin-top:16px">
        <p-card header="Variações">
          <p-table [value]="changes()" stripedRows>
            <ng-template #header>
              <tr><th>Janela</th><th>Variação</th></tr>
            </ng-template>
            <ng-template #body let-row>
              <tr>
                <td>{{ row.label }}</td>
                <td>
                  <p-tag
                    [value]="pct(row.value)"
                    [severity]="(row.value ?? 0) >= 0 ? 'success' : 'danger'"
                  />
                </td>
              </tr>
            </ng-template>
          </p-table>
        </p-card>
        <p-card header="Níveis do período">
          <div class="list">
            <div class="row">
              <div><div class="name">Mínima</div></div>
              <span>{{ money(d.min) }}</span>
            </div>
            <div class="row">
              <div><div class="name">Máxima</div></div>
              <span>{{ money(d.max) }}</span>
            </div>
            <div class="row">
              <div><div class="name">Suportes</div><div class="meta">{{ supportLabels() }}</div></div>
            </div>
            <div class="row">
              <div><div class="name">Resistências</div><div class="meta">{{ resistanceLabels() }}</div></div>
            </div>
          </div>
        </p-card>
      </div>
    } @else if (loading()) {
      <p class="muted small">Carregando indicadores…</p>
    }
  `,
})
export class TrackingComponent implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);

  readonly data = signal<Indicators | null>(null);
  readonly outlook = signal<Outlook | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly auto = signal(true);
  readonly lastRefresh = signal<string | null>(null);
  readonly positions = signal<Position[]>([]);
  readonly tracked = signal<Array<{ symbol: string; score: number }>>([]);
  readonly searchResults = signal<Array<{ symbol: string; name?: string }>>([]);
  readonly searchWidth = signal(200);

  readonly ranges = [
    { label: '3 meses', value: '3mo' },
    { label: '6 meses', value: '6mo' },
    { label: '1 ano', value: '1y' },
    { label: '2 anos', value: '2y' },
  ];

  symbol = '';
  custom = '';
  range = '1y';
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    const fromQuery = this.route.snapshot.queryParamMap.get('symbol');
    if (fromQuery) this.symbol = fromQuery.toUpperCase();
    this.loadPositions();
    this.loadTracked();
    if (this.symbol) this.load();
    this.startTimer();
  }

  loadTracked() {
    this.api.get<Array<{ symbol: string; score: number }>>('/discovery/tracked').subscribe({
      next: (rows) => this.tracked.set(rows),
      error: () => this.tracked.set([]),
    });
  }

  ngOnDestroy() {
    this.stopTimer();
  }

  /** Chips de troca rápida: posições da carteira + watchlist. */
  watchOptions(): Array<{ symbol: string; name?: string }> {
    return this.symbolList();
  }

  /** Troca de chip com um clique (e reflete na URL para deep-link). */
  switchTo(symbol: string) {
    if (!symbol || symbol === this.symbol) return;
    this.symbol = symbol;
    this.syncUrl();
    this.load();
  }

  /** Atualiza ?symbol= sem recarregar a página. */
  private syncUrl() {
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}?symbol=${encodeURIComponent(this.symbol)}`,
    );
  }

  /** Busca inline de ticker novo (não está nos chips). */
  onSearchInput(event: Event) {
    const raw = String((event.target as HTMLInputElement).value || '');
    this.custom = raw.toUpperCase();
    const query = this.custom.trim();
    if (!query) {
      this.searchResults.set([]);
      this.searchWidth.set(200);
      return;
    }
    this.searchWidth.set(Math.max(200, Math.min(280, 60 + query.length * 14)));
    const all = this.symbolList().filter((option) => option.symbol !== this.symbol);
    this.searchResults.set(
      all
        .filter(
          (option) =>
            option.symbol.includes(query) || (option.name || '').toUpperCase().includes(query),
        )
        .slice(0, 5),
    );
  }

  selectFromSearch(symbol: string) {
    this.symbol = symbol;
    this.custom = '';
    this.searchResults.set([]);
    this.searchWidth.set(200);
    this.syncUrl();
    this.load();
  }

  viewCustom() {
    const ticker = this.custom.trim().toUpperCase();
    if (!ticker) return;
    this.symbol = ticker;
    this.custom = '';
    this.searchResults.set([]);
    this.syncUrl();
    this.load();
  }

  symbolList(): Array<{ symbol: string; name?: string }> {
    const options: Array<{ symbol: string; name?: string }> = this.positions().map((p) => ({
      symbol: p.symbol,
      name: p.name,
    }));
    const seen = new Set(options.map((o) => o.symbol));
    for (const row of this.tracked()) {
      if (seen.has(row.symbol)) continue;
      options.push({ symbol: row.symbol, name: `descoberto (${row.score})` });
      seen.add(row.symbol);
    }
    return options;
  }

  loadPositions() {
    this.api.get<Array<{ id: string; isDefault: boolean }>>('/portfolios').subscribe({
      next: (list) => {
        const preferred = list.find((p) => p.isDefault) || list[0];
        if (!preferred) return;
        this.api.get<Position[]>(`/portfolios/${preferred.id}/positions`).subscribe({
          next: (items) => {
            this.positions.set(items);
            if (!this.symbol && items.length && !this.route.snapshot.queryParamMap.get('symbol')) {
              this.symbol = items[0].symbol;
              this.load();
            }
          },
        });
      },
    });
  }

  load() {
    const requested = (this.symbol || '').trim().toUpperCase();
    if (!requested) return;
    this.symbol = requested;
    this.loading.set(true);
    this.error.set(null);
    this.api
      .get<Indicators>(`/market/indicators?symbol=${encodeURIComponent(requested)}&range=${this.range}`)
      .subscribe({
        next: (res) => {
          if (this.symbol !== requested) return; // resposta de um ticker anterior
          this.loading.set(false);
          this.data.set(res);
          this.lastRefresh.set(new Date().toISOString());
        },
        error: (err) => {
          if (this.symbol !== requested) return;
          this.loading.set(false);
          this.data.set(null);
          this.error.set(err?.error?.message || 'Não foi possível carregar os indicadores.');
        },
      });
    this.api
      .get<Outlook>(`/learning/outlook?symbol=${encodeURIComponent(requested)}&range=${this.range}`)
      .subscribe({
        next: (res) => {
          if (this.symbol !== requested) return;
          this.outlook.set(res);
        },
        error: () => {
          if (this.symbol !== requested) return;
          this.outlook.set(null);
        },
      });
  }

  labels() {
    return (this.data()?.points || []).map((p) => p.date.slice(0, 10));
  }

  values() {
    return (this.data()?.points || []).map((p) => p.close);
  }

  changes() {
    const changed = this.data()?.changed || {};
    const labels: Record<string, string> = { d1: '1 dia', w1: '1 semana', m1: '1 mês', m3: '3 meses', y1: '1 ano' };
    return Object.entries(labels).map(([key, label]) => ({ label, value: changed[key] ?? null }));
  }

  supportLabels(): string {
    const levels = this.data()?.supports || [];
    return levels.length ? levels.map((v) => this.money(v)).join(' · ') : '—';
  }

  resistanceLabels(): string {
    const levels = this.data()?.resistances || [];
    return levels.length ? levels.map((v) => this.money(v)).join(' · ') : '—';
  }

  toggleAuto() {
    this.auto.update((v) => !v);
    if (this.auto()) this.startTimer();
    else this.stopTimer();
  }

  private startTimer() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      if (this.auto()) this.load();
    }, REFRESH_MS);
  }

  private stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  pct(value: number | null | undefined, sign = true): string {
    if (value == null) return '—';
    return `${sign && value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  }

  trendSeverity(trend: string): 'success' | 'warn' | 'danger' | 'secondary' {
    if (trend === 'alta') return 'success';
    if (trend === 'baixa') return 'danger';
    return 'secondary';
  }

  scoreText(o: Outlook): string {
    return `${o.read.label} - ${o.read.score}/100`;
  }

  scoreSeverity(score: number): 'success' | 'warn' | 'danger' {
    if (score >= 65) return 'success';
    if (score >= 45) return 'warn';
    return 'danger';
  }

  verdictSeverity(signal: string): 'success' | 'warn' | 'danger' {
    if (signal === 'Oportunidade') return 'success';
    if (signal === 'Evitar') return 'danger';
    return 'warn';
  }

  rsiLabel(value: number | null): string {
    if (value == null) return '—';
    if (value >= 70) return 'Sobrecompra';
    if (value <= 30) return 'Sobrevenda';
    return 'Neutro';
  }

  rsiSeverity(value: number | null): 'success' | 'warn' | 'danger' | 'secondary' {
    if (value == null) return 'secondary';
    if (value >= 70) return 'danger';
    if (value <= 30) return 'warn';
    return 'success';
  }

  money(value: number): string {
    try {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: this.data()?.currency || 'BRL',
        maximumFractionDigits: 2,
      }).format(value || 0);
    } catch {
      return `${this.data()?.currency || ''} ${(value || 0).toFixed(2)}`;
    }
  }
}
