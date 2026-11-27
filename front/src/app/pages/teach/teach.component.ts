import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { PriceChartComponent } from '../../shared/charts/price-chart.component';
import { ApiService } from '../../core/api.service';

interface CurriculumItem {
  id: string;
  emoji: string;
  title: string;
  summary: string;
  attempts: number;
  correct: boolean;
  completed: boolean;
}

interface CurriculumTrack {
  id: string;
  label: string;
  lessons: CurriculumItem[];
  completed: number;
  total: number;
}

interface LiveData {
  symbol: string;
  currency: string;
  current: number;
  trend: string;
  rsi14: number | null;
  support: number | null;
  resistance: number | null;
  ratio: number | null;
  labels: string[];
  values: number[];
  supports: number[];
  resistances: number[];
  ma20: number | null;
  ma50: number | null;
  halvingDaysBeforeNext?: number | null;
  halving?: {
    daysBeforeNext: number;
    phase: string;
    phaseNote: string;
    nextHalving: { date: string; estimated: boolean };
    reference: Array<{
      halving: string;
      priceAtHalvingUsd: number;
      topUsdApprox: number | null;
      daysHalvingToTop: number | null;
      followingDrawdownPct: number | null;
    }>;
  } | null;
}

interface LessonSection {
  title: string;
  text: string;
}

interface LessonContent {
  id: string;
  emoji: string;
  title: string;
  summary: string;
  sections: LessonSection[];
  exercise: {
    type: string;
    question: string;
    hint: string;
    choices?: string[];
    answer?: string;
    explanation?: string;
  };
  sources: string[];
  progress: { attempts: number; correct: boolean; completedAt: string | null };
  live: LiveData | null;
}

