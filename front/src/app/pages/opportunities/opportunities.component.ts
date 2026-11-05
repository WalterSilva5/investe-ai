import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api.service';

interface RadarItem {
  slug: string;
  name: string;
  icon: string;
  description: string;
  attention: number;
  trend?: number;
  headlines: Array<{ title: string; source: string; url: string }>;
  latest: {
    id: string;
    title: string;
    stage: string;
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
  imports: [DatePipe],
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

    <div class="cards">
      @for (item of radar(); track item.slug) {
        <div class="card">
          <h3>{{ item.icon }} {{ item.name }}</h3>
          <div class="hint" style="margin:6px 0">{{ item.description }}</div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0">
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
          @if (item.headlines.length) {
            <div class="small muted" style="margin-bottom:8px">
              {{ item.headlines[0].title }}
            </div>
          }
          <button class="btn secondary" [disabled]="analyzing() === item.slug" (click)="analyze(item.slug)">
            {{ analyzing() === item.slug ? 'Analisando…' : 'Analisar tema' }}
          </button>
        </div>
      }
    </div>

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

  readonly radar = signal<RadarItem[]>([]);
  readonly cycles = signal<Cycle[]>([]);
  readonly brief = signal<Brief | null>(null);
  readonly analyzing = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  mode = 'growth';

  constructor() {
    this.loadRadar();
    this.loadCycles();
  }

  loadCycles() {
    this.api.get<Cycle[]>('/opportunities/cycles').subscribe({
      next: (items) => this.cycles.set(items),
    });
  }

  onModeChange(event: Event) {
    this.mode = (event.target as HTMLSelectElement).value;
  }

  loadRadar() {
    this.api.get<RadarItem[]>('/opportunities/radar').subscribe({
      next: (items) => this.radar.set(items),
      error: () => this.error.set('Falha ao carregar o radar.'),
    });
  }

  analyze(slug: string) {
    this.analyzing.set(slug);
    this.error.set(null);
    this.api.post<Brief>(`/opportunities/${slug}/analyze`, { mode: this.mode }).subscribe({
      next: (result) => {
        this.analyzing.set(null);
        this.brief.set(result);
        this.loadRadar();
      },
      error: (err) => {
        this.analyzing.set(null);
        this.error.set(err?.error?.message || 'Falha ao analisar o tema.');
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
}
