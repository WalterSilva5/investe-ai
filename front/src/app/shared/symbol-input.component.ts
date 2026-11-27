import { Component, computed, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AutoCompleteCompleteEvent, AutoCompleteModule, AutoCompleteSelectEvent } from 'primeng/autocomplete';

/**
 * Seletor de ticker: autocomplete com seta (mostra a lista inteira), digitação
 * livre e seleção com clique ou Enter. Emite `submitted` quando o usuário
 * confirma — o pai decide carregar a análise.
 */
@Component({
  selector: 'app-symbol-input',
  imports: [FormsModule, AutoCompleteModule],
  template: `
    <p-autocomplete
      [ngModel]="value()"
      (ngModelChange)="onChange($event)"
      [suggestions]="filtered()"
      (completeMethod)="filter($event)"
      [dropdown]="true"
      [forceSelection]="false"
      optionLabel="symbol"
      [placeholder]="placeholder()"
      [inputStyle]="{ width: '180px' }"
      (onSelect)="onSelect($event)"
      (onKeyUp)="onKeyUp($event)"
      (onHide)="emitSubmit()"
      appendTo="body"
    >
      <ng-template let-option pTemplate="item">
        <div style="display:flex;justify-content:space-between;gap:12px">
          <strong>{{ option.symbol }}</strong>
          <span class="muted small">{{ option.name }}</span>
        </div>
      </ng-template>
    </p-autocomplete>
  `,
})
export class SymbolInputComponent {
  readonly value = model<string>('');
  readonly options = input<Array<{ symbol: string; name?: string }>>([]);
  readonly placeholder = input('Ticker');
  readonly submitted = output<string>();

  readonly filtered = signal<Array<{ symbol: string; name?: string }>>([]);

  private lastEmitted = '';

  constructor() {
    // lista cheia antes de digitar (a seta abre com tudo)
    queueMicrotask(() => this.filtered.set(this.options()));
  }

  filter(event: AutoCompleteCompleteEvent) {
    const query = (event.query || '').toUpperCase().trim();
    const all = this.options();
    this.filtered.set(
      !query
        ? all
        : all.filter(
            (option) =>
              option.symbol.toUpperCase().includes(query) ||
              (option.name || '').toUpperCase().includes(query),
          ),
    );
  }

  onChange(raw: string) {
    this.value.set((raw || '').toUpperCase());
  }

  onSelect(event: AutoCompleteSelectEvent) {
    const option = event.value as { symbol: string } | string;
    const symbol = typeof option === 'string' ? option : option?.symbol;
    if (symbol) this.value.set(symbol.toUpperCase());
    this.emitSubmit();
  }

  onKeyUp(event: KeyboardEvent) {
    if (event.key === 'Enter') this.emitSubmit();
  }

  /** Evita disparar duas vezes seguidas pela mesma confirmação (Enter + hide). */
  emitSubmit() {
    const symbol = (this.value() || '').trim().toUpperCase();
    if (!symbol) return;
    if (symbol === this.lastEmitted) return;
    this.lastEmitted = symbol;
    this.submitted.emit(symbol);
  }
}
