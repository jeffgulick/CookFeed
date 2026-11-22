import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CartData,
  CreatorTile,
  FeedPage,
  FeedSort,
  Order,
  ProductDetail,
  ProductReviews,
  ProductShoppingList,
  ProductSort,
  ProductTile,
  ProductType,
  Purchase,
  RecipeDetail,
  SaveState,
  SavedRecipe,
  Storefront,
} from './api-types';

/**
 * The Cookfeed API, one method per endpoint. Paths are relative (/api/...): in development the Angular dev server
 * passes them on to the API (proxy.conf.json), so the browser sees one origin.
 */
@Injectable({ providedIn: 'root' })
export class CookfeedApi {
  private readonly http = inject(HttpClient);

  /**
   * The first page of the published free recipes, newest first or most saved first (GET /api/feed). With a search,
   * only those whose title, creator handle or creator name holds the text, in any letter case.
   */
  feed(sort: FeedSort, pageSize: number, search = ''): Observable<FeedPage> {
    const params: Record<string, string | number> = { sort, page: 1, pageSize };
    if (search !== '') {
      params['search'] = search;
    }
    return this.http.get<FeedPage>('/api/feed', { params });
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

  /** A plan's reviews, the rating, and where the caller stands with reviewing it (GET /api/products/{id}/reviews). */
  productReviews(id: string): Observable<ProductReviews> {
    return this.http.get<ProductReviews>(`/api/products/${encodeURIComponent(id)}/reviews`);
  }

  /**
   * One recipe in full (GET /api/recipes/{id}). A 403 is a premium recipe the caller has not bought, with a
   * RecipeLocked body; a 404 is an id that names no recipe the caller may know about.
   */
  recipe(id: string): Observable<RecipeDetail> {
    return this.http.get<RecipeDetail>(`/api/recipes/${encodeURIComponent(id)}`);
  }

  /** Every creator, in the order they joined (GET /api/creators). */
  creators(): Observable<CreatorTile[]> {
    return this.http.get<CreatorTile[]>('/api/creators');
  }

  /** One creator's storefront (GET /api/creators/{handle}); a 404 when nobody has the handle. */
  storefront(handle: string): Observable<Storefront> {
    return this.http.get<Storefront>(`/api/creators/${encodeURIComponent(handle)}`);
  }

  /** The signed-in cook's cart (GET /api/me/cart). A 403 for an account that does not shop. */
  cart(): Observable<CartData> {
    return this.http.get<CartData>('/api/me/cart');
  }

  /**
   * Puts a plan in the cart (PUT /api/me/cart/{id}) and answers with the cart. Refused with a sentence in the
   * body's detail when the plan is the caller's own (400), already owned or not for sale (409).
   */
  addToCart(productId: number): Observable<CartData> {
    return this.http.put<CartData>(`/api/me/cart/${productId}`, null);
  }

  /** Takes a plan out of the cart (DELETE /api/me/cart/{id}) and answers with the cart. */
  removeFromCart(productId: number): Observable<CartData> {
    return this.http.delete<CartData>(`/api/me/cart/${productId}`);
  }

  /** Empties the cart (DELETE /api/me/cart) and answers with it. */
  clearCart(): Observable<CartData> {
    return this.http.delete<CartData>('/api/me/cart');
  }

  /** Turns the cart into a paid order (POST /api/me/checkout). A 400 when nothing in it can be bought. */
  checkout(): Observable<Order> {
    return this.http.post<Order>('/api/me/checkout', null);
  }

  /** The plans and collections the signed-in cook owns (GET /api/me/purchases). */
  purchases(): Observable<Purchase[]> {
    return this.http.get<Purchase[]>('/api/me/purchases');
  }

  /** The recipes the signed-in cook saved, the newest save first (GET /api/me/saves). */
  saves(): Observable<SavedRecipe[]> {
    return this.http.get<SavedRecipe[]>('/api/me/saves');
  }

  /** Saves a recipe to My kitchen (PUT /api/me/saves/{id}). A 404 for a recipe the caller may not save. */
  save(recipeId: number): Observable<SaveState> {
    return this.http.put<SaveState>(`/api/me/saves/${recipeId}`, null);
  }

  /** Unsaves a recipe (DELETE /api/me/saves/{id}). */
  unsave(recipeId: number): Observable<SaveState> {
    return this.http.delete<SaveState>(`/api/me/saves/${recipeId}`);
  }

  /** The signed-in cook's orders, newest first, cancelled ones included (GET /api/me/orders). */
  orders(): Observable<Order[]> {
    return this.http.get<Order[]>('/api/me/orders');
  }
}
