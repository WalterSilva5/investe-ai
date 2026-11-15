import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../../core/api.service';
import { TrendLineComponent } from '../../shared/charts/trend-line.component';
import { TargetBarsComponent } from '../../shared/charts/target-bars.component';
import { AllocationDonutComponent } from '../../shared/charts/allocation-donut.component';

interface ContributionItem {
  type: string;
  targetPct: number;
  currentPct: number;
  driftPct: number;
  pct: number;
  amount: number;
}

interface ContributionMap {
  amount: number;
  portfolioTotal: number;
  items: ContributionItem[];
}

interface ContributionAdvice {
  headline?: string;
  bullets?: string[];
  watchOut?: string;
  raw?: string;
}

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
  imports: [
    FormsModule,
    CardModule,
    ButtonModule,
    TableModule,
    TagModule,
    TrendLineComponent,
    TargetBarsComponent,
    AllocationDonutComponent,
  ],
  template: `
    <h1 class="page-title">Análise</h1>
    <p class="page-sub">Runway, projeção de patrimônio, rebalanceamento e mapa do aporte do dia.</p>

    <div class="cards">
      <p-card header="Patrimônio">
        <div class="stat-value">{{ money(summary()?.totalValue || 0) }}</div>
        <div class="stat-hint">{{ summary()?.portfolio?.name || 'sem carteira' }}</div>
      </p-card>
      <p-card header="Runway">
        <div class="stat-value">{{ runwayLabel() }}</div>
        <div class="stat-hint">
          a R$ {{ burnLabel() }}/mês
          @if (runway()?.infinite) { <p-tag value="infinito" severity="success" /> }
        </div>
      </p-card>
      <p-card header="Projeção em {{ projectForm.months }} meses">
        <div class="stat-value">{{ money(project()?.futureValue || 0) }}</div>
        <div class="stat-hint">
          investido {{ money(project()?.invested || 0) }} ·
          juros {{ money(project()?.interest || 0) }}
        </div>
      </p-card>
    </div>

    <section class="section">
      <h2>Aporte do dia</h2>
      <p-card>
        <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
          <div class="field" style="margin-top:0;min-width:200px">
            <label>Quanto vai investir hoje? (R$)</label>
            <input class="input" type="number" min="0" [(ngModel)]="aporte" />
          </div>
          <p-button
            label="Montar mapa"
            (onClick)="runContribution()"
            [loading]="loadingMap()"
          />
          <p-button
            label="Pedir análise do agente"
            severity="secondary"
            [outlined]="true"
            (onClick)="runAdvice()"
            [loading]="loadingAdvice()"
            [disabled]="!contribution()?.items?.length"
          />
        </div>
        <p class="muted small" style="margin-top:8px">
          O mapa é matemática do rebalanceamento (grátis). A análise do agente usa suas dicas e gasta tokens.
        </p>

        @if (mapError()) {
          <div class="alert error">{{ mapError() }}</div>
        }

        @if (contribution(); as c) {
          <div class="grid-2" style="margin-top:16px">
            <div>
              <app-allocation-donut [data]="contributionDonut()" title="Mapa do aporte" />
            </div>
            <p-table [value]="c.items" stripedRows>
              <ng-template #header>
                <tr><th>Tipo</th><th>% do aporte</th><th>Valor</th><th>Defasagem</th></tr>
              </ng-template>
              <ng-template #body let-item>
                <tr>
                  <td>{{ item.type }}</td>
                  <td>{{ item.pct.toFixed(1) }}%</td>
                  <td>{{ money(item.amount) }}</td>
                  <td>
                    <p-tag [value]="item.driftPct.toFixed(1) + ' p.p.'" [severity]="item.driftPct < 0 ? 'warn' : 'success'" />
                  </td>
                </tr>
              </ng-template>
            </p-table>
          </div>
        }

        @if (advice(); as a) {
          <div class="insight" style="margin-top:16px">
            @if (a.headline) {
              <div class="insight-title">{{ a.headline }}</div>
            }
            @if (a.bullets?.length) {
              <ul class="small" style="margin:8px 0;padding-left:20px">
                @for (b of a.bullets; track b) {
                  <li style="margin-bottom:4px">{{ b }}</li>
                }
              </ul>
            }
            @if (a.watchOut) {
              <div class="small"><strong>Atenção:</strong> {{ a.watchOut }}</div>
            }
            @if (a.raw) {
              <div class="insight-body">{{ a.raw }}</div>
            }
            <div class="disclaimer">Conteúdo educacional — não é recomendação de investimento.</div>
          </div>
        }
      </p-card>
    </section>

    <div class="grid-2" style="margin-top:20px">
      <p-card header="Runway">
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
        <p-button label="Calcular runway" styleClass="mt-2" (onClick)="runRunway()" />
      </p-card>

      <p-card header="Projeção">
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
        <p-button label="Projetar" styleClass="mt-2" (onClick)="runProject()" />
      </p-card>
    </div>

    <div class="grid-2" style="margin-top:20px">
      <p-card header="Curva da projeção" styleClass="chart-card">
        <app-trend-line [labels]="projectionLabels()" [values]="projectionValues()" title="" />
      </p-card>
      <p-card header="Atual × meta" styleClass="chart-card">
        @if (rebalance()?.items?.length) {
          <app-target-bars [data]="rebalanceBars()" />
        } @else {
          <p class="muted small">Sem dados de rebalanceamento.</p>
        }
      </p-card>
    </div>

    <section class="section">
      <h2>Rebalanceamento</h2>
      <p-card>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          @for (type of targetTypes(); track type) {
            <div class="field" style="min-width:110px">
              <label>{{ type }}</label>
              <input class="input" type="number" [(ngModel)]="target[type]" />
            </div>
          }
          <div style="align-self:flex-end;padding-bottom:2px">
            <p-button label="Comparar" (onClick)="runRebalance()" />
          </div>
        </div>

        @if (rebalance(); as r) {
          <p-table [value]="r.items" stripedRows styleClass="mt-2">
            <ng-template #header>
              <tr>
                <th>Tipo</th>
                <th>Meta</th>
                <th>Atual</th>
                <th>Desvio</th>
                <th>Mover</th>
              </tr>
            </ng-template>
            <ng-template #body let-item>
              <tr>
                <td>{{ item.type }}</td>
                <td>{{ item.targetPct }}%</td>
                <td>{{ item.currentPct }}%</td>
                <td>
                  <p-tag
                    [value]="item.driftPct + '%'"
                    [severity]="Math.abs(item.driftPct) > 5 ? 'warn' : 'success'"
                  />
                </td>
                <td>{{ money(item.move) }}</td>
              </tr>
            </ng-template>
          </p-table>
        }
      </p-card>
    </section>
  `,
  styles: [`.mt-2 { margin-top: 14px; }`],
})
export class AnalysisComponent {
  private readonly api = inject(ApiService);
  protected readonly Math = Math;

