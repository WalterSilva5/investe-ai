import { Component, ElementRef, ViewChild, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SymbolInputComponent } from '../../shared/symbol-input.component';
import { ChatStreamService } from '../../core/chat-stream.service';
import { MarkdownPipe } from '../../shared/markdown.pipe';
import { PriceChartComponent } from '../../shared/charts/price-chart.component';
import { ApiService } from '../../core/api.service';

interface YearRow {
  year: number;
  invested: number;
  value: number;
}

interface WhatIfResult {
  symbol: string;
  currency: string;
  amount: number;
  monthly: number;
  months: number;
  startDate: string;
  endDate: string;
  totalInvested: number;
  finalValue: number;
  profit: number;
  roiPct: number;
  annualizedPct: number;
  maxDrawdownPct: number;
  years: YearRow[];
  curve: Array<{ date: string; value: number; invested: number }>;
  cdi: { totalInvested: number; finalValue: number } | null;
  forward?: {
    horizonMonths: number;
    pessimisticPct: number;
    basePct: number;
    optimisticPct: number;
    pessimisticValue: number;
    baseValue: number;
    optimisticValue: number;
    probPositive12mPct: number | null;
    yearsSampled: number;
    annualVolPct: number;
  } | null;
}

interface PortfolioResult {
  legs: Array<{
    symbol: string;
    amount: number;
    monthly: number;
    invested: number;
    finalValue: number;
    profit: number;
    roiPct: number;
  }>;
  window: { start: string; end: string };
  total: {
    invested: number;
    finalValue: number;
    profit: number;
    roiPct: number;
    annualizedPct: number;
    maxDrawdownPct: number;
  };
  cdi: { invested: number; finalValue: number } | null;
}

interface StrategyResult {
  symbol: string;
  currency: string;
  months: number;
  agent: {
    invested: number;
    finalValue: number;
    profit: number;
    roiPct: number;
    irrAnnualPct: number | null;
    maxDrawdownPct: number;
    anchors: number;
    inMarketAnchors: number;
  };
  buyHold: { invested: number; finalValue: number; profit: number; roiPct: number };
  cdi: { invested: number; finalValue: number } | null;
  signals: Array<{ date: string; signal: string; score: number; trend: string; price: number }>;
  trades: Array<{
    date: string;
    action: string;
    signal: string;
    price: number;
    why: string;
  }>;
}

