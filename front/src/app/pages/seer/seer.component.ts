import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TableModule } from 'primeng/table';
import { ApiService } from '../../core/api.service';

interface SeerItem {
  symbol: string;
  setup: string;
  setupLabel: string;
  completed: number;
  winRate: number | null;
  avgReturn: number | null;
  avgReturn20: number | null;
  verdict: string;
  score: number;
  edge: string;
}

interface SetupSummary {
  setup: string;
  setupLabel: string;
  assets: number;
  weightedWinRate: number | null;
  avgReturn: number | null;
  avgReturn20: number | null;
}

interface SeerResult {
  range: string;
  scanned: number;
  failures: string[];
  items: SeerItem[];
  setups: SetupSummary[];
  disclaimer: string;
}

@Component({
  selector: 'app-seer',
  imports: [FormsModule, RouterLink, CardModule, ButtonModule, SelectModule, TagModule, TableModule],
  template: `
    <h1 class="page-title">Vidente de dicas</h1>
    <p class="page-sub">
      Análise geral de oportunidades: o app varre o universo (B3, EUA e cripto), identifica o padrão que
      cada papel vive agora e ranqueia pelo <strong>histórico desse padrão no próprio papel</strong>. Não é
      previsão — é medir o que já aconteceu.
    </p>

    <div class="toolbar">
      <div class="group">
        <p-select [options]="ranges" [(ngModel)]="range" appendTo="body" />
        <p-button label="Analisar oportunidades" [loading]="loading()" (onClick)="run()" />
      </div>
      <div class="group">
        @if (result(); as r) {
          <span class="muted small">{{ r.scanned }} papéis analisados · janela {{ r.range }}</span>
        }
      </div>
    </div>

    @if (error()) {
      <div class="alert error">{{ error() }}</div>
    }

    @if (result(); as r) {
      <div class="cards">
        <p-card header="Papéis analisados">
          <div class="stat-value">{{ r.scanned }}</div>
          <div class="stat-hint">{{ r.failures.length }} sem dados nesta rodada</div>
        </p-card>
        <p-card header="Melhor padrão no universo">
          <div class="stat-value">{{ r.setups[0]?.weightedWinRate ?? '—' }}%</div>
          <div class="stat-hint">
            {{ r.setups[0]?.setupLabel || 'sem amostra' }} · {{ r.setups[0]?.assets ?? 0 }} ativo(s)
          </div>
        </p-card>
        <p-card header="Histórico forte">
          <div class="stat-value">{{ strongCount() }}</div>
          <div class="stat-hint">papéis com nota ≥ 70 no ranking</div>
        </p-card>
        <p-card header="Retorno médio do melhor padrão">
          <div class="stat-value">
            {{ r.setups[0]?.avgReturn != null ? r.setups[0]!.avgReturn + '%' : '—' }}
          </div>
          <div class="stat-hint">
            em 10 pregões · {{ r.setups[0]?.avgReturn20 != null ? r.setups[0]!.avgReturn20 + '% em 20' : '—' }}
          </div>
        </p-card>
      </div>

      <p-card header="Ranking de oportunidades (pelo histórico do padrão atual)" styleClass="mt-card">
        <p-table [value]="r.items" stripedRows>
          <ng-template #header>
            <tr>
              <th>Ativo</th>
              <th>Padrão atual</th>
              <th>Casos</th>
              <th>Acerto 10d</th>
              <th>Retorno 10d</th>
              <th>Retorno 20d</th>
              <th>Veredito</th>
              <th>Nota</th>
              <th></th>
            </tr>
          </ng-template>
          <ng-template #body let-row>
            <tr>
              <td><strong>{{ row.symbol }}</strong></td>
              <td class="small" style="min-width:200px">{{ row.setupLabel }}</td>
              <td>{{ row.completed }}</td>
              <td>{{ row.winRate != null ? row.winRate.toFixed(1) + '%' : '—' }}</td>
              <td>{{ pct(row.avgReturn) }}</td>
              <td>{{ pct(row.avgReturn20) }}</td>
              <td><p-tag [value]="row.verdict" [severity]="verdictSeverity(row.verdict)" /></td>
              <td>
                <p-tag
                  [value]="row.score + '/100'"
                  [severity]="row.score >= 70 ? 'success' : row.score >= 55 ? 'warn' : 'secondary'"
                />
                <div class="muted small">{{ row.edge }}</div>
              </td>
              <td style="white-space:nowrap">
                <p-button
                  label="Tracking"
                  size="small"
                  severity="secondary"
                  [outlined]="true"
                  [routerLink]="['/app/tracking']"
                  [queryParams]="{ symbol: row.symbol }"
                />
                <p-button
                  label="Salvar"
                  size="small"
                  severity="secondary"
                  [text]="true"
                  (onClick)="track(row.symbol)"
                />
              </td>
            </tr>
          </ng-template>
          <ng-template #emptymessage>
            <tr>
              <td colspan="9" class="muted">
                Nenhum papel com amostra suficiente (mínimo 8 casos) nesta janela. Tente 2 anos.
              </td>
            </tr>
          </ng-template>
        </p-table>
      </p-card>

      <p-card header="Qual padrão tem funcionado melhor no universo" styleClass="mt-card">
        <p-table [value]="r.setups" stripedRows>
          <ng-template #header>
            <tr>
              <th>Padrão</th>
              <th>Ativos</th>
              <th>Acerto ponderado</th>
              <th>Retorno médio 10d</th>
              <th>Retorno médio 20d</th>
            </tr>
          </ng-template>
          <ng-template #body let-row>
            <tr>
              <td>{{ row.setupLabel }}</td>
              <td>{{ row.assets }}</td>
              <td>{{ row.weightedWinRate != null ? row.weightedWinRate.toFixed(1) + '%' : '—' }}</td>
              <td>{{ pct(row.avgReturn) }}</td>
              <td>{{ pct(row.avgReturn20) }}</td>
            </tr>
          </ng-template>
          <ng-template #emptymessage>
            <tr><td colspan="5" class="muted">Sem amostra suficiente para comparar padrões.</td></tr>
          </ng-template>
        </p-table>
        <p class="disclaimer" style="margin-top:10px">{{ r.disclaimer }}</p>
      </p-card>
    } @else if (loading()) {
      <p class="muted small">Analisando o universo…</p>
    } @else {
      <div class="row">
        <div>
          <div class="name">Nenhuma análise ainda</div>
          <div class="meta">Clique em "Analisar oportunidades" para varrer o universo.</div>
        </div>
      </div>
    }
  `,
})
export class SeerComponent {
  private readonly api = inject(ApiService);

