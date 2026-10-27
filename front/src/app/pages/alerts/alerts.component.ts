import { SlicePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

interface AlertEvent {
  id: string;
  firedAt: string;
  payload?: { message?: string; current?: number };
}

interface AlertRule {
  id: string;
  type: string;
  condition: Record<string, unknown>;
  enabled: boolean;
  events: AlertEvent[];
}

@Component({
  selector: 'app-alerts',
  imports: [FormsModule, SlicePipe],
  template: `
    <h1 class="page-title">Alertas</h1>
    <p class="page-sub">Avisos de desvio de alocação e de macro. Avaliação sob demanda.</p>

    <div class="grid-2">
      <section class="card">
        <h3>Nova regra</h3>
        <div class="field">
          <label>Tipo</label>
          <select class="input" [(ngModel)]="form.type">
            <option value="ALLOCATION_MAX">Alocação máxima por tipo</option>
            <option value="MACRO">Macro (Selic/IPCA/CDI)</option>
          </select>
        </div>

        @if (form.type === 'ALLOCATION_MAX') {
          <div class="grid-2">
            <div class="field">
              <label>Tipo de ativo</label>
              <select class="input" [(ngModel)]="form.assetType">
                <option value="STOCK">Ações</option>
                <option value="FII">FIIs</option>
                <option value="ETF">ETFs</option>
                <option value="FIXED_INCOME">Renda fixa</option>
                <option value="CRYPTO">Cripto</option>
                <option value="CASH">Caixa</option>
              </select>
            </div>
            <div class="field">
              <label>Máximo (%)</label>
              <input class="input" type="number" [(ngModel)]="form.maxPct" />
            </div>
          </div>
        } @else {
          <div class="grid-2">
            <div class="field">
              <label>Métrica</label>
              <select class="input" [(ngModel)]="form.metric">
                <option value="selic">Selic</option>
                <option value="ipcaAnnual">IPCA anual</option>
                <option value="cdiAnnual">CDI anual</option>
              </select>
            </div>
            <div class="field">
              <label>Operador</label>
              <select class="input" [(ngModel)]="form.operator">
                <option value=">">maior que</option>
                <option value="<">menor que</option>
              </select>
            </div>
          </div>
          <div class="field">
            <label>Valor (%)</label>
            <input class="input" type="number" [(ngModel)]="form.value" />
          </div>
        }

        <div style="display:flex;gap:10px;margin-top:14px">
          <button class="btn" (click)="create()">Criar regra</button>
          <button class="btn secondary" (click)="evaluate()">Avaliar agora</button>
        </div>

        @if (message()) {
          <div class="alert ok">{{ message() }}</div>
        }
      </section>

      <section class="card">
        <h3>Regras</h3>
        <div class="list" style="margin-top:10px">
          @for (rule of rules(); track rule.id) {
            <div class="row">
              <div>
                <div class="name">{{ label(rule.type) }}</div>
                <div class="meta">{{ describe(rule) }}</div>
              </div>
              <div style="display:flex;gap:8px">
                <span class="badge" [class.ok]="rule.enabled" [class.off]="!rule.enabled">
                  {{ rule.enabled ? 'ativa' : 'pausada' }}
                </span>
                <button class="btn secondary" (click)="toggle(rule)">Alternar</button>
                <button class="btn secondary" (click)="remove(rule.id)">Excluir</button>
              </div>
            </div>
            @for (event of rule.events; track event.id) {
              <div class="small muted" style="padding-left:8px">
                • {{ event.payload?.message }} — {{ event.firedAt | slice:0:16 }}
              </div>
            }
          } @empty {
            <p class="muted small">Nenhuma regra cadastrada.</p>
          }
        </div>
      </section>
    </div>
  `,
})
export class AlertsComponent {
  private readonly api = inject(ApiService);

  readonly rules = signal<AlertRule[]>([]);
  readonly message = signal<string | null>(null);

  form = {
    type: 'ALLOCATION_MAX',
    assetType: 'STOCK',
    maxPct: 60,
    metric: 'selic',
    operator: '>',
    value: 15,
  };

  constructor() {
    this.load();
  }

  load() {
    this.api.get<AlertRule[]>('/alerts').subscribe({ next: (rules) => this.rules.set(rules) });
  }

  create() {
    const condition =
      this.form.type === 'ALLOCATION_MAX'
        ? { assetType: this.form.assetType, maxPct: Number(this.form.maxPct) }
        : { metric: this.form.metric, operator: this.form.operator, value: Number(this.form.value) };

    this.api.post<AlertRule>('/alerts', { type: this.form.type, condition }).subscribe({
      next: () => {
        this.message.set('Regra criada.');
        this.load();
      },
      error: (err) => this.message.set(err?.error?.message || 'Falha ao criar.'),
    });
  }

  evaluate() {
    this.api.post<{ triggered: number }>('/alerts/evaluate', {}).subscribe({
      next: (res) => {
        this.message.set(`Avaliação concluída: ${res.triggered} alerta(s) disparado(s).`);
        this.load();
      },
      error: (err) => this.message.set(err?.error?.message || 'Falha ao avaliar.'),
    });
  }

  toggle(rule: AlertRule) {
    this.api.patch(`/alerts/${rule.id}`, { enabled: !rule.enabled }).subscribe({
      next: () => this.load(),
    });
  }

  remove(id: string) {
    this.api.delete(`/alerts/${id}`).subscribe({ next: () => this.load() });
  }

  label(type: string): string {
    return type === 'ALLOCATION_MAX' ? 'Alocação máxima' : type === 'MACRO' ? 'Macro' : type;
  }

  describe(rule: AlertRule): string {
    const c = rule.condition as Record<string, unknown>;
    if (rule.type === 'ALLOCATION_MAX') {
      return `${c['assetType']} > ${c['maxPct']}%`;
    }
    return `${c['metric']} ${c['operator']} ${c['value']}%`;
  }
}