@Component({
  selector: 'app-whatif',
  imports: [
    FormsModule,
    CommonModule,
    CardModule,
    ButtonModule,
    TagModule,
    SymbolInputComponent,
    PriceChartComponent,
    MarkdownPipe,
  ],
  template: `
    <h1 class="page-title">Simulador</h1>
    <p class="page-sub">
      "Se eu tivesse investido R$ X há N anos neste ativo, quanto teria hoje?" — o passado com
      compra no primeiro pregão, aportes mensais e comparativo com o CDI real (BCB) — e o
      <strong>futuro</strong> como cenários estatísticos baseados no próprio histórico do papel.
      Estatística não é promessa: o passado não garante o futuro.
    </p>

    <p-card styleClass="mt-card">
      <div class="wi-form">
        <div class="wi-row">
          <div class="wi-field">
            <label>Ativo</label>
            <app-symbol-input
              [(value)]="symbol"
              [options]="symbolOptions()"
              placeholder="Ticker (ITUB4, IVVB11, BTC…)"
              (submitted)="runOnSymbol($event)"
            />
          </div>
          <div class="wi-field">
            <label>Janela</label>
            <div class="chips">
              @for (option of monthOptions; track option) {
                <button class="chip" [class.active]="months === option" (click)="months = option">
                  {{ option === 12 ? '1 ano' : option === 60 ? '5 anos' : option / 12 + ' anos' }}
                </button>
              }
            </div>
          </div>
        </div>

        <div class="wi-row">
          <div class="wi-field">
            <label>Valor inicial (R$)</label>
            <input class="input" type="number" min="10" [(ngModel)]="amount" style="width:140px" />
            <div class="chips" style="margin-left:6px">
              @for (value of amountOptions; track value) {
                <button class="chip" [class.active]="amount === value" (click)="amount = value">
                  {{ value }}
                </button>
              }
            </div>
          </div>
          <div class="wi-field">
            <label>Aporte mensal (opcional)</label>
            <input class="input" type="number" min="0" [(ngModel)]="monthly" style="width:140px" />
            <div class="chips" style="margin-left:6px">
              @for (value of monthlyOptions; track value) {
                <button class="chip" [class.active]="monthly === value" (click)="monthly = value">
                  {{ value === 0 ? 'sem aporte' : value }}
                </button>
              }
            </div>
          </div>
          <div class="wi-field wi-go">
            <label>&nbsp;</label>
            <p-button label="Simular" [loading]="loading()" (onClick)="run()" />
          </div>
        </div>
      </div>
    </p-card>

    @if (error(); as e) {
      <div class="alert error">{{ e }}</div>
    }

    <div [class.wi-grid]="chatVisible()">
      <div>
        @if (result(); as r) {
          <div class="cards" style="margin-top:12px">
            <p-card>
              <div class="stat-label">Valor final</div>
              <div class="stat-value">{{ money(r.finalValue, r.currency) }}</div>
              <div class="stat-hint">{{ r.startDate | date: 'MM/yyyy' }} → {{ r.endDate | date: 'MM/yyyy' }}</div>
            </p-card>
            <p-card>
              <div class="stat-label">Lucro no período</div>
              <div class="stat-value" [style.color]="r.profit >= 0 ? 'var(--success)' : 'var(--danger)'">
                {{ (r.profit >= 0 ? '+' : '') + money(r.profit, r.currency) }}
              </div>
              <div class="stat-hint">investido {{ money(r.totalInvested, r.currency) }} · ROI {{ r.roiPct }}%</div>
            </p-card>
            <p-card>
              <div class="stat-label">Anualizada (IRR)</div>
              <div class="stat-value">{{ r.annualizedPct }}% a.a.</div>
              <div class="stat-hint">queda máxima: {{ r.maxDrawdownPct }}%</div>
            </p-card>
            @if (r.cdi; as cdi) {
              <p-card>
                <div class="stat-label">Se fosse no CDI</div>
                <div class="stat-value">{{ money(cdi.finalValue, r.currency) }}</div>
                <div class="stat-hint">
                  {{ r.finalValue >= cdi.finalValue ? 'ativo superou o CDI' : 'CDI superou o ativo' }}
                  ({{ money(cdi.finalValue - r.finalValue, r.currency) }})
                </div>
              </p-card>
            }
          </div>

          <p-card header="Curva do patrimônio" styleClass="mt-card">
            <app-price-chart
              [labels]="labels()"
              [values]="values()"
              [title]="'Valor de mercado — ' + r.symbol"
            />
          </p-card>

          <p-card header="Ano a ano" styleClass="mt-card">
            <table style="width:100%;border-collapse:collapse">
              <tr style="border-bottom:1px solid var(--border)">
                <th style="text-align:left;padding:6px 0">Ano</th>
                <th style="text-align:right">Investido até aqui</th>
                <th style="text-align:right">Valor de mercado</th>
                <th style="text-align:right">Resultado</th>
              </tr>
              @for (row of r.years; track row.year) {
                <tr style="border-bottom:1px dashed var(--border)">
                  <td style="padding:6px 0"><strong>{{ row.year }}</strong></td>
                  <td style="text-align:right">{{ money(row.invested, r.currency) }}</td>
                  <td style="text-align:right">{{ money(row.value, r.currency) }}</td>
                  <td style="text-align:right" [style.color]="row.value >= row.invested ? 'var(--success)' : 'var(--danger)'">
                    {{ money(row.value - row.invested, r.currency) }}
                  </td>
                </tr>
              }
            </table>
            @if (r.currency !== 'BRL') {
              <p class="muted small" style="margin:8px 0 0">
                Ativo negociado em {{ r.currency }}: valores na moeda do ativo, não em reais.
              </p>
            }
          </p-card>

          @if (r.forward; as f) {
            <p-card header="🔮 E o futuro? (cenários para 12 meses)" styleClass="mt-card">
              <div class="cards">
                <p-card>
                  <div class="stat-label">📉 Pessimista</div>
                  <div class="stat-value" style="color:var(--danger)">
                    {{ money(f.pessimisticValue, r.currency) }}
                  </div>
                  <div class="stat-hint">{{ f.pessimisticPct }}% · vol anual {{ f.annualVolPct }}%</div>
                </p-card>
                <p-card>
                  <div class="stat-label">➡️ Base (IRR histórica)</div>
                  <div class="stat-value">{{ money(f.baseValue, r.currency) }}</div>
                  <div class="stat-hint">{{ f.basePct }}% · {{ f.yearsSampled }} anos de amostra</div>
                </p-card>
                <p-card>
                  <div class="stat-label">📈 Otimista</div>
                  <div class="stat-value" style="color:var(--success)">
                    {{ money(f.optimisticValue, r.currency) }}
                  </div>
                  <div class="stat-hint">{{ f.optimisticPct }}% · banda de 1 desvio-padrão</div>
                </p-card>
              </div>
              @if (f.probPositive12mPct != null) {
                <p class="small" style="margin:8px 0 0">
                  Chance histórica de retorno positivo em 12 meses neste papel:
                  <strong>{{ f.probPositive12mPct }}%</strong>
                  (frequência nos últimos {{ f.yearsSampled }} anos)
                </p>
              }
              <p class="disclaimer" style="margin:8px 0 0">
                Projeção estatística baseada no próprio histórico (retornos anuais e volatilidade),
                assumindo que o regime se mantém. NÃO é previsão nem promessa: choques, mudanças de
                regime e caudas não aparecem em média. Conteúdo educacional.
              </p>
            </p-card>
          }

          @if (strategy(); as s) {
            <p-card header="🎯 Seguindo o agente (análise mensal)" styleClass="mt-card">
              <p class="muted small" style="margin-top:0">
                A cada mês do período, o mesmo critério do veredito atual analisa o gráfico:
                <strong>Oportunidade</strong> investe o caixa, <strong>Evitar</strong> zera a posição,
                <strong>Aguardar</strong> mantém.
              </p>

              <table style="width:100%;border-collapse:collapse;margin-bottom:10px">
                <tr style="border-bottom:1px solid var(--border)">
                  <th style="text-align:left;padding:6px 0">Cenário</th>
                  <th style="text-align:right">Investido</th>
                  <th style="text-align:right">Valor final</th>
                  <th style="text-align:right">a.a. (IRR)</th>
                  <th style="text-align:right">Queda máx.</th>
                </tr>
                <tr style="border-bottom:1px dashed var(--border)">
                  <td style="padding:6px 0"><strong>🤖 Seguindo o agente</strong></td>
                  <td style="text-align:right">{{ money(s.agent.invested, s.currency) }}</td>
                  <td style="text-align:right"><strong>{{ money(s.agent.finalValue, s.currency) }}</strong></td>
                  <td style="text-align:right" [style.color]="(s.agent.irrAnnualPct ?? 0) >= 0 ? 'var(--success)' : 'var(--danger)'">
                    {{ s.agent.irrAnnualPct ?? '—' }}%
                  </td>
                  <td style="text-align:right">{{ s.agent.maxDrawdownPct }}%</td>
                </tr>
                <tr style="border-bottom:1px dashed var(--border)">
                  <td style="padding:6px 0">Compra e segura</td>
                  <td style="text-align:right">{{ money(s.buyHold.invested, s.currency) }}</td>
                  <td style="text-align:right">{{ money(s.buyHold.finalValue, s.currency) }}</td>
                  <td style="text-align:right">—</td>
                  <td style="text-align:right">—</td>
                </tr>
                @if (s.cdi; as cdi) {
                  <tr>
                    <td style="padding:6px 0">CDI (mesmo fluxo)</td>
                    <td style="text-align:right">{{ money(cdi.invested, s.currency) }}</td>
                    <td style="text-align:right">{{ money(cdi.finalValue, s.currency) }}</td>
                    <td style="text-align:right">—</td>
                    <td style="text-align:right">—</td>
                  </tr>
                }
              </table>

              <div class="muted small" style="margin-bottom:6px">
                {{ s.agent.anchors }} análises mensais · no mercado {{ s.agent.inMarketAnchors }}/{{ s.agent.anchors }}
                · {{ s.trades.length }} operações
              </div>

              <p-tag
                [value]="
                  s.agent.finalValue > s.buyHold.finalValue
                    ? 'agente superou compra e segura'
                    : 'compra e segura superou o agente'
                "
                [severity]="s.agent.finalValue > s.buyHold.finalValue ? 'success' : 'warn'"
              />

              <details style="margin-top:10px">
                <summary class="small" style="cursor:pointer">Análises mensais do agente ({{ s.signals.length }})</summary>
                <div class="chips" style="margin-top:6px">
                  @for (signal of s.signals.slice().reverse(); track signal.date) {
                    <span
                      class="chip"
                      [style.opacity]="signal.signal === 'Aguardar' ? 0.55 : 1"
                      [style.border-color]="
                        signal.signal === 'Oportunidade' ? 'var(--success)' : signal.signal === 'Evitar' ? 'var(--danger)' : 'var(--border)'
                      "
                      title="{{ signal.date }} · score {{ signal.score }} · {{ signal.trend }}"
                    >
                      {{ signal.date | date: 'MM/yy' }}: {{ signal.signal === 'Oportunidade' ? '🟢' : signal.signal === 'Evitar' ? '🔴' : '⚪' }} {{ signal.signal }}
                    </span>
                  }
                </div>
              </details>

              @if (s.trades.length) {
                <details style="margin-top:8px">
                  <summary class="small" style="cursor:pointer">Operações ({{ s.trades.length }})</summary>
                  <table style="width:100%;border-collapse:collapse;margin-top:6px">
                    @for (trade of s.trades; track trade.date) {
                      <tr style="border-bottom:1px dashed var(--border)">
                        <td class="small" style="padding:4px 0">{{ trade.date | date: 'dd/MM/yy' }}</td>
                        <td class="small">
                          <p-tag [value]="trade.action" [severity]="trade.action === 'COMPRA' ? 'success' : 'danger'" />
                        </td>
                        <td class="small" style="text-align:right">{{ money(trade.price, s.currency) }}</td>
                        <td class="muted small">{{ trade.why }}</td>
                      </tr>
                    }
                  </table>
                </details>
              }

              <p class="disclaimer" style="margin:10px 0 0">
                Retrospectiva com a régua de hoje aplicada ao passado — o agente real da época não existia.
                Não é recomendação; o resultado depende do papel e do regime de mercado.
              </p>
            </p-card>
          }
        }
      </div>

      <div class="wi-chat" style="margin-top:12px">
        <p-card header="🤖 Simular via conversa" styleClass="mt-card">
          <p class="muted small" style="margin-top:0">
            Fale naturalmente — o agente simula carteiras diversificadas com valores reais:
          </p>
          <div class="chips" style="margin-bottom:8px">
            @for (sample of samples; track sample) {
              <button class="chip" (click)="ask(sample)">{{ sample }}</button>
            }
          </div>
          <div class="wi-chat-body" #chatBody>
            @for (message of chat.messages(); track $index) {
              <div class="wi-msg" [class.user]="message.role === 'user'">
                @if (message.role === 'assistant') {
                  <div class="md" [innerHTML]="message.content | markdown"></div>
                } @else {
                  {{ message.content }}
                }
              </div>
            }
            @if (chat.loading()) {
              <div class="wi-msg wi-typing">Analisando…</div>
            }
            @if (chat.error(); as err) {
              <div class="wi-msg wi-error">{{ err }}</div>
            }
          </div>
          <div style="display:flex;gap:6px;margin-top:8px">
            <input
              class="input"
              placeholder="Ex.: e se eu tivesse 30% em cada (ITUB4, PETR4, IVVB11) há 5 anos?"
              [(ngModel)]="chatText"
              (keyup.enter)="sendChat()"
            />
            @if (chat.loading()) {
              <p-button icon="pi pi-stop" severity="secondary" [outlined]="true" (onClick)="chat.stop()" />
            } @else {
              <p-button icon="pi pi-send" [disabled]="!chatText.trim()" (onClick)="sendChat()" />
            }
          </div>
          <p class="disclaimer" style="margin:8px 0 0">
            Conteúdo educacional e retrospectivo — não é recomendação.
          </p>
        </p-card>
      </div>
    </div>
  `,
  styles: [
    `
      .wi-form { display: flex; flex-direction: column; gap: 12px; }
      .wi-row { display: flex; gap: 16px; flex-wrap: wrap; align-items: flex-end; }
      .wi-field { display: flex; flex-direction: column; gap: 6px; }
      .wi-field label { font-size: 12px; color: var(--muted); font-weight: 600; }
      .wi-field .chips { display: flex; gap: 4px; flex-wrap: wrap; }
      .wi-go { justify-content: flex-end; }
      .wi-grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 16px; align-items: start; }
      @media (max-width: 1100px) { .wi-grid { grid-template-columns: 1fr; } }
      .wi-chat-body {
        max-height: 420px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;
        padding: 4px 2px;
      }
      .wi-msg {
        padding: 8px 10px; border-radius: 10px; font-size: 13px; line-height: 1.45;
        background: var(--surface-2, #f4f6fb); align-self: flex-start; max-width: 92%;
      }
      .wi-msg.user { background: #dbe7ff; align-self: flex-end; }
      .app-dark .wi-msg { background: #1b2333; }
      .app-dark .wi-msg.user { background: #24406e; }
      .wi-msg.wi-typing { color: var(--muted); font-style: italic; }
      .wi-msg.wi-error { color: var(--danger); }
    `,
  ],
})
export class WhatIfComponent {
  private readonly api = inject(ApiService);
  readonly chat = inject(ChatStreamService);

