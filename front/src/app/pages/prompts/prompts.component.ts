import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TableModule } from 'primeng/table';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { AccordionModule } from 'primeng/accordion';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ApiService } from '../../core/api.service';

interface PromptRow {
  id: string;
  profileId: string;
  version: number;
  status: string;
  systemPrompt: string;
  notes: string | null;
  evalScore: number | null;
  activatedAt: string | null;
  createdAt: string;
  runs?: Array<{ score: number; createdAt: string }>;
}

interface SwarmOutcome {
  profile: string;
  candidateVersion?: number;
  score?: number;
  baseline?: number | null;
  promoted: boolean;
  reason: string;
  skipped?: string;
}

interface SwarmResult {
  summary: {
    total: number;
    promoted: number;
    candidates: number;
    skipped: number;
    best: { profile: string; score?: number; candidateVersion?: number } | null;
    byProfile: SwarmOutcome[];
  };
  outcomes: SwarmOutcome[];
}

interface EvalResult {
  promptId: string;
  version: number;
  score: number;
  baseline: number | null;
  verdict: string;
  results: Array<{
    id: string;
    score: number;
    checks: Array<{ name: string; weight: number; ok: boolean; detail?: string }>;
  }>;
}

interface ProfileOption {
  id: string;
  name: string;
  icon: string;
}

interface SimRun {
  id: string;
  classId: string;
  classLabel: string;
  variantId: string;
  symbols: string[];
  anchors: number;
  calls: number;
  hits: number;
  hitRatePct: number;
  score: number;
  model: string | null;
  createdAt: string;
}

interface SimBest {
  classId: string;
  classLabel: string;
  variantId: string;
  score: number;
  hitRatePct: number;
  calls: number;
}

