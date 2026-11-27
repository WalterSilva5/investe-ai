import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../../core/api.service';

interface RuleStat {
  rule: string;
  ruleLabel: string;
  direction: string;
  total: number;
  hits: number;
  hitRate: number | null;
  avgReturn: number | null;
  learned: boolean;
}

interface LearningSummary {
  total: number;
  pending: number;
  evaluated: number;
  minSamples: number;
  evalDays: number;
  byRule: RuleStat[];
  best: RuleStat | null;
  worst: RuleStat | null;
}

@Component({
  selector: 'app-learning',
  imports: [DatePipe, CardModule, ButtonModule, TableModule, TagModule],
  template: `
    <h1 class="page-title">Aprendizado</h1>
    <p class="page-sub">
      O app registra os sinais que gera (tendência e RSI), espera {{ summary()?.evalDays ?? 14 }} dias e
      mede o que aconteceu de fato com o preço. Com {{ summary()?.minSamples ?? 6 }}+ casos avaliados, o
      score do Tracking passa a ser ajustado pela taxa de acerto de cada regra.
    </p>

    <div class="toolbar">
      <div class="group">
        <span class="muted small">
          @if (lastRun()) { Última avaliação manual: {{ lastRun() | date: 'dd/MM/yyyy HH:mm' }} }
        </span>
      </div>
      <div class="group">
        <p-button label="Avaliar pendentes" [loading]="evaluating()" (onClick)="evaluate()" />
        <p-button label="Atualizar" severity="secondary" [outlined]="true" (onClick)="load()" />
      </div>
    </div>

    @if (message()) {
      <div class="alert" [class.ok]="ok()" [class.error]="!ok()">{{ message() }}</div>
    }

    @if (summary(); as s) {
      <div class="cards">
        <p-card header="Sinais registrados">
          <div class="stat-value">{{ s.total }}</div>
          <div class="stat-hint">{{ s.pending }} aguardando avaliação</div>
        </p-card>
        <p-card header="Avaliados">
          <div class="stat-value">{{ s.evaluated }}</div>
          <div class="stat-hint">comparados com o preço real depois de {{ s.evalDays }} dias</div>
        </p-card>
        <p-card header="Melhor regra">
          <div class="stat-value">{{ s.best?.hitRate != null ? s.best!.hitRate + '%' : '—' }}</div>
          <div class="stat-hint">{{ s.best?.ruleLabel || 'sem histórico ainda' }}</div>
        </p-card>
        <p-card header="Pior regra">
          <div class="stat-value">{{ s.worst?.hitRate != null ? s.worst!.hitRate + '%' : '—' }}</div>
          <div class="stat-hint">{{ s.worst?.ruleLabel || 'sem histórico ainda' }}</div>
        </p-card>
      </div>

      <p-card header="Desempenho por regra" styleClass="mt-card">
        <p-table [value]="s.byRule" stripedRows>
          <ng-template #header>
            <tr>
              <th>Regra</th>
              <th>Direção</th>
              <th>Avaliados</th>
              <th>Acertos</th>
              <th>Acerto</th>
              <th>Retorno médio</th>
              <th>Status</th>
            </tr>
          </ng-template>
          <ng-template #body let-row>
            <tr>
              <td>{{ row.ruleLabel }}</td>
              <td>
                <p-tag
                  [value]="row.direction === 'up' ? 'alta' : 'baixa'"
                  [severity]="row.direction === 'up' ? 'success' : 'danger'"
                />
              </td>
              <td>{{ row.total }}</td>
              <td>{{ row.hits }}</td>
              <td>{{ row.hitRate != null ? row.hitRate.toFixed(1) + '%' : '—' }}</td>
              <td>{{ row.avgReturn != null ? (row.avgReturn >= 0 ? '+' : '') + row.avgReturn.toFixed(2) + '%' : '—' }}</td>
              <td>
                <p-tag
                  [value]="row.learned ? 'calibrando score' : 'amostra pequena'"
                  [severity]="row.learned ? 'success' : 'secondary'"
                />
              </td>
            </tr>
          </ng-template>
          <ng-template #emptymessage>
            <tr>
              <td colspan="7" class="muted">
                Nenhum sinal avaliado ainda. Abra o Tracking em alguns ativos (o sinal é registrado por dia)
                e volte depois de {{ s.evalDays }} dias — ou rode "Avaliar pendentes" quando houver sinais antigos.
              </td>
            </tr>
          </ng-template>
        </p-table>

        <p class="disclaimer" style="margin-top:10px">
          O ajuste usa suavização de Laplace e só entra com {{ s.minSamples }}+ casos, para não "aprender" com
          coincidência. Mede acerto passado das regras — não garante acerto futuro nem é recomendação.
        </p>
      </p-card>
    } @else {
      <p class="muted small">Carregando…</p>
    }
  `,
})
export class LearningComponent {
  private readonly api = inject(ApiService);

  readonly summary = signal<LearningSummary | null>(null);
  readonly evaluating = signal(false);
  readonly message = signal<string | null>(null);
  readonly ok = signal(false);
  readonly lastRun = signal<string | null>(null);

  constructor() {
    this.load();
  }

  load() {
    this.api.get<LearningSummary>('/learning/summary').subscribe({
      next: (res) => this.summary.set(res),
      error: () => this.summary.set(null),
    });
  }

  evaluate() {
    this.evaluating.set(true);
    this.message.set(null);
    this.api.post<{ evaluated: number; stillPending: number }>('/learning/evaluate', {}).subscribe({
      next: (res) => {
        this.evaluating.set(false);
        this.ok.set(true);
        this.lastRun.set(new Date().toISOString());
        this.message.set(
          `${res.evaluated} sinal(is) avaliado(s); ${res.stillPending} ainda pendente(s) (precisam de ${this.summary()?.evalDays ?? 14} dias).`,
        );
        this.load();
      },
      error: (err) => {
        this.evaluating.set(false);
        this.ok.set(false);
        this.message.set(err?.error?.message || 'Não foi possível avaliar os sinais.');
      },
    });
  }
}
