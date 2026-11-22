import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, distinctUntilChanged, firstValueFrom, map, of, switchMap } from 'rxjs';
import { CookfeedApi } from './api';
import { CartData, Order } from './api-types';
import { LoadState } from './load';
import { Session } from './session';

/**
 * The signed-in shopper's cart, kept in one place for every page: the header counts it, a plan's buy area asks
 * whether the plan is in it, and the cart page lists it. It is the API's cart, read when a shopper signs in; each
 * change is sent to the API, which answers with the cart as it now is. A guest and the admin have no cart.
 */
@Injectable({ providedIn: 'root' })
export class Cart {
  private readonly api = inject(CookfeedApi);
  private readonly session = inject(Session);

  private readonly held = signal<CartData | null>(null);
  private readonly reading = signal<LoadState>('loading');

  /** The cart, or null for a guest, for the admin, and until the first read finishes. */
  readonly cart = this.held.asReadonly();

  /** Where the reading of the cart stands, for the cart page to say. */
  readonly state = this.reading.asReadonly();

  /** How many plans can be bought from the cart now: the number on the header's cart link. */
  readonly count = computed(() => this.held()?.lines.length ?? 0);

  constructor() {
    // The shopper whose cart this is: null for a guest and for an account that does not shop.
    const shopper = computed(() => (this.session.canShop() ? (this.session.user()?.id ?? null) : null));

    toObservable(shopper)
      .pipe(
        distinctUntilChanged(),
        // switchMap drops the answer for an account that has since signed out or been switched.
        switchMap((id) => {
          this.held.set(null);
          this.reading.set('loading');
          return id === null ? of(null) : this.read();
        }),
        takeUntilDestroyed(),
      )
      .subscribe((cart) => this.keep(cart));
  }

  /** Whether the plan is in the cart; null while that is not known yet. */
  has(productId: number): boolean | null {
    const cart = this.held();
    return cart === null ? null : cart.lines.some((line) => line.productId === productId);
  }

  /** Reads the cart again, when what is on screen may be out of date. */
  async refresh(): Promise<void> {
    this.keep(await firstValueFrom(this.read()));
  }

  /** Puts a plan in the cart. Rejects with the API's refusal, leaving the cart as it was. */
  async add(productId: number): Promise<void> {
    this.held.set(await firstValueFrom(this.api.addToCart(productId)));
  }

  async remove(productId: number): Promise<void> {
    this.held.set(await firstValueFrom(this.api.removeFromCart(productId)));
  }

  async clear(): Promise<void> {
    this.held.set(await firstValueFrom(this.api.clearCart()));
  }

  /** Places the order for what is in the cart, and leaves the cart empty. Rejects with the API's refusal. */
  async checkout(): Promise<Order> {
    const order = await firstValueFrom(this.api.checkout());
    this.held.set({ lines: [], totalCents: 0, currency: order.currency, unavailable: [] });
    return order;
  }

  /** The cart from the API, or "failed" when it could not be read. */
  private read() {
    return this.api.cart().pipe(
      map((cart): CartData | 'failed' => cart),
      catchError(() => of('failed' as const)),
    );
  }

  private keep(cart: CartData | 'failed' | null): void {
    this.held.set(cart === 'failed' ? null : cart);
    this.reading.set(cart === 'failed' ? 'failed' : 'ready');
  }
}
