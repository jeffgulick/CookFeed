import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Account, CartData, CartLine, Order } from './api-types';
import { Cart } from './cart';
import { Session } from './session';

/* The signed-in shopper's cart, kept for every page: the header counts it, a plan's buy area asks whether the plan
   is in it, and the cart page lists it. It is the API's cart (GET /api/me/cart); every change answers with the cart
   as it now is. */
describe('Cart', () => {
  const alex: Account = { id: 1, displayName: 'Alex Rivera', roles: ['HomeCook'], handle: null };
  const admin: Account = { id: 6, displayName: 'Cookfeed Admin', roles: ['Admin'], handle: null };

  const line = (productId: number, priceCents: number): CartLine => ({
    productId,
    type: 'MealPlan',
    title: `Plan ${productId}`,
    coverImageUrl: null,
    creatorHandle: 'kenji-kitchen',
    recipeCount: 3,
    mealCount: 3,
    priceCents,
  });
  const cartOf = (...lines: CartLine[]): CartData => ({
    lines,
    totalCents: lines.reduce((sum, l) => sum + l.priceCents, 0),
    currency: 'USD',
    unavailable: [],
  });

  let http: HttpTestingController;
  let session: Session;
  let cart: Cart;

  async function start(signedInAs: Account | null): Promise<void> {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(Session);
    session.accounts.set([alex, admin]);
    if (signedInAs !== null) {
      session.signIn(signedInAs.id);
    }
    cart = TestBed.inject(Cart);
    await settle();
  }

  /** Lets the service react to a change of account. */
  const settle = async () => {
    TestBed.tick();
    await Promise.resolve();
  };

  it('reads the cart of a signed-in shopper, and counts its lines', async () => {
    await start(alex);
    expect(cart.state()).toBe('loading');

    http.expectOne('/api/me/cart').flush(cartOf(line(3, 1299), line(2, 499)));

    expect(cart.state()).toBe('ready');
    expect(cart.count()).toBe(2);
    expect(cart.cart()?.totalCents).toBe(1798);
    expect(cart.has(3)).toBe(true);
    expect(cart.has(4)).toBe(false);
  });

  it('does not know what is in the cart until it has been read', async () => {
    await start(alex);

    expect(cart.has(3)).toBeNull();
    expect(cart.count()).toBe(0);
    http.expectOne('/api/me/cart').flush(cartOf());
    expect(cart.has(3)).toBe(false);
  });

  it('asks for no cart for a guest or for the admin, who have none', async () => {
    await start(null);
    http.expectNone('/api/me/cart');
    expect(cart.count()).toBe(0);
    expect(cart.cart()).toBeNull();

    session.signIn(admin.id);
    await settle();
    http.expectNone('/api/me/cart');
  });

  it('reads the cart again when the account changes, and forgets it on sign-out', async () => {
    await start(null);

    session.signIn(alex.id);
    await settle();
    http.expectOne('/api/me/cart').flush(cartOf(line(3, 1299)));
    expect(cart.count()).toBe(1);

    session.signOut();
    await settle();
    expect(cart.count()).toBe(0);
    expect(cart.cart()).toBeNull();
  });

  it('says so when the cart could not be read', async () => {
    await start(alex);

    http.expectOne('/api/me/cart').flush('down', { status: 503, statusText: 'Service Unavailable' });

    expect(cart.state()).toBe('failed');
    expect(cart.count()).toBe(0);
  });

  it('adds a plan and keeps the cart the API answers with', async () => {
    await start(alex);
    http.expectOne('/api/me/cart').flush(cartOf());

    const added = cart.add(3);
    const request = http.expectOne('/api/me/cart/3');
    expect(request.request.method).toBe('PUT');
    request.flush(cartOf(line(3, 1299)));
    await added;

    expect(cart.count()).toBe(1);
    expect(cart.has(3)).toBe(true);
  });

  it('takes a plan out, and empties the cart', async () => {
    await start(alex);
    http.expectOne('/api/me/cart').flush(cartOf(line(3, 1299), line(2, 499)));

    const removed = cart.remove(2);
    const one = http.expectOne('/api/me/cart/2');
    expect(one.request.method).toBe('DELETE');
    one.flush(cartOf(line(3, 1299)));
    await removed;
    expect(cart.count()).toBe(1);

    const cleared = cart.clear();
    const all = http.expectOne('/api/me/cart');
    expect(all.request.method).toBe('DELETE');
    all.flush(cartOf());
    await cleared;
    expect(cart.count()).toBe(0);
  });

  it('places the order, hands it back, and leaves the cart empty', async () => {
    await start(alex);
    http.expectOne('/api/me/cart').flush(cartOf(line(3, 1299)));
    const order: Order = {
      id: 7,
      status: 'Paid',
      placedAt: '2026-11-21T18:00:00+00:00',
      paidAt: '2026-11-21T18:00:00+00:00',
      totalCents: 1299,
      currency: 'USD',
      items: [],
    };

    const placed = cart.checkout();
    const request = http.expectOne('/api/me/checkout');
    expect(request.request.method).toBe('POST');
    request.flush(order, { status: 201, statusText: 'Created' });

    expect(await placed).toEqual(order);
    expect(cart.count()).toBe(0);
    expect(cart.cart()?.totalCents).toBe(0);
  });

  it('passes on a refusal, and leaves the cart as it was', async () => {
    await start(alex);
    http.expectOne('/api/me/cart').flush(cartOf(line(3, 1299)));

    const added = cart.add(1);
    http
      .expectOne('/api/me/cart/1')
      .flush({ detail: 'You already own this plan, and a plan is bought once.' }, { status: 409, statusText: 'Conflict' });

    await expect(added).rejects.toBeTruthy();
    expect(cart.count()).toBe(1);
  });
});
