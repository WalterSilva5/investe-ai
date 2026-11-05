import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

interface BusinessKind {
  slug: string;
  name: string;
  icon: string;
  description: string;
  requiredSkills: string[];
  signals: string[];
}

interface IdeaContent {
  kind?: string;
  title?: string;
  summary?: string;
  fitScore?: number;
  requiredSkills?: string[];
  whyFit?: string;
  firstSteps?: string[];
  validation?: string[];
  pricing?: string;
  risks?: string[];
  timeline?: string;
  disclaimer?: string;
}

interface BusinessIdea {
  id: string;
  kind: string;
  title: string;
  summary: string;
  score: number;
  content: IdeaContent;
  createdAt: string;
}

@Component({
  selector: 'app-business',
  imports: [FormsModule, DatePipe],
  template: `
    <h1 class="page-title">Oportunidades de negócio</h1>
    <p class="page-sub">
      Use seu perfil (skills, experiência, formação) para encontrar caminhos de negócio viáveis.
      Conteúdo educacional — não é garantia de resultado.
    </p>

    @if (error()) {
      <div class="alert error">{{ error() }}</div>
    }
    @if (okMsg()) {
      <div class="alert ok">{{ okMsg() }}</div>
    }

    <div class="grid-2">
      <section class="card">
        <h3>Seu perfil profissional</h3>

        <div class="field">
          <label>Headline</label>
          <input class="input" [(ngModel)]="headline" placeholder="Ex.: Desenvolvedor full-stack com foco em IA" />
        </div>
        <div class="field">
          <label>Resumo</label>
          <textarea class="input" rows="3" [(ngModel)]="summary" placeholder="O que você faz, para quem, e o que quer construir."></textarea>
        </div>
        <div class="field">
          <label>Skills (separadas por vírgula)</label>
          <input class="input" [(ngModel)]="skills" placeholder="TypeScript, Node.js, Angular, IA, liderança" />
        </div>
        <div class="field">
          <label>Experiência (uma por linha)</label>
          <textarea class="input" rows="3" [(ngModel)]="experience" placeholder="Desenvolvedor sênior — Empresa X (2020–2024)&#10;Consultor — Projetos Y (2024–hoje)"></textarea>
        </div>
        <div class="field">
          <label>Formação (uma por linha)</label>
          <textarea class="input" rows="2" [(ngModel)]="education" placeholder="Ciência da Computação — Universidade Z (2018)"></textarea>
        </div>
        <div class="field">
          <label>Idiomas</label>
          <input class="input" [(ngModel)]="languages" placeholder="Português, Inglês avançado" />
        </div>
        <div class="field">
          <label>Interesses</label>
          <input class="input" [(ngModel)]="interests" placeholder="IA, produtos, ensino, mercado internacional" />
        </div>
        <div class="grid-2">
          <div class="field">
            <label>Localização</label>
            <input class="input" [(ngModel)]="location" placeholder="Brasil (remoto)" />
          </div>
          <div class="field">
            <label>Disponibilidade</label>
            <input class="input" [(ngModel)]="availability" placeholder="10h/semana" />
          </div>
        </div>
        <div class="field">
          <label>Meta de renda (R$/mês)</label>
          <input class="input" type="number" [(ngModel)]="incomeGoal" placeholder="10000" />
        </div>

        <button class="btn" [disabled]="saving()" (click)="saveProfile()">
          {{ saving() ? 'Salvando…' : 'Salvar perfil' }}
        </button>
      </section>

      <section class="card">
        <h3>Tipos de negócio</h3>
        <div class="list" style="margin-top:10px">
          @for (kind of kinds(); track kind.slug) {
            <div class="row">
              <div>
                <div class="name">{{ kind.icon }} {{ kind.name }}</div>
                <div class="meta">{{ kind.description }}</div>
              </div>
            </div>
          }
        </div>
      </section>
    </div>

    <section class="section">
      <h2>Gerar ideias</h2>
      <div class="field">
        <label>Foco (opcional)</label>
        <input class="input" [(ngModel)]="focus" placeholder="Ex.: renda em dólar, produto próprio, consultoria B2B" />
      </div>
      <button class="btn" [disabled]="generating()" (click)="generate()">
        {{ generating() ? 'Gerando…' : 'Gerar ideias de negócio' }}
      </button>
      <p class="small muted" style="margin-top:8px">
        Exige um provedor de IA configurado. As ideias são geradas a partir do seu perfil.
      </p>
    </section>

    @if (ideas().length) {
      <section class="section">
        <h2>Ideias geradas</h2>
        <div class="list">
          @for (idea of ideas(); track idea.id) {
            <div class="insight">
              <div class="insight-top">
                <span class="badge cat-carteira">{{ kindLabel(idea.kind) }}</span>
                <span class="muted small">
                  fit {{ idea.score }}/100 · {{ idea.createdAt | date: 'dd/MM/yyyy' }}
                </span>
              </div>
              <div class="insight-title">{{ idea.title }}</div>
              <div class="insight-body">{{ idea.summary }}</div>

              @if (idea.content.whyFit) {
                <div class="small" style="margin-top:6px"><strong>Por que combina:</strong> {{ idea.content.whyFit }}</div>
              }

              <div class="grid-2" style="margin-top:10px">
                <div>
                  <div class="small muted"><strong>Primeiros passos</strong></div>
                  <ul class="small">
                    @for (step of idea.content.firstSteps || []; track $index) { <li>{{ step }}</li> }
                  </ul>
                </div>
                <div>
                  <div class="small muted"><strong>Validação barata</strong></div>
                  <ul class="small">
                    @for (step of idea.content.validation || []; track $index) { <li>{{ step }}</li> }
                  </ul>
                </div>
                <div>
                  <div class="small muted"><strong>Riscos</strong></div>
                  <ul class="small">
                    @for (risk of idea.content.risks || []; track $index) { <li>{{ risk }}</li> }
                  </ul>
                </div>
                <div>
                  <div class="small muted"><strong>Preço / modelo</strong></div>
                  <p class="small">{{ idea.content.pricing }}</p>
                  <div class="small muted"><strong>Prazo</strong></div>
                  <p class="small">{{ idea.content.timeline }}</p>
                </div>
              </div>

              <p class="disclaimer">
                {{ idea.content.disclaimer || 'Conteúdo educacional. Não é garantia de resultado.' }}
              </p>
            </div>
          }
        </div>
      </section>
    }
  `,
})
export class BusinessComponent {
  private readonly api = inject(ApiService);

