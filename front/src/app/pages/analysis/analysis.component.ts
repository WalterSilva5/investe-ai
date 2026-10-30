import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

interface Runway {
  assets: number;
  burn: number;
  months: number | null;
  runwayYears: number | null;
  infinite: boolean;
  monthlyIncome: number;
}
interface Project {
  futureValue: number;
  invested: number;
  interest: number;
  months: number;
}
interface RebalanceItem {
  type: string;
  targetPct: number;
  currentPct: number;
  driftPct: number;
  move: number;
}
interface Rebalance {
  total: number;
  items: RebalanceItem[];
}
interface Macro {
  cdiAnnual?: number;
  ipcaAnnual?: number;
}
interface Summary {
  totalValue: number;
  portfolio: { name: string };
}

@Component({
  selector: 'app-analysis',
  imports: [FormsModule],
  template: `
    <h1 class="page-title">Análise</h1>
    <p class="page-sub">Runway, projeção de patrimônio e rebalanceamento.</p>

    <div class="cards">
      <div class="card">
        <h3>Patrimônio</h3>
        <div class="value">{{ money(summary()?.totalValue || 0) }}</div>
        <div class="hint">{{ summary()?.portfolio?.name || 'sem carteira' }}</div>
      </div>
      <div class="card">
        <h3>Runway</h3>
        <div class="value">{{ runwayLabel() }}</div>
        <div class="hint">a R$ {{ burnLabel() }}/mês</div>
      </div>
      <div class="card">
        <h3>Projeção em {{ projectForm.months }} meses</h3>
        <div class="value">{{ money(project()?.futureValue || 0) }}</div>
        <div class="hint">investido {{ money(project()?.invested || 0) }}</div>
      </div>
    </div>

    <div class="grid-2" style="margin-top:20px">
      <section class="card">
        <h3>Runway</h3>
        <div class="grid-2">
          <div class="field">
            <label>Despesa mensal</label>
            <input class="input" type="number" [(ngModel)]="runwayForm.monthlyExpense" />
          </div>
          <div class="field">
            <label>Renda mensal</label>
            <input class="input" type="number" [(ngModel)]="runwayForm.monthlyIncome" />
          </div>
          <div class="field">
            <label>Taxa anual (%)</label>
            <input class="input" type="number" [(ngModel)]="runwayForm.rateAnnual" />
          </div>
        </div>
        <button class="btn" style="margin-top:12px" (click)="runRunway()">Calcular runway</button>
      </section>

      <section class="card">
        <h3>Projeção</h3>
        <div class="grid-2">
          <div class="field">
            <label>Valor inicial</label>
            <input class="input" type="number" [(ngModel)]="projectForm.principal" />
          </div>
          <div class="field">
            <label>Aporte mensal</label>
            <input class="input" type="number" [(ngModel)]="projectForm.monthlyContribution" />
          </div>
          <div class="field">
            <label>Taxa anual (%)</label>
            <input class="input" type="number" [(ngModel)]="projectForm.rateAnnual" />
          </div>
          <div class="field">
            <label>Meses</label>
            <input class="input" type="number" [(ngModel)]="projectForm.months" />
          </div>
        </div>
        <button class="btn" style="margin-top:12px" (click)="runProject()">Projetar</button>
      </section>
    </div>

    <section class="section">
      <h2>Rebalanceamento</h2>
      <div class="card">
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          @for (type of targetTypes(); track type) {
            <div class="field" style="min-width:110px">
              <label>{{ type }}</label>
              <input class="input" type="number" [(ngModel)]="target[type]" />
            </div>
          }
          <div style="align-self:flex-end;padding-bottom:2px">
            <button class="btn" (click)="runRebalance()">Comparar</button>
          </div>
        </div>

        @if (rebalance(); as r) {
          <table style="width:100%;border-collapse:collapse;font-size:13.5px;margin-top:14px">
            <thead>
              <tr style="text-align:left;background:#f9fafb">
                <th style="padding:9px 12px">Tipo</th>
                <th style="padding:9px 12px">Meta</th>
                <th style="padding:9px 12px">Atual</th>
                <th style="padding:9px 12px">Desvio</th>
                <th style="padding:9px 12px">Mover</th>
              </tr>
            </thead>
            <tbody>
              @for (item of r.items; track item.type) {
                <tr style="border-top:1px solid var(--border)">
                  <td style="padding:9px 12px">{{ item.type }}</td>
                  <td style="padding:9px 12px">{{ item.targetPct }}%</td>
                  <td style="padding:9px 12px">{{ item.currentPct }}%</td>
                  <td style="padding:9px 12px">{{ item.driftPct }}%</td>
                  <td style="padding:9px 12px">{{ money(item.move) }}</td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
    </section>
  `,
})
export class AnalysisComponent {
  private readonly api = inject(ApiService);

  readonly summary = signal<Summary | null>(null);
  readonly runway = signal<Runway | null>(null);
  readonly project = signal<Project | null>(null);
  readonly rebalance = signal<Rebalance | null>(null);

  runwayForm = { monthlyExpense: 3000, monthlyIncome: 0, rateAnnual: 12 };
  projectForm = { principal: 20000, monthlyContribution: 2500, rateAnnual: 14, months: 24 };
  target: Record<string, number> = {
    STOCK: 30,
    FII: 10,
    ETF: 20,
    FIXED_INCOME: 35,
    CRYPTO: 5,
    CASH: 0,
  };
  targetTypes = signal<string[]>(Object.keys(this.target));

  constructor() {
    this.api.get<Macro>('/market/macro').subscribe({
      next: (macro) => {
        const cdi = macro.cdiAnnual ?? 14;
        this.runwayForm.rateAnnual = cdi;
        this.projectForm.rateAnnual = cdi;
      },
    });
    this.loadSummary();
    this.runRunway();
    this.runProject();
    this.runRebalance();
  }

  loadSummary() {
    this.api
      .get<Array<{ id: string; isDefault: boolean }>>('/portfolios')
      .subscribe({
        next: (list) => {
          const preferred = list.find((p) => p.isDefault) || list[0];
          if (!preferred) return;
          this.api.get<Summary>(`/portfolios/${preferred.id}/summary`).subscribe({
            next: (summary) => {
              this.summary.set(summary);
              this.projectForm.principal = summary.totalValue || this.projectForm.principal;
            },
          });
        },
      });
  }

  runRunway() {
    this.api
      .post<Runway>('/analysis/runway', this.runwayForm)
      .subscribe({ next: (r) => this.runway.set(r) });
  }

  runProject() {
    this.api
      .post<Project>('/analysis/project', this.projectForm)
      .subscribe({ next: (p) => this.project.set(p) });
  }

  runRebalance() {
    this.api
      .post<Rebalance>('/analysis/rebalance', { target: this.target })
      .subscribe({ next: (r) => this.rebalance.set(r) });
  }

  runwayLabel(): string {
    const r = this.runway();
    if (!r) return '—';
    if (r.infinite) return '∞';
    return `${r.months} meses (~${r.runwayYears} anos)`;
  }

  burnLabel(): string {
    const r = this.runway();
    return r ? r.burn.toFixed(2) : '—';
  }

  money(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  }
}
