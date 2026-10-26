export type ProviderKind = 'openai-compatible' | 'native';

export interface ProviderDefinition {
  id: string;
  name: string;
  baseUrl: string;
  defaultModel: string;
  kind: ProviderKind;
  docs?: string;
}

/** Catálogo inicial (baseado no maestro + treina). */
export const PROVIDER_CATALOG: ProviderDefinition[] = [
  {
    id: 'opencode',
    name: 'OpenCode (Zen Go)',
    baseUrl: 'https://opencode.ai/zen/go/v1',
    defaultModel: 'deepseek-v4-pro',
    kind: 'openai-compatible',
    docs: 'https://opencode.ai',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    kind: 'openai-compatible',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: '',
    kind: 'openai-compatible',
  },
  {
    id: 'groq',
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    kind: 'openai-compatible',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    kind: 'openai-compatible',
  },
  {
    id: 'mistral',
    name: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-large-latest',
    kind: 'openai-compatible',
  },
  {
    id: 'together',
    name: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    defaultModel: '',
    kind: 'openai-compatible',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.0-flash',
    kind: 'openai-compatible',
  },
  {
    id: 'lmstudio',
    name: 'LM Studio (local)',
    baseUrl: 'http://localhost:1234/v1',
    defaultModel: '',
    kind: 'openai-compatible',
  },
  {
    id: 'ollama',
    name: 'Ollama (local)',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: '',
    kind: 'openai-compatible',
  },
];

export function findProvider(id: string): ProviderDefinition | undefined {
  return PROVIDER_CATALOG.find((p) => p.id === id.toLowerCase());
}
