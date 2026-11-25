import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { SelectModule } from 'primeng/select';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { BadgeModule } from 'primeng/badge';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { InsightsService } from '../../core/insights.service';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    CommonModule,
    FormsModule,
    ButtonModule,
    DrawerModule,
    SelectModule,
    DialogModule,
    ToastModule,
    BadgeModule,
  ],
  providers: [MessageService],
  template: `
    <p-toast />
    <header class="topbar">
      <p-button icon="pi pi-bars" [text]="true" (onClick)="drawer.set(true)" ariaLabel="Abrir menu" />
      <div class="logo">wsi<span>-invest-ai</span></div>
      <div class="grow"></div>
      <p-button
        [icon]="dark() ? 'pi pi-sun' : 'pi pi-moon'"
        [text]="true"
        (onClick)="toggleDark()"
        ariaLabel="Alternar tema"
      />
    </header>

    <div class="layout">
      <aside class="sidebar desktop">
        <div class="logo">wsi<span>-invest-ai</span></div>
        <ng-container *ngTemplateOutlet="workspaceBlock" />
        <ng-container *ngTemplateOutlet="navBlock" />
        <div class="spacer"></div>
        <ng-container *ngTemplateOutlet="userBlock" />
      </aside>

      <main class="content">
        <router-outlet />
      </main>
    </div>

    <p-drawer
      [visible]="drawer()"
      (visibleChange)="drawer.set($event)"
      position="left"
      styleClass="mobile-drawer"
    >
      <aside class="sidebar" style="height:100%">
        <div class="logo">wsi<span>-invest-ai</span></div>
        <ng-container *ngTemplateOutlet="workspaceBlock" />
        <ng-container *ngTemplateOutlet="navBlock" />
        <div class="spacer"></div>
        <ng-container *ngTemplateOutlet="userBlock" />
      </aside>
    </p-drawer>

    <ng-template #workspaceBlock>
      <div class="workspace">
        <p-select
          [options]="workspaceOptions()"
          [(ngModel)]="selectedWorkspace"
          (onChange)="onWorkspaceSelect($event.value)"
          optionLabel="label"
          optionValue="value"
          placeholder="Workspace"
          appendTo="body"
          styleClass="w-full"
        />
        <button class="workspace-add" (click)="openDialog()" title="Novo workspace">+ workspace</button>
      </div>
    </ng-template>

    <ng-template #navBlock>
      @for (item of nav(); track item.path) {
        <a [routerLink]="item.path" routerLinkActive="active" (click)="drawer.set(false)">
          <i class="pi {{ item.icon }}"></i> {{ item.label }}
          @if (item.path === '/app/insights' && insights.unread() > 0) {
            <p-badge [value]="insights.unread()" severity="info" />
          }
          @if (item.path === '/app/admin') {
            <i class="pi pi-lock" style="font-size:11px;opacity:.6"></i>
          }
        </a>
      }
      <p-button
        [icon]="dark() ? 'pi pi-sun' : 'pi pi-moon'"
        [label]="dark() ? 'Claro' : 'Escuro'"
        [text]="true"
        size="small"
        (onClick)="toggleDark()"
      />
    </ng-template>

    <ng-template #userBlock>
      @if (auth.openMode()) {
        <div class="who">Modo local — sem login</div>
      } @else {
        <div class="who">{{ auth.user()?.email }}</div>
        <a href="javascript:void(0)" (click)="logout()">Sair</a>
      }
    </ng-template>

    <p-dialog
      header="Novo workspace"
      [visible]="dialog()"
      (visibleChange)="dialog.set($event)"
      [modal]="true"
      [style]="{ width: 'min(420px, 92vw)' }"
    >
      <div class="field">
        <label for="ws-name">Nome</label>
        <input id="ws-name" class="input" [(ngModel)]="companyName" placeholder="Ex.: Reserva, Empresa X" />
      </div>
      <div class="field">
        <label for="ws-kind">Tipo</label>
        <p-select
          inputId="ws-kind"
          [options]="[
            { label: 'Pessoal', value: 'PERSONAL' },
            { label: 'Empresa', value: 'COMPANY' },
          ]"
          [(ngModel)]="companyKind"
          appendTo="body"
          styleClass="w-full"
        />
      </div>
      @if (companyKind === 'COMPANY') {
        <div class="field">
          <label for="ws-cnpj">CNPJ (opcional)</label>
          <input id="ws-cnpj" class="input" [(ngModel)]="companyCnpj" placeholder="00.000.000/0001-00" />
        </div>
      }
      @if (companyError()) {
        <div class="alert error">{{ companyError() }}</div>
      }
      <ng-template #footer>
        <p-button label="Cancelar" severity="secondary" [text]="true" (onClick)="dialog.set(false)" />
        <p-button
          label="Criar"
          [loading]="creating()"
          [disabled]="!companyName.trim()"
          (onClick)="createCompany()"
        />
      </ng-template>
    </p-dialog>
  `,
})
export class ShellComponent {
  readonly auth = inject(AuthService);
  readonly insights = inject(InsightsService);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(MessageService);