@Component({
  selector: 'app-teach',
  imports: [FormsModule, RouterLink, CardModule, ButtonModule, TagModule, PriceChartComponent],
  template: `
    @if (!lesson()) {
      <h1 class="page-title">Aprender a investir</h1>
      <p class="page-sub">
        Módulo de ensino com lições curtas, exemplos com <strong>dados reais do app</strong> e
        exercícios corrigidos na hora. Comece pela primeira ou escolha onde precisa.
      </p>

      <div class="muted small" style="margin-bottom:14px">
        Progresso: {{ curriculum()?.completed ?? 0 }} de {{ curriculum()?.total ?? 0 }} aulas concluídas
      </div>

      @for (track of curriculum()?.tracks || []; track track.id) {
        <div class="track-head">
          <h2 style="font-size:16px;margin:0 0 2px">{{ track.label }}</h2>
          <span class="muted small">{{ track.completed }}/{{ track.total }} concluídas</span>
        </div>
        <div class="cards" style="margin-bottom:8px">
          @for (lesson of track.lessons; track lesson.id) {
            <p-card>
              <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
                <h3 style="margin:0">{{ lesson.emoji }} {{ lesson.title }}</h3>
                @if (lesson.completed) {
                  <p-tag value="concluída" severity="success" />
                } @else if (lesson.correct) {
                  <p-tag value="exercício ok" severity="info" />
                } @else if (lesson.attempts > 0) {
                  <p-tag value="{{ lesson.attempts }} tentativa(s)" severity="warn" />
                }
              </div>
              <p class="muted small" style="margin:8px 0 0">{{ lesson.summary }}</p>
              <p-button
                label="Estudar"
                size="small"
                styleClass="mt-2"
                (onClick)="openLesson(lesson.id)"
              />
            </p-card>
          }
        </div>
      }
    } @else if (lesson(); as current) {
      <h1 class="page-title">{{ current.emoji }} {{ current.title }}</h1>
      <p class="page-sub">{{ current.summary }}</p>

      <button class="btn secondary" style="margin-bottom:16px" (click)="back()">
        ← Voltar ao currículo
      </button>

      @if (current.live?.halving; as halving) {
        <div class="insight" style="margin-bottom:16px">
          <div class="insight-top">
            <span class="badge mode-growth">Ciclo do halving — contexto da aula</span>
            <span class="muted small">
              próximo halving: {{ halving.nextHalving.date }}
              {{ halving.nextHalving.estimated ? '(estimado)' : '' }}
            </span>
          </div>
          <div class="insight-title" style="margin-top:6px">
            {{ halving.phase }} — faltam ~{{ halving.daysBeforeNext }} dias
          </div>
          <div class="insight-body small">{{ halving.phaseNote }}</div>
          <p class="disclaimer" style="margin-top:6px">
            Dados históricos aproximados; padrão observado não é garantia do próximo ciclo.
          </p>
        </div>
      }

      @for (section of current.sections; track section.title) {
        <section class="section" style="margin-top:18px">
          <h2 style="font-size:17px;margin:0 0 6px">{{ section.title }}</h2>
          <p style="margin:0;white-space:pre-wrap">{{ section.text }}</p>
        </section>
      }

      @if (current.live; as live) {
        <section class="section">
          <h2 style="font-size:17px;margin:0 0 6px">Exemplo ao vivo: {{ live.symbol }}</h2>
          <p class="muted small" style="margin-top:0">
            Dados reais de agora — o mesmo que o Tracking mostra. Fonte pública, atualizada no carregamento.
          </p>
          <div class="cards" style="margin-bottom:12px">
            <p-card header="Preço">
              <div class="stat-value">{{ money(live.current, live.currency) }}</div>
              <div class="stat-hint">
                <p-tag [value]="'tendência ' + live.trend" [severity]="trendSeverity(live.trend)" />
              </div>
            </p-card>
            <p-card header="RSI (14)">
              <div class="stat-value">{{ live.rsi14 ?? '—' }}</div>
              <div class="stat-hint">{{ rsiZone(live.rsi14) }}</div>
            </p-card>
            <p-card header="MM20 / MM50">
              <div class="stat-value">
                {{ live.ma20 ? money(live.ma20, live.currency) : '—' }}
              </div>
              <div class="stat-hint">MM50 {{ live.ma50 ? money(live.ma50, live.currency) : '—' }}</div>
            </p-card>
            <p-card header="Suporte / resistência">
              <div class="stat-value">
                {{ live.support ? money(live.support, live.currency) : '—' }}
              </div>
              <div class="stat-hint">
                resistência {{ live.resistance ? money(live.resistance, live.currency) : '—' }}
                @if (live.ratio != null) { · ganho/risco {{ live.ratio.toFixed(2) }}:1 }
              </div>
            </p-card>
          </div>
          <p-card styleClass="chart-card">
            <app-price-chart
              [labels]="live.labels"
              [values]="live.values"
              [supports]="live.supports"
              [resistances]="live.resistances"
              [title]="live.symbol + ' (' + live.currency + ')'"
            />
          </p-card>
        </section>
      }

      <section class="section">
        <h2 style="font-size:17px;margin:0 0 6px">🎯 Exercício</h2>
        <p-card>
          <p style="margin:0 0 8px">{{ current.exercise.question }}</p>
          @if (current.exercise.choices?.length) {
            <div class="chips" style="margin-bottom:10px">
              @for (choice of current.exercise.choices; track choice) {
                <button class="chip" (click)="answer = choice">{{ choice }}</button>
              }
            </div>
          }
          <input
            class="input"
            style="max-width:320px"
            [(ngModel)]="answer"
            [placeholder]="current.exercise.hint"
            (keyup.enter)="check()"
          />
          <p-button label="Corrigir" styleClass="ml-2" [loading]="checking()" (onClick)="check()" />

          @if (feedback(); as fb) {
            <div class="alert" [class.ok]="fb.correct" [class.error]="!fb.correct" style="margin-top:12px">
              <strong>{{ fb.correct ? 'Correto!' : 'Quase — veja o gabarito:' }}</strong>
              {{ fb.expected }}.
              <div style="margin-top:4px">{{ fb.explanation }}</div>
            </div>
          }
          <p class="muted small" style="margin-top:8px">{{ current.exercise.hint }}</p>
        </p-card>
      </section>

      <section class="section" style="display:flex;gap:8px;flex-wrap:wrap">
        <p-button label="Concluir aula" (onClick)="complete()" [loading]="completing()" />
        @if (nextLessonId()) {
          <p-button label="Próxima aula →" severity="secondary" [outlined]="true" (onClick)="openLesson(nextLessonId()!)" />
        }
      </section>

      <p class="muted small" style="margin-top:12px">
        Fontes: {{ current.sources.join(' · ') }}. Conteúdo educacional — não é recomendação de investimento.
      </p>
    }
  `,
})
export class TeachComponent {
  private readonly api = inject(ApiService);

