import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

interface BankStatement {
  id: string;
  name: string;
  institution?: string | null;
  source: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  importedAt: string;
  _count?: { transactions: number };
}

interface BankTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: string;
  category?: string | null;
  reconciledAt?: string | null;
  portfolioTransactionId?: string | null;
}

interface Reconciliation {
  matched: BankTransaction[];
  unmatched: BankTransaction[];
}

interface MonthBucket {
  month: string;
  income: number;
  expense: number;
  net: number;
  count: number;
}

interface CategoryBucket {
  category: string;
  income: number;
  expense: number;
  count: number;
}

interface Summary {
  income: number;
  expense: number;
  net: number;
  count: number;
  byMonth: MonthBucket[];
  byCategory: CategoryBucket[];
}

@Component({
  selector: 'app-banking',
  imports: [FormsModule, DatePipe],
  template: `
    <h1 class="page-title">Extratos bancários</h1>
    <p class="page-sub">
      Importe seus extratos (OFX/CSV/PDF) para acompanhar entradas, saídas, saldo e categorias.
    </p>

    <div class="cards" style="margin-bottom:20px">
      <div class="card">
        <h3>Entradas</h3>
        <div class="value" style="color:var(--success)">R$ {{ fmt(summary()?.income) }}</div>
      </div>
      <div class="card">
        <h3>Saídas</h3>
        <div class="value" style="color:var(--danger)">R$ {{ fmt(summary()?.expense) }}</div>
      </div>
      <div class="card">
        <h3>Saldo</h3>
        <div class="value">R$ {{ fmt(summary()?.net) }}</div>
      </div>
    </div>

    <section class="section">
      <h2>Saídas por categoria</h2>
      @if (!summary()?.byCategory?.length) {
        <div class="muted">Sem dados ainda.</div>
      } @else {
        <div class="cat-list">
          @for (cat of expenseCategories(); track cat.category) {
            <div class="cat-row">
              <span class="cat-label">{{ cat.category }}</span>
              <div class="cat-bar">
                <div class="cat-bar-fill" [style.width.%]="barWidth(cat.expense)"></div>
              </div>
              <span class="muted small">R$ {{ fmt(cat.expense) }}</span>
            </div>
          }
        </div>
      }
    </section>

    <section class="section">
      <div class="insights-head">
        <div>
          <h2>Conciliação com a carteira</h2>
          <p class="muted small">
            Casa lançamentos do extrato com transações da carteira por valor e data (±3 dias).
          </p>
        </div>
        <button class="btn" [disabled]="reconciling()" (click)="runReconcile()">
          {{ reconciling() ? 'Conciliando…' : 'Conciliar com a carteira' }}
        </button>
      </div>

      @if (reconciliation()) {
        <div class="row">
          <div>
            <div class="name">{{ reconciliation()!.matched.length }} conciliada(s)</div>
            <div class="meta">{{ reconciliation()!.unmatched.length }} pendente(s)</div>
          </div>
        </div>
      }

      @if (reconciliation()?.unmatched?.length) {
        <div class="list" style="margin-top:8px">
          @for (transaction of reconciliation()!.unmatched.slice(0, 10); track transaction.id) {
            <div class="row">
              <div>
                <div class="name">{{ transaction.description }}</div>
                <div class="meta">{{ transaction.date | date: 'dd/MM/yyyy' }}</div>
              </div>
              <span class="hint {{ transaction.amount >= 0 ? 'up' : 'down' }}">
                {{ transaction.amount >= 0 ? '+' : '' }}R$ {{ fmt(transaction.amount) }}
              </span>
            </div>
          }
        </div>
      }
    </section>

    <section class="section">
      <h2>Importar extrato</h2>
      <div class="grid-2">
        <div class="field">
          <label>Nome da conta</label>
          <input class="input" [(ngModel)]="name" placeholder="Ex.: Conta PF — Nubank" />
        </div>
        <div class="field">
          <label>Instituição</label>
          <input class="input" [(ngModel)]="institution" placeholder="Ex.: Nubank" />
        </div>
      </div>

      <div class="field">
        <label>Enviar arquivo (OFX, CSV ou PDF)</label>
        <input class="input" type="file" accept=".ofx,.csv,.pdf" (change)="onFileSelected($event)" />
        <button class="btn" style="margin-top:8px" [disabled]="uploading() || !file || !name.trim()" (click)="uploadFile()">
          {{ uploading() ? 'Enviando…' : 'Enviar arquivo' }}
        </button>
      </div>

      <div class="field" style="margin-top:16px">
        <label>…ou cole o conteúdo (OFX/CSV)</label>
        <select class="input" [(ngModel)]="format" style="margin-bottom:8px">
          <option value="OFX">OFX (.ofx)</option>
          <option value="CSV">CSV</option>
        </select>
        <textarea class="input" rows="5" [(ngModel)]="content" placeholder="Cole o conteúdo do arquivo…"></textarea>
        <button class="btn" style="margin-top:8px" [disabled]="importing() || !name.trim() || !content.trim()" (click)="importStatement()">
          {{ importing() ? 'Importando…' : 'Importar conteúdo' }}
        </button>
      </div>

      @if (error()) {
        <div class="alert error">{{ error() }}</div>
      }
      @if (okMsg()) {
        <div class="alert ok">{{ okMsg() }}</div>
      }
    </section>

    <section class="section">
      <h2>Extratos importados</h2>
      @if (!statements().length) {
        <div class="muted">Nenhum extrato ainda.</div>
      }
      <div class="list">
        @for (statement of statements(); track statement.id) {
          <div class="row" style="cursor:pointer" (click)="select(statement.id)">
            <div>
              <div class="name">
                {{ statement.name }}
                <span class="badge off">{{ statement.source }}</span>
              </div>
              <div class="meta">
                {{ statement._count?.transactions || 0 }} transações
                @if (statement.institution) { · {{ statement.institution }} }
              </div>
            </div>
            <button class="btn secondary" (click)="remove(statement.id, $event)">Excluir</button>
          </div>
        }
      </div>
    </section>

    @if (selected()) {
      <section class="section">
        <h2>Transações — {{ selected()?.name }}</h2>
        <div class="list">
          @for (transaction of transactions(); track transaction.id) {
            <div class="row">
              <div style="flex:1">
                <div class="name">
                  {{ transaction.description }}
                  @if (transaction.reconciledAt) {
                    <span class="badge ok">conciliado</span>
                  }
                </div>
                <div class="meta">{{ transaction.date | date: 'dd/MM/yyyy' }}</div>
              </div>
              <div class="hint {{ transaction.amount >= 0 ? 'up' : 'down' }}">
                {{ transaction.amount >= 0 ? '+' : '' }}R$ {{ fmt(transaction.amount) }}
              </div>
              <select class="input" style="max-width:150px" [value]="transaction.category || 'Outros'" (change)="changeCategory(transaction.id, $event)">
                @for (category of categories(); track category) {
                  <option [value]="category">{{ category }}</option>
                }
              </select>
            </div>
          }
        </div>
      </section>
    }
  `,
})
export class BankingComponent {
  private readonly api = inject(ApiService);