@Component({
  selector: 'app-prompts',
  imports: [
    FormsModule,
    DatePipe,
    CardModule,
    ButtonModule,
    SelectModule,
    TagModule,
    TableModule,
    ConfirmDialogModule,
    AccordionModule,
    ToastModule,
  ],
  providers: [ConfirmationService, MessageService],
  template: `
    <p-toast />
    <p-confirmDialog />
    <h1 class="page-title">Prompts do agente</h1>
    <p class="page-sub">
      Prompts versionados no banco: a versão <strong>ativa</strong> é a usada no chat. Um candidato só deve
      virar ativo depois de rodar a avaliação (conjunto dourado de perguntas) e comparar com o baseline.
    </p>

    <div class="toolbar">
      <div class="group">
        <p-select
          [options]="profileOptions()"
          [(ngModel)]="profileId"
          (onChange)="load()"
          optionLabel="label"
          optionValue="value"
          appendTo="body"
        />
      </div>
      <div class="group">
        <p-button label="Novo candidato" severity="secondary" [outlined]="true" (onClick)="startProposal()" />
        <p-button
          label="Swarm (todos os perfis)"
          severity="secondary"
          [outlined]="true"
          [loading]="swarming()"
          (onClick)="runSwarm()"
        />
      </div>
    </div>

    @if (proposing()) {
      <p-card header="Novo candidato" styleClass="mt-card">
        <div class="field">
          <label>Prompt do perfil ({{ profileId }})</label>
          <textarea class="input" rows="10" [(ngModel)]="draft"></textarea>
        </div>
        <div class="field">
          <label>Nota da mudança (o que você espera melhorar)</label>
          <input class="input" [(ngModel)]="notes" placeholder="Ex.: forçar veredito na primeira linha" />
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <p-button label="Cancelar" severity="secondary" [text]="true" (onClick)="proposing.set(false)" />
          <p-button label="Salvar como candidato" [loading]="saving()" (onClick)="propose()" />
        </div>
      </p-card>
    }

    <p-card header="Versões" styleClass="mt-card">
      <p-table [value]="rows()" stripedRows>
        <ng-template #header>
          <tr>
            <th>Versão</th>
            <th>Status</th>
            <th>Nota da avaliação</th>
            <th>Criada</th>
            <th>Ativa desde</th>
            <th>Notas</th>
            <th></th>
          </tr>
        </ng-template>
        <ng-template #body let-row>
          <tr>
            <td><strong>v{{ row.version }}</strong></td>
            <td>
              <p-tag
                [value]="row.status"
                [severity]="row.status === 'active' ? 'success' : row.status === 'candidate' ? 'warn' : 'secondary'"
              />
            </td>
            <td>
              @if (row.evalScore != null) {
                <p-tag
                  [value]="row.evalScore + '/100'"
                  [severity]="row.evalScore >= 90 ? 'success' : row.evalScore >= 70 ? 'warn' : 'danger'"
                />
              } @else {
                <span class="muted small">não avaliada</span>
              }
            </td>
            <td class="small">{{ row.createdAt | date: 'dd/MM/yyyy HH:mm' }}</td>
            <td class="small">{{ row.activatedAt ? (row.activatedAt | date: 'dd/MM/yyyy') : '—' }}</td>
            <td class="small" style="max-width:220px">{{ row.notes || '—' }}</td>
            <td style="white-space:nowrap">
              <p-button label="Ver" size="small" severity="secondary" [text]="true" (onClick)="view(row)" />
              <p-button
                label="Avaliar"
                size="small"
                severity="secondary"
                [outlined]="true"
                [loading]="evaluating() === row.id"
                (onClick)="evaluate(row)"
              />
              @if (row.status !== 'active') {
                <p-button label="Ativar" size="small" (onClick)="activate(row)" />
              }
            </td>
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr><td colspan="7" class="muted">Nenhuma versão para este perfil.</td></tr>
        </ng-template>
      </p-table>
    </p-card>

    @if (viewing(); as row) {
      <p-card [header]="'Prompt v' + row.version + ' (' + row.status + ')'" styleClass="mt-card">
        <pre class="prompt-box">{{ row.systemPrompt }}</pre>
      </p-card>
    }

    @if (lastEval(); as ev) {
      <p-card header="Resultado da avaliação" styleClass="mt-card">
        <div class="cards">
          <p-card header="Nota">
            <div class="stat-value">{{ ev.score }}/100</div>
            <div class="stat-hint">{{ ev.verdict }}</div>
          </p-card>
          <p-card header="Baseline (versão ativa)">
            <div class="stat-value">{{ ev.baseline ?? '—' }}</div>
            <div class="stat-hint">{{ ev.baseline == null ? 'ative ainda não avaliada' : 'nota da ativa' }}</div>
          </p-card>
          <p-card header="Casos">
            <div class="stat-value">{{ ev.results.length }}</div>
            <div class="stat-hint">perguntas do conjunto dourado</div>
          </p-card>
        </div>

        <p-accordion [multiple]="true" styleClass="mt-2">
          @for (item of ev.results; track item.id) {
            <p-accordion-panel [value]="item.id">
              <p-accordion-header>
                <span style="font-weight:700;margin-right:8px">{{ item.id }}</span>
                <p-tag
                  [value]="item.score + '/100'"
                  [severity]="item.score >= 90 ? 'success' : item.score >= 70 ? 'warn' : 'danger'"
                />
              </p-accordion-header>
              <p-accordion-content>
                @for (check of item.checks; track check.name) {
                  <div class="small" style="display:flex;gap:8px;align-items:baseline">
                    <span>{{ check.ok ? '✅' : '❌' }}</span>
                    <span>{{ check.name }} (peso {{ check.weight }})</span>
                    @if (check.detail) { <span class="muted">— {{ check.detail }}</span> }
                  </div>
                }
              </p-accordion-content>
            </p-accordion-panel>
          }
        </p-accordion>
        <p class="disclaimer" style="margin-top:10px">
          A nota mede aderência às regras (tool certa, números, fonte, sem promessa, aviso único) — não é
          julgamento de qualidade literária.
        </p>
      </p-card>
    }

    <p-card header="Simulações por classe de ativo" styleClass="mt-card">
      <p class="muted small" style="margin-top:0">
        Backtest de prompts: para âncoras no passado (2 anos), reconstrói o gráfico como estava e compara a leitura
        direcional do LLM (alta/baixa/lateral) com o retorno REALIZADO nos 20 pregões seguintes. A variante vencedora
        de cada classe é usada automaticamente na análise de chat do ativo.
      </p>

      <div class="toolbar" style="margin-bottom:10px">
        <div class="group">
          <p-button
            label="Rodar simulação (todas as classes)"
            [loading]="simRunning()"
            (onClick)="runSim()"
          />
        </div>
      </div>

      @if (simBest().length) {
        <h3 style="margin:6px 0 6px;font-size:15px">Melhor variante por classe</h3>
        <p-table [value]="simBest()" stripedRows [paginator]="true" [rows]="10">
          <ng-template #header>
            <tr>
              <th>Classe</th>
              <th>Variante vencedora</th>
              <th>Taxa de acerto</th>
              <th>Nota (score)</th>
              <th>Chamadas</th>
            </tr>
          </ng-template>
          <ng-template #body let-row>
            <tr>
              <td>{{ row.classLabel }}</td>
              <td>
                <p-tag
                  [value]="row.variantId"
                  [severity]="row.variantId === 'base' ? 'secondary' : 'success'"
                />
              </td>
              <td>
                <p-tag [value]="row.hitRatePct + '%'" [severity]="row.hitRatePct >= 60 ? 'success' : row.hitRatePct >= 45 ? 'warn' : 'danger'" />
              </td>
              <td>{{ row.score }}</td>
              <td class="small">{{ row.calls }}</td>
            </tr>
          </ng-template>
        </p-table>
      }

      <h3 style="margin:14px 0 6px;font-size:15px">Runs recentes</h3>
      <p-table [value]="simRuns().slice(0, 24)" stripedRows [paginator]="false">
        <ng-template #header>
          <tr>
            <th>Classe</th>
            <th>Variante</th>
            <th>Símbolos</th>
            <th>Acertos</th>
            <th>Taxa</th>
            <th>Score</th>
            <th>Modelo</th>
            <th>Quando</th>
          </tr>
        </ng-template>
        <ng-template #body let-row>
          <tr>
            <td class="small">{{ row.classLabel }}</td>
            <td class="small">{{ row.variantId }}</td>
            <td class="small">{{ row.symbols.join(', ') }}</td>
            <td class="small">{{ row.hits }}/{{ row.calls }}</td>
            <td class="small">{{ row.hitRatePct }}%</td>
            <td class="small">{{ row.score }}</td>
            <td class="small">{{ row.model || '—' }}</td>
            <td class="small">{{ row.createdAt | date: 'dd/MM HH:mm' }}</td>
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr><td colspan="8" class="muted">Nenhuma simulação ainda — rode a primeira.</td></tr>
        </ng-template>
      </p-table>

      <p class="disclaimer" style="margin-top:10px">
        Exercício retrospectivo de leitura direcional (não é execução nem recomendação). Amostra pequena por classe:
        trate como calibragem de prompt, não como edge estatístico.
      </p>
    </p-card>
  `,
  styles: [
    `
      .prompt-box {
        white-space: pre-wrap;
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 12px;
        font-size: 12.5px;
        max-height: 360px;
        overflow: auto;
      }
    `,
  ],
})
export class PromptsComponent {
  private readonly api = inject(ApiService);
  private readonly confirm = inject(ConfirmationService);
  private readonly toast = inject(MessageService);

