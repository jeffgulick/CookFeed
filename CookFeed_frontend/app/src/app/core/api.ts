import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { FeedPage, FeedSort } from './api-types';

/**
 * The Cookfeed API, one method per endpoint. Paths are relative (/api/...): in development the Angular dev server
 * passes them on to the API (proxy.conf.json), so the browser sees one origin.
 */
@Injectable({ providedIn: 'root' })
export class CookfeedApi {
  private readonly http = inject(HttpClient);

  /** Published free recipes, newest first or most saved first (GET /api/feed). */
  feed(sort: FeedSort, pageSize: number, page = 1): Observable<FeedPage> {
    return this.http.get<FeedPage>('/api/feed', { params: { sort, page, pageSize } });
  }
}
