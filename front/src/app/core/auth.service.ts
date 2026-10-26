import { Injectable, computed, inject, signal } from '@angular/core';
import { tap } from 'rxjs';
import { ApiService } from './api.service';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
}

export interface Membership {
  id: string;
  tenantId: string;
  role: string;
  tenant: { id: string; name: string; slug: string; plan: string };
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);

  readonly user = signal<AuthUser | null>(this.readUser());
  readonly tenantId = signal<string | null>(localStorage.getItem('wsi.tenantId'));
  readonly memberships = signal<Membership[]>([]);
  readonly isAuthenticated = computed(() => Boolean(this.user() && this.tenantId()));

  constructor() {
    if (localStorage.getItem('wsi.accessToken')) {
      this.refreshSession();
    }
  }

  login(email: string, password: string) {
    return this.api
      .post<AuthResponse>('/auth/login', { email, password })
      .pipe(tap((res) => this.applySession(res)));
  }

  register(email: string, password: string, name?: string) {
    return this.api
      .post<AuthResponse>('/auth/register', { email, password, name })
      .pipe(tap((res) => this.applySession(res)));
  }

  logout() {
    localStorage.removeItem('wsi.accessToken');
    localStorage.removeItem('wsi.refreshToken');
    localStorage.removeItem('wsi.tenantId');
    localStorage.removeItem('wsi.user');
    this.user.set(null);
    this.tenantId.set(null);
    this.memberships.set([]);
  }

  selectTenant(tenantId: string) {
    localStorage.setItem('wsi.tenantId', tenantId);
    this.tenantId.set(tenantId);
  }

  private applySession(res: AuthResponse) {
    localStorage.setItem('wsi.accessToken', res.accessToken);
    localStorage.setItem('wsi.refreshToken', res.refreshToken);
    localStorage.setItem('wsi.user', JSON.stringify(res.user));
    this.user.set(res.user);
    this.loadMemberships();
  }

  private refreshSession() {
    this.api.get<AuthUser & { memberships: Membership[] }>('/auth/me').subscribe({
      next: (me) => {
        this.user.set({ id: me.id, email: me.email, name: me.name });
        this.memberships.set(me.memberships ?? []);
        const tenant = localStorage.getItem('wsi.tenantId');
        if (!tenant && me.memberships?.length) {
          this.selectTenant(me.memberships[0].tenantId);
        }
      },
      error: () => this.logout(),
    });
  }

  private loadMemberships() {
    this.api.get<Membership[]>('/tenants').subscribe({
      next: (memberships) => {
        this.memberships.set(memberships);
        if (!localStorage.getItem('wsi.tenantId') && memberships.length) {
          this.selectTenant(memberships[0].tenantId);
        }
      },
    });
  }

  private readUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem('wsi.user');
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  }
}
