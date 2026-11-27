import { Component, inject, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe, DatePipe } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../../core/api.service';

interface Proposal {
  id: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  score: number;
  rule: string;
  verdict: string;
  reason: string | null;
  status: string;
  executedAt: string | null;
  paperPrice: number | null;
  createdAt: string;
}

interface Position {
  symbol: string;
  netQty: number;
  invested: number;
  averagePrice: number;
  currentPrice: number | null;
  currentValue: number | null;
  pnl: number | null;
  pnlPct: number | null;
}

interface Totals {
  invested: number;
  current: number;
  pnl: number;
  returnPct: number;
  positions: number;
}

interface Cdi {
  cdiAnnual: number;
  days: number;
  returnPct: number;
}

interface PaperPortfolio {
  proposals: Proposal[];
  positions: Position[];
  totals: Totals;
  cdi: Cdi;
}

@Component({
  selector: 'app-paper',
  imports: [CurrencyPipe, DecimalPipe, DatePipe, CardModule, ButtonModule, TableModule, TagModule],
  template: `
    <h1 class="page-title">Paper trading</h1>
    <p class="page-sub">
      Propostas geradas a partir das dicas de ação com veredito "Oportunidade" são
      <strong>executadas em carteira simulada</strong> (sem dinheiro real, sem corretora) e
      acompanham o resultado contra o CDI. Dias úteis 18h30 o ciclo roda sozinho.
    </p>

    <div class="toolbar">
      <p-button label="Gerar propostas do dia" [loading]="generating()" (onClick)="generate()" />
      @if (message()) {
        <span class="muted small">{{ message() }}</span>
      }
    </div>

    <div class="cards">
      <div class="card">
        <h3>Valor do paper</h3>
        <div class="value">{{ totals()?.current ?? 0 | currency: 'BRL' }}</div>
        <div class="hint">investido: {{ totals()?.invested ?? 0 | currency: 'BRL' }}</div>
      </div>
      <div class="card">
        <h3>P&amp;L</h3>
        <div class="value">{{ totals()?.pnl ?? 0 | currency: 'BRL' }}</div>
        <div class="hint">{{ totals()?.positions ?? 0 }} posição(ões) simulada(s)</div>
      </div>
      <div class="card">
        <h3>Retorno</h3>
        <div class="value">{{ totals()?.returnPct ?? 0 | number: '1.2-2' }}%</div>
        <div class="hint">desde a primeira execução</div>
      </div>
      <div class="card">
        <h3>vs CDI</h3>
        <div class="value">
          @if (cdi(); as c) {
            @if ((totals()?.returnPct ?? 0) >= c.returnPct) {
              <span style="color: var(--ok, #2e7d32)">+</span>
            } @else {
              <span style="color: #c62828">−</span>
            }
            {{ ((totals()?.returnPct ?? 0) - c.returnPct) | number: '1.2-2' }} p.p.
          }
        </div>
        <div class="hint">CDI {{ cdi()?.days ?? 0 }} d: {{ cdi()?.returnPct ?? 0 | number: '1.2-2' }}%</div>
      </div>
    </div>

    <p-card header="Propostas (fila)" styleClass="mt-card">
      <p-table [value]="proposals()" stripedRows>
        <ng-template #header>
          <tr>
            <th>Ativo</th>
            <th>Lado</th>
            <th>Qtd</th>
            <th>Preço</th>
            <th>Score</th>
            <th>Veredito</th>
            <th style="min-width:260px">Motivo</th>
            <th>Status</th>
            <th></th>
          </tr>
        </ng-template>
        <ng-template #body let-row>
          <tr>
            <td><strong>{{ row.symbol }}</strong></td>
            <td>
              <p-tag
                [value]="row.side"
                [severity]="row.side === 'BUY' ? 'success' : 'warn'"
              />
            </td>
            <td>{{ row.quantity | number }}</td>
            <td>{{ (row.paperPrice ?? row.price) | currency: 'BRL' }}</td>
            <td>{{ row.score }}</td>
            <td>
              <p-tag
                [value]="row.verdict"
                [severity]="row.verdict === 'Oportunidade' ? 'success' : row.verdict === 'Evitar' ? 'danger' : 'secondary'"
              />
            </td>
            <td class="small" style="min-width:260px">{{ row.reason || '—' }}</td>
            <td>
              <p-tag
                [value]="row.status"
                [severity]="row.status === 'paper' ? 'info' : row.status === 'executed' ? 'success' : 'secondary'"
              />
            </td>
            <td style="white-space:nowrap">
              @if (row.status === 'paper') {
                <p-button
                  label="Rejeitar"
                  size="small"
                  severity="danger"
                  [text]="true"
                  (onClick)="reject(row.id)"
                />
              }
            </td>
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr>
            <td colspan="9" class="muted">
              Sem propostas ainda. Clique em "Gerar propostas do dia" depois de ter dicas de ação geradas.
            </td>
          </tr>
        </ng-template>
      </p-table>
    </p-card>

    <p-card header="Posições paper" styleClass="mt-card">
      <p-table [value]="positions()" stripedRows>
        <ng-template #header>
          <tr>
            <th>Ativo</th>
            <th>Qtd líquida</th>
            <th>Custo médio</th>
            <th>Preço atual</th>
            <th>Valor atual</th>
            <th>P&amp;L</th>
            <th>%</th>
          </tr>
        </ng-template>
        <ng-template #body let-row>
          <tr>
            <td><strong>{{ row.symbol }}</strong></td>
            <td>{{ row.netQty | number }}</td>
            <td>{{ row.averagePrice | currency: 'BRL' }}</td>
            <td>{{ row.currentPrice ?? '—' }}</td>
            <td>{{ row.currentValue != null ? (row.currentValue | currency: 'BRL') : '—' }}</td>
            <td>{{ row.pnl != null ? (row.pnl | currency: 'BRL') : '—' }}</td>
            <td>
              @if (row.pnlPct != null) {
                <p-tag
                  [value]="((row.pnlPct ?? 0) | number: '1.2-2') + '%'"
                  [severity]="row.pnlPct >= 0 ? 'success' : 'danger'"
                />
              } @else {
                —
              }
            </td>
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr>
            <td colspan="7" class="muted">Nenhuma posição simulada ainda.</td>
          </tr>
        </ng-template>
      </p-table>

      <p class="disclaimer" style="margin-top:10px">
        Carteira de brincadeira séria: ordens executadas só no papel, na cotação do momento. Serve para
        medir se as dicas teriam funcionado — não é recomendação nem execução real.
      </p>
    </p-card>
  `,
})
export class PaperComponent {
  private readonly api = inject(ApiService);