  readonly result = signal<SeerResult | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly ranges = [
    { label: '1 ano', value: '1y' },
    { label: '2 anos', value: '2y' },
    { label: '5 anos', value: '5y' },
  ];

  range = '1y';

  constructor() {
    this.run();
  }

  run() {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .get<SeerResult>(`/market/seer?range=${this.range}&limit=10`)
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          this.result.set(res);
          if (!res.items?.length) {
            this.error.set('Nenhum papel com amostra suficiente nesta janela. Tente 2 anos.');
          }
        },
        error: (err) => {
          this.loading.set(false);
          this.result.set(null);
          this.error.set(err?.error?.message || 'Não foi possível analisar as oportunidades.');
        },
      });
  }

  strongCount(): number {
    return (this.result()?.items || []).filter((item) => item.score >= 70).length;
  }

  track(symbol: string) {
    this.api.post(`/discovery/tracked/${encodeURIComponent(symbol)}`, {}).subscribe({
      next: () => undefined,
      error: () => undefined,
    });
  }

  verdictSeverity(verdict: string): 'success' | 'warn' | 'danger' | 'secondary' {
    if (verdict === 'Oportunidade') return 'success';
    if (verdict === 'Evitar') return 'danger';
    return 'secondary';
  }

  pct(value: number | null | undefined): string {
    if (value == null) return '—';
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  }
}