  readonly kinds = signal<BusinessKind[]>([]);
  readonly ideas = signal<BusinessIdea[]>([]);
  readonly saving = signal(false);
  readonly generating = signal(false);
  readonly error = signal<string | null>(null);
  readonly okMsg = signal<string | null>(null);

  headline = '';
  summary = '';
  skills = '';
  experience = '';
  education = '';
  languages = '';
  interests = '';
  location = '';
  availability = '';
  incomeGoal: number | null = null;
  focus = '';

  constructor() {
    this.api.get<BusinessKind[]>('/business/catalog').subscribe({
      next: (items) => this.kinds.set(items),
    });
    this.loadProfile();
    this.loadIdeas();
  }

  loadProfile() {
    this.api.get<Record<string, unknown> | null>('/business/profile').subscribe({
      next: (profile) => {
        if (!profile) return;
        this.headline = (profile['headline'] as string) || '';
        this.summary = (profile['summary'] as string) || '';
        this.skills = ((profile['skills'] as string[]) || []).join(', ');
        this.experience = ((profile['experience'] as Array<{ description?: string }>) || [])
          .map((item) => item.description || '')
          .join('\n');
        this.education = ((profile['education'] as Array<{ description?: string }>) || [])
          .map((item) => item.description || '')
          .join('\n');
        this.languages = ((profile['languages'] as string[]) || []).join(', ');
        this.interests = ((profile['interests'] as string[]) || []).join(', ');
        this.location = (profile['location'] as string) || '';
        this.availability = (profile['availability'] as string) || '';
        this.incomeGoal = (profile['incomeGoal'] as number) ?? null;
      },
    });
  }

  loadIdeas() {
    this.api.get<BusinessIdea[]>('/business/ideas').subscribe({
      next: (items) => this.ideas.set(items),
    });
  }

  saveProfile() {
    this.saving.set(true);
    this.error.set(null);
    this.okMsg.set(null);
    this.api
      .put('/business/profile', {
        headline: this.headline,
        summary: this.summary,
        skills: this.split(this.skills),
        experience: this.lines(this.experience),
        education: this.lines(this.education),
        languages: this.split(this.languages),
        interests: this.split(this.interests),
        location: this.location,
        availability: this.availability,
        incomeGoal: this.incomeGoal ?? undefined,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.okMsg.set('Perfil salvo.');
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.error?.message || 'Falha ao salvar o perfil.');
        },
      });
  }

  generate() {
    this.generating.set(true);
    this.error.set(null);
    this.okMsg.set(null);
    this.api.post<{ generated: number }>('/business/ideas', { focus: this.focus || undefined }).subscribe({
      next: (res) => {
        this.generating.set(false);
        this.okMsg.set(`${res.generated} ideia(s) gerada(s).`);
        this.loadIdeas();
      },
      error: (err) => {
        this.generating.set(false);
        this.error.set(err?.error?.message || 'Falha ao gerar ideias.');
      },
    });
  }

  kindLabel(slug: string): string {
    const kind = this.kinds().find((k) => k.slug === slug);
    return kind ? `${kind.icon} ${kind.name}` : slug;
  }

  private split(value: string): string[] {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private lines(value: string): Array<{ description: string }> {
    return value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((description) => ({ description }));
  }
}
