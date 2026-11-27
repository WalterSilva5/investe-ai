import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AccordionModule } from 'primeng/accordion';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { ApiService } from '../../core/api.service';

interface RadarItem {
  slug: string;
  name: string;
  icon: string;
  description: string;
  attention: number;
  trend?: number;
  thermometer?: { score: number; label: string; reading: string; tip?: string } | null;
  headlines: Array<{ title: string; source: string; url: string }>;
  latest: {
    id: string;
    title: string;
    stage: string;
    mode?: string;
    attention: number;
    hypeRisk: number;
    generatedAt: string;
  } | null;
}

interface Cycle {
  id: string;
  theme: string;
  period: string;
  title: string;
  summary: string;
  warningSigns: string[];
  lessons: string[];
}

interface CycleSummary {
  id: string;
  title: string;
  summary: string;
  dominantStage: string;
  topThemes?: Array<{ theme: string; stage: string; note: string }> | null;
  risks?: string[] | null;
  watchPoints?: string[] | null;
  generatedAt: string;
}

interface ActionTip {
  ticker?: string;
  theme: string;
  signal: string;
  action: string;
  why: string;
  risk: string;
  verdict?: string;
  trigger?: string;
  invalidation?: string;
  highlight?: boolean;
}

interface ActionDigest {
  id: string;
  title: string;
  summary: string;
  actions?: ActionTip[] | null;
  generatedAt: string;
}

interface ContrarianItem {
  symbol: string;
  score: number;
  verdict: string;
  reasons: string[];
  drop3mPct: number | null;
  rsi14: number | null;
  distSupportPct: number | null;
  ratio: number | null;
}

interface BriefContent {
  headline?: string;
  stage?: string;
  summary?: string;
  asymmetry?: string;
  evidence?: string[];
  risks?: string[];
  euphoriaSignals?: string[];
  confirmSignals?: string[];
  invalidateSignals?: string[];
  exitRules?: string[];
  sizing?: string[];
  timing?: string;
  psychology?: string;
  disclaimer?: string;
}

interface Brief {
  id: string;
  theme: string;
  title: string;
  stage: string;
  mode?: string;
  attention: number;
  hypeRisk: number;
  content: BriefContent;
  sources?: Array<{ title: string; source: string; url: string }> | null;
  generatedAt: string;
}

