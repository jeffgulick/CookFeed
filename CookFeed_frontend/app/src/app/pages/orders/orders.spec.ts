import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import axe from 'axe-core';
import { Account, Order, OrderItem } from '../../core/api-types';
import { Session } from '../../core/session';
import { OrdersPage } from './orders';

/* Your orders (the prototype's orders.html): the signed-in cook's orders, newest first, cancelled ones included.
   Each line shows the title and price paid at checkout, which the API keeps (GET /api/me/orders). */
describe('Orders page', () => {
  const alex: Account = { id: 1, displayName: 'Alex Rivera', roles: ['HomeCook'], handle: null };
  const admin: Account = { id: 6, displayName: 'Cookfeed Admin', roles: ['Admin'], handle: null };

  const item = (productId: number, productTitle: string, unitPriceCents: number, extra: Partial<OrderItem> = {}): OrderItem => ({
    productId,
    productTitle,
    unitPriceCents,
    sellerHandle: 'dan-meal-preps',
    type: 'MealPlan',
    recipeCount: 3,
    mealCount: 3,
    ...extra,
  });
  const order = (id: number, status: Order['status'], items: OrderItem[]): Order => ({
    id,
    status,
    // Noon UTC, so the date reads the same in any time zone the tests run in.
    placedAt: '2026-08-31T12:00:00+00:00',
    paidAt: status === 'Paid' ? '2026-08-31T12:00:00+00:00' : null,
    totalCents: items.reduce((sum, i) => sum + i.unitPriceCents, 0),
    currency: 'USD',
    items,
  });

  let fixture: ComponentFixture<OrdersPage>;
  let page: HTMLElement;
  let http: HttpTestingController;
  let session: Session;

  async function show(signedInAs: Account | null, orders?: Order[]): Promise<void> {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [OrdersPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(Session);
    session.accounts.set([alex, admin]);
    if (signedInAs !== null) {
      session.signIn(signedInAs.id);
    }
    fixture = TestBed.createComponent(OrdersPage);
    await fixture.whenStable();
    page = fixture.nativeElement as HTMLElement;
    if (orders !== undefined) {
      http.expectOne('/api/me/orders').flush(orders);
      await fixture.whenStable();
    }
  }

  const text = (selector: string, within: Element = page) =>
    within.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
  const cards = () => Array.from(page.querySelectorAll('[data-order]'));

  it('lists the orders in the order the API sends them, and says how many', async () => {
    await show(alex, [
      order(3, 'Cancelled', [item(2, 'The Bread Box', 499)]),
      order(2, 'Paid', [item(4, 'Family Week on a Budget', 999)]),
    ]);

    expect(page.querySelector('h1')?.textContent).toContain('Your orders');
    expect(text('[data-order-summary]')).toBe('2 orders, newest first.');
    expect(cards().map((card) => text('[data-order-number]', card))).toEqual(['Order CF-00003', 'Order CF-00002']);
    expect(cards().map((card) => text('[data-status]', card))).toEqual(['Cancelled', 'Paid']);
  });

  it('counts one order as "1 order"', async () => {
    await show(alex, [order(2, 'Paid', [item(4, 'Family Week on a Budget', 999)])]);

    expect(text('[data-order-summary]')).toBe('1 order, newest first.');
  });

  it('shows each line as it was bought: the title, what it held and the price paid', async () => {
    await show(alex, [
      order(1, 'Paid', [
        item(4, 'Family Week on a Budget', 999, { recipeCount: 5, mealCount: 6 }),
        item(1, 'Roman Pasta Collection', 799, { type: 'RecipeCollection', recipeCount: 3, mealCount: null }),
      ]),
    ]);

    const lines = Array.from(cards()[0].querySelectorAll('li'));
    expect(lines.length).toBe(2);
    expect(lines[0].querySelector('a')?.textContent?.trim()).toBe('Family Week on a Budget');
    expect(lines[0].querySelector('a')?.getAttribute('href')).toBe('/plans/4');
    expect(lines[0].textContent).toContain('5 recipes, 6 meals');
    expect(text('[data-line-price]', lines[0])).toBe('$9.99');
    expect(lines[1].textContent).toContain('3 recipes');
    expect(lines[1].textContent).not.toContain('meals');
    expect(text('[data-order-total]', cards()[0])).toBe('$17.98');
    expect(cards()[0].textContent).toContain('August 31, 2026');
  });

  it('says a cancelled or refunded order owns nothing, and says nothing of the kind on a paid one', async () => {
    await show(alex, [
      order(3, 'Cancelled', [item(2, 'The Bread Box', 499)]),
      order(2, 'Refunded', [item(4, 'Family Week on a Budget', 999)]),
      order(1, 'Paid', [item(1, 'Roman Pasta Collection', 799)]),
    ]);

    expect(cards()[0].textContent).toContain('This order was cancelled, so nothing in it is yours.');
    expect(cards()[1].textContent).toContain('This order was refunded, so nothing in it is yours.');
    expect(cards()[2].textContent).not.toContain('nothing in it is yours');
  });

  it('points a cook with no orders to the plans', async () => {
    await show(alex, []);

    expect(text('[data-order-summary]')).toBe('Plans you buy show up here.');
    expect(text('[data-no-orders]')).toContain('No orders yet.');
    expect(page.querySelector('[data-no-orders] a')?.getAttribute('href')).toBe('/plans');
  });

  it('asks a visitor to sign in, and says where to come back to', async () => {
    await show(null);

    const link = page.querySelector('[data-no-orders-here] a');
    expect(link?.textContent?.trim()).toBe('Sign in to see your orders');
    expect(link?.getAttribute('href')).toBe('/sign-in?next=%2Forders');
    http.expectNone('/api/me/orders');
  });

  it('tells the admin that admin accounts do not place orders', async () => {
    await show(admin);

    expect(text('[data-no-orders-here]')).toBe('Admin accounts do not place orders.');
    http.expectNone('/api/me/orders');
  });

  it('reads the orders again when the account changes', async () => {
    await show(null);

    session.signIn(alex.id);
    await fixture.whenStable();
    http.expectOne('/api/me/orders').flush([order(2, 'Paid', [item(4, 'Family Week on a Budget', 999)])]);
    await fixture.whenStable();

    expect(cards().length).toBe(1);
  });

  it('says the orders are loading, then that they could not be loaded', async () => {
    await show(alex);
    expect(page.querySelector('[role="status"]')?.textContent).toContain('Loading');

    http.expectOne('/api/me/orders').flush('down', { status: 503, statusText: 'Service Unavailable' });
    await fixture.whenStable();

    expect(page.querySelector('[role="alert"]')?.textContent).toContain('could not be loaded');
  });

  it('has no accessibility violations a structural check can find', async () => {
    await show(alex, [
      order(3, 'Cancelled', [item(2, 'The Bread Box', 499)]),
      order(2, 'Paid', [item(4, 'Family Week on a Budget', 999)]),
    ]);

    const results = await axe.run(page, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });

    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
});
