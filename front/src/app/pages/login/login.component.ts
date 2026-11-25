import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="brand">wsi-invest-ai</div>
        <h1>{{ mode() === 'login' ? 'Entrar' : 'Criar conta' }}</h1>
        <p class="muted small">
          Assistente de investimentos — análise, carteira e renda fixa.
        </p>

        <form (ngSubmit)="submit()" autocomplete="on" novalidate>
          @if (mode() === 'register') {
            <div class="field">
              <label for="name">Nome</label>
              <input
                id="name"
                name="name"
                class="input"
                type="text"
                [(ngModel)]="name"
                placeholder="Seu nome"
                autocomplete="name"
              />
            </div>
          }

          <div class="field">
            <label for="email">E-mail</label>
            <input
              id="email"
              name="email"
              class="input"
              type="email"
              [(ngModel)]="email"
              placeholder="voce@exemplo.com"
              autocomplete="email"
              required
              autofocus
            />
          </div>

          <div class="field">
            <label for="password">Senha</label>
            <div class="password-wrap">
              <input
                id="password"
                name="password"
                class="input password-input"
                [type]="showPassword() ? 'text' : 'password'"
                [(ngModel)]="password"
                placeholder="mínimo 8 caracteres"
                [autocomplete]="mode() === 'login' ? 'current-password' : 'new-password'"
                required
                minlength="8"
              />
              <button
                type="button"
                class="password-toggle"
                (click)="togglePassword()"
                [attr.aria-label]="showPassword() ? 'Ocultar senha' : 'Mostrar senha'"
                [attr.aria-pressed]="showPassword()"
                [title]="showPassword() ? 'Ocultar senha' : 'Mostrar senha'"
              >
                {{ showPassword() ? 'Ocultar' : 'Mostrar' }}
              </button>
            </div>
            @if (mode() === 'register') {
              <p class="hint">Use ao menos 8 caracteres.</p>
            }
          </div>

          @if (error()) {
            <div class="alert error" role="alert">{{ error() }}</div>
          }

          <button class="btn block" type="submit" [disabled]="loading() || !canSubmit()">
            {{ loading() ? 'Aguarde…' : (mode() === 'login' ? 'Entrar' : 'Criar conta') }}
          </button>
        </form>

        <p class="small muted" style="margin-top:16px;text-align:center">
          {{ mode() === 'login' ? 'Ainda não tem conta?' : 'Já tem conta?' }}
          <button type="button" class="link" (click)="toggle()">
            {{ mode() === 'login' ? 'Criar agora' : 'Entrar' }}
          </button>
        </p>

        @if (mode() === 'login') {
          <p class="small muted" style="text-align:center;margin-top:8px">
            <a routerLink="/forgot">Esqueci a senha?</a>
          </p>
        }

        <p class="small muted" style="margin-top:18px">
          Ferramenta educacional e analítica. Não é recomendação de investimento.
        </p>
      </div>
    </div>
  `,
  styles: [
    `
      .password-wrap {
        position: relative;
      }
      .password-input {
        padding-right: 88px;
      }
      .password-toggle {
        position: absolute;
        right: 6px;
        top: 50%;
        transform: translateY(-50%);
        border: 0;
        background: transparent;
        color: var(--primary);
        font: inherit;
        font-size: 13px;
        font-weight: 600;
        padding: 6px 10px;
        border-radius: 7px;
        cursor: pointer;
      }
      .password-toggle:hover {
        background: #eef4ff;
      }
      .link {
        border: 0;
        background: none;
        padding: 0;
        color: var(--primary);
        font: inherit;
        font-size: inherit;
        cursor: pointer;
      }
      .link:hover {
        text-decoration: underline;
      }
      .hint {
        margin: 6px 0 0;
        font-size: 12.5px;
        color: var(--muted);
      }
    `,
  ],
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly mode = signal<'login' | 'register'>('login');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly showPassword = signal(false);

  email = '';
  password = '';
  name = '';

  constructor() {
    // Modo local: pula o login e vai direto ao app.
    effect(() => {
      if (this.auth.openMode()) this.router.navigate(['/app/overview']);
    });
  }

  toggle() {
    this.mode.set(this.mode() === 'login' ? 'register' : 'login');
    this.error.set(null);
  }

  togglePassword() {
    this.showPassword.update((v) => !v);
  }

  canSubmit(): boolean {
    return this.email.trim().length > 3 && this.password.length >= 1;
  }

  submit() {
    const email = this.email.trim();
    if (!email || !this.password) {
      this.error.set('Preencha e-mail e senha.');
      return;
    }
    if (this.password.length < 8) {
      this.error.set('A senha deve ter ao menos 8 caracteres.');
      return;
    }
    this.loading.set(true);
    this.error.set(null);

    const request =
      this.mode() === 'login'
        ? this.auth.login(email, this.password)
        : this.auth.register(email, this.password, this.name.trim() || undefined);

    request.subscribe({
      next: () => this.router.navigate(['/app/overview']),
      error: (err) => {
        this.error.set(err?.error?.message || 'Não foi possível entrar. Tente novamente.');
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }
}
