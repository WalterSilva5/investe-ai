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

  selectedPortfolioId = '';
  newPortfolioName = '';
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
      next: (positions) => this.positions.set(positions),
    });
    this.api.get<Transaction[]>(`/portfolios/${id}/transactions`).subscribe({
      next: (transactions) => this.transactions.set(transactions),
    });
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
