import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
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
}

@Component({
  selector: 'app-whatif',
  imports: [FormsModule, CommonModule, CardModule, ButtonModule, TagModule, PriceChartComponent],
  template: `
    <h1 class="page-title">Simulador de passado</h1>
    <p class="page-sub">
      "Se eu tivesse investido R$ X há N anos neste ativo, quanto teria hoje?" — compra no primeiro
      pregão, aportes mensais opcionais, comparação com o CDI do mesmo período. Retrospectiva:
      o padrão passado não garante resultado futuro.
    </p>

    <div class="toolbar">
      <div class="group">
        <input class="input" style="width:130px" placeholder="Ticker (ITUB4)" [(ngModel)]="symbol" />
        <input class="input" style="width:130px" type="number" min="10" placeholder="Valor inicial" [(ngModel)]="amount" />
        <input class="input" style="width:130px" type="number" min="0" placeholder="Aporte mensal (opcional)" [(ngModel)]="monthly" />
        <select class="input" style="width:120px" [(ngModel)]="months">
          <option [ngValue]="12">1 ano</option>
          <option [ngValue]="24">2 anos</option>
          <option [ngValue]="36">3 anos</option>
          <option [ngValue]="60">5 anos</option>
        </select>
        <p-button label="Simular" [loading]="loading()" (onClick)="run()" />
      </div>
    </div>

    @if (error(); as e) {
      <div class="alert error">{{ e }}</div>
    }

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
          <div class="stat-label">Rentabilidade anualizada</div>
          <div class="stat-value">{{ r.annualizedPct }}% a.a.</div>
          <div class="stat-hint">queda máxima no período: {{ r.maxDrawdownPct }}%</div>
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
        } @else {
          <p-card>
            <div class="stat-label">Se fosse no CDI</div>
            <div class="stat-value">—</div>
            <div class="stat-hint">comparativo indisponível (BCB fora ou ativo em USD)</div>
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
            Ativo negociado em {{ r.currency }}: os valores estão na moeda do ativo, não em reais.
          </p>
        }
        <p class="disclaimer" style="margin:8px 0 0">
          Conteúdo educacional e retrospectivo. Não é recomendação de investimento; resultados passados
          não garantem resultados futuros.
        </p>
      </p-card>
    }
  `,
})
export class WhatIfComponent {
  private readonly api = inject(ApiService);

  readonly result = signal<WhatIfResult | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  symbol = 'ITUB4';
  amount = 1000;
  monthly = 0;
  months: number = 12;

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
  }

  labels(): string[] {
    return (this.result()?.curve || []).map((c) => c.date);
  }

  values(): number[] {
    return (this.result()?.curve || []).map((c) => c.value);
  }
}
