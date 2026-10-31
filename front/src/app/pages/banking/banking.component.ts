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
}

interface MonthBucket {
  month: string;
  income: number;
  expense: number;
  net: number;
  count: number;
}

interface Summary {
  income: number;
  expense: number;
  net: number;
  count: number;
  byMonth: MonthBucket[];
}

@Component({
  selector: 'app-banking',
  imports: [FormsModule, DatePipe],
  template: `
    <h1 class="page-title">Extratos bancários</h1>
    <p class="page-sub">
      Importe seus extratos (OFX/CSV) para acompanhar entradas, saídas e saldo — PF e empresas.
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
        <label>Formato</label>
        <select class="input" [(ngModel)]="format">
          <option value="OFX">OFX (.ofx)</option>
          <option value="CSV">CSV</option>
        </select>
      </div>
      <div class="field">
        <label>Conteúdo do arquivo</label>
        <textarea class="input" rows="6" [(ngModel)]="content" placeholder="Cole o conteúdo do arquivo OFX ou CSV…"></textarea>
      </div>
      @if (error()) {
        <div class="alert error">{{ error() }}</div>
      }
      @if (okMsg()) {
        <div class="alert ok">{{ okMsg() }}</div>
      }
      <button class="btn" [disabled]="importing() || !name.trim() || !content.trim()" (click)="importStatement()">
        {{ importing() ? 'Importando…' : 'Importar' }}
      </button>
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
              <div>
                <div class="name">{{ transaction.description }}</div>
                <div class="meta">{{ transaction.date | date: 'dd/MM/yyyy' }}</div>
              </div>
              <div class="hint {{ transaction.amount >= 0 ? 'up' : 'down' }}">
                {{ transaction.amount >= 0 ? '+' : '' }}R$ {{ fmt(transaction.amount) }}
              </div>
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
  readonly selected = signal<BankStatement | null>(null);
  readonly transactions = signal<BankTransaction[]>([]);
  readonly importing = signal(false);
  readonly error = signal<string | null>(null);
  readonly okMsg = signal<string | null>(null);

  name = '';
  institution = '';
  format = 'OFX';
  content = '';

  constructor() {
    this.load();
  }

  load() {
    this.api.get<BankStatement[]>('/banking/statements').subscribe({
      next: (items) => this.statements.set(items),
    });
    this.api.get<Summary>('/banking/summary').subscribe({
      next: (summary) => this.summary.set(summary),
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
