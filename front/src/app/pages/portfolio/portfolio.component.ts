import { SlicePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { SelectModule } from 'primeng/select';
import { ToolbarModule } from 'primeng/toolbar';
import { ApiService } from '../../core/api.service';
import { AllocationDonutComponent } from '../../shared/charts/allocation-donut.component';
import { PriceChartComponent } from '../../shared/charts/price-chart.component';

interface Portfolio {
  id: string;
  name: string;
  currency: string;
  isDefault: boolean;
  _count?: { positions: number };
}

interface AllocationItem {
  type?: string;
  symbol?: string;
  name?: string;
  value: number;
  pct: number;
}

interface Summary {
  portfolio: { id: string; name: string; currency: string };
  totalInvested: number;
  totalValue: number;
  pnl: number;
  pnlPct: number;
  positionsCount: number;
  allocation: { total: number; byType: AllocationItem[]; byAsset: AllocationItem[] };
}

interface Position {
  symbol: string;
  name: string;
  type: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  invested: number;
  currentValue: number;
  pnl: number;
  pnlPct: number;
  hasMarketPrice: boolean;
}

interface Asset {
  id: string;
  symbol: string;
  name: string;
  type: string;
}

interface Transaction {
  id: string;
  type: string;
  quantity: number;
  price: number;
  fees: number;
  date: string;
  asset: { symbol: string; name: string };
}

interface IncomeItem {
  assetId: string;
  symbol: string;
  name: string;
  totalReceived: number;
  last12m: number;
  dyPct: number;
  payments: number;
  lastDate: string | null;
}

interface IncomeSummary {
  totalReceived: number;
  totalLast12m: number;
  items: IncomeItem[];
}

interface PricePoint {
  date: string;
  close: number;
}

interface LevelsResponse {
  points: PricePoint[];
  supports: number[];
  resistances: number[];
  ma20: number | null;
  ma50: number | null;
  currency: string;
}

@Component({
  selector: 'app-portfolio',
  imports: [
    FormsModule,
    SlicePipe,
    CardModule,
    ButtonModule,
    TableModule,
    TagModule,
    SelectModule,
    ToolbarModule,
    AllocationDonutComponent,
    PriceChartComponent,
  ],
  template: `
    <h1 class="page-title">Carteira</h1>
    <p class="page-sub">Cadastre ativos e transações. Os números são calculados no servidor.</p>

    <p-toolbar>
      <ng-template #start>
        <p-select
          [options]="portfolioOptions()"
          [(ngModel)]="selectedPortfolioId"
          (onChange)="loadPortfolio($event.value)"
          placeholder="Selecione a carteira"
        />
      </ng-template>
      <ng-template #end>
        <div class="group" style="display:flex;gap:8px;flex-wrap:wrap">
          <input class="input" style="max-width:180px" [(ngModel)]="newPortfolioName" placeholder="nova carteira" />
          <p-button label="Criar" severity="secondary" [outlined]="true" (onClick)="createPortfolio()" />
          <p-button label="Importar CSV" severity="secondary" [outlined]="true" (onClick)="csvInput.click()" />
          <p-button label="Modelo CSV" severity="secondary" [outlined]="true" (onClick)="downloadTemplate()" />
          <p-button label="Exportar CSV" severity="secondary" [outlined]="true" (onClick)="downloadReport()" />
          <p-button label="Exportar PDF" severity="secondary" [outlined]="true" (onClick)="downloadPdf()" />
          <p-button label="Atualizar cotações" (onClick)="refreshQuotes()" />
          <input #csvInput type="file" accept=".csv,text/csv" style="display:none" (change)="onFileSelected($event)" />
        </div>
      </ng-template>
    </p-toolbar>

    @if (!portfolios().length) {
      <p-card header="Comece criando uma carteira" styleClass="section">
        <p class="muted small">Ex.: “Principal”, “Reserva”, “Internacional”.</p>
        <div style="display:flex;gap:8px;margin-top:12px">
          <input class="input" [(ngModel)]="newPortfolioName" placeholder="nome da carteira" />
          <p-button label="Criar carteira" (onClick)="createPortfolio()" />
        </div>
      </p-card>
    }

    @if (summary(); as s) {
      <div class="cards" style="margin-top:16px">
        <p-card header="Patrimônio">
          <div class="stat-value">{{ money(s.totalValue) }}</div>
          <div class="stat-hint">valor atual das posições</div>
        </p-card>
        <p-card header="Investido">
          <div class="stat-value">{{ money(s.totalInvested) }}</div>
          <div class="stat-hint">custo de aquisição</div>
        </p-card>
        <p-card header="Resultado">
          <div class="stat-value" [style.color]="s.pnl >= 0 ? 'var(--success)' : 'var(--danger)'">
            {{ money(s.pnl) }}
          </div>
          <div class="stat-hint">
            <p-tag [value]="s.pnlPct.toFixed(2) + '%'" [severity]="s.pnl >= 0 ? 'success' : 'danger'" />
          </div>
        </p-card>
        <p-card header="Posições">
          <div class="stat-value">{{ s.positionsCount }}</div>
          <div class="stat-hint">ativos na carteira</div>
        </p-card>
      </div>

      <div class="grid-2" style="margin-top:20px">
        <p-card header="Alocação por tipo" styleClass="chart-card">
          @if (s.allocation.byType.length) {
            <app-allocation-donut [data]="donutByType()" title="" />
          } @else {
            <p class="muted small">Sem posições ainda.</p>
          }
          <div class="list" style="margin-top:10px">
            @for (item of s.allocation.byType; track item.type) {
              <div>
                <div style="display:flex;justify-content:space-between;font-size:13px">
                  <span>{{ label(item.type) }}</span>
                  <p-tag [value]="item.pct.toFixed(1) + '%'" severity="secondary" />
                </div>
                <div style="height:8px;background:var(--border);border-radius:999px;overflow:hidden;margin-top:4px">
                  <div style="height:100%;background:var(--primary)" [style.width.%]="item.pct"></div>
                </div>
              </div>
            }
          </div>
        </p-card>

        <p-card header="Nova transação">
          <div class="field">
            <label>Ativo</label>
            <p-select
              [options]="assetOptions()"
              [(ngModel)]="tx.assetId"
              placeholder="selecione"
              appendTo="body"
              styleClass="w-full"
            />
          </div>
          <div class="grid-2">
            <div class="field">
              <label>Tipo</label>
              <p-select
                [options]="txTypeOptions"
                [(ngModel)]="tx.type"
                appendTo="body"
                styleClass="w-full"
              />
            </div>
            <div class="field">
              <label>Data</label>
              <input class="input" type="date" [(ngModel)]="tx.date" />
            </div>
            <div class="field">
              <label>Quantidade</label>
              <input class="input" type="number" [(ngModel)]="tx.quantity" />
            </div>
            <div class="field">
              <label>Preço</label>
              <input class="input" type="number" [(ngModel)]="tx.price" />
            </div>
          </div>
          <p-button label="Registrar" styleClass="mt-2" (onClick)="addTransaction()" />

          <hr style="border:0;border-top:1px solid var(--border);margin:18px 0" />
          <h3 style="font-size:14px;color:var(--muted)">Novo ativo</h3>
          <div class="grid-2">
            <div class="field">
              <label>Símbolo</label>
              <input class="input" [(ngModel)]="assetForm.symbol" placeholder="PETR4" />
            </div>
            <div class="field">
              <label>Tipo</label>
              <p-select
                [options]="assetTypeOptions"
                [(ngModel)]="assetForm.type"
                appendTo="body"
                styleClass="w-full"
              />
            </div>
          </div>
          <div class="field">
            <label>Nome</label>
            <input class="input" [(ngModel)]="assetForm.name" placeholder="Petrobras PN" />
          </div>
          <p-button label="Criar ativo" severity="secondary" [outlined]="true" (onClick)="createAsset()" />
        </p-card>
      </div>

      <section class="section">
        <h2>Cotação e proventos</h2>
        <div class="grid-2">
          <p-card header="Histórico de cotação">
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
              <p-select
                [options]="symbolOptions()"
                [(ngModel)]="selAsset"
                (onChange)="loadLevels()"
                placeholder="Ativo"
                appendTo="body"
              />
              <p-select
                [options]="periodOptions"
                [(ngModel)]="period"
                (onChange)="loadLevels()"
                appendTo="body"
              />
              <input
                class="input"
                style="max-width:130px"
                [(ngModel)]="customSymbol"
                placeholder="Outro ticker"
                (keyup.enter)="viewCustom()"
              />
              <p-button label="Ver" severity="secondary" [outlined]="true" size="small" (onClick)="viewCustom()" />
            </div>
            @if (historyLoading()) {
              <p class="muted small">Carregando histórico…</p>
            } @else if (historyError()) {
              <div class="alert error">{{ historyError() }}</div>
            } @else if (historyValues().length) {
              <app-price-chart
                [labels]="historyLabels()"
                [values]="historyValues()"
                [supports]="supports()"
                [resistances]="resistances()"
                [title]="selAsset + ' (' + priceCurrency() + ')'"
              />
              @if (historyStats(); as st) {
                <div class="stat-hint">
                  Mín {{ moneyC(st.min) }} · Máx {{ moneyC(st.max) }} · MM20 {{ st.ma20 ? moneyC(st.ma20) : '—' }} · MM50 {{ st.ma50 ? moneyC(st.ma50) : '—' }} ·
                  <p-tag [value]="(st.changePct >= 0 ? '+' : '') + st.changePct.toFixed(2) + '% no período'" [severity]="st.changePct >= 0 ? 'success' : 'danger'" />
                </div>
                <div class="stat-hint">
                  Suportes: {{ supportLabels() || '—' }} ·
                  Resistências: {{ resistanceLabels() || '—' }}
                </div>
              }
            }
          </p-card>

          <p-card header="Proventos recebidos">
            @if (income(); as inc) {
              <div class="stat-value">{{ money(inc.totalReceived) }}</div>
              <div class="stat-hint">total · {{ money(inc.totalLast12m) }} nos últimos 12 meses</div>
              <p-table [value]="inc.items" stripedRows [scrollable]="true" scrollHeight="280px" styleClass="mt-2">
                <ng-template #header>
                  <tr><th>Ativo</th><th>12 meses</th><th>DY recebido</th><th>Total</th></tr>
                </ng-template>
                <ng-template #body let-item>
                  <tr>
                    <td><strong>{{ item.symbol }}</strong></td>
                    <td>{{ money(item.last12m) }}</td>
                    <td><p-tag [value]="item.dyPct.toFixed(2) + '%'" severity="success" /></td>
                    <td>{{ money(item.totalReceived) }}</td>
                  </tr>
                </ng-template>
                <ng-template #emptymessage>
                  <tr><td colspan="4" class="muted">Nenhum dividendo/juros registrado. Registre transações DIVIDENDO.</td></tr>
                </ng-template>
              </p-table>
            } @else {
              <p class="muted small">Sem dados de proventos.</p>
            }
          </p-card>
        </div>
      </section>

      <section class="section">
        <h2>Posições</h2>
        <p-table [value]="positions()" stripedRows [scrollable]="true" scrollHeight="420px">
          <ng-template #header>
            <tr>
              <th>Ativo</th>
              <th>Qtd</th>
              <th>Preço médio</th>
              <th>Investido</th>
              <th>Atual</th>
              <th>Resultado</th>
            </tr>
          </ng-template>
          <ng-template #body let-p>
            <tr>
              <td><strong>{{ p.symbol }}</strong> <span class="muted small">{{ p.name }}</span></td>
              <td>{{ p.quantity }}</td>
              <td>{{ money(p.averagePrice) }}</td>
              <td>{{ money(p.invested) }}</td>
              <td>
                {{ money(p.currentValue) }}
                @if (!p.hasMarketPrice) { <p-tag value="sem cotação" severity="secondary" /> }
              </td>
              <td [style.color]="p.pnl >= 0 ? 'var(--success)' : 'var(--danger)'">
                {{ money(p.pnl) }} ({{ p.pnlPct.toFixed(2) }}%)
              </td>
            </tr>
          </ng-template>
          <ng-template #emptymessage>
            <tr><td colspan="6" class="muted">Nenhuma posição.</td></tr>
          </ng-template>
        </p-table>
      </section>

      <section class="section">
        <h2>Transações recentes</h2>
        <div class="list">
          @for (t of transactions(); track t.id) {
            <div class="row">
              <div>
                <div class="name">{{ t.asset.symbol }} — {{ label(t.type) }}</div>
                <div class="meta">{{ t.date | slice:0:10 }} · {{ t.quantity }} × {{ money(t.price) }}</div>
              </div>
              <p-button label="Excluir" severity="secondary" [outlined]="true" size="small" (onClick)="removeTransaction(t.id)" />
            </div>
          } @empty {
            <p class="muted small">Nenhuma transação.</p>
          }
        </div>
      </section>
    }

    @if (message()) {
      <div class="alert" [class.ok]="ok()" [class.error]="!ok()">{{ message() }}</div>
    }
  `,
  styles: [`.mt-2 { margin-top: 14px; }`],
})
export class PortfolioComponent {
  private readonly api = inject(ApiService);

  readonly portfolios = signal<Portfolio[]>([]);
  readonly summary = signal<Summary | null>(null);
  readonly positions = signal<Position[]>([]);
  readonly transactions = signal<Transaction[]>([]);
  readonly assets = signal<Asset[]>([]);
  readonly message = signal<string | null>(null);
  readonly ok = signal(false);
  readonly income = signal<IncomeSummary | null>(null);
  readonly historyLabels = signal<string[]>([]);
  readonly historyValues = signal<number[]>([]);
  readonly supports = signal<number[]>([]);
  readonly resistances = signal<number[]>([]);
  readonly ma20 = signal<number | null>(null);
  readonly ma50 = signal<number | null>(null);
  readonly priceCurrency = signal('BRL');
  readonly historyLoading = signal(false);
  readonly historyError = signal<string | null>(null);

  readonly periodOptions = [
    { label: '30 dias', value: '1mo' },
    { label: '3 meses', value: '3mo' },
    { label: '6 meses', value: '6mo' },
    { label: '1 ano', value: '1y' },
    { label: '5 anos', value: '5y' },
  ];

  selectedPortfolioId = '';
  newPortfolioName = '';
  selAsset = '';
  customSymbol = '';
  period = '1y';
  tx = { assetId: '', type: 'BUY', quantity: 1, price: 0, date: new Date().toISOString().slice(0, 10) };
  assetForm = { symbol: '', name: '', type: 'STOCK' };

  readonly txTypeOptions = [
    { label: 'Compra', value: 'BUY' },
    { label: 'Venda', value: 'SELL' },
    { label: 'Dividendo', value: 'DIVIDEND' },
    { label: 'Juros', value: 'INTEREST' },
  ];

  readonly assetTypeOptions = [
    { label: 'Ação', value: 'STOCK' },
    { label: 'FII', value: 'FII' },
    { label: 'ETF', value: 'ETF' },
    { label: 'Renda fixa', value: 'FIXED_INCOME' },
    { label: 'Cripto', value: 'CRYPTO' },
    { label: 'Caixa', value: 'CASH' },
  ];

  readonly portfolioOptions = computed(() =>
    this.portfolios().map((p) => ({
      label: p.name + (p.isDefault ? ' (padrão)' : ''),
      value: p.id,
    })),
  );

  readonly assetOptions = computed(() =>
    this.assets().map((a) => ({ label: `${a.symbol} - ${a.name}`, value: a.id })),
  );

  readonly symbolOptions = computed(() =>
    this.positions().map((p) => ({ label: p.symbol, value: p.symbol })),
  );

  readonly supportLabels = computed(() =>
    this.supports().map((v) => this.moneyC(v)).join(' · '),
  );

  readonly resistanceLabels = computed(() =>
    this.resistances().map((v) => this.moneyC(v)).join(' · '),
  );

  constructor() {
    this.loadPortfolios();
    this.loadAssets();
  }

  donutByType() {
    return (this.summary()?.allocation.byType || []).map((a) => ({
      name: this.label(a.type),
      value: a.pct,
    }));
  }

  loadPortfolios() {
    this.api.get<Portfolio[]>('/portfolios').subscribe({
      next: (items) => {
        this.portfolios.set(items);
        if (!this.selectedPortfolioId && items.length) {
          const preferred = items.find((p) => p.isDefault) || items[0];
          this.selectedPortfolioId = preferred.id;
          this.loadPortfolio(preferred.id);
        }
      },
    });
  }

  loadPortfolio(id: string) {
    if (!id) return;
    this.api.get<Summary>(`/portfolios/${id}/summary`).subscribe({
      next: (summary) => this.summary.set(summary),
      error: () => this.summary.set(null),
    });
    this.api.get<Position[]>(`/portfolios/${id}/positions`).subscribe({
      next: (positions) => {
        this.positions.set(positions);
        if (!this.selAsset && positions.length) {
          this.selAsset = positions[0].symbol;
          this.loadLevels();
        }
      },
    });
    this.api.get<Transaction[]>(`/portfolios/${id}/transactions`).subscribe({
      next: (transactions) => this.transactions.set(transactions),
    });
    this.api.get<IncomeSummary>(`/portfolios/${id}/income`).subscribe({
      next: (income) => this.income.set(income),
      error: () => this.income.set(null),
    });
  }

  viewCustom() {
    const symbol = this.customSymbol.trim().toUpperCase();
    if (!symbol) return;
    this.selAsset = symbol;
    this.customSymbol = '';
    this.loadLevels();
  }

  loadLevels() {
    if (!this.selAsset) return;
    this.historyLoading.set(true);
    this.historyError.set(null);
    this.api
      .get<LevelsResponse>(`/market/levels?symbol=${encodeURIComponent(this.selAsset)}&range=${this.period}`)
      .subscribe({
        next: (res) => {
          this.historyLoading.set(false);
          const points = res.points || [];
          this.historyLabels.set(points.map((p) => p.date.slice(0, 10)));
          this.historyValues.set(points.map((p) => p.close));
          this.supports.set(res.supports || []);
          this.resistances.set(res.resistances || []);
          this.ma20.set(res.ma20 ?? null);
          this.ma50.set(res.ma50 ?? null);
          this.priceCurrency.set(res.currency || 'BRL');
        },
        error: (err) => {
          this.historyLoading.set(false);
          this.historyLabels.set([]);
          this.historyValues.set([]);
          this.supports.set([]);
          this.resistances.set([]);
          this.ma20.set(null);
          this.ma50.set(null);
          this.historyError.set(err?.error?.message || 'Sem histórico para este ativo.');
        },
      });
  }

  historyStats(): { min: number; max: number; changePct: number; ma20: number | null; ma50: number | null } | null {
    const values = this.historyValues();
    if (values.length < 2) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const first = values[0];
    const last = values[values.length - 1];
    return {
      min,
      max,
      changePct: first > 0 ? ((last - first) / first) * 100 : 0,
      ma20: this.ma20(),
      ma50: this.ma50(),
    };
  }

  loadAssets() {
    this.api.get<Asset[]>('/assets').subscribe({ next: (assets) => this.assets.set(assets) });
  }

  createPortfolio() {
    const name = this.newPortfolioName.trim();
    if (!name) return;
    this.api.post<Portfolio>('/portfolios', { name, isDefault: true }).subscribe({
      next: (portfolio) => {
        this.newPortfolioName = '';
        this.ok.set(true);
        this.message.set('Carteira criada.');
        this.loadPortfolios();
        this.selectedPortfolioId = portfolio.id;
        this.loadPortfolio(portfolio.id);
      },
      error: (err) => this.fail(err),
    });
  }

  createAsset() {
    const { symbol, name, type } = this.assetForm;
    if (!symbol || !name) {
      this.ok.set(false);
      this.message.set('Preencha símbolo e nome do ativo.');
      return;
    }
    this.api.post<Asset>('/assets', { symbol, name, type }).subscribe({
      next: () => {
        this.assetForm = { symbol: '', name: '', type: 'STOCK' };
        this.ok.set(true);
        this.message.set('Ativo criado.');
        this.loadAssets();
      },
      error: (err) => this.fail(err),
    });
  }

  addTransaction() {
    if (!this.selectedPortfolioId) return;
    const body = {
      assetId: this.tx.assetId,
      type: this.tx.type,
      quantity: Number(this.tx.quantity),
      price: Number(this.tx.price),
      date: this.tx.date,
    };
    if (!body.assetId || body.quantity <= 0 || body.price < 0) {
      this.ok.set(false);
      this.message.set('Selecione o ativo e informe quantidade/preço.');
      return;
    }
    this.api.post(`/portfolios/${this.selectedPortfolioId}/transactions`, body).subscribe({
      next: () => {
        this.ok.set(true);
        this.message.set('Transação registrada.');
        this.loadPortfolio(this.selectedPortfolioId);
      },
      error: (err) => this.fail(err),
    });
  }

  removeTransaction(id: string) {
    this.api.delete(`/transactions/${id}`).subscribe({
      next: () => this.loadPortfolio(this.selectedPortfolioId),
      error: () => {
        this.ok.set(false);
        this.message.set('Não foi possível excluir.');
      },
    });
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.selectedPortfolioId) return;

    const reader = new FileReader();
    reader.onload = () => {
      this.api
        .post<{ imported: number; errors: unknown[]; status: string }>('/import/transactions', {
          portfolioId: this.selectedPortfolioId,
          csv: String(reader.result || ''),
        })
        .subscribe({
          next: (res) => {
            this.ok.set(res.errors.length === 0);
            this.message.set(
              `Importação ${res.status}: ${res.imported} transação(ões), ${res.errors.length} erro(s).`,
            );
            this.loadPortfolio(this.selectedPortfolioId);
          },
          error: (err) => this.fail(err),
        });
    };
    reader.readAsText(file);
    input.value = '';
  }

  downloadTemplate() {
    this.api.getBlob('/import/template').subscribe({
      next: (blob) => this.saveBlob(blob, 'modelo-importacao.csv'),
      error: (err) => this.fail(err),
    });
  }

  downloadReport() {
    if (!this.selectedPortfolioId) return;
    this.api.getBlob(`/reports/portfolio/${this.selectedPortfolioId}/csv`).subscribe({
      next: (blob) => this.saveBlob(blob, 'relatorio-carteira.csv'),
      error: (err) => this.fail(err),
    });
  }

  downloadPdf() {
    if (!this.selectedPortfolioId) return;
    this.api.getBlob(`/reports/portfolio/${this.selectedPortfolioId}/pdf`).subscribe({
      next: (blob) => this.saveBlob(blob, 'relatorio-carteira.pdf'),
      error: (err) => this.fail(err),
    });
  }

  refreshQuotes() {
    this.api
      .post<{ total: number; updated: number; failed: number }>('/market/refresh', {})
      .subscribe({
        next: (res) => {
          this.ok.set(res.failed === 0);
          this.message.set(
            `Cotações: ${res.updated}/${res.total} atualizadas${res.failed ? `, ${res.failed} falha(s)` : ''}.`,
          );
          this.loadPortfolio(this.selectedPortfolioId);
        },
        error: (err) => this.fail(err),
      });
  }

  private saveBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  money(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  }

  moneyC(value: number): string {
    try {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: this.priceCurrency() || 'BRL' }).format(value || 0);
    } catch {
      return `${this.priceCurrency()} ${Number(value || 0).toFixed(2)}`;
    }
  }

  label(value?: string): string {
    const labels: Record<string, string> = {
      STOCK: 'Ações',
      FII: 'FIIs',
      ETF: 'ETFs',
      FIXED_INCOME: 'Renda fixa',
      CRYPTO: 'Cripto',
      CASH: 'Caixa',
      BUY: 'Compra',
      SELL: 'Venda',
      DIVIDEND: 'Dividendo',
      INTEREST: 'Juros',
    };
    return value ? labels[value] || value : '—';
  }

  private fail(err: any) {
    this.ok.set(false);
    this.message.set(err?.error?.message || 'Falha na operação.');
  }
}
