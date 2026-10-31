import { SlicePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { API_BASE_URL } from '../../core/api.config';

interface Citation {
  tool: string;
  source: string;
  asOf: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  steps?: Array<{ tool: string; status: string; durationMs: number }>;
}

interface ChatResponse {
  conversationId: string;
  content: string;
  providerId: string;
  model: string;
  citations: Citation[];
  steps: Array<{ tool: string; status: string; durationMs: number }>;
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
            @if (message.steps?.length) {
              <div class="small muted" style="margin-top:8px">
                Consultou: @for (step of message.steps; track $index) { {{ step.tool }}{{ $last ? '' : ' · ' }} }
              </div>
            }
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

    this.streamSend(content).catch(() => {
      // fallback não-streaming
      this.api
        .post<ChatResponse>('/ai/chat', { message: content, conversationId: this.conversationId })
        .subscribe({
          next: (res) => this.applyResponse(res),
          error: (err) => this.failChat(err),
        });
    });
  }

  private applyResponse(res: ChatResponse) {
    this.conversationId = res.conversationId;
    this.messages.update((items) => [
      ...items,
      { role: 'assistant', content: res.content, citations: res.citations, steps: res.steps },
    ]);
    this.loading.set(false);
    this.loadConversations();
  }

  private failChat(err: any) {
    this.error.set(err?.error?.message || 'Falha ao consultar o agente. Verifique o provedor configurado.');
    this.loading.set(false);
  }

  private async streamSend(content: string): Promise<void> {
    const token = localStorage.getItem('wsi.accessToken');
    const tenantId = localStorage.getItem('wsi.tenantId');
    const response = await fetch(`${API_BASE_URL}/ai/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'x-tenant-id': tenantId || '',
      },
      body: JSON.stringify({ message: content, conversationId: this.conversationId }),
    });

    if (!response.ok || !response.body) {
      throw new Error('stream indisponível');
    }

    let assistantIndex = -1;
    this.messages.update((items) => {
      assistantIndex = items.length;
      return [...items, { role: 'assistant', content: '' }];
    });

    let citations: Citation[] = [];
    let steps: Array<{ tool: string; status: string; durationMs: number }> = [];
    let full = '';

    const setAssistant = (value: string) => {
      this.messages.update((items) => {
        const next = items.slice();
        next[assistantIndex] = { role: 'assistant', content: value, citations, steps };
        return next;
      });
    };

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let index;
      while ((index = buffer.indexOf('\n\n')) >= 0) {
        const raw = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 2);
        if (!raw.startsWith('data:')) continue;
        const data = raw.slice(5).trim();
        if (!data) continue;
        const event = JSON.parse(data) as {
          type: string;
          conversationId?: string;
          citations?: Citation[];
          steps?: Array<{ tool: string; status: string; durationMs: number }>;
          content?: string;
          message?: string;
        };
        if (event.type === 'meta') {
          this.conversationId = event.conversationId || null;
          citations = event.citations || [];
          steps = event.steps || [];
        } else if (event.type === 'delta') {
          full += event.content || '';
          setAssistant(full);
        } else if (event.type === 'done') {
          this.loadConversations();
        } else if (event.type === 'error') {
          this.error.set(event.message || 'Falha no agente.');
        }
      }
    }

    setAssistant(full);
    this.loading.set(false);
  }
}