  readonly statements = signal<BankStatement[]>([]);
  readonly summary = signal<Summary | null>(null);
  readonly categories = signal<string[]>([]);
  readonly reconciliation = signal<Reconciliation | null>(null);
  readonly selected = signal<BankStatement | null>(null);
  readonly transactions = signal<BankTransaction[]>([]);
  readonly importing = signal(false);
  readonly uploading = signal(false);
  readonly reconciling = signal(false);
  readonly error = signal<string | null>(null);
  readonly okMsg = signal<string | null>(null);

  name = '';
  institution = '';
  format = 'OFX';
  content = '';
  file: File | null = null;

  constructor() {
    this.load();
    this.api.get<string[]>('/banking/categories').subscribe({
      next: (items) => this.categories.set(items),
    });
    this.loadReconciliation();
  }

  loadReconciliation() {
    this.api.get<Reconciliation>('/banking/reconciliation').subscribe({
      next: (result) => this.reconciliation.set(result),
    });
  }

  runReconcile() {
    this.reconciling.set(true);
    this.error.set(null);
    this.okMsg.set(null);
    this.api.post<{ matched: number; unmatched: number; total: number }>('/banking/reconcile', {}).subscribe({
      next: (res) => {
        this.reconciling.set(false);
        this.okMsg.set(`Conciliação: ${res.matched} casada(s), ${res.unmatched} pendente(s).`);
        this.load();
        this.loadReconciliation();
      },
      error: (err) => {
        this.reconciling.set(false);
        this.error.set(err?.error?.message || 'Falha ao conciliar.');
      },
    });
  }