  readonly totals = signal<Totals | null>(null);
  readonly positions = signal<Position[]>([]);
  readonly proposals = signal<Proposal[]>([]);
  readonly cdi = signal<Cdi | null>(null);
  readonly generating = signal(false);
  readonly message = signal<string | null>(null);

  constructor() {
    this.load();
  }

  load() {
    this.api.get<PaperPortfolio>('/paper/portfolio').subscribe({
      next: (res) => {
        this.proposals.set(res.proposals || []);
        this.positions.set(res.positions || []);
        this.totals.set(res.totals);
        this.cdi.set(res.cdi);
      },
      error: () => {
        this.positions.set([]);
        this.proposals.set([]);
      },
    });
  }

  generate() {
    this.generating.set(true);
    this.message.set(null);
    this.api.post<{ created: number; skipped: number; message?: string }>('/paper/generate', {}).subscribe({
      next: (res) => {
        this.generating.set(false);
        this.message.set(res.message || `${res.created} proposta(s) executada(s) no paper.`);
        this.load();
      },
      error: (err) => {
        this.generating.set(false);
        this.message.set(err?.error?.message || 'Não foi possível gerar as propostas.');
      },
    });
  }

  reject(id: string) {
    this.api.post(`/paper/proposals/${encodeURIComponent(id)}/reject`, {}).subscribe({
      next: () => this.load(),
    });
  }
}
