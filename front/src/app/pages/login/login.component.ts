import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="brand">wsi-invest-ai</div>
        <h1>{{ mode() === 'login' ? 'Entrar' : 'Criar conta' }}</h1>
        <p class="muted small">
          Assistente de investimentos — análise, carteira e renda fixa.
        </p>

        @if (mode() === 'register') {
          <div class="field">
            <label for="name">Nome</label>
            <input id="name" class="input" [(ngModel)]="name" placeholder="Seu nome" />
          </div>
        }

        <div class="field">
          <label for="email">E-mail</label>
          <input id="email" class="input" type="email" [(ngModel)]="email" placeholder="voce@exemplo.com" />
        </div>

        <div class="field">
          <label for="password">Senha</label>
          <input id="password" class="input" type="password" [(ngModel)]="password" placeholder="mínimo 8 caracteres" />
        </div>

        @if (error()) {
          <div class="alert error">{{ error() }}</div>
        }

        <button class="btn block" [disabled]="loading()" (click)="submit()">
          {{ loading() ? 'Aguarde…' : (mode() === 'login' ? 'Entrar' : 'Criar conta') }}
        </button>

        <p class="small muted" style="margin-top:16px;text-align:center">
          {{ mode() === 'login' ? 'Ainda não tem conta?' : 'Já tem conta?' }}
          <a href="javascript:void(0)" (click)="toggle()">
            {{ mode() === 'login' ? 'Criar agora' : 'Entrar' }}
          </a>
        </p>

        <p class="small muted" style="margin-top:18px">
          Ferramenta educacional e analítica. Não é recomendação de investimento.
        </p>
      </div>
    </div>
  `,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly mode = signal<'login' | 'register'>('login');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  email = '';
  password = '';
  name = '';

  toggle() {
    this.mode.set(this.mode() === 'login' ? 'register' : 'login');
    this.error.set(null);
  }

  submit() {
    if (!this.email || !this.password) {
      this.error.set('Preencha e-mail e senha.');
      return;
    }
    this.loading.set(true);
    this.error.set(null);

    const request =
      this.mode() === 'login'
        ? this.auth.login(this.email, this.password)
        : this.auth.register(this.email, this.password, this.name || undefined);

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
