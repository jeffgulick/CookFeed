import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CreatorTile, FeedPage, FeedSort, ProductSort, ProductTile, ProductType } from './api-types';

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

  /**
   * The meal plans and collections for sale (GET /api/products). With no options: both kinds, newest first.
   * Each tile says whether the signed-in account already owns it.
   */
  products(options: { type?: ProductType; sort?: ProductSort } = {}): Observable<ProductTile[]> {
    const params: Record<string, string> = {};
    if (options.type !== undefined) {
      params['type'] = options.type;
    }
    if (options.sort !== undefined) {
      params['sort'] = options.sort;
    }
    return this.http.get<ProductTile[]>('/api/products', { params });
  }

  /** Every creator, in the order they joined (GET /api/creators). */
  creators(): Observable<CreatorTile[]> {
    return this.http.get<CreatorTile[]>('/api/creators');
  }
}