  load() {
    this.api.get<BankStatement[]>('/banking/statements').subscribe({
      next: (items) => this.statements.set(items),
    });
    this.api.get<Summary>('/banking/summary').subscribe({
      next: (summary) => this.summary.set(summary),
    });
  }

  expenseCategories(): CategoryBucket[] {
    return (this.summary()?.byCategory || []).filter((c) => c.expense < 0);
  }

  barWidth(expense: number): number {
    const max = Math.max(1, ...(this.summary()?.byCategory || []).map((c) => Math.abs(c.expense)));
    return Math.round((Math.abs(expense) / max) * 100);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    this.file = input.files?.[0] || null;
  }

  uploadFile() {
    if (!this.file || !this.name.trim()) return;
    this.uploading.set(true);
    this.error.set(null);
    this.okMsg.set(null);

    const formData = new FormData();
    formData.append('file', this.file);
    formData.append('name', this.name.trim());
    if (this.institution.trim()) formData.append('institution', this.institution.trim());

    this.api.postFormData<{ imported: number }>('/banking/statements/upload', formData).subscribe({
      next: (res) => {
        this.uploading.set(false);
        this.okMsg.set(`${res.imported} transação(ões) importada(s).`);
        this.file = null;
        this.name = '';
        this.institution = '';
        this.load();
      },
      error: (err) => {
        this.uploading.set(false);
        this.error.set(err?.error?.message || 'Falha ao enviar o arquivo.');
      },
    });
  }

  importStatement() {
    this.importing.set(true);
    this.error.set(null);
    this.okMsg.set(null);
    this.api
      .post<{ imported: number }>('/banking/statements', {
        name: this.name,
        institution: this.institution || undefined,
        format: this.format,
        content: this.content,
      })
      .subscribe({
        next: (res) => {
          this.importing.set(false);
          this.okMsg.set(`${res.imported} transação(ões) importada(s).`);
          this.content = '';
          this.name = '';
          this.institution = '';
          this.load();
        },
        error: (err) => {
          this.importing.set(false);
          this.error.set(err?.error?.message || 'Falha ao importar.');
        },
      });
  }

  select(id: string) {
    const statement = this.statements().find((s) => s.id === id);
    this.selected.set(statement || null);
    this.api
      .get<{ transactions: BankTransaction[] }>(`/banking/statements/${id}`)
      .subscribe({
        next: (res) => this.transactions.set(res.transactions),
      });
  }

  changeCategory(id: string, event: Event) {
    const category = (event.target as HTMLSelectElement).value;
    this.api.patch(`/banking/transactions/${id}`, { category }).subscribe({
      next: () => this.load(),
    });
  }

  remove(id: string, event: Event) {
    event.stopPropagation();
    this.api.delete(`/banking/statements/${id}`).subscribe({
      next: () => {
        if (this.selected()?.id === id) {
          this.selected.set(null);
          this.transactions.set([]);
        }
        this.load();
      },
    });
  }

  fmt(value: number | undefined | null): string {
    if (value == null || !Number.isFinite(value)) return '0,00';
    return Math.abs(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
