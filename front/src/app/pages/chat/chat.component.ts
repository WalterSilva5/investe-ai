import { SlicePipe } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { retry, throwError, timer, OperatorFunction } from 'rxjs';
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

      <div class="chat-attach" style="margin-bottom:8px">
        @if (attachedImage(); as image) {
          <span class="attach-chip">
            <img [src]="image" alt="imagem anexada" />
            <button class="attach-remove" type="button" (click)="removeImage()" title="Remover imagem">×</button>
          </span>
        }
      </div>

      <div class="chat-input">
        <input
          class="input"
          [(ngModel)]="text"
          (keyup.enter)="send()"
          placeholder="Digite sua pergunta… (cole ou anexe uma imagem para o agente ler)"
          [disabled]="loading()"
        />
        <button class="btn secondary" (click)="imageInput.click()" [disabled]="loading()" title="Anexar imagem">📎</button>
        <input
          #imageInput
          type="file"
          accept="image/png,image/jpeg,image/webp"
          style="display:none"
          (change)="onImageSelected($event)"
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
  private readonly route = inject(ActivatedRoute);

  @HostListener('document:paste', ['$event'])
  onDocumentPasteEvent(event: ClipboardEvent) {
    this.onDocumentPaste(event);
  }

  readonly messages = signal<ChatMessage[]>([]);
  readonly attachedImage = signal<string | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly conversations = signal<ConversationSummary[]>([]);
  readonly profiles = signal<Profile[]>([]);
  readonly tools = signal<AgentTool[]>([]);
  readonly showTools = signal(false);

  private aborter: AbortController | null = null;
  /** true quando o stream já entregou pelo menos um delta (diferencia quebra no início × no meio). */
  private streamedPartial = false;
  private streamStarted(): boolean {
    return this.streamedPartial;
  }

  text = '';
  conversationId: string | null = null;
  profile = 'geral';

  @ViewChild('chatBox') chatBox?: ElementRef<HTMLElement>;

  /** Recebe imagens coladas (Ctrl+V) em qualquer lugar da página. */
  onDocumentPaste(event: ClipboardEvent) {
    const item = Array.from(event.clipboardData?.items || []).find((entry) =>
      entry.type.startsWith('image/'),
    );
    if (!item) return;
    const file = item.getAsFile();
    if (file) this.readImage(file);
  }

  onImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.readImage(file);
    input.value = '';
  }

  readImage(file: File) {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 3 * 1024 * 1024) {
      this.error.set('Imagem muito grande (máx 3 MB).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.attachedImage.set(String(reader.result || ''));
      this.error.set(null);
    };
    reader.readAsDataURL(file);
  }

  removeImage() {
    this.attachedImage.set(null);
  }

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
    // Vem do Radar ("Analisar no chat"): auto-dispara a análise do tema.
    const theme = this.route.snapshot.queryParamMap.get('theme');
    if (theme) {
      const name = this.route.snapshot.queryParamMap.get('themeName') || theme;
      const mode = this.route.snapshot.queryParamMap.get('mode') || 'growth';
      const modeLabel = mode === 'conservative' ? 'conservador' : 'crescimento máximo';
      this.text =
        `Analise o tema "${name}" (${theme}) em detalhe: use analyze_theme no modo ${modeLabel} ` +
        `e leia estágio, evidências, riscos e regras de saída. ` +
        `Depois sugira 3 a 5 oportunidades CONCRETAS dentro do tema (tickers, BDRs ou setores), ` +
        `verificando cada uma com get_stock_outlook. Salve as melhores na watchlist com track_symbol, ` +
        `com nota curta e objetiva.`;
      setTimeout(() => {
        if (this.text.trim()) this.send();
      }, 400);
    }
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
      if (this.streamStarted()) {
        // O stream quebrou NO MEIO (deltas já recebidos): re-enviar rodaria tudo
        // de novo (ferramentas, cota de tokens). Mantém o parcial e avisa.
        this.error.set(
          'A conexão do stream caiu no meio da resposta (API reiniciando ou rede instável). A parte já gerada está acima; reenvie se quiser a resposta completa.',
        );
        this.loading.set(false);
        this.loadConversations();
        return;
      }
      // fallback não-streaming (com 1 retry para API reiniciando/fora do ar)
      this.api
        .post<ChatResponse>('/ai/chat', {
          message: content,
          conversationId: this.conversationId,
          profile: this.profile || undefined,
          image: this.attachedImage() || undefined,
        })
        .pipe(this.retryOnceOnNetworkError())
        .subscribe({
          next: (res) => {
            this.attachedImage.set(null);
            this.applyResponse(res);
          },
          error: (e) => this.failChat(e),
        });
    });
  }

  stop() {
    if (this.aborter) {
      this.aborter.abort();
    } else if (this.loading()) {
      // sem requisição ativa mas UI travada: libera para nova tentativa
      this.loading.set(false);
    }
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
    const status = err?.status;
    const message =
      err?.error?.message ||
      (status === 429
        ? 'Limite mensal de uso da IA atingido — aumenta em back/.env (AI_MONTHLY_TOKEN_QUOTA) ou aguarda o reset no dia 1º.'
        : status === 0 || status === 503
          ? 'API indisponível no momento (reiniciando?). Tentando de novo não funcionou — aguarde alguns segundos e reenvie.'
          : 'Falha ao consultar o agente. Verifique o provedor configurado.');
    this.error.set(message);
    this.loading.set(false);
  }

  /** Retry único (2s) para falha de rede/503 — cobre API reiniciando. */
  private retryOnceOnNetworkError<T>(): OperatorFunction<T, T> {
    return retry({
      delay: (error: unknown, count: number) =>
        count < 2 &&
        (typeof error === 'object' &&
          error != null &&
          'status' in error &&
          ((error as { status: number }).status === 0 ||
            (error as { status: number }).status === 503))
          ? timer(2000)
          : throwError(() => error),
    });
  }

  private async streamSend(content: string): Promise<void> {
    this.streamedPartial = false;
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
        image: this.attachedImage() || undefined,
      }),
    });
    this.attachedImage.set(null);

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
          this.streamedPartial = true;
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
