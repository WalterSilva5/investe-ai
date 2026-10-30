import { SlicePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

interface Note {
  id: string;
  title: string;
  body: string;
  tags?: string;
  updatedAt: string;
}

@Component({
  selector: 'app-notes',
  imports: [FormsModule, SlicePipe],
  template: `
    <h1 class="page-title">Notas</h1>
    <p class="page-sub">
      Registre decisões, planos e aprendizados. O agente consulta estas notas pela ferramenta de busca.
    </p>

    <div class="grid-2">
      <section class="card">
        <h3>Nova nota</h3>
        <div class="field">
          <label>Título</label>
          <input class="input" [(ngModel)]="form.title" placeholder="Ex.: política de investimento" />
        </div>
        <div class="field">
          <label>Tags</label>
          <input class="input" [(ngModel)]="form.tags" placeholder="reserva, renda fixa, metas" />
        </div>
        <div class="field">
          <label>Conteúdo</label>
          <textarea class="input" rows="8" [(ngModel)]="form.body" placeholder="Escreva aqui…"></textarea>
        </div>
        <button class="btn" style="margin-top:14px" (click)="create()">Salvar nota</button>
        @if (message()) {
          <div class="alert ok">{{ message() }}</div>
        }
      </section>

      <section class="card">
        <div style="display:flex;gap:10px;align-items:center;justify-content:space-between">
          <h3>Suas notas</h3>
          <div style="display:flex;gap:8px">
            <input class="input" style="max-width:200px" [(ngModel)]="query" placeholder="buscar…" />
            <button class="btn secondary" (click)="search()">Buscar</button>
            <button class="btn secondary" (click)="load()">Limpar</button>
          </div>
        </div>

        <div class="list" style="margin-top:12px">
          @for (note of notes(); track note.id) {
            <div class="card" style="box-shadow:none">
              <div style="display:flex;justify-content:space-between;gap:10px;align-items:start">
                <div>
                  <div class="name">{{ note.title }}</div>
                  <div class="meta">
                    {{ note.tags || 'sem tags' }} · {{ note.updatedAt | slice:0:10 }}
                  </div>
                </div>
                <button class="btn secondary" (click)="remove(note.id)">Excluir</button>
              </div>
              <p class="small muted" style="margin:8px 0 0">{{ note.body | slice:0:240 }}</p>
            </div>
          } @empty {
            <p class="muted small">Nenhuma nota.</p>
          }
        </div>
      </section>
    </div>
  `,
})
export class NotesComponent {
  private readonly api = inject(ApiService);

  readonly notes = signal<Note[]>([]);
  readonly message = signal<string | null>(null);

  form = { title: '', tags: '', body: '' };
  query = '';

  constructor() {
    this.load();
  }

  load() {
    this.api.get<Note[]>('/documents').subscribe({ next: (notes) => this.notes.set(notes) });
  }

  search() {
    const q = this.query.trim();
    if (!q) return this.load();
    this.api.get<Note[]>(`/documents/search?q=${encodeURIComponent(q)}`).subscribe({
      next: (notes) => this.notes.set(notes),
    });
  }

  create() {
    if (!this.form.title.trim() || !this.form.body.trim()) {
      this.message.set('Preencha título e conteúdo.');
      return;
    }
    this.api
      .post<Note>('/documents', {
        title: this.form.title,
        body: this.form.body,
        tags: this.form.tags || undefined,
      })
      .subscribe({
        next: () => {
          this.message.set('Nota salva.');
          this.form = { title: '', tags: '', body: '' };
          this.load();
        },
        error: (err) => this.message.set(err?.error?.message || 'Falha ao salvar.'),
      });
  }

  remove(id: string) {
    this.api.delete(`/documents/${id}`).subscribe({ next: () => this.load() });
  }
}
