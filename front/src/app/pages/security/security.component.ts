import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

interface Me {
  email: string;
  twoFactorEnabled: boolean;
}

@Component({
  selector: 'app-security',
  imports: [FormsModule],
  template: `
    <h1 class="page-title">Segurança</h1>
    <p class="page-sub">Autenticação em dois fatores e troca de senha.</p>

    <div class="grid-2">
      <section class="card">
        <h3>Autenticação em dois fatores (2FA)</h3>

        @if (!secret()) {
          <p class="muted small" style="margin-top:10px">
            {{ enabled() ? '2FA está ativo. Para desativar, informe o código do app.' : 'Ative o 2FA para exigir um código do seu autenticador no login.' }}
          </p>
          <div class="field">
            <label>Código do autenticador</label>
            <input class="input" [(ngModel)]="code" placeholder="6 dígitos" />
          </div>
          @if (enabled()) {
            <button class="btn secondary" style="margin-top:12px" (click)="disable()">Desativar 2FA</button>
          } @else {
            <button class="btn" style="margin-top:12px" (click)="enable()">Ativar 2FA</button>
          }
        } @else {
          <p class="small muted" style="margin-top:10px">
            Adicione esta chave no seu aplicativo (Google Authenticator, Authy, etc.):
          </p>
          <div class="field">
            <label>Chave secreta</label>
            <input class="input" [value]="secret()" readonly />
          </div>
          <div class="field">
            <label>Código de confirmação</label>
            <input class="input" [(ngModel)]="code" placeholder="6 dígitos" />
          </div>
          <button class="btn" style="margin-top:12px" (click)="confirm()">Confirmar 2FA</button>
        }

        @if (message()) {
          <div class="alert" [class.ok]="ok()" [class.error]="!ok()">{{ message() }}</div>
        }
      </section>

      <section class="card">
        <h3>Trocar senha</h3>
        <div class="field">
          <label>Senha atual</label>
          <input class="input" type="password" [(ngModel)]="oldPassword" />
        </div>
        <div class="field">
          <label>Nova senha</label>
          <input class="input" type="password" [(ngModel)]="newPassword" placeholder="mínimo 8 caracteres" />
        </div>
        <button class="btn" style="margin-top:12px" (click)="changePassword()">Trocar senha</button>
        @if (passwordMessage()) {
          <div class="alert" [class.ok]="passwordOk()" [class.error]="!passwordOk()">{{ passwordMessage() }}</div>
        }
      </section>
    </div>
  `,
})
export class SecurityComponent {
  private readonly api = inject(ApiService);

  readonly enabled = signal(false);
  readonly secret = signal<string | null>(null);
  readonly message = signal<string | null>(null);
  readonly ok = signal(false);
  readonly passwordMessage = signal<string | null>(null);
  readonly passwordOk = signal(false);

  code = '';
  oldPassword = '';
  newPassword = '';

  constructor() {
    this.api.get<Me>('/auth/me').subscribe({ next: (me) => this.enabled.set(me.twoFactorEnabled) });
  }

  enable() {
    this.api.post<{ secret: string; otpauthUrl: string }>('/auth/2fa/setup', {}).subscribe({
      next: (res) => {
        this.secret.set(res.secret);
        this.message.set(null);
      },
      error: (err) => {
        this.ok.set(false);
        this.message.set(err?.error?.message || 'Falha ao iniciar 2FA.');
      },
    });
  }

  confirm() {
    this.api.post('/auth/2fa/confirm', { code: this.code }).subscribe({
      next: () => {
        this.ok.set(true);
        this.message.set('2FA ativado.');
        this.secret.set(null);
        this.code = '';
        this.enabled.set(true);
      },
      error: (err) => {
        this.ok.set(false);
        this.message.set(err?.error?.message || 'Código inválido.');
      },
    });
  }

  disable() {
    this.api.post('/auth/2fa/disable', { code: this.code }).subscribe({
      next: () => {
        this.ok.set(true);
        this.message.set('2FA desativado.');
        this.code = '';
        this.enabled.set(false);
      },
      error: (err) => {
        this.ok.set(false);
        this.message.set(err?.error?.message || 'Código inválido.');
      },
    });
  }

  changePassword() {
    this.api
      .post('/auth/change-password', { oldPassword: this.oldPassword, newPassword: this.newPassword })
      .subscribe({
        next: () => {
          this.passwordOk.set(true);
          this.passwordMessage.set('Senha alterada.');
          this.oldPassword = '';
          this.newPassword = '';
        },
        error: (err) => {
          this.passwordOk.set(false);
          this.passwordMessage.set(err?.error?.message || 'Falha ao trocar a senha.');
        },
      });
  }
}
