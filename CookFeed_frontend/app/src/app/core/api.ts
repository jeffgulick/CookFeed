import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CreatorTile,
  FeedPage,
  FeedSort,
  ProductDetail,
  ProductShoppingList,
  ProductSort,
  ProductTile,
  ProductType,
  Storefront,
} from './api-types';

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

  /** One plan or collection's page, as the caller sees it (GET /api/products/{id}); a 404 when the id names none. */
  product(id: string): Observable<ProductDetail> {
    return this.http.get<ProductDetail>(`/api/products/${encodeURIComponent(id)}`);
  }

  /** "What you'll buy" for a plan: the ingredients of the recipes the caller may open, as written. */
  productShoppingList(id: string): Observable<ProductShoppingList> {
    return this.http.get<ProductShoppingList>(`/api/products/${encodeURIComponent(id)}/shopping-list`);
  }

  /** Every creator, in the order they joined (GET /api/creators). */
  creators(): Observable<CreatorTile[]> {
    return this.http.get<CreatorTile[]>('/api/creators');
  }

  /** One creator's storefront (GET /api/creators/{handle}); a 404 when nobody has the handle. */
  storefront(handle: string): Observable<Storefront> {
    return this.http.get<Storefront>(`/api/creators/${encodeURIComponent(handle)}`);
  }
}
