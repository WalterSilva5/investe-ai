import { Injectable, inject, signal } from '@angular/core';
import { API_BASE_URL } from './api.config';

export interface WidgetMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Estado do chat flutuante (global no shell). Fala com o mesmo endpoint SSE do
 * chat da tela cheia; mantém a conversa apenas enquanto a página está aberta.
 */
@Injectable({ providedIn: 'root' })
export class ChatStreamService {
  readonly messages = signal<WidgetMessage[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  conversationId: string | null = null;
  private aborter: AbortController | null = null;

  reset() {
    this.stop();
    this.messages.set([]);
    this.error.set(null);
    this.conversationId = null;
  }

  send(text: string, profile = 'geral') {
    const content = text.trim();
    if (!content || this.loading()) return;

    this.messages.update((items) => [...items, { role: 'user', content }]);
    this.loading.set(true);
    this.error.set(null);
    this.streamSend(content, profile).catch((err) => {
      if (err?.name === 'AbortError') {
        this.loading.set(false);
        return;
      }
      this.fallback(content, profile);
    });
  }

  stop() {
    if (this.aborter) this.aborter.abort();
    if (this.loading()) this.loading.set(false);
  }

  private async streamSend(content: string, profile: string) {
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
        profile,
      }),
    });
    if (!response.ok || !response.body) throw new Error('stream indisponível');

    let index = -1;
    this.messages.update((items) => {
      index = items.length;
      return [...items, { role: 'assistant', content: '' }];
    });

    const setAssistant = (value: string) => {
      this.messages.update((items) => {
        const next = items.slice();
        next[index] = { role: 'assistant', content: value };
        return next;
      });
    };

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) >= 0) {
        const raw = buffer.slice(0, sep).trim();
        buffer = buffer.slice(sep + 2);
        if (!raw.startsWith('data:')) continue;
        const data = raw.slice(5).trim();
        if (!data) continue;
        const event = JSON.parse(data) as {
          type: string;
          conversationId?: string;
          content?: string;
          message?: string;
        };
        if (event.type === 'meta') {
          this.conversationId = event.conversationId || this.conversationId;
        } else if (event.type === 'delta') {
          full += event.content || '';
          setAssistant(full);
        } else if (event.type === 'error') {
          this.error.set(event.message || 'Falha no agente.');
        }
      }
    }

    setAssistant(full);
    this.aborter = null;
    this.loading.set(false);
  }

  private fallback(content: string, profile: string) {
    const token = localStorage.getItem('wsi.accessToken');
    const tenantId = localStorage.getItem('wsi.tenantId');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (tenantId) headers['x-tenant-id'] = tenantId;

    fetch(`${API_BASE_URL}/ai/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message: content, conversationId: this.conversationId, profile }),
    })
      .then((res) => res.json())
      .then((res: { conversationId?: string; content?: string; message?: string }) => {
        this.conversationId = res.conversationId || this.conversationId;
        if (res.content) {
          this.messages.update((items) => [...items, { role: 'assistant', content: res.content! }]);
        } else {
          this.error.set(res.message || 'Falha ao consultar o agente.');
        }
      })
      .catch(() => this.error.set('Falha ao consultar o agente.'))
      .finally(() => this.loading.set(false));
  }
}