  readonly drawer = signal(false);
  readonly dialog = signal(false);
  readonly creating = signal(false);
  readonly companyError = signal<string | null>(null);
  readonly dark = signal(localStorage.getItem('wsi.theme') === 'dark');

  companyName = '';
  companyKind: 'PERSONAL' | 'COMPANY' = 'PERSONAL';
  companyCnpj = '';
  selectedWorkspace = '';

  readonly nav = signal<NavItem[]>([
    { path: '/app/overview', label: 'Visão geral', icon: 'pi-home' },
    { path: '/app/insights', label: 'Insights de IA', icon: 'pi-sparkles' },
    { path: '/app/opportunities', label: 'Radar de oportunidades', icon: 'pi-compass' },
    { path: '/app/business', label: 'Oportunidades de negócio', icon: 'pi-briefcase' },
    { path: '/app/portfolio', label: 'Carteira', icon: 'pi-wallet' },
    { path: '/app/banking', label: 'Extratos', icon: 'pi-receipt' },
    { path: '/app/analysis', label: 'Análise', icon: 'pi-chart-line' },
    { path: '/app/fixed-income', label: 'Renda fixa', icon: 'pi-percentage' },
    { path: '/app/alerts', label: 'Alertas', icon: 'pi-bell' },
    { path: '/app/chat', label: 'Chat / análise', icon: 'pi-comments' },
    { path: '/app/notes', label: 'Diário', icon: 'pi-file-edit' },
    { path: '/app/memories', label: 'Memórias', icon: 'pi-database' },
    { path: '/app/security', label: 'Segurança', icon: 'pi-shield' },
    { path: '/app/admin', label: 'Admin', icon: 'pi-cog' },
    { path: '/app/settings', label: 'Provedores de IA', icon: 'pi-sliders-h' },
  ]);

  constructor() {
    this.applyTheme();
    this.insights.refreshUnread();
    const current = this.auth.tenantId();
    if (current) this.selectedWorkspace = current;
    effect(() => {
      const t = this.auth.tenantId();
      if (t && t !== this.selectedWorkspace) this.selectedWorkspace = t;
    });
  }

  workspaceOptions() {
    return this.auth.memberships().map((m) => ({
      label: `${m.tenant.kind === 'COMPANY' ? '🏢' : '🏠'} ${m.tenant.name}`,
      value: m.tenantId,
    }));
  }

  onWorkspaceSelect(id: string) {
    if (id && id !== this.auth.tenantId()) {
      this.auth.selectTenant(id);
      this.drawer.set(false);
      window.location.reload();
    }
  }

  openDialog() {
    this.companyError.set(null);
    this.drawer.set(false);
    this.dialog.set(true);
  }

  createCompany() {
    if (!this.companyName.trim()) return;
    this.creating.set(true);
    this.companyError.set(null);
    this.api
      .post<{ id: string }>('/tenants', {
        name: this.companyName.trim(),
        cnpj: this.companyKind === 'COMPANY' ? this.companyCnpj.trim() || undefined : undefined,
        kind: this.companyKind,
      })
      .subscribe({
        next: (tenant) => {
          this.creating.set(false);
          this.dialog.set(false);
          this.toast.add({ severity: 'success', summary: 'Workspace criado' });
          this.auth.selectTenant(tenant.id);
          window.location.reload();
        },
        error: (err) => {
          this.creating.set(false);
          const msg = err?.error?.message || 'Falha ao criar o workspace.';
          this.companyError.set(msg);
          this.toast.add({ severity: 'error', summary: 'Erro', detail: msg });
        },
      });
  }

  toggleDark() {
    this.dark.update((v) => !v);
    localStorage.setItem('wsi.theme', this.dark() ? 'dark' : 'light');
    this.applyTheme();
  }

  private applyTheme() {
    document.documentElement.classList.toggle('app-dark', this.dark());
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
