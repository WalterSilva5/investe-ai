import OpenAI from 'openai';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: unknown[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
}

export interface ChatResult {
  content: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  toolCalls: ToolCall[];
  finishReason?: string | null;
  assistantMessage?: unknown;
}

export interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  extraHeaders?: Record<string, string>;
}

/** Adaptador para qualquer endpoint compatível com OpenAI. */
export class OpenAICompatibleProvider {
  private readonly client: OpenAI;

  constructor(private readonly config: ProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey || 'not-needed',
      baseURL: config.baseUrl,
      defaultHeaders: config.extraHeaders,
      maxRetries: 1,
      timeout: 120_000,
    });
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ChatResult> {
    const model = options.model || this.config.defaultModel;
    if (!model) {
      throw new Error('Nenhum modelo definido para este provedor.');
    }

    const response = await this.client.chat.completions.create({
      model,
      messages: messages as never,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens,
      ...(options.tools?.length
        ? { tools: options.tools as never, tool_choice: 'auto' as never }
        : {}),
    });

    const choice = response.choices[0];
    const message = choice?.message;
    const toolCalls: ToolCall[] = (message?.tool_calls ?? []).map((call) => ({
      id: call.id,
      name: call.function.name,
      arguments: call.function.arguments,
    }));

    return {
      content: this.extractText((message as { content?: unknown } | undefined)?.content),
      model: response.model || model,
      tokensIn: response.usage?.prompt_tokens ?? 0,
      tokensOut: response.usage?.completion_tokens ?? 0,
      toolCalls,
      finishReason: choice?.finish_reason,
      assistantMessage: message,
    };
  }

  /**
   * Extrai texto de `message.content`, que pode vir como string,
   * array de partes (alguns gateways) ou null.
   */
  private extractText(content: unknown): string {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .map((part) => {
          if (typeof part === 'string') return part;
          if (part && typeof part === 'object') {
            const p = part as Record<string, unknown>;
            if (typeof p['text'] === 'string') return p['text'] as string;
            const nested = p['text'];
            if (nested && typeof nested === 'object') {
              const value = (nested as Record<string, unknown>)['value'];
              if (typeof value === 'string') return value;
            }
          }
          return '';
        })
        .join('');
    }
    return '';
  }

  async *streamChat(
    messages: ChatMessage[],
    options: ChatOptions = {},
  ): AsyncGenerator<{ delta: string; model: string }> {
    const model = options.model || this.config.defaultModel;
    if (!model) {
      throw new Error('Nenhum modelo definido para este provedor.');
    }
    const stream = await this.client.chat.completions.create({
      model,
      messages: messages as never,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens,
      stream: true,
    });
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        yield { delta, model: chunk.model || model };
      }
    }
  }

  async listModels(): Promise<string[]> {
    const list = await this.client.models.list();
    return list.data.map((m) => m.id).sort();
  }

  async testConnection(): Promise<{ ok: boolean; message: string; models?: string[] }> {
    try {
      const models = await this.listModels();
      return {
        ok: true,
        message: models.length
          ? `Conectado — ${models.length} modelo(s).`
          : 'Conectado, mas nenhum modelo retornado.',
        models,
      };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Falha na conexão.',
      };
    }
  }
}