  readonly summary = signal<Summary | null>(null);
  readonly runway = signal<Runway | null>(null);
  readonly project = signal<Project | null>(null);
  readonly rebalance = signal<Rebalance | null>(null);
  readonly contribution = signal<ContributionMap | null>(null);
  readonly advice = signal<ContributionAdvice | null>(null);
  readonly loadingMap = signal(false);
  readonly loadingAdvice = signal(false);
  readonly mapError = signal<string | null>(null);

  aporte = 1000;

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

  readonly projectionLabels = computed(() => {
    const n = Math.max(1, Math.min(360, this.projectForm.months || 0));
    return Array.from({ length: n + 1 }, (_, i) => `M${i}`);
  });

  readonly projectionValues = computed(() => {
    const { principal, monthlyContribution, rateAnnual, months } = this.projectForm;
    const n = Math.max(1, Math.min(360, months || 0));
    const monthly = Math.pow(1 + (rateAnnual || 0) / 100, 1 / 12) - 1;
    let balance = principal || 0;
    const out = [Number(balance.toFixed(2))];
    for (let i = 1; i <= n; i += 1) {
      balance = balance * (1 + monthly) + (monthlyContribution || 0);
      out.push(Number(balance.toFixed(2)));
    }
    return out;
  });

  readonly rebalanceBars = computed(() =>
    (this.rebalance()?.items || []).map((i) => ({
      name: i.type,
      current: i.currentPct,
      target: i.targetPct,
    })),
  );

  readonly contributionDonut = computed(() =>
    (this.contribution()?.items || []).map((i) => ({ name: i.type, value: i.pct })),
  );

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

  runContribution() {
    const amount = Number(this.aporte);
    if (!amount || amount <= 0) {
      this.mapError.set('Informe quanto vai investir hoje.');
      return;
    }
    this.loadingMap.set(true);
    this.mapError.set(null);
    this.api
      .post<ContributionMap>('/analysis/contribution', { amount, target: this.target })
      .subscribe({
        next: (c) => {
          this.loadingMap.set(false);
          this.contribution.set(c);
        },
        error: (err) => {
          this.loadingMap.set(false);
          this.mapError.set(err?.error?.message || 'Não foi possível montar o mapa.');
        },
      });
  }

  runAdvice() {
    const amount = Number(this.aporte);
    if (!amount || amount <= 0) {
      this.mapError.set('Informe quanto vai investir hoje.');
      return;
    }
    this.loadingAdvice.set(true);
    this.mapError.set(null);
    this.api
      .post<{ map: ContributionMap; advice: ContributionAdvice }>('/analysis/contribution/advice', {
        amount,
        target: this.target,
      })
      .subscribe({
        next: (res) => {
          this.loadingAdvice.set(false);
          this.contribution.set(res.map);
          this.advice.set(res.advice);
        },
        error: (err) => {
          this.loadingAdvice.set(false);
          this.mapError.set(err?.error?.message || 'Não foi possível gerar a análise.');
        },
      });
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
