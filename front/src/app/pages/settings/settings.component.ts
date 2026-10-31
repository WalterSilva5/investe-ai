import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

interface Provider {
  id: string;
  name: string;
  kind: string;
  configured: boolean;
  model: string;
  baseUrl: string;
  docs?: string;
}

@Component({
  selector: 'app-settings',
  imports: [FormsModule],
  template: `
    <h1 class="page-title">Provedores de IA</h1>
    <p class="page-sub">
      A chave é armazenada criptografada. OpenCode é o provedor padrão inicial.
    </p>

    <div class="grid-2">
      <section class="card">
        <h3>Disponíveis</h3>
        <div class="list" style="margin-top:10px">
          @for (provider of providers(); track provider.id) {
            <button
              class="row"
              style="width:100%;text-align:left;cursor:pointer;background:#fff"
              (click)="select(provider)"
            >
              <div>
                <div class="name">{{ provider.name }}</div>
                <div class="meta">{{ provider.model || 'sem modelo' }}</div>
              </div>
              <span class="badge" [class.ok]="provider.configured" [class.off]="!provider.configured">
                {{ provider.configured ? 'configurado' : 'pendente' }}
              </span>
            </button>
          }
        </div>
      </section>

      <section class="card">
        <h3>Configurar {{ selected()?.name || 'provedor' }}</h3>

        <div class="field">
          <label for="apiKey">API key</label>
          <input id="apiKey" class="input" type="password" [(ngModel)]="apiKey" placeholder="cole a chave" />
        </div>

        <div class="field">
          <label for="model">Modelo</label>
          @if (models().length) {
            <select id="model" class="input" [(ngModel)]="model">
              @for (m of models(); track m) {
                <option [value]="m">{{ m }}</option>
              }
            </select>
            <p class="small muted" style="margin-top:6px">
              {{ models().length }} modelo(s) retornado(s) pelo provedor.
            </p>
          } @else {
            <input id="model" class="input" [(ngModel)]="model" [placeholder]="selected()?.model || 'modelo'" />
            <p class="small muted" style="margin-top:6px">
              Clique em "Testar conexão" para listar os modelos disponíveis.
            </p>
          }
        </div>

        <div class="field">
          <label for="baseUrl">Base URL</label>
          <input id="baseUrl" class="input" [(ngModel)]="baseUrl" [placeholder]="selected()?.baseUrl || ''" />
        </div>

        @if (message()) {
          <div class="alert" [class.ok]="ok()" [class.error]="!ok()">{{ message() }}</div>
        }

        <div style="display:flex;gap:10px;margin-top:18px">
          <button class="btn" [disabled]="!apiKey || saving()" (click)="save()">
            {{ saving() ? 'Salvando…' : 'Salvar chave' }}
          </button>
          <button class="btn secondary" [disabled]="testing()" (click)="test()">
            {{ testing() ? 'Testando…' : 'Testar conexão' }}
          </button>
        </div>

        <p class="small muted" style="margin-top:14px">
          A chave nunca é devolvida pela API. Para trocar, salve uma nova.
        </p>
      </section>
    </div>
  `,
})
export class SettingsComponent {
  private readonly api = inject(ApiService);

  readonly providers = signal<Provider[]>([]);
  readonly selected = signal<Provider | null>(null);
  readonly message = signal<string | null>(null);
  readonly ok = signal(false);
  readonly saving = signal(false);
  readonly testing = signal(false);
  readonly models = signal<string[]>([]);

  apiKey = '';
  model = '';
  baseUrl = '';

  constructor() {
    this.load();
  }

  select(provider: Provider) {
    this.selected.set(provider);
    this.model = provider.model;
    this.baseUrl = provider.baseUrl;
    this.apiKey = '';
    this.models.set([]);
    this.message.set(null);
  }

  save() {
    const provider = this.selected();
    if (!provider || !this.apiKey) return;
    this.saving.set(true);
    this.message.set(null);

    this.api
      .post(`/ai/providers/${provider.id}/credential`, {
        apiKey: this.apiKey,
        model: this.model || undefined,
        baseUrl: this.baseUrl || undefined,
      })
      .subscribe({
        next: () => {
          this.ok.set(true);
          this.message.set('Chave salva com sucesso.');
          this.saving.set(false);
          this.apiKey = '';
          this.load();
        },
        error: (err) => {
          this.ok.set(false);
          this.message.set(err?.error?.message || 'Falha ao salvar a chave.');
          this.saving.set(false);
        },
      });
  }

  test() {
    const provider = this.selected();
    if (!provider) return;
    this.testing.set(true);
    this.message.set(null);

    this.api
      .post<{ ok: boolean; message: string; models?: string[] }>(
        `/ai/providers/${provider.id}/test`,
        {
          apiKey: this.apiKey || undefined,
          model: this.model || undefined,
          baseUrl: this.baseUrl || undefined,
        },
      )
      .subscribe({
        next: (res) => {
          this.ok.set(res.ok);
          this.message.set(res.message);
          if (res.models?.length) {
            this.models.set(res.models);
            if (!this.model) this.model = res.models[0];
          }
          this.testing.set(false);
        },
        error: (err) => {
          this.ok.set(false);
          this.message.set(err?.error?.message || 'Falha no teste de conexão.');
          this.testing.set(false);
        },
      });
  }

  private load() {
    this.api.get<Provider[]>('/ai/providers').subscribe({
      next: (items) => {
        this.providers.set(items);
        if (!this.selected() && items.length) this.select(items[0]);
      },
    });
  }
}
