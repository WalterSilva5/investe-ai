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

@Component({
  selector: 'app-chat',
  imports: [FormsModule, SlicePipe],
  template: `
    <h1 class="page-title">Chat / análise</h1>
    <p class="page-sub">
      Pergunte sobre produtos, cenários e conceitos. O agente analisa e explica — não recomenda compra/venda.
    </p>

    <div class="chat">
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

  text = '';
  conversationId: string | null = null;

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
