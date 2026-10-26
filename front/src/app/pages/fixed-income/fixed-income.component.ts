import { SlicePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

interface Macro {
  available: boolean;
  selic?: number;
  ipcaAnnual?: number;
  cdiAnnual?: number;
  source?: string;
  fetchedAt?: string;
  error?: string;
}

interface Simulation {
  product: string;
  net: number;
  gross: number;
  ir: number;
  netAnnualPct: number;
  annualRatePct: number;
  irExempt: boolean;
}

@Component({
  selector: 'app-fixed-income',
  imports: [FormsModule, SlicePipe],
  template: `
    <h1 class="page-title">Renda fixa</h1>
    <p class="page-sub">Compare CDB, LCI/LCA e Tesouro com IR e isenções. Números calculados no servidor.</p>

    <div class="cards">
      <div class="card">
        <h3>Selic</h3>
        <div class="value">{{ pct(macro().selic) }}</div>
        <div class="hint">meta anual</div>
      </div>
      <div class="card">
        <h3>CDI</h3>
        <div class="value">{{ pct(macro().cdiAnnual) }}</div>
        <div class="hint">anualizado</div>
      </div>
      <div class="card">
        <h3>IPCA</h3>
        <div class="value">{{ pct(macro().ipcaAnnual) }}</div>
        <div class="hint">anualizado</div>
      </div>
      <div class="card">
        <h3>Fonte</h3>
        <div class="value" style="font-size:15px">{{ macro().available ? 'BCB' : 'indisponível' }}</div>
        <div class="hint">{{ macro().fetchedAt ? (macro().fetchedAt | slice:0:10) : '—' }}</div>
      </div>
    </div>

    <div class="grid-2" style="margin-top:20px">
      <section class="card">
        <h3>Simular</h3>
        <div class="grid-2">
          <div class="field">
            <label>Valor</label>
            <input class="input" type="number" [(ngModel)]="form.principal" />
          </div>
          <div class="field">
            <label>Meses</label>
            <input class="input" type="number" [(ngModel)]="form.months" />
          </div>
          <div class="field">
            <label>Produto</label>
            <select class="input" [(ngModel)]="form.product">
              <option value="CDB">CDB</option>
              <option value="LCI">LCI</option>
              <option value="LCA">LCA</option>
              <option value="TESOURO">Tesouro</option>
            </select>
          </div>
          <div class="field">
            <label>Indexador</label>
            <select class="input" [(ngModel)]="form.rateType">
              <option value="CDI_PERCENT">% do CDI</option>
              <option value="PREFIXED">Prefixado</option>
              <option value="IPCA_PLUS">IPCA +</option>
            </select>
          </div>
          <div class="field">
            <label>Taxa</label>
            <input class="input" type="number" [(ngModel)]="form.rate" />
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-top:14px">
          <button class="btn" (click)="simulate()">Simular</button>
          <button class="btn secondary" (click)="compare()">Comparar 3</button>
        </div>
      </section>

      <section class="card">
        <h3>Resultado</h3>
        @if (result(); as r) {
          <div class="list" style="margin-top:10px">
            <div class="row"><span>Bruto</span><strong>{{ money(r.gross) }}</strong></div>
            <div class="row"><span>IR {{ r.irExempt ? '(isento)' : '' }}</span><strong>{{ money(r.ir) }}</strong></div>
            <div class="row"><span>Líquido</span><strong>{{ money(r.net) }}</strong></div>
            <div class="row"><span>Rentabilidade líquida</span><strong>{{ r.netAnnualPct.toFixed(2) }}% a.a.</strong></div>
          </div>
        } @else {
          <p class="muted small">Preencha e simule.</p>
        }
      </section>
    </div>

    @if (comparison().length) {
      <section class="section">
        <h2>Comparação</h2>
        <div class="card" style="padding:0;overflow:auto">
          <table style="width:100%;border-collapse:collapse;font-size:13.5px">
            <thead>
              <tr style="text-align:left;background:#f9fafb">
                <th style="padding:10px 12px">Produto</th>
                <th style="padding:10px 12px">Bruto</th>
                <th style="padding:10px 12px">IR</th>
                <th style="padding:10px 12px">Líquido</th>
                <th style="padding:10px 12px">% a.a.</th>
              </tr>
            </thead>
            <tbody>
              @for (r of comparison(); track r.product) {
                <tr style="border-top:1px solid var(--border)">
                  <td style="padding:10px 12px">{{ r.product }}</td>
                  <td style="padding:10px 12px">{{ money(r.gross) }}</td>
                  <td style="padding:10px 12px">{{ money(r.ir) }}</td>
                  <td style="padding:10px 12px">{{ money(r.net) }}</td>
                  <td style="padding:10px 12px">{{ r.netAnnualPct.toFixed(2) }}%</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    }

    @if (error()) {
      <div class="alert error">{{ error() }}</div>
    }

    <p class="disclaimer">
      Simulação educacional. IR/IOF e isenções variam; confirme com contador. Não é recomendação.
    </p>
  `,
})
export class FixedIncomeComponent {
  private readonly api = inject(ApiService);

  readonly macro = signal<Macro>({ available: false });
  readonly result = signal<Simulation | null>(null);
  readonly comparison = signal<Simulation[]>([]);
  readonly error = signal<string | null>(null);

  form = {
    principal: 20000,
    months: 24,
    product: 'CDB',
    rateType: 'CDI_PERCENT',
    rate: 100,
  };

  constructor() {
    this.api.get<Macro>('/market/macro').subscribe({
      next: (macro) => this.macro.set(macro),
      error: () => this.macro.set({ available: false }),
    });
    this.simulate();
  }

  simulate() {
    this.error.set(null);
    this.api
      .post<Simulation>('/fixed-income/simulate', this.body())
      .subscribe({
        next: (result) => this.result.set(result),
        error: (err) => this.error.set(err?.error?.message || 'Falha na simulação.'),
      });
  }

  compare() {
    this.error.set(null);
    const cdi = this.macro().cdiAnnual ?? 14;
    const ipca = this.macro().ipcaAnnual ?? 5;
    const base = { principal: this.form.principal, months: this.form.months };
    const items = [
      { ...base, product: 'CDB', rateType: 'CDI_PERCENT', rate: 100, cdiAnnual: cdi },
      { ...base, product: 'LCI', rateType: 'CDI_PERCENT', rate: 90, cdiAnnual: cdi },
      { ...base, product: 'TESOURO', rateType: 'IPCA_PLUS', rate: 6, ipcaAnnual: ipca },
    ];

    this.api
      .post<{ results: Simulation[] }>('/fixed-income/compare', items)
      .subscribe({
        next: (res) => this.comparison.set(res.results),
        error: (err) => this.error.set(err?.error?.message || 'Falha na comparação.'),
      });
  }

  money(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  }

  pct(value?: number): string {
    return value == null ? '—' : `${value.toFixed(2)}%`;
  }

  private body() {
    return {
      ...this.form,
      cdiAnnual: this.macro().cdiAnnual ?? 14,
      ipcaAnnual: this.macro().ipcaAnnual ?? 5,
    };
  }
}
