import { SlicePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

interface Citation {
  tool: string;
  source: string;
  asOf: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
}

interface ChatResponse {
  conversationId: string;
  content: string;
  providerId: string;
  model: string;
  citations: Citation[];
  usage: { tokensIn: number; tokensOut: number };
  disclaimer: string;
}

interface ConversationSummary {
  id: string;
  title?: string;
  updatedAt: string;
}

@Component({
  selector: 'app-chat',
  imports: [FormsModule, SlicePipe],
  template: `
    <h1 class="page-title">Chat / análise</h1>
    <p class="page-sub">
      Pergunte sobre produtos, cenários e conceitos. O agente analisa e explica — não recomenda compra/venda.
    </p>

    <div class="chat">
      <div style="display:flex;gap:10px;align-items:center">
        <select
          class="input"
          style="max-width:340px"
          [value]="conversationId || ''"
          (change)="onConversationChange($event)"
        >
          <option value="">+ Nova conversa</option>
          @for (conversation of conversations(); track conversation.id) {
            <option [value]="conversation.id">{{ conversation.title || conversation.id }}</option>
          }
        </select>
        <span class="small muted">As respostas são por conversa, com citação de fontes.</span>
      </div>

      <div class="chat-box">
        @if (!messages().length) {
          <p class="muted small">
            Exemplos: “Qual a minha alocação?”, “Quanto tenho investido?”, “Compare CDB 100% CDI com LCI 90%”,
            “Como está a Selic e o IPCA?”.
          </p>
        }
        @for (message of messages(); track $index) {
          <div class="msg" [class.user]="message.role === 'user'" [class.assistant]="message.role === 'assistant'">
            <div class="who">{{ message.role === 'user' ? 'Você' : 'Agente' }}</div>
            {{ message.content }}
            @if (message.citations?.length) {
              <div class="small muted" style="margin-top:8px;border-top:1px solid var(--border);padding-top:6px">
                Fontes:
                @for (citation of message.citations; track $index) {
                  {{ citation.source }} ({{ citation.asOf | slice:0:10 }}){{ $last ? '' : ' · ' }}
                }
              </div>
            }
          </div>
        }
        @if (loading()) {
          <div class="msg assistant"><div class="who">Agente</div>Analisando…</div>
        }
      </div>

      @if (error()) {
        <div class="alert error">{{ error() }}</div>
      }

      <div class="chat-input">
        <input
          class="input"
          [(ngModel)]="text"
          (keyup.enter)="send()"
          placeholder="Digite sua pergunta…"
          [disabled]="loading()"
        />
        <button class="btn" (click)="send()" [disabled]="loading() || !text.trim()">Enviar</button>
      </div>
      <p class="disclaimer">
        Conteúdo educacional e analítico. Não é recomendação de investimento. O agente não executa ordens.
      </p>
    </div>
  `,
})
export class ChatComponent {
  private readonly api = inject(ApiService);

  readonly messages = signal<ChatMessage[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly conversations = signal<ConversationSummary[]>([]);

  text = '';
  conversationId: string | null = null;

  constructor() {
    this.loadConversations();
  }

  loadConversations() {
    this.api.get<ConversationSummary[]>('/ai/conversations').subscribe({
      next: (conversations) => this.conversations.set(conversations),
    });
  }

  onConversationChange(event: Event) {
    const id = (event.target as HTMLSelectElement).value;
    if (!id) {
      this.conversationId = null;
      this.messages.set([]);
      return;
    }
    this.api
      .get<{ messages: Array<{ role: string; content: string; citations?: Citation[] }> }>(
        `/ai/conversations/${id}`,
      )
      .subscribe({
        next: (conversation) => {
          this.conversationId = id;
          this.messages.set(
            conversation.messages
              .filter((message) => message.role === 'USER' || message.role === 'ASSISTANT')
              .map((message) => ({
                role: message.role === 'USER' ? 'user' : 'assistant',
                content: message.content,
                citations: message.citations,
              })),
          );
        },
        error: (err) => this.error.set(err?.error?.message || 'Falha ao carregar conversa.'),
      });
  }

  send() {
    const content = this.text.trim();
    if (!content || this.loading()) return;

    this.messages.update((items) => [...items, { role: 'user', content }]);
    this.text = '';
    this.loading.set(true);
    this.error.set(null);

    this.api
      .post<ChatResponse>('/ai/chat', {
        message: content,
        conversationId: this.conversationId,
      })
      .subscribe({
        next: (res) => {
          this.conversationId = res.conversationId;
          this.messages.update((items) => [
            ...items,
            { role: 'assistant', content: res.content, citations: res.citations },
          ]);
          this.loading.set(false);
          this.loadConversations();
        },
        error: (err) => {
          this.error.set(
            err?.error?.message || 'Falha ao consultar o agente. Verifique o provedor configurado.',
          );
          this.loading.set(false);
        },
      });
  }
}
