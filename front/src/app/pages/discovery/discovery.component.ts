import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

interface TrackedSymbol {
  id: string;
  symbol: string;
  source: string;
  score: number;
  note: string | null;
  updatedAt: string;
}

interface ScanResult {
  scanned: number;
  failures: Array<{ symbol: string; error: string }>;
  saved: TrackedSymbol[];
  durationMs: number;
}

@Component({
  selector: 'app-discovery',
  imports: [DatePipe, RouterLink, FormsModule, CardModule, ButtonModule, TableModule, TagModule, InputTextModule],
  template: `
    <h1 class="page-title">Descobertas</h1>
    <p class="page-sub">
      O app varre uma lista curada de papéis líquidos (B3, EUA e cripto), pontua cada um com os mesmos
      critérios do Tracking (técnica, ganho/risco e histórico do padrão) e atualiza a watchlist com os
      melhores. Toda segunda 8h, ou quando você pedir. Não é recomendação de compra.
    </p>

    <div class="toolbar">
      <div class="group">
        <input
          class="input"
          style="max-width:160px"
          [(ngModel)]="newSymbol"
          placeholder="Ticker manual"
          (keyup.enter)="addManual()"
        />
        <p-button label="Adicionar" severity="secondary" [outlined]="true" (onClick)="addManual()" />
      </div>
      <div class="group">
        @if (lastScan()) {
          <span class="muted small">
            {{ scannedCount() }} papéis varridos em {{ lastDuration() }}s · {{ lastScan() | date: 'dd/MM HH:mm' }}
          </span>
        }
        <p-button label="Descobrir agora" [loading]="scanning()" (onClick)="scan()" />
      </div>
    </div>

    @if (message()) {
      <div class="alert" [class.ok]="ok()" [class.error]="!ok()">{{ message() }}</div>
    }

    <p-card header="Watchlist" styleClass="mt-card">
      <p-table [value]="tracked()" stripedRows>
        <ng-template #header>
          <tr>
            <th>Ativo</th>
            <th>Nota</th>
            <th style="min-width:260px">Por que entrou</th>
            <th>Origem</th>
            <th>Atualizado</th>
            <th></th>
          </tr>
        </ng-template>
        <ng-template #body let-row>
          <tr>
            <td><strong>{{ row.symbol }}</strong></td>
            <td>
              <p-tag
                [value]="row.score + '/100'"
                [severity]="row.score >= 70 ? 'success' : row.score >= 50 ? 'warn' : 'secondary'"
              />
            </td>
            <td class="small" style="min-width:260px">{{ row.note || '—' }}</td>
            <td>
              <p-tag
                [value]="row.source === 'discovered' ? 'descoberto' : 'manual'"
                [severity]="row.source === 'discovered' ? 'info' : 'secondary'"
              />
            </td>
            <td class="small">{{ row.updatedAt | date: 'dd/MM/yyyy' }}</td>
            <td style="white-space:nowrap">
              <p-button
                label="Ver no tracking"
                size="small"
                severity="secondary"
                [outlined]="true"
                [routerLink]="['/app/tracking']"
                [queryParams]="{ symbol: row.symbol }"
              />
              <p-button
                label="Remover"
                size="small"
                severity="danger"
                [text]="true"
                (onClick)="remove(row.symbol)"
              />
            </td>
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr>
            <td colspan="6" class="muted">
              Watchlist vazia. Clique em "Descobrir agora" para varrer o universo, ou adicione um ticker manual.
            </td>
          </tr>
        </ng-template>
      </p-table>

      @if (failures().length) {
        <p class="disclaimer" style="margin-top:10px">
          {{ failures().length }} papel(is) sem dados nesta varredura (provedor fora ou sem histórico):
          {{ failureList() }}
        </p>
      }

      <p class="disclaimer" style="margin-top:10px">
        A nota combina 50% leitura técnica, 30% relação ganho/risco até os níveis e 20% acerto histórico do
        padrão (amostra pequena conta como neutro). Papel colado na resistência perde pontos. Descreve o
        estado atual — não garante resultado.
      </p>
    </p-card>
  `,
})
export class DiscoveryComponent {
  private readonly api = inject(ApiService);

  readonly tracked = signal<TrackedSymbol[]>([]);
  readonly scanning = signal(false);
  readonly message = signal<string | null>(null);
  readonly ok = signal(false);
  readonly lastScan = signal<string | null>(null);
  readonly lastDuration = signal<number>(0);
  readonly scannedCount = signal(0);
  readonly failures = signal<Array<{ symbol: string; error: string }>>([]);

  newSymbol = '';

  constructor() {
    this.load();
  }

  load() {
    this.api.get<TrackedSymbol[]>('/discovery/tracked').subscribe({
      next: (rows) => this.tracked.set(rows),
      error: () => this.tracked.set([]),
    });
  }

  scan() {
    this.scanning.set(true);
    this.message.set(null);
    this.api.post<ScanResult>('/discovery/scan?limit=8', {}).subscribe({
      next: (res) => {
        this.scanning.set(false);
        this.ok.set(true);
        this.lastScan.set(new Date().toISOString());
        this.lastDuration.set(Math.round(res.durationMs / 100) / 10);
        this.scannedCount.set(res.scanned);
        this.failures.set(res.failures || []);
        this.message.set(`${res.saved.length} papel(is) na watchlist · ${res.scanned} varridos.`);
        this.load();
      },
      error: (err) => {
        this.scanning.set(false);
        this.ok.set(false);
        this.message.set(err?.error?.message || 'Não foi possível concluir a varredura.');
      },
    });
  }

  addManual() {
    const symbol = this.newSymbol.trim().toUpperCase();
    if (!symbol) return;
    this.api.post(`/discovery/tracked/${encodeURIComponent(symbol)}`, {}).subscribe({
      next: () => {
        this.newSymbol = '';
        this.ok.set(true);
        this.message.set(`${symbol} adicionado à watchlist.`);
        this.load();
      },
      error: (err) => {
        this.ok.set(false);
        this.message.set(err?.error?.message || 'Não foi possível adicionar.');
      },
    });
  }

  remove(symbol: string) {
    this.api.delete(`/discovery/tracked/${encodeURIComponent(symbol)}`).subscribe({
      next: () => this.load(),
    });
  }

  failureList(): string {
    return this.failures().map((f) => f.symbol).join(', ');
  }
}
