import { SlicePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';

interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

interface Note {
  id: string;
  title: string;
  body: string;
  tags?: string;
  updatedAt: string;
  attachments?: Attachment[];
}

@Component({
  selector: 'app-notes',
  imports: [FormsModule, SlicePipe, RouterLink],
  template: `
    <h1 class="page-title">Diário</h1>
    <p class="page-sub">
      Anote todo dia: decisões, observações de mercado, boletos, ideias. Anexe PDFs e textos.
      O botão de dicas gera orientações a partir das suas anotações (categoria Diário nos Insights).
    </p>

    <div class="toolbar">
      <div class="group">
        <button class="btn" (click)="generateDiary()" [disabled]="generating()">
          {{ generating() ? 'Gerando dicas…' : 'Gerar dicas do diário' }}
        </button>
        <a routerLink="/app/insights" class="btn secondary">Ver insights</a>
      </div>
    </div>

    @if (diaryMessage()) {
      <div class="alert" [class.ok]="diaryOk()" [class.error]="!diaryOk()">{{ diaryMessage() }}</div>
    }

    <div class="grid-2">
      <section class="card">
        <h3>Nova anotação</h3>
        <div class="field">
          <label>Título</label>
          <input class="input" [(ngModel)]="form.title" placeholder="Ex.: 15/11 — aportes e CDI" />
        </div>
        <div class="field">
          <label>Tags</label>
          <input class="input" [(ngModel)]="form.tags" placeholder="reserva, renda fixa, metas" />
        </div>
        <div class="field">
          <label>Conteúdo</label>
          <textarea class="input" rows="8" [(ngModel)]="form.body" placeholder="Escreva aqui…"></textarea>
        </div>
        <button class="btn" style="margin-top:14px" (click)="create()">Salvar anotação</button>
        @if (message()) {
          <div class="alert ok">{{ message() }}</div>
        }
      </section>

      <section class="card">
        <div style="display:flex;gap:10px;align-items:center;justify-content:space-between">
          <h3>Suas anotações</h3>
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

              @if (note.attachments?.length) {
                <div class="chips" style="margin-top:10px">
                  @for (att of note.attachments; track att.id) {
                    <span class="chip" title="{{ att.mimeType }} · {{ att.size }} bytes">
                      {{ att.filename | slice:0:28 }}
                      <a
                        href="javascript:void(0)"
                        (click)="download(note.id, att)"
                        style="margin-left:6px"
                      >baixar</a>
                      <a
                        href="javascript:void(0)"
                        (click)="removeAttachment(note.id, att.id)"
                        style="margin-left:6px"
                      >x</a>
                    </span>
                  }
                </div>
              }
              <div style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                <input
                  type="file"
                  accept=".pdf,.txt,.md,.markdown,.csv"
                  (change)="upload(note.id, $event)"
                  [disabled]="uploading() === note.id"
                />
                @if (uploading() === note.id) {
                  <span class="muted small">Enviando…</span>
                }
              </div>
            </div>
          } @empty {
            <p class="muted small">Nenhuma anotação.</p>
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
  readonly diaryMessage = signal<string | null>(null);
  readonly diaryOk = signal(false);
  readonly generating = signal(false);
  readonly uploading = signal<string | null>(null);

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
          this.message.set('Anotação salva.');
          this.form = { title: '', tags: '', body: '' };
          this.load();
        },
        error: (err) => this.message.set(err?.error?.message || 'Falha ao salvar.'),
      });
  }

  remove(id: string) {
    this.api.delete(`/documents/${id}`).subscribe({ next: () => this.load() });
  }

  upload(noteId: string, event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploading.set(noteId);
    const data = new FormData();
    data.append('file', file, file.name);
    this.api.postFormData(`/documents/${noteId}/attachments`, data).subscribe({
      next: () => {
        this.uploading.set(null);
        this.load();
      },
      error: (err) => {
        this.uploading.set(null);
        this.diaryMessage.set(err?.error?.message || 'Falha no upload.');
        this.diaryOk.set(false);
      },
    });
    input.value = '';
  }

  download(noteId: string, att: Attachment) {
    this.api.getBlob(`/documents/${noteId}/attachments/${att.id}/download`).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = att.filename;
        link.click();
        URL.revokeObjectURL(url);
      },
    });
  }

  removeAttachment(noteId: string, attachmentId: string) {
    this.api.delete(`/documents/${noteId}/attachments/${attachmentId}`).subscribe({
      next: () => this.load(),
    });
  }

  generateDiary() {
    this.generating.set(true);
    this.diaryMessage.set(null);
    this.api.post<{ generated: number }>('/insights/diary', {}).subscribe({
      next: (res) => {
        this.generating.set(false);
        this.diaryOk.set(true);
        this.diaryMessage.set(
          `${res.generated} dica(s) do diário gerada(s). Veja na categoria Diário dos Insights.`,
        );
      },
      error: (err) => {
        this.generating.set(false);
        this.diaryOk.set(false);
        this.diaryMessage.set(err?.error?.message || 'Não foi possível gerar as dicas.');
      },
    });
  }
}
