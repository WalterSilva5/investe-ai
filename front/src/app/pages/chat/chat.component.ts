import { SlicePipe } from '@angular/common';
import { Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { MarkdownPipe } from '../../shared/markdown.pipe';
import { API_BASE_URL } from '../../core/api.config';

interface Citation {
  tool: string;
  source: string;
  asOf: string;
}

interface ChatStep {
  tool: string;
  status: string;
  durationMs: number;
  input?: Record<string, unknown>;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  steps?: ChatStep[];
  stopped?: boolean;
}

interface ChatResponse {
  conversationId: string;
  content: string;
  providerId: string;
  model: string;
  citations: Citation[];
  steps: ChatStep[];
  usage: { tokensIn: number; tokensOut: number };
  disclaimer: string;
}

interface ConversationSummary {
  id: string;
  title?: string;
  updatedAt: string;
}

interface Profile {
  id: string;
  name: string;
  description: string;
  icon: string;
}

interface AgentTool {
  name: string;
  description: string;
}

@Component({
  selector: 'app-chat',
  imports: [FormsModule, SlicePipe, MarkdownPipe],
  template: `
    <h1 class="page-title">Chat / análise</h1>
    <p class="page-sub">
      Pergunte sobre produtos, cenários e conceitos. O agente analisa e explica — não recomenda compra/venda.
    </p>

    <div class="chat">
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <select
          class="input"
          style="max-width:240px"
          [(ngModel)]="profile"
          (ngModelChange)="onProfileChange()"
          title="Perfil do agente"
        >
          @for (profile of profiles(); track profile.id) {
            <option [value]="profile.id">{{ profile.icon }} {{ profile.name }}</option>
          }
        </select>
        <select
          class="input"
          style="max-width:300px"
          [value]="conversationId || ''"
          (change)="onConversationChange($event)"
        >
          <option value="">+ Nova conversa</option>
          @for (conversation of conversations(); track conversation.id) {
            <option [value]="conversation.id">{{ conversation.title || conversation.id }}</option>
          }
        </select>
        <span class="small muted">As respostas são por conversa, com citação de fontes.</span>
        <button class="chip" (click)="showTools.set(!showTools())" title="Capacidades do agente">
          🛠️ {{ tools().length }} ferramentas
        </button>
      </div>

      @if (showTools()) {
        <div class="chips" style="margin-bottom:4px">
          @for (tool of tools(); track tool.name) {
            <span class="chip" [title]="tool.description">{{ tool.name }}</span>
          } @empty {
            <span class="muted small">Nenhuma ferramenta neste perfil.</span>
          }
        </div>
      }

      <div class="chat-box" #chatBox (scroll)="onChatScroll()">
        @if (!messages().length) {
          <p class="muted small">
            Exemplos: “Qual a minha alocação?”, “Quanto tenho investido?”, “Compare CDB 100% CDI com LCI 90%”,
            “Como está a Selic e o IPCA?”.
          </p>
        }
        @for (message of messages(); track $index) {
          <div class="msg" [class.user]="message.role === 'user'" [class.assistant]="message.role === 'assistant'">
            <div class="who">{{ message.role === 'user' ? 'Você' : 'Agente' }}</div>
            @if (message.role === 'assistant') {
              <div class="md" [innerHTML]="message.content | markdown"></div>
            } @else {
              {{ message.content }}
            }
            @if (message.role === 'assistant' && message.steps?.length) {
              <details class="thinking" [open]="message.role === 'assistant' && !message.content">
                <summary>
                  Raciocínio · {{ message.steps!.length }} ferramenta(s) · {{ thinkTime(message.steps!) }}ms
                </summary>
                <div class="think-list">
                  @for (step of message.steps; track $index) {
                    <div class="think-item">
                      <span class="badge {{ step.status === 'ok' ? 'ok' : 'off' }}">{{ step.tool }}</span>
                      <span class="muted small">{{ step.durationMs }}ms</span>
                      @if (step.input && hasInput(step.input)) {
                        <code class="small muted">{{ inputPreview(step.input) }}</code>
                      }
                    </div>
                  }
                </div>
              </details>
            }
            @if (message.stopped) {
              <div class="small muted" style="margin-top:8px">(interrompido pelo usuário)</div>
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

      @if (showEnd()) {
        <button class="btn secondary scroll-end" (click)="scrollEnd()" title="Ir para o final">
          ↓ Final
        </button>
      }

      <div class="chat-input">
        <input
          class="input"
          [(ngModel)]="text"
          (keyup.enter)="send()"
          placeholder="Digite sua pergunta…"
          [disabled]="loading()"
        />
        @if (loading()) {
          <button class="btn secondary" (click)="stop()">Parar</button>
        } @else {
          <button class="btn" (click)="send()" [disabled]="!text.trim()">Enviar</button>
        }
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
  readonly profiles = signal<Profile[]>([]);
  readonly tools = signal<AgentTool[]>([]);
  readonly showTools = signal(false);

  private aborter: AbortController | null = null;

  text = '';
  conversationId: string | null = null;
  profile = 'geral';

  @ViewChild('chatBox') chatBox?: ElementRef<HTMLElement>;
  readonly showEnd = signal(false);
  private pinned = true;

  onChatScroll() {
    const el = this.chatBox?.nativeElement;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    this.pinned = dist < 120;
    this.showEnd.set(!this.pinned);
  }

  scrollEnd(smooth = true) {
    this.pinned = true;
    this.showEnd.set(false);
    const el = this.chatBox?.nativeElement;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }

  private autoscroll() {
    if (!this.pinned) return;
    requestAnimationFrame(() => {
      const el = this.chatBox?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  constructor() {
    this.loadConversations();
    this.api.get<Profile[]>('/ai/profiles').subscribe({
      next: (profiles) => this.profiles.set(profiles),
    });
    this.loadTools();
  }

  onProfileChange() {
    this.loadTools();
  }

  loadTools() {
    this.api.get<AgentTool[]>(`/ai/tools?profile=${this.profile || 'geral'}`).subscribe({
      next: (tools) => this.tools.set(tools),
      error: () => this.tools.set([]),
    });
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
          this.scrollEnd(false);
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
    this.scrollEnd(false);

    this.streamSend(content).catch((err) => {
      if (err?.name === 'AbortError') {
        // parado pelo usuário: mantém o parcial, sem fallback
        this.aborter = null;
        this.messages.update((items) => {
          const next = items.slice();
          const last = next[next.length - 1];
          if (last?.role === 'assistant') next[next.length - 1] = { ...last, stopped: true };
          return next;
        });
        this.loading.set(false);
        this.loadConversations();
        return;
      }
      // fallback não-streaming
      this.api
        .post<ChatResponse>('/ai/chat', {
          message: content,
          conversationId: this.conversationId,
          profile: this.profile || undefined,
        })
        .subscribe({
          next: (res) => this.applyResponse(res),
          error: (e) => this.failChat(e),
        });
    });
  }

  stop() {
    this.aborter?.abort();
  }

  thinkTime(steps: ChatStep[]): number {
    return steps.reduce((acc, s) => acc + (s.durationMs || 0), 0);
  }

  hasInput(input?: Record<string, unknown>): boolean {
    return !!input && Object.keys(input).length > 0;
  }

  inputPreview(input: Record<string, unknown>): string {
    return JSON.stringify(input).slice(0, 160);
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
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (tenantId) headers['x-tenant-id'] = tenantId;
    this.aborter = new AbortController();
    const response = await fetch(`${API_BASE_URL}/ai/chat/stream`, {
      method: 'POST',
      headers,
      signal: this.aborter.signal,
      body: JSON.stringify({
        message: content,
        conversationId: this.conversationId,
        profile: this.profile || undefined,
      }),
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
    let steps: ChatStep[] = [];
    let full = '';
    let stopped = false;

    const setAssistant = (value: string) => {
      this.messages.update((items) => {
        const next = items.slice();
        next[assistantIndex] = { role: 'assistant', content: value, citations, steps, stopped };
        return next;
      });
      this.autoscroll();
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
          steps?: ChatStep[];
          content?: string;
          message?: string;
        };
        if (event.type === 'meta') {
          this.conversationId = event.conversationId || null;
          citations = event.citations || [];
          steps = event.steps || [];
          setAssistant(full);
        } else if (event.type === 'delta') {
          full += event.content || '';
          setAssistant(full);
        } else if (event.type === 'aborted') {
          stopped = true;
          setAssistant(full);
        } else if (event.type === 'done') {
          this.loadConversations();
        } else if (event.type === 'error') {
          this.error.set(event.message || 'Falha no agente.');
        }
      }
    }

    setAssistant(full);
    this.aborter = null;
    this.loading.set(false);
  }
}