  readonly result = signal<WhatIfResult | null>(null);
  readonly portfolio = signal<PortfolioResult | null>(null);
  readonly strategy = signal<StrategyResult | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly chatVisible = signal(true);

  symbol = 'ITUB4';
  amount = 1000;
  monthly = 0;
  months = 60;

  readonly monthOptions = [12, 24, 36, 60];
  readonly amountOptions = [100, 500, 1000, 5000];
  readonly monthlyOptions = [0, 100, 200, 500];

  readonly symbols = [
    { symbol: 'ITUB4', name: 'Itaú' },
    { symbol: 'PETR4', name: 'Petrobras' },
    { symbol: 'VALE3', name: 'Vale' },
    { symbol: 'WEGE3', name: 'Weg' },
    { symbol: 'IVVB11', name: 'S&P 500' },
    { symbol: 'MXRF11', name: 'FII Maxi' },
    { symbol: 'BTC', name: 'Bitcoin' },
    { symbol: 'ETH', name: 'Ethereum' },
  ];
  symbolOptions() {
    return this.symbols;
  }

  readonly samples = [
    'Simule R$ 1.000 em PETR4 e R$ 2.000 em IVVB11 há 5 anos',
    'E se eu tivesse 30% em ITUB4, 30% em PETR4 e 40% em IVVB11 há 5 anos? (R$ 3.000)',
    'R$ 500 por mês dividido entre BTC e IVVB11 nos últimos 2 anos',
  ];