  readonly rows = signal<PromptRow[]>([]);
  readonly profileOptions = signal<Array<{ label: string; value: string }>>([]);
  readonly viewing = signal<PromptRow | null>(null);
  readonly proposing = signal(false);
  readonly saving = signal(false);
  readonly evaluating = signal<string | null>(null);
  readonly swarming = signal(false);
  readonly lastEval = signal<EvalResult | null>(null);
  readonly simRuns = signal<SimRun[]>([]);
  readonly simBest = signal<SimBest[]>([]);
  readonly simRunning = signal(false);

  profileId = 'geral';
  draft = '';
  notes = '';

  constructor() {
    this.loadProfiles();
    this.load();
    this.loadSim();
  }

  loadSim() {
    this.api.get<SimRun[]>('/prompts/sim/results').subscribe({
      next: (rows) => this.simRuns.set(rows || []),
      error: () => this.simRuns.set([]),
    });
    this.api.get<SimBest[]>('/prompts/sim/best').subscribe({
      next: (rows) => this.simBest.set(rows || []),
      error: () => this.simBest.set([]),
    });
  }

  /** Roda a matriz completa (classes padrão × 3 variantes × 6 âncoras) — leva minutos. */
  runSim() {
    this.simRunning.set(true);
    this.toast.add({
      severity: 'info',
      summary: 'Simulação iniciada',
      detail: 'Backtest de prompts por classe contra o passado — leva vários minutos.',
      life: 8000,
    });
    this.api
      .post<{ model: string; runs: Array<{ classId: string; variantId: string; hitRate: number; score: number }> }>(
        '/prompts/sim/run',
        { anchors: 6 },
      )
      .subscribe({
        next: (res) => {
          this.simRunning.set(false);
          this.toast.add({
            severity: 'success',
            summary: `Simulação concluída (${res.runs.length} runs)`,
            detail: 'Tabela atualizada com os resultados.',
            life: 10000,
          });
          this.loadSim();
        },
        error: (err) => {
          this.simRunning.set(false);
          this.toast.add({
            severity: 'error',
            summary: 'Falha na simulação',
            detail: err?.error?.message || 'Verifique o provedor de IA',
          });
        },
      });
  }

