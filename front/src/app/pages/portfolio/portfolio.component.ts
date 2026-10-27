import { SlicePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

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
  imports: [FormsModule, SlicePipe],
  template: `
    <h1 class="page-title">Carteira</h1>
    <p class="page-sub">Cadastre ativos e transações. Os números são calculados no servidor.</p>

    <div class="row" style="margin-bottom:16px">
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <label class="small muted" for="portfolio">Carteira</label>
        <select
          id="portfolio"
          class="input"
          style="max-width:260px"
          [(ngModel)]="selectedPortfolioId"
          (ngModelChange)="loadPortfolio($event)"
        >
          @for (p of portfolios(); track p.id) {
            <option [value]="p.id">{{ p.name }}{{ p.isDefault ? ' (padrão)' : '' }}</option>
          }
        </select>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <input class="input" style="max-width:180px" [(ngModel)]="newPortfolioName" placeholder="nova carteira" />
        <button class="btn secondary" (click)="createPortfolio()">Criar</button>
        <button class="btn secondary" (click)="csvInput.click()">Importar CSV</button>
        <button class="btn secondary" (click)="downloadTemplate()">Modelo CSV</button>
        <button class="btn secondary" (click)="downloadReport()">Exportar CSV</button>
        <input #csvInput type="file" accept=".csv,text/csv" style="display:none" (change)="onFileSelected($event)" />
      </div>
    </div>

    @if (!portfolios().length) {
      <div class="card">
        <h3>Comece criando uma carteira</h3>
        <p class="muted small">Ex.: “Principal”, “Reserva”, “Internacional”.</p>
        <div style="display:flex;gap:8px;margin-top:12px">
          <input class="input" [(ngModel)]="newPortfolioName" placeholder="nome da carteira" />
          <button class="btn" (click)="createPortfolio()">Criar carteira</button>
        </div>
      </div>
    }

    @if (summary(); as s) {
      <div class="cards">
        <div class="card">
          <h3>Patrimônio</h3>
          <div class="value">{{ money(s.totalValue) }}</div>
          <div class="hint">valor atual das posições</div>
        </div>
        <div class="card">
          <h3>Investido</h3>
          <div class="value">{{ money(s.totalInvested) }}</div>
          <div class="hint">custo de aquisição</div>
        </div>
        <div class="card">
          <h3>Resultado</h3>
          <div class="value" [style.color]="s.pnl >= 0 ? 'var(--success)' : 'var(--danger)'">
            {{ money(s.pnl) }}
          </div>
          <div class="hint">{{ s.pnlPct.toFixed(2) }}%</div>
        </div>
        <div class="card">
          <h3>Posições</h3>
          <div class="value">{{ s.positionsCount }}</div>
          <div class="hint">ativos na carteira</div>
        </div>
      </div>

      <div class="grid-2" style="margin-top:20px">
        <section class="card">
          <h3>Alocação por tipo</h3>
          <div class="list" style="margin-top:10px">
            @for (item of s.allocation.byType; track item.type) {
              <div>
                <div style="display:flex;justify-content:space-between;font-size:13px">
                  <span>{{ label(item.type) }}</span>
                  <span class="muted">{{ item.pct.toFixed(1) }}%</span>
                </div>
                <div style="height:8px;background:#eef0f3;border-radius:999px;overflow:hidden;margin-top:4px">
                  <div style="height:100%;background:var(--primary)" [style.width.%]="item.pct"></div>
                </div>
              </div>
            } @empty {
              <p class="muted small">Sem posições ainda.</p>
            }
          </div>
        </section>

        <section class="card">
          <h3>Nova transação</h3>
          <div class="field">
            <label>Ativo</label>
            <select class="input" [(ngModel)]="tx.assetId">
              <option value="">selecione</option>
              @for (asset of assets(); track asset.id) {
                <option [value]="asset.id">{{ asset.symbol }} — {{ asset.name }}</option>
              }
            </select>
          </div>
          <div class="grid-2">
            <div class="field">
              <label>Tipo</label>
              <select class="input" [(ngModel)]="tx.type">
                <option value="BUY">Compra</option>
                <option value="SELL">Venda</option>
                <option value="DIVIDEND">Dividendo</option>
                <option value="INTEREST">Juros</option>
              </select>
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
          <button class="btn" style="margin-top:14px" (click)="addTransaction()">Registrar</button>

          <hr style="border:0;border-top:1px solid var(--border);margin:18px 0" />
          <h3>Novo ativo</h3>
          <div class="grid-2">
            <div class="field">
              <label>Símbolo</label>
              <input class="input" [(ngModel)]="assetForm.symbol" placeholder="PETR4" />
            </div>
            <div class="field">
              <label>Tipo</label>
              <select class="input" [(ngModel)]="assetForm.type">
                <option value="STOCK">Ação</option>
                <option value="FII">FII</option>
                <option value="ETF">ETF</option>
                <option value="FIXED_INCOME">Renda fixa</option>
                <option value="CRYPTO">Cripto</option>
                <option value="CASH">Caixa</option>
              </select>
            </div>
          </div>
          <div class="field">
            <label>Nome</label>
            <input class="input" [(ngModel)]="assetForm.name" placeholder="Petrobras PN" />
          </div>
          <button class="btn secondary" style="margin-top:12px" (click)="createAsset()">Criar ativo</button>
        </section>
      </div>

      <section class="section">
        <h2>Posições</h2>
        <div class="card" style="padding:0;overflow:auto">
          <table style="width:100%;border-collapse:collapse;font-size:13.5px">
            <thead>
              <tr style="text-align:left;background:#f9fafb">
                <th style="padding:10px 12px">Ativo</th>
                <th style="padding:10px 12px">Qtd</th>
                <th style="padding:10px 12px">Preço médio</th>
                <th style="padding:10px 12px">Investido</th>
                <th style="padding:10px 12px">Atual</th>
                <th style="padding:10px 12px">Resultado</th>
              </tr>
            </thead>
            <tbody>
              @for (p of positions(); track p.symbol) {
                <tr style="border-top:1px solid var(--border)">
                  <td style="padding:10px 12px"><strong>{{ p.symbol }}</strong> <span class="muted small">{{ p.name }}</span></td>
                  <td style="padding:10px 12px">{{ p.quantity }}</td>
                  <td style="padding:10px 12px">{{ money(p.averagePrice) }}</td>
                  <td style="padding:10px 12px">{{ money(p.invested) }}</td>
                  <td style="padding:10px 12px">
                    {{ money(p.currentValue) }}
                    @if (!p.hasMarketPrice) { <span class="badge off">sem cotação</span> }
                  </td>
                  <td style="padding:10px 12px" [style.color]="p.pnl >= 0 ? 'var(--success)' : 'var(--danger)'">
                    {{ money(p.pnl) }} ({{ p.pnlPct.toFixed(2) }}%)
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="6" style="padding:16px" class="muted">Nenhuma posição.</td></tr>
              }
            </tbody>
          </table>
        </div>
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
              <button class="btn secondary" (click)="removeTransaction(t.id)">Excluir</button>
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

  constructor() {
    this.loadPortfolios();
    this.loadAssets();
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
