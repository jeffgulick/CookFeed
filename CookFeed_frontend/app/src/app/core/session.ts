import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Account, Role } from './api-types';

/** Where the chosen account's id is kept between visits: the same key the prototype used. */
export const SESSION_STORAGE_KEY = 'cookfeed.userId';

/**
 * Who is signed in. Until login exists, signing in means picking one of the store's accounts; the API then takes
 * the caller from the X-User-Id header (see callerInterceptor). Every page asks this service what the account may
 * do, and shows or hides its controls from the answer, as the prototype's rules.js did. The API enforces the same
 * rules on every request, so these only decide what the screen offers.
 */
@Injectable({ providedIn: 'root' })
export class Session {
  private readonly http = inject(HttpClient);

  /** Every account the picker offers. Empty until load() finishes, or if the API cannot be reached. */
  readonly accounts = signal<Account[]>([]);

  /** False when the account list could not be read, so the sign-in page can say so. */
  readonly reachable = signal(true);

  private readonly storedId = signal<number | null>(readStoredId());

  /** The signed-in account, or null for a guest. A stored id that names no account is a guest too. */
  readonly user = computed(() => this.accounts().find((account) => account.id === this.storedId()) ?? null);

  /** The admin runs the Admin console and holds no other role (3.1, 3.8). */
  readonly isAdmin = computed(() => hasRole(this.user(), 'Admin'));

  /** A creator runs their studio, and shops like anyone else. */
  readonly isCreator = computed(() => hasRole(this.user(), 'Creator'));

  /** Saving, carts, orders and reviews belong to the HomeCook role. */
  readonly canShop = computed(() => hasRole(this.user(), 'HomeCook'));

  /**
   * Whether the shopper's links (My kitchen, Your orders, the cart) are shown. A guest sees them, and is asked to
   * sign in when they follow one; only a signed-in account that cannot shop, the admin, has them left out.
   */
  readonly showShopLinks = computed(() => this.user() === null || this.canShop());

  /** Reads the accounts once, when the app starts. A failure leaves the visitor browsing as a guest. */
  async load(): Promise<void> {
    try {
      this.accounts.set(await firstValueFrom(this.http.get<Account[]>('/api/accounts')));
      this.reachable.set(true);
    } catch {
      this.accounts.set([]);
      this.reachable.set(false);
    }
  }

  signIn(accountId: number): void {
    this.storedId.set(accountId);
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, String(accountId));
    } catch {
      // Storage can be switched off (private windows): the choice then lasts until the page is reloaded.
    }
  }

  signOut(): void {
    this.storedId.set(null);
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // Nothing was stored, so there is nothing to remove.
    }
  }
}

function hasRole(account: Account | null, role: Role): boolean {
  return account !== null && account.roles.includes(role);
}

function readStoredId(): number | null {
  try {
    const stored = Number(localStorage.getItem(SESSION_STORAGE_KEY));
    return Number.isInteger(stored) && stored > 0 ? stored : null;
  } catch {
    return null;
  }
}