  readonly curriculum = signal<{
    tracks: CurriculumTrack[];
    completed: number;
    total: number;
  } | null>(null);
  readonly lesson = signal<LessonContent | null>(null);
  readonly checking = signal(false);
  readonly completing = signal(false);
  readonly feedback = signal<{ correct: boolean; expected: string; explanation: string } | null>(null);

  answer = '';

  constructor() {
    this.loadCurriculum();
  }

  loadCurriculum() {
    this.api.get<{ tracks: CurriculumTrack[]; completed: number; total: number }>('/teach').subscribe({
      next: (res) => this.curriculum.set(res),
    });
  }

  openLesson(id: string) {
    this.feedback.set(null);
    this.answer = '';
    this.api
      .get<LessonContent>(`/teach/${encodeURIComponent(id)}`)
      .subscribe({
        next: (lesson) => {
          this.lesson.set(lesson);
          window.scrollTo({ top: 0 });
        },
      });
  }

  back() {
    this.lesson.set(null);
    this.loadCurriculum();
  }

  check() {
    const current = this.lesson();
    if (!current || !this.answer.trim() || this.checking()) return;
    this.checking.set(true);
    this.api
      .post<{ correct: boolean; expected: string; explanation: string; attempts: number }>(
        `/teach/${current.id}/answer`,
        { value: this.answer },
      )
      .subscribe({
        next: (res) => {
          this.checking.set(false);
          this.feedback.set(res);
        },
        error: () => {
          this.checking.set(false);
          this.feedback.set({
            correct: false,
            expected: '—',
            explanation: 'Não foi possível validar agora (dados de mercado). Tente novamente.',
          });
        },
      });
  }

  complete() {
    const current = this.lesson();
    if (!current || this.completing()) return;
    this.completing.set(true);
    this.api.post(`/teach/${current.id}/complete`, {}).subscribe({
      next: () => {
        this.completing.set(false);
        this.loadCurriculum();
        this.openLesson(current.id);
      },
      error: () => (this.completing.set(false)),
    });
  }

  nextLessonId(): string | null {
    const list = (this.curriculum()?.tracks || [])
      .map((track) => track.lessons)
      .reduce((all, lessons) => all.concat(lessons), []);
    const index = list.findIndex((item) => item.id === this.lesson()?.id);
    return index >= 0 && index < list.length - 1 ? list[index + 1].id : null;
  }

  trendSeverity(trend: string): 'success' | 'warn' | 'danger' {
    if (trend === 'alta') return 'success';
    if (trend === 'baixa') return 'danger';
    return 'warn';
  }

  rsiZone(value: number | null): string {
    if (value == null) return '—';
    if (value >= 70) return 'sobrecompra';
    if (value <= 30) return 'sobrevenda';
    return 'neutro';
  }

  money(value: number, currency: string): string {
    try {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: currency || 'BRL',
        maximumFractionDigits: 2,
      }).format(value || 0);
    } catch {
      return `${currency} ${(value || 0).toFixed(2)}`;
    }
  }
}
