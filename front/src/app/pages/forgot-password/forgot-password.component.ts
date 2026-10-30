import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-forgot-password',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="brand">wsi-invest-ai</div>
        <h1>{{ token ? 'Redefinir senha' : 'Recuperar senha' }}</h1>

        @if (token) {
          <div class="field">
            <label for="password">Nova senha</label>
            <input id="password" class="input" type="password" [(ngModel)]="newPassword" placeholder="mínimo 8 caracteres" />
          </div>
          <button class="btn block" (click)="reset()">Redefinir</button>
        } @else {
          <div class="field">
            <label for="email">E-mail</label>
            <input id="email" class="input" type="email" [(ngModel)]="email" placeholder="voce@exemplo.com" />
          </div>
          <button class="btn block" (click)="request()">Enviar link</button>
        }

        @if (message()) {
          <div class="alert" [class.ok]="ok()" [class.error]="!ok()">{{ message() }}</div>
        }

        <p class="small muted" style="margin-top:16px;text-align:center">
          <a routerLink="/login">Voltar para o login</a>
        </p>
      </div>
    </div>
  `,
})
export class ForgotPasswordComponent {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly token = this.route.snapshot.queryParamMap.get('token') || '';
  readonly message = signal<string | null>(null);
  readonly ok = signal(false);

  email = '';
  newPassword = '';

  request() {
    this.api.post('/auth/forgot-password', { email: this.email }).subscribe({
      next: () => {
        this.ok.set(true);
        this.message.set(
          'Se o e-mail existir, o link foi gerado. Em ambiente local, veja o log do servidor (rota /reset?token=...).',
        );
      },
      error: (err) => {
        this.ok.set(false);
        this.message.set(err?.error?.message || 'Falha ao solicitar reset.');
      },
    });
  }

  reset() {
    this.api.post('/auth/reset-password', { token: this.token, newPassword: this.newPassword }).subscribe({
      next: () => {
        this.ok.set(true);
        this.message.set('Senha redefinida. Faça login.');
        setTimeout(() => this.router.navigate(['/login']), 1200);
      },
      error: (err) => {
        this.ok.set(false);
        this.message.set(err?.error?.message || 'Token inválido ou expirado.');
      },
    });
  }
}