@Component({
  selector: 'app-opportunities',
  imports: [DatePipe, AccordionModule, TableModule, TagModule, ButtonModule, RouterLink],
  template: `
    <h1 class="page-title">Radar de oportunidades</h1>
    <p class="page-sub">
      Entenda o ciclo de narrativas (IA, cripto, metaverso, NFTs…) — o que é fato, o que é hype
      e quais sinais indicam risco. <strong>Não é recomendação de compra/venda.</strong>
    </p>

    <div class="alert ok" style="margin-bottom:18px">
      <strong>Como usar com ética:</strong> o objetivo é você se proteger e agir com critério —
      reconhecer hype, manipulação e risco de comprar no topo. <em>Não</em> é para explorar a
      ignorância de outros investidores.
    </div>

    <div class="legend" style="margin-bottom:16px">
      <span class="legend-title">Cor do card = objetivo da última análise:</span>
      <span class="badge mode-growth">Crescimento máximo</span>
      <span class="badge mode-conservative">Preservação (conservador)</span>
      <span class="badge off">Sem análise</span>
    </div>
    <div class="legend" style="margin-bottom:16px">
      <span class="legend-title">Termômetro: força do tema (0–100) × leitura de momento.</span>
      <span class="badge read-bullish">Bullish</span>
      <span class="badge read-neutro">Neutro</span>
      <span class="badge read-bearish">Bearish</span>
    </div>

    <div class="field" style="max-width:420px;margin-bottom:18px">
      <label>Modo da análise</label>
      <select class="input" [value]="mode" (change)="onModeChange($event)">
        <option value="growth">Crescimento máximo (assimetria, momentum, saída)</option>
        <option value="conservative">Conservador (preservação de capital)</option>
      </select>
    </div>

    @if (error()) {
      <div class="alert error">{{ error() }}</div>
    }

    <section class="section" style="margin-top:0;margin-bottom:28px">
      <div class="insights-head">
        <div>
          <h2>Oportunidades em queda (reversão)</h2>
          <p class="muted small">
            Papéis que caíram e começam a dar sinal de virada: sobrevenda, suporte próximo, ganho/risco e
            repique. Varre o universo + sua carteira. O oposto do radar de tendência — aqui o foco é o que
            caiu, não o que já subiu.
          </p>
        </div>
        <button class="btn secondary" [disabled]="contrarianLoading()" (click)="runContrarian()">
          {{ contrarianLoading() ? 'Analisando quedas…' : 'Analisar quedas' }}
        </button>
      </div>

      @if (contrarian().length) {
        <div class="muted small" style="margin-bottom:8px">
          {{ contrarianScanned() }} papéis varridos · {{ contrarian().length }} com sinal de virada
        </div>
        <p-table [value]="contrarian()" stripedRows>
          <ng-template #header>
            <tr>
              <th>Ativo</th>
              <th>Nota de reversão</th>
              <th>Veredito</th>
              <th>Queda 3m</th>
              <th>RSI</th>
              <th>Do suporte</th>
              <th>Ganho/risco</th>
              <th>Por que entrou</th>
              <th></th>
            </tr>
          </ng-template>
          <ng-template #body let-row>
            <tr>
              <td><strong>{{ row.symbol }}</strong></td>
              <td>
                <p-tag
                  [value]="row.score + '/100'"
                  [severity]="row.score >= 60 ? 'success' : row.score >= 40 ? 'warn' : 'secondary'"
                />
              </td>
              <td><p-tag [value]="row.verdict" [severity]="verdictSeverity(row.verdict)" /></td>
              <td>{{ row.drop3mPct != null ? row.drop3mPct.toFixed(1) + '%' : '—' }}</td>
              <td>{{ row.rsi14 != null ? row.rsi14.toFixed(0) : '—' }}</td>
              <td>{{ row.distSupportPct != null ? row.distSupportPct.toFixed(1) + '%' : '—' }}</td>
              <td>{{ row.ratio != null ? row.ratio.toFixed(2) + ':1' : '—' }}</td>
              <td class="small" style="min-width:240px">{{ row.reasons.join(' · ') }}</td>
              <td style="white-space:nowrap">
                <p-button
                  label="Salvar"
                  size="small"
                  severity="secondary"
                  [outlined]="true"
                  (onClick)="trackContrarian(row.symbol)"
                />
                <p-button
                  label="Tracking"
                  size="small"
                  severity="secondary"
                  [text]="true"
                  [routerLink]="['/app/tracking']"
                  [queryParams]="{ symbol: row.symbol }"
                />
              </td>
            </tr>
          </ng-template>
        </p-table>
      } @else if (!contrarianLoading()) {
        <div class="row">
          <div>
            <div class="name">Nenhuma análise de queda ainda</div>
            <div class="meta">Clique em "Analisar quedas" para varrer o universo e a carteira.</div>
          </div>
        </div>
      }
    </section>

    <section class="section" style="margin-top:0;margin-bottom:28px">
      <div class="insights-head">
        <div>
          <h2>Dicas de ação</h2>
          <p class="muted small">
            O que fazer a partir do radar agora — observar, revisar, aguardar. Atualizado toda
            segunda-feira ou quando você pedir. Educacional, sem recomendação de compra/venda.
          </p>
        </div>
        <button class="btn secondary" [disabled]="refreshingActions()" (click)="refreshActionTips()">
          {{ refreshingActions() ? 'Gerando…' : 'Gerar dicas' }}
        </button>
      </div>

      @if (actionTips(); as tips) {
        <div class="insight">
          <div class="insight-top">
            <span class="badge mode-growth">{{ tips.title }}</span>
            <span class="muted small">{{ tips.generatedAt | date: 'dd/MM/yyyy HH:mm' }}</span>
          </div>
          @if (tips.summary) {
            <div class="insight-body">{{ tips.summary }}</div>
          }
          @if (tips.actions?.length) {
            <p-accordion [multiple]="true" styleClass="tips-accordion">
              @for (tip of tips.actions; track $index) {
                <p-accordion-panel [value]="$index">
                  <p-accordion-header>
                    <span class="tip-title">{{ tip.ticker || tip.theme }}</span>
                    @if (tip.verdict) {
                      <span class="badge {{ verdictBadge(tip.verdict) }}">{{ tip.verdict }}</span>
                    }
                    @if (tip.highlight) {
                      <span class="badge mode-conservative">Destaque do dia</span>
                    }
                    <span class="badge mode-growth">{{ tip.signal }}</span>
                  </p-accordion-header>
                  <p-accordion-content>
                    <div class="name">{{ tip.action }}</div>
                    <div class="meta" style="margin-top:6px">
                      @if (tip.why) { <div><strong>Por quê:</strong> {{ tip.why }}</div> }
                      @if (tip.trigger) { <div><strong>Confirma se:</strong> {{ tip.trigger }}</div> }
                      @if (tip.invalidation) { <div><strong>Invalida se:</strong> {{ tip.invalidation }}</div> }
                      @if (tip.risk) { <div><strong>Risco:</strong> {{ tip.risk }}</div> }
                      @if (tip.theme && tip.ticker && tip.theme !== tip.ticker) {
                        <div><strong>Tema:</strong> {{ tip.theme }}</div>
                      }
                    </div>
                  </p-accordion-content>
                </p-accordion-panel>
              }
            </p-accordion>
          }
        </div>
      } @else {
        <div class="row">
          <div>
            <div class="name">Sem dicas ainda</div>
            <div class="meta">Clique em "Gerar dicas" para analisar o estado atual do radar.</div>
          </div>
        </div>
      }

      @if (pastTips().length) {
        <h3 style="margin:20px 0 8px;font-size:15px">Histórico por dia</h3>
        <p-accordion styleClass="tips-accordion">
          @for (day of pastTips(); track day.id) {
            <p-accordion-panel [value]="day.id">
              <p-accordion-header>
                <span class="tip-title">{{ day.generatedAt | date: 'dd/MM/yyyy HH:mm' }} — {{ day.title }}</span>
                <span class="badge off">{{ day.actions?.length || 0 }} dicas</span>
              </p-accordion-header>
              <p-accordion-content>
                @if (day.summary) { <p class="muted small" style="margin-top:0">{{ day.summary }}</p> }
                <div class="list">
                  @for (tip of day.actions; track $index) {
                    <div class="row">
                      <div>
                        <div class="name">{{ tip.ticker || tip.theme }} — {{ tip.action }}</div>
                        <div class="meta">sinal: {{ tip.signal }}</div>
                        @if (tip.why) {
                          <div class="meta">por quê: {{ tip.why }}</div>
                        }
                        @if (tip.risk) {
                          <div class="meta">risco: {{ tip.risk }}</div>
                        }
                      </div>
                    </div>
                  }
                </div>
              </p-accordion-content>
            </p-accordion-panel>
          }
        </p-accordion>
      }
    </section>

    <div class="cards">
      @for (item of radar(); track item.slug) {
        <div class="card opp-card {{ objectiveClass(item.latest?.mode) }}">
          <h3>{{ item.icon }} {{ item.name }}</h3>
          <div class="hint" style="margin:6px 0">{{ item.description }}</div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0">
            <span class="badge {{ objectiveBadge(item.latest?.mode) }}">
              {{ objectiveLabel(item.latest?.mode) }}
            </span>
            <span class="badge off">{{ item.attention }} manchete(s)</span>
            @if ((item.trend ?? 0) !== 0) {
              <span class="badge {{ (item.trend ?? 0) > 0 ? 'ok' : 'off' }}">
                {{ (item.trend ?? 0) > 0 ? '↑' : '↓' }} atenção
                {{ (item.trend ?? 0) > 0 ? '+' : '' }}{{ item.trend }}
              </span>
            }
            @if (item.latest) {
              <span class="badge {{ stageClass(item.latest.stage) }}">
                {{ stageLabel(item.latest.stage) }}
              </span>
              <span class="badge off">hype {{ item.latest.hypeRisk }}/100</span>
            }
          </div>
          @if (item.thermometer) {
            <div class="thermo">
              <div class="thermo-head">
                <span>Força do tema <strong>{{ item.thermometer.score }}</strong></span>
                <span class="badge {{ readingBadge(item.thermometer.reading) }}">{{ item.thermometer.reading }}</span>
              </div>
              <div class="thermo-bar"><div class="thermo-fill" [style.width.%]="item.thermometer.score"></div></div>
              <div class="hint">{{ item.thermometer.label }} · setor x leitura do tema</div>
              @if (item.thermometer.tip) {
                <div class="hint" style="margin-top:4px">{{ item.thermometer.tip }}</div>
              }
            </div>
          }
          @if (item.headlines.length) {
            <div class="small muted" style="margin-bottom:8px">
              {{ item.headlines[0].title }}
            </div>
          }
          <button class="btn secondary" (click)="analyze(item.slug)">
            Analisar no chat
          </button>
        </div>
      }
    </div>

    <section class="section">
      <div class="insights-head">
        <div>
          <h2>Ciclo atual</h2>
          <p class="muted small">
            Resumo do momento a partir de todas as suas análises — atualizado toda segunda-feira
            ou quando você pedir.
          </p>
        </div>
        <button class="btn secondary" [disabled]="refreshingCycle()" (click)="refreshCurrentCycle()">
          {{ refreshingCycle() ? 'Atualizando…' : 'Atualizar resumo' }}
        </button>
      </div>

      @if (currentCycle(); as cycle) {
        <div class="insight">
          <div class="insight-top">
            <span class="badge {{ stageClass(cycle.dominantStage) }}">
              {{ stageLabel(cycle.dominantStage) }}
            </span>
            <span class="muted small">{{ cycle.generatedAt | date: 'dd/MM/yyyy HH:mm' }}</span>
          </div>
          <div class="insight-title">{{ cycle.title }}</div>
          <div class="insight-body">{{ cycle.summary }}</div>
          @if (cycle.topThemes?.length) {
            <div class="list" style="margin-top:10px">
              @for (t of cycle.topThemes; track t.theme) {
                <div class="row">
                  <div>
                    <div class="name">{{ t.theme }}</div>
                    <div class="meta">{{ t.note }}</div>
                  </div>
                  <span class="badge {{ stageClass(t.stage) }}">{{ stageLabel(t.stage) }}</span>
                </div>
              }
            </div>
          }
          <div class="grid-2" style="margin-top:10px">
            @if (cycle.risks?.length) {
              <div>
                <div class="small muted"><strong>Riscos transversais</strong></div>
                <ul class="small">
                  @for (risk of cycle.risks; track $index) {
                    <li>{{ risk }}</li>
                  }
                </ul>
              </div>
            }
            @if (cycle.watchPoints?.length) {
              <div>
                <div class="small muted"><strong>O que observar</strong></div>
                <ul class="small">
                  @for (point of cycle.watchPoints; track $index) {
                    <li>{{ point }}</li>
                  }
                </ul>
              </div>
            }
          </div>
        </div>
      } @else {
        <div class="row">
          <div>
            <div class="name">Sem resumo ainda</div>
            <div class="meta">Analise ao menos um tema e clique em "Atualizar resumo".</div>
          </div>
        </div>
      }
    </section>

    <section class="section">
      <h2>Ciclos passados (lições)</h2>
      <div class="list">
        @for (cycle of cycles(); track cycle.id) {
          <div class="insight">
            <div class="insight-top">
              <span class="badge off">{{ cycle.theme }} · {{ cycle.period }}</span>
            </div>
            <div class="insight-title">{{ cycle.title }}</div>
            <div class="insight-body">{{ cycle.summary }}</div>
            <div class="grid-2" style="margin-top:8px">
              <div>
                <div class="small muted"><strong>Sinais de alerta</strong></div>
                <ul class="small">
                  @for (sign of cycle.warningSigns; track $index) {
                    <li>{{ sign }}</li>
                  }
                </ul>
              </div>
              <div>
                <div class="small muted"><strong>Lições</strong></div>
                <ul class="small">
                  @for (lesson of cycle.lessons; track $index) {
                    <li>{{ lesson }}</li>
                  }
                </ul>
              </div>
            </div>
          </div>
        }
      </div>
    </section>

    <section class="section">
      <h2>Playbook de saída (disciplina)</h2>
      <div class="list">
        <div class="row"><div><div class="name">Tamanho da posição</div><div class="meta">Risco máximo por posição (ex.: 1–2% do patrimônio) e teto por tema (ex.: 10%).</div></div></div>
        <div class="row"><div><div class="name">Take profit parcial</div><div class="meta">Realizar parte quando a tese inicial se materializar; não tentar "o topo".</div></div></div>
        <div class="row"><div><div class="name">Trailing stop</div><div class="meta">Subir o ponto de saída conforme o preço sobe, protegendo o lucro.</div></div></div>
        <div class="row"><div><div class="name">Invalidação da tese</div><div class="meta">Sair se o sinal que confirmava a tese desaparecer — sem esperar "voltar".</div></div></div>
        <div class="row"><div><div class="name">Prazo</div><div class="meta">Definir prazo; se a tese não se materializar, reavaliar.</div></div></div>
        <div class="row"><div><div class="name">Emoção</div><div class="meta">Não aumentar posição no prejuízo por vingança; não vender tudo no pânico.</div></div></div>
      </div>
      <p class="disclaimer">Framework educacional. Não é recomendação de investimento.</p>
    </section>

    @if (brief()) {
      <section class="section">
        <div class="insights-head">
          <div>
            <h2>{{ brief()!.title }}</h2>
            <p class="muted small">
              Gerado em {{ brief()!.generatedAt | date: 'dd/MM/yyyy HH:mm' }} ·
              {{ brief()!.attention }} manchete(s) · hype {{ brief()!.hypeRisk }}/100 ·
              modo {{ brief()!.mode === 'conservative' ? 'conservador' : 'crescimento máximo' }}
            </p>
          </div>
          <span class="badge {{ stageClass(brief()!.stage) }}">{{ stageLabel(brief()!.stage) }}</span>
        </div>

        @if (brief()!.content.summary) {
          <p>{{ brief()!.content.summary }}</p>
        }

        @if (brief()!.content.asymmetry) {
          <div class="alert ok" style="margin-bottom:12px">
            <strong>Assimetria (upside × downside):</strong> {{ brief()!.content.asymmetry }}
          </div>
        }

        <div class="grid-2">
          <div class="card">
            <h3>Evidências</h3>
            <ul>
              @for (item of brief()!.content.evidence || []; track $index) {
                <li>{{ item }}</li>
              }
            </ul>
          </div>
          <div class="card">
            <h3>Riscos</h3>
            <ul>
              @for (item of brief()!.content.risks || []; track $index) {
                <li>{{ item }}</li>
              }
            </ul>
          </div>
          <div class="card">
            <h3>Sinais de euforia/topo</h3>
            <ul>
              @for (item of brief()!.content.euphoriaSignals || []; track $index) {
                <li>{{ item }}</li>
              }
            </ul>
          </div>
          <div class="card">
            <h3>Sinais de confirmação</h3>
            <ul>
              @for (item of brief()!.content.confirmSignals || []; track $index) {
                <li>{{ item }}</li>
              }
            </ul>
          </div>
          <div class="card">
            <h3>Sinais de invalidação</h3>
            <ul>
              @for (item of brief()!.content.invalidateSignals || []; track $index) {
                <li>{{ item }}</li>
              }
            </ul>
          </div>
          <div class="card">
            <h3>Regras de saída (disciplina)</h3>
            <ul>
              @for (item of brief()!.content.exitRules || []; track $index) {
                <li>{{ item }}</li>
              }
            </ul>
          </div>
          <div class="card">
            <h3>Dimensionamento de risco</h3>
            <ul>
              @for (item of brief()!.content.sizing || []; track $index) {
                <li>{{ item }}</li>
              }
            </ul>
          </div>
          <div class="card">
            <h3>Leitura de timing</h3>
            <p>{{ brief()!.content.timing }}</p>
          </div>
          <div class="card">
            <h3>Psicologia do mercado</h3>
            <p>{{ brief()!.content.psychology }}</p>
          </div>
        </div>

        @if (brief()!.sources?.length) {
          <div class="insight-sources" style="margin-top:12px">
            <span class="muted small">Fontes:</span>
            @for (source of brief()!.sources; track source.url) {
              <a [href]="source.url" target="_blank" rel="noopener">{{ source.source }}</a>
            }
          </div>
        }

        <p class="disclaimer">
          {{ brief()!.content.disclaimer || 'Conteúdo educacional. Não é recomendação de investimento.' }}
        </p>
      </section>
    }
  `,
})
export class OpportunitiesComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly radar = signal<RadarItem[]>([]);
  readonly cycles = signal<Cycle[]>([]);
  readonly currentCycle = signal<CycleSummary | null>(null);
  readonly actionTips = signal<ActionDigest | null>(null);
  readonly actionHistory = signal<ActionDigest[]>([]);
  readonly contrarian = signal<ContrarianItem[]>([]);
  readonly contrarianLoading = signal(false);
  readonly contrarianScanned = signal(0);
  readonly pastTips = computed(() => {
    const current = this.actionTips()?.id;
    return this.actionHistory().filter((d) => d.id !== current);
  });
  readonly brief = signal<Brief | null>(null);
  readonly analyzing = signal<string | null>(null);
  readonly refreshingCycle = signal(false);
  readonly refreshingActions = signal(false);
  readonly error = signal<string | null>(null);

  mode = 'growth';

  constructor() {
    this.loadRadar();
    this.loadCycles();
    this.loadCurrentCycle();
    this.loadActionTips();
    this.loadActionHistory();
  }

  loadCycles() {
    this.api.get<Cycle[]>('/opportunities/cycles').subscribe({
      next: (items) => this.cycles.set(items),
    });
  }

  loadCurrentCycle() {
    this.api.get<CycleSummary>('/opportunities/current-cycle').subscribe({
      next: (item) => this.currentCycle.set(item || null),
      error: () => this.currentCycle.set(null),
    });
  }

  refreshCurrentCycle() {
    this.refreshingCycle.set(true);
    this.error.set(null);
    this.api.post<CycleSummary>('/opportunities/current-cycle/refresh', {}).subscribe({
      next: (item) => {
        this.refreshingCycle.set(false);
        this.currentCycle.set(item);
      },
      error: (err) => {
        this.refreshingCycle.set(false);
        this.error.set(err?.error?.message || 'Falha ao atualizar o resumo do ciclo.');
      },
    });
  }

  loadActionTips() {
    this.api.get<ActionDigest>('/opportunities/action-tips').subscribe({
      next: (item) => this.actionTips.set(item || null),
      error: () => this.actionTips.set(null),
    });
  }

  loadActionHistory() {
    this.api.get<ActionDigest[]>('/opportunities/action-tips/history').subscribe({
      next: (items) => this.actionHistory.set(items || []),
      error: () => this.actionHistory.set([]),
    });
  }

  runContrarian() {
    this.contrarianLoading.set(true);
    this.error.set(null);
    this.api
      .get<{ scanned: number; items: ContrarianItem[] }>('/opportunities/contrarian?limit=8')
      .subscribe({
        next: (res) => {
          this.contrarianLoading.set(false);
          this.contrarianScanned.set(res.scanned || 0);
          this.contrarian.set(res.items || []);
          if (!res.items?.length) {
            this.error.set('Nenhum papel em queda com sinal de virada agora.');
          }
        },
        error: (err) => {
          this.contrarianLoading.set(false);
          this.error.set(err?.error?.message || 'Não foi possível analisar as quedas.');
        },
      });
  }

  trackContrarian(symbol: string) {
    this.api.post(`/discovery/tracked/${encodeURIComponent(symbol)}`, {}).subscribe({
      next: () => this.loadActionHistory(),
      error: () => undefined,
    });
  }

  verdictSeverity(verdict: string): 'success' | 'warn' | 'danger' | 'secondary' {
    if (verdict === 'Reversão forte') return 'success';
    if (verdict === 'Reversão em formação') return 'warn';
    if (verdict === 'Aguardar') return 'secondary';
    return 'danger';
  }

  refreshActionTips() {
    this.refreshingActions.set(true);
    this.error.set(null);
    this.api.post<ActionDigest>('/opportunities/action-tips/refresh', {}).subscribe({
      next: (item) => {
        this.refreshingActions.set(false);
        this.actionTips.set(item);
        this.loadActionHistory();
      },
      error: (err) => {
        this.refreshingActions.set(false);
        this.error.set(err?.error?.message || 'Falha ao gerar dicas de ação.');
      },
    });
  }

  onModeChange(event: Event) {
    this.mode = (event.target as HTMLSelectElement).value;
    this.brief.set(null);
    this.loadRadar();
  }

  loadRadar() {
    this.api.get<RadarItem[]>(`/opportunities/radar?mode=${this.mode}`).subscribe({
      next: (items) => this.radar.set(items),
      error: () => this.error.set('Falha ao carregar o radar.'),
    });
  }

  /** Abre o CHAT com um pedido de análise detalhada do tema — o agente usa
   * analyze_theme + get_stock_outlook e sugere oportunidades na área. */
  analyze(slug: string) {
    const name = this.radar().find((item) => item.slug === slug)?.name || slug;
    this.router.navigate(['/app/chat'], {
      queryParams: {
        theme: slug,
        themeName: name,
        mode: this.mode,
      },
    });
  }

  stageLabel(stage: string): string {
    const labels: Record<string, string> = {
      EMERGENTE: 'Emergente',
      HYPE: 'Hype',
      DESILUSAO: 'Desilusão',
      MATURACAO: 'Maturação',
      PLATEAU: 'Platô',
      DECLINIO: 'Declínio',
    };
    return labels[stage] || stage;
  }

  stageClass(stage: string): string {
    return 'stage-' + (stage || 'emergente').toLowerCase();
  }

  readingBadge(reading: string): string {
    if (reading === 'Bullish') return 'read-bullish';
    if (reading === 'Bearish') return 'read-bearish';
    return 'read-neutro';
  }

  verdictBadge(verdict?: string): string {
    if (verdict === 'Oportunidade') return 'read-bullish';
    if (verdict === 'Evitar') return 'read-bearish';
    return 'read-neutro';
  }

  objectiveLabel(mode?: string): string {
    if (mode === 'conservative') return 'Preservação';
    if (mode === 'growth') return 'Crescimento';
    return 'Sem análise';
  }

  objectiveBadge(mode?: string): string {
    if (mode === 'conservative') return 'mode-conservative';
    if (mode === 'growth') return 'mode-growth';
    return 'off';
  }

  objectiveClass(mode?: string): string {
    if (mode === 'conservative') return 'opp-conservative';
    if (mode === 'growth') return 'opp-growth';
    return 'opp-none';
  }
}