  chatText = '';
  @ViewChild('chatBody') private chatBody?: ElementRef<HTMLElement>;

  constructor() {
    effect(() => {
      this.chat.messages();
      this.chat.loading();
      requestAnimationFrame(() => {
        const el = this.chatBody?.nativeElement;
        if (el) el.scrollTop = el.scrollHeight;
      });
    });
  }

  money(value: number, currency: string): string {
    const locale = currency === 'BRL' ? 'pt-BR' : 'en-US';
    return (value ?? 0).toLocaleString(locale, {
      style: 'currency',
      currency: currency === 'BRL' ? 'BRL' : 'USD',
      maximumFractionDigits: 0,
    });
  }

  run() {
    if (!this.symbol.trim() || this.amount <= 0) return;
    this.loading.set(true);
    this.error.set(null);
    this.portfolio.set(null);
    this.strategy.set(null);
    const params = new URLSearchParams({
      symbol: this.symbol.trim().toUpperCase(),
      amount: String(this.amount),
      months: String(this.months),
      monthly: String(this.monthly || 0),
    });
    this.api.get<WhatIfResult>(`/market/whatif?${params.toString()}`).subscribe({
      next: (result) => {
        this.result.set(result);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'Falha ao simular. Verifique o ticker.');
      },
    });
    // Estratégia "seguindo o agente" (análise mensal) roda em paralelo.
    const strategyParams = new URLSearchParams({
      symbol: this.symbol.trim().toUpperCase(),
      amount: String(this.amount),
      months: String(Math.max(12, this.months)),
      monthly: String(this.monthly || 0),
    });
    this.api
      .get<StrategyResult>(`/market/whatif-strategy?${strategyParams.toString()}`)
      .subscribe({
        next: (result) => this.strategy.set(result),
        error: () => this.strategy.set(null),
      });
  }

  runOnSymbol(symbol: string) {
    this.symbol = symbol;
    this.run();
  }

  ask(sample: string) {
    this.chatText = sample;
    this.sendChat();
  }

  sendChat() {
    const content = this.chatText.trim();
    if (!content) return;
    this.chatText = '';
    this.chatVisible.set(true);
    this.chat.send(content);
  }

  labels(): string[] {
    return (this.result()?.curve || []).map((c) => c.date);
  }

  values(): number[] {
    return (this.result()?.curve || []).map((c) => c.value);
  }
}
