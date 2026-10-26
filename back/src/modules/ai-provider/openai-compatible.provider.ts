import OpenAI from 'openai';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatResult {
  content: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
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
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens,
    });
    return {
      content: response.choices[0]?.message?.content ?? '',
      model: response.model || model,
      tokensIn: response.usage?.prompt_tokens ?? 0,
      tokensOut: response.usage?.completion_tokens ?? 0,
    };
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
