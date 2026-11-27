import { Component, ElementRef, ViewChild, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ChatStreamService } from '../core/chat-stream.service';
import { MarkdownPipe } from './markdown.pipe';

/**
 * Chat flutuante (estilo mensageiro) disponível em todas as telas do app.
 * O botão de expandir abre o chat completo em /app/chat.
 */
@Component({
  selector: 'app-chat-widget',
  imports: [FormsModule, RouterLink, ButtonModule, MarkdownPipe],
  template: `
    @if (open()) {
      <section class="cw-panel" aria-label="Chat do agente">
        <header class="cw-head">
          <span class="cw-title">Assistente</span>
          <div class="cw-actions">
            <a routerLink="/app/chat" class="cw-icon" title="Abrir em tela cheia">
              <i class="pi pi-expand"></i>
            </a>
            <button class="cw-icon" type="button" title="Limpar conversa" (click)="reset()">
              <i class="pi pi-refresh"></i>
            </button>
            <button class="cw-icon" type="button" title="Fechar" (click)="open.set(false)">
              <i class="pi pi-times"></i>
            </button>
          </div>
        </header>

        <div class="cw-body" #body>
          @if (!chat.messages().length) {
            <p class="cw-hint">
              Pergunte sobre a carteira, macro ou peça: “quais ações estão com boa relação
              ganho/risco hoje? salve as melhores”.
            </p>
          }
          @for (message of chat.messages(); track $index) {
            <div class="cw-msg" [class.user]="message.role === 'user'">
              @if (message.role === 'assistant') {
                <div class="md" [innerHTML]="message.content | markdown"></div>
              } @else {
                {{ message.content }}
              }
            </div>
          }
          @if (chat.loading()) {
            <div class="cw-msg cw-typing">Analisando…</div>
          }
          @if (chat.error()) {
            <div class="cw-error">{{ chat.error() }}</div>
          }
        </div>

        <footer class="cw-foot">
          <input
            class="input"
            [(ngModel)]="text"
            (keyup.enter)="send()"
            placeholder="Mensagem…"
            [disabled]="chat.loading()"
          />
          @if (chat.loading()) {
            <p-button icon="pi pi-stop" severity="secondary" [outlined]="true" (onClick)="chat.stop()" ariaLabel="Parar" />
          } @else {
            <p-button icon="pi pi-send" [disabled]="!text.trim()" (onClick)="send()" ariaLabel="Enviar" />
          }
        </footer>
      </section>
    }

    <button class="cw-fab" type="button" (click)="open.set(!open())" [title]="open() ? 'Fechar chat' : 'Abrir chat'">
      <i class="pi" [class.pi-comments]="!open()" [class.pi-chevron-down]="open()"></i>
    </button>
  `,
})
export class ChatWidgetComponent {
  readonly chat = inject(ChatStreamService);
  readonly open = signal(false);

  text = '';
  @ViewChild('body') private body?: ElementRef<HTMLElement>;

  constructor() {
    effect(() => {
      // acompanha a conversa e o "digitando"
      this.chat.messages();
      this.chat.loading();
      requestAnimationFrame(() => {
        const el = this.body?.nativeElement;
        if (el) el.scrollTop = el.scrollHeight;
      });
    });
  }

  send() {
    const content = this.text.trim();
    if (!content) return;
    this.text = '';
    this.chat.send(content);
  }

  reset() {
    this.chat.reset();
  }
}