  loadProfiles() {
    this.api.get<ProfileOption[]>('/prompts/profiles').subscribe({
      next: (profiles) =>
        this.profileOptions.set(
          profiles.map((profile) => ({ label: `${profile.icon} ${profile.name}`, value: profile.id })),
        ),
    });
  }

  load() {
    this.api.get<PromptRow[]>(`/prompts?profile=${encodeURIComponent(this.profileId)}`).subscribe({
      next: (rows) => this.rows.set(rows || []),
      error: () => this.rows.set([]),
    });
  }

  startProposal() {
    const active = this.rows().find((row) => row.status === 'active');
    this.draft = active?.systemPrompt || '';
    this.notes = '';
    this.proposing.set(true);
  }

  propose() {
    if (!this.draft.trim()) return;
    this.saving.set(true);
    this.api
      .post<PromptRow>('/prompts', { profileId: this.profileId, systemPrompt: this.draft, notes: this.notes })
      .subscribe({
        next: (row) => {
          this.saving.set(false);
          this.proposing.set(false);
          this.toast.add({ severity: 'success', summary: `Candidato v${row.version} criado` });
          this.load();
        },
        error: (err) => {
          this.saving.set(false);
          this.toast.add({
            severity: 'error',
            summary: 'Falha ao salvar',
            detail: err?.error?.message || 'Tente novamente',
          });
        },
      });
  }

  view(row: PromptRow) {
    this.api.get<PromptRow>(`/prompts/${row.id}`).subscribe({
      next: (full) => this.viewing.set(full),
      error: () => this.viewing.set(row),
    });
  }

  runSwarm() {
    this.swarming.set(true);
    this.toast.add({
      severity: 'info',
      summary: 'Swarm iniciado',
      detail: 'Auto-ajuste para todos os perfis em paralelo — pode levar vários minutos.',
      life: 8000,
    });
    this.api.post<SwarmResult>('/prompts/swarm', {}).subscribe({
      next: (res) => {
        this.swarming.set(false);
        const s = res.summary;
        this.toast.add({
          severity: s.promoted ? 'success' : 'info',
          summary: `Swarm: ${s.promoted} promovido(s), ${s.candidates} candidato(s)`,
          detail: s.best ? `Melhor: ${s.best.profile} (nota ${s.best.score ?? '—'})` : 'Nenhum superou o baseline',
          life: 12000,
        });
        this.load();
      },
      error: (err) => {
        this.swarming.set(false);
        this.toast.add({
          severity: 'error',
          summary: 'Falha no swarm',
          detail: err?.error?.message || 'Tente novamente',
        });
      },
    });
  }

  evaluate(row: PromptRow) {    this.evaluating.set(row.id);
    this.api.post<EvalResult>(`/prompts/${row.id}/evaluate`, {}).subscribe({
      next: (result) => {
        this.evaluating.set(null);
        this.lastEval.set(result);
        this.toast.add({ severity: 'success', summary: `v${row.version}: ${result.score}/100` });
        this.load();
      },
      error: (err) => {
        this.evaluating.set(null);
        this.toast.add({
          severity: 'error',
          summary: 'Falha na avaliação',
          detail: err?.error?.message || 'Verifique o provedor de IA',
        });
      },
    });
  }

  activate(row: PromptRow) {
    this.confirm.confirm({
      message: `Ativar a v${row.version} no perfil ${row.profileId}? A versão atual será arquivada.`,
      header: 'Ativar prompt',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.api.post(`/prompts/${row.id}/activate`, {}).subscribe({
          next: () => {
            this.toast.add({ severity: 'success', summary: `v${row.version} ativada` });
            this.load();
          },
          error: () =>
            this.toast.add({ severity: 'error', summary: 'Falha ao ativar', detail: 'Tente novamente' }),
        });
      },
    });
  }
}
