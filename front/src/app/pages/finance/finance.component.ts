import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../../core/api.service';

interface FinanceBook {
  id: string;
  kind: string;
  label: string;
  cashBalance: number;
  emergencyReserve: number;
  investable: number;
  monthlyIncome: number;
  monthlyExpense: number;
  monthlySurplus: number;
  runwayMonths: number | null;
}

interface FinanceSummary {
  books: FinanceBook[];
  cashTotal: number;
  reserved: number;
  investable: number;
  monthlySurplus: number;
  hasData: boolean;
}

interface FinanceEntry {
  id: string;
  kind: string;
  amount: number;
  category: string | null;
  note: string | null;
  date: string;
}

@Component({
  selector: 'app-finance',
  imports: [FormsModule, CommonModule, CardModule, ButtonModule, TagModule],
  template: `
    <h1 class="page-title">Finanças</h1>
    <p class="page-sub">
      Caixa pessoal e da empresa: o agente usa estes números para calibrar dicas de aporte
      (nunca acima do disponível, reserva antes de risco, capital de giro da empresa antes de mais).
    </p>

    @if (summary(); as s) {
      <div class="cards">
        <p-card>
          <div class="stat-label">Disponível para investir</div>
          <div class="stat-value">{{ brl(s.investable) }}</div>
          <div class="stat-hint">caixa {{ brl(s.cashTotal) }} − reserva {{ brl(s.reserved) }}</div>
        </p-card>
        <p-card>
          <div class="stat-label">Excedente mensal</div>
          <div class="stat-value">{{ brl(s.monthlySurplus) }}</div>
          <div class="stat-hint">média dos últimos 3 meses (pessoal + empresa)</div>
        </p-card>
        <p-card>
          <div class="stat-label">Reserva de emergência</div>
          <div class="stat-value">{{ brl(s.reserved) }}</div>
          <div class="stat-hint">intocável — fica de fora do caixa investível</div>
        </p-card>
      </div>
    }

    <div class="cards" style="margin-top:12px">
      @for (book of summary()?.books || []; track book.id) {
        <p-card>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
            <h2 style="margin:0;font-size:17px">{{ book.kind === 'pessoal' ? '🏠' : '🏢' }} {{ book.label }}</h2>
            @if (book.runwayMonths != null) {
              <p-tag value="runway {{ book.runwayMonths }} meses" [severity]="book.runwayMonths >= 6 ? 'success' : 'warn'" />
            }
          </div>

          <div class="fin-row">
            <span>Caixa atual (contas hoje)</span>
            <input class="input fin-amount" type="number" [min]="0" [(ngModel)]="draft[book.id + ':cash']" (blur)="saveBalance(book)" placeholder="0,00" />
          </div>
          <div class="fin-row">
            <span>Reserva de emergência</span>
            <input class="input fin-amount" type="number" [min]="0" [(ngModel)]="draft[book.id + ':reserve']" (blur)="saveBalance(book)" placeholder="0,00" />
          </div>

          <div class="fin-line">
            <span class="muted small">Disponível</span>
            <span><strong>{{ brl(book.investable) }}</strong></span>
          </div>
          <div class="fin-line">
            <span class="muted small">Excedente mensal</span>
            <span [style.color]="book.monthlySurplus >= 0 ? 'var(--success)' : 'var(--danger)'">{{ brl(book.monthlySurplus) }}</span>
          </div>

          <div class="fin-form">
            <input class="input" type="number" [min]="0.01" placeholder="Valor" [(ngModel)]="draft[book.id + ':amount']" />
            <select class="input" [(ngModel)]="draft[book.id + ':kind']">
              <option value="income">Receita</option>
              <option value="expense">Despesa</option>
            </select>
            <input class="input" placeholder="Categoria (opcional)" [(ngModel)]="draft[book.id + ':category']" />
            <p-button label="Lançar" size="small" [loading]="saving() === book.id" (onClick)="addEntry(book)" />
          </div>

          @if (entries()[book.id]?.length) {
            <div class="fin-entries">
              @for (entry of entries()[book.id].slice(0, 8); track entry.id) {
                <div class="fin-entry">
                  <span class="fin-entry-icon">{{ entry.kind === 'income' ? '↑' : '↓' }}</span>
                  <span class="small">{{ entry.category || (entry.kind === 'income' ? 'Receita' : 'Despesa') }}</span>
                  <span class="small" [style.color]="entry.kind === 'income' ? 'var(--success)' : 'var(--danger)'">
                    {{ entry.kind === 'income' ? '+' : '−' }}{{ brl(entry.amount) }}
                  </span>
                  <span class="muted small">{{ entry.date | date: 'dd/MM' }}</span>
                  <button class="fin-remove" type="button" title="Remover" (click)="removeEntry(entry)">×</button>
                </div>
              }
            </div>
          }
        </p-card>
      }
    </div>

    <p class="disclaimer" style="margin-top:12px">
      Os números alimentam o contexto dos agentes (chat, radar e paper trading). Dicas passam a respeitar:
      aporte ≤ caixa disponível, reserva de emergência completa antes de risco, capital de giro da empresa
      preservado. Conteúdo educacional — não é recomendação.
    </p>
  `,
  styles: [
    `
      .fin-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 8px 0; }
      .fin-row span { font-size: 13.5px; }
      .fin-amount { width: 140px; text-align: right; }
      .fin-line { display: flex; justify-content: space-between; padding: 4px 0; border-top: 1px solid var(--border); }
      .fin-form { display: flex; gap: 6px; margin: 10px 0; flex-wrap: wrap; }
      .fin-form .input { flex: 1 1 90px; }
      .fin-form select { flex: 0 0 110px; }
      .fin-entries { border-top: 1px solid var(--border); margin-top: 6px; }
      .fin-entry { display: flex; align-items: baseline; gap: 8px; padding: 5px 0; border-bottom: 1px dashed var(--border); }
      .fin-entry-icon { width: 14px; text-align: center; font-weight: 700; }
      .fin-entry .small:nth-child(2) { flex: 1; }
      .fin-remove { border: 0; background: none; color: var(--danger); cursor: pointer; font-size: 14px; }
    `,
  ],
})
export class FinanceComponent {
  private readonly api = inject(ApiService);

