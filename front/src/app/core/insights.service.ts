import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';

export interface InsightSource {
  title: string;
  url: string;
  source?: string;
}

export interface Insight {
  id: string;
  category: string;
  title: string;
  content: string;
  sources?: InsightSource[] | null;
  generatedAt: string;
  isRead: boolean;
}

@Injectable({ providedIn: 'root' })
export class InsightsService {
  private readonly api = inject(ApiService);
  readonly unread = signal(0);

  refreshUnread() {
    this.api.get<{ unread: number }>('/insights/unread-count').subscribe({
      next: (result) => this.unread.set(result.unread ?? 0),
      error: () => this.unread.set(0),
    });
  }

  load(category?: string) {
    const query = category ? `?category=${encodeURIComponent(category)}` : '';
    return this.api.get<Insight[]>(`/insights${query}`);
  }

  refresh() {
    return this.api.post<{ generated: number }>('/insights/refresh', {});
  }

  markAllRead() {
    return this.api.post<{ updated: number }>('/insights/read-all', {});
  }
}
