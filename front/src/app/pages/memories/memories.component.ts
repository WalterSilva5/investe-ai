import { SlicePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

interface Memory {
  id: string;
  kind: string;
  content: string;
  tags?: string;
  importance: number;
  updatedAt: string;
}

const KINDS = ['fact', 'decision', 'preference', 'episode', 'procedure', 'context'];

@Component({
  selector: 'app-memories',
  imports: [FormsModule, SlicePipe],
  template: `
    <h1 class="page-title">Memórias</h1>
    <p class="page-sub">
      Fatos, decisões e preferências que o agente lembra e usa em conversas futuras (tools <code>remember</code> e <code>search_memory</code>).
    </p>

    <div class="grid-2">
      <section class="card">
        <h3>Nova memória</h3>
        <div class="field">
          <label>Conteúdo</label>
          <textarea class="input" rows="4" [(ngModel)]="form.content" placeholder="Ex.: prefiere renda fixa de baixo risco"></textarea>
        </div>
        <div class="grid-2">
          <div class="field">
            <label>Tipo</label>
            <select class="input" [(ngModel)]="form.kind">
              @for (kind of kinds; track kind) {
                <option [value]="kind">{{ kind }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label>Importância (1–10)</label>
            <input class="input" type="number" [(ngModel)]="form.importance" min="1" max="10" />
          </div>
        </div>
        <div class="field">
          <label>Tags</label>
          <input class="input" [(ngModel)]="form.tags" placeholder="reserva, perfil" />
        </div>
        <button class="btn" style="margin-top:12px" (click)="create()">Salvar</button>
        @if (message()) {
          <div class="alert ok">{{ message() }}</div>
        }
      </section>

      <section class="card">
        <div style="display:flex;gap:10px;align-items:center;justify-content:space-between">
          <h3>Memórias</h3>
          <div style="display:flex;gap:8px">
            <input class="input" style="max-width:180px" [(ngModel)]="query" placeholder="buscar…" />
            <button class="btn secondary" (click)="search()">Buscar</button>
            <button class="btn secondary" (click)="load()">Limpar</button>
          </div>
        </div>

        <div class="list" style="margin-top:12px">
          @for (memory of memories(); track memory.id) {
            <div class="card" style="box-shadow:none">
              <div style="display:flex;justify-content:space-between;gap:10px;align-items:start">
                <div>
                  <span class="badge off">{{ memory.kind }}</span>
                  <span class="small muted"> · importância {{ memory.importance }}</span>
                </div>
                <button class="btn secondary" (click)="remove(memory.id)">Excluir</button>
              </div>
              <p style="margin:8px 0 0">{{ memory.content }}</p>
              <div class="small muted">{{ memory.tags || 'sem tags' }} · {{ memory.updatedAt | slice:0:10 }}</div>
            </div>
          } @empty {
            <p class="muted small">Nenhuma memória.</p>
          }
        </div>
      </section>
    </div>
  `,
})
export class MemoriesComponent {
  private readonly api = inject(ApiService);

  readonly memories = signal<Memory[]>([]);
  readonly message = signal<string | null>(null);
  readonly kinds = KINDS;

  form = { content: '', kind: 'fact', tags: '', importance: 5 };
  query = '';

  constructor() {
    this.load();
  }

  load() {
    this.api.get<Memory[]>('/memories').subscribe({ next: (memories) => this.memories.set(memories) });
  }

  search() {
    const q = this.query.trim();
    if (!q) return this.load();
    this.api.get<Memory[]>(`/memories/search?q=${encodeURIComponent(q)}`).subscribe({
      next: (memories) => this.memories.set(memories),
    });
  }

  create() {
    if (!this.form.content.trim()) {
      this.message.set('Preencha o conteúdo.');
      return;
    }
    this.api
      .post<Memory>('/memories', {
        content: this.form.content,
        kind: this.form.kind,
        tags: this.form.tags || undefined,
        importance: Number(this.form.importance),
      })
      .subscribe({
        next: () => {
          this.message.set('Memória salva.');
          this.form = { content: '', kind: 'fact', tags: '', importance: 5 };
          this.load();
        },
        error: (err) => this.message.set(err?.error?.message || 'Falha ao salvar.'),
      });
  }

  remove(id: string) {
    this.api.delete(`/memories/${id}`).subscribe({ next: () => this.load() });
  }
}