  readonly summary = signal<FinanceSummary | null>(null);
  readonly entries = signal<Record<string, FinanceEntry[]>>({});
  readonly saving = signal<string | null>(null);

  draft: Record<string, string> = {};

  constructor() {
    this.load();
  }

  brl(value: number | null | undefined): string {
    return (value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  }

  load() {
    this.api.get<FinanceSummary>('/finance/summary').subscribe({
      next: (summary) => {
        this.summary.set(summary);
        for (const book of summary.books) {
          this.draft[book.id + ':cash'] = String(book.cashBalance || '');
          this.draft[book.id + ':reserve'] = String(book.emergencyReserve || '');
          this.draft[book.id + ':kind'] = 'expense';
          this.loadEntries(book.id);
        }
      },
    });
  }

  loadEntries(bookId: string) {
    this.api.get<FinanceEntry[]>(`/finance/books/${bookId}/entries`).subscribe({
      next: (rows) => this.entries.set({ ...this.entries(), [bookId]: rows || [] }),
    });
  }

  saveBalance(book: FinanceBook) {
    const cash = Number(this.draft[book.id + ':cash'] || 0);
    const reserve = Number(this.draft[book.id + ':reserve'] || 0);
    this.api
      .patch(`/finance/books/${book.id}`, { cashBalance: cash, emergencyReserve: reserve })
      .subscribe({ next: () => this.load() });
  }

  addEntry(book: FinanceBook) {
    const amount = Number(this.draft[book.id + ':amount'] || 0);
    if (amount <= 0) return;
    this.saving.set(book.id);
    this.api
      .post(`/finance/books/${book.id}/entries`, {
        kind: this.draft[book.id + ':kind'] || 'expense',
        amount,
        category: this.draft[book.id + ':category'] || undefined,
      })
      .subscribe({
        next: () => {
          this.saving.set(null);
          this.draft[book.id + ':amount'] = '';
          this.draft[book.id + ':category'] = '';
          this.load();
        },
        error: () => this.saving.set(null),
      });
  }

  removeEntry(entry: FinanceEntry) {
    this.api.delete(`/finance/entries/${entry.id}`).subscribe({ next: () => this.load() });
  }
}
