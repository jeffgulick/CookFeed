import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import axe from 'axe-core';
import { Account, CartData, CartLine, Order } from '../../core/api-types';
import { Session } from '../../core/session';
import { Confirm } from '../../ui/confirm';
import { CartPage } from './cart';

/* The cart page (the prototype's cart.html): the signed-in cook's cart lines, the totals, taking lines out, and
   Place order, which replaces the cart with a receipt. Confirmations are asked through the shared dialog; here a
   stand-in answers them. */
describe('Cart page', () => {
  const alex: Account = { id: 1, displayName: 'Alex Rivera', roles: ['HomeCook'], handle: null };
  const admin: Account = { id: 6, displayName: 'Cookfeed Admin', roles: ['Admin'], handle: null };

  const japan: CartLine = {
    productId: 3,
    type: 'MealPlan',
    title: 'Three Weeknights in Japan',
    coverImageUrl: 'images/products/3.svg',
    creatorHandle: 'kenji-kitchen',
    recipeCount: 3,
    mealCount: 3,
    priceCents: 1299,
  };
  const bread: CartLine = {
    productId: 2,
    type: 'RecipeCollection',
    title: 'The Bread Box',
    coverImageUrl: 'images/products/2.svg',
    creatorHandle: 'maria-cooks',
    recipeCount: 3,
    mealCount: null,
    priceCents: 499,
  };
  const cartOf = (lines: CartLine[], unavailable: string[] = []): CartData => ({
    lines,
    totalCents: lines.reduce((sum, l) => sum + l.priceCents, 0),
    currency: 'USD',
    unavailable,
  });

  let fixture: ComponentFixture<CartPage>;
  let page: HTMLElement;
  let http: HttpTestingController;
  /** What the stand-in dialog was asked, and what it answers. */
  let asked: { message: string; action: string }[];
  let answer: boolean;

  async function show(signedInAs: Account | null, cart?: CartData): Promise<void> {
    localStorage.clear();
    asked = [];
    answer = true;
    TestBed.configureTestingModule({
      imports: [CartPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: Confirm,
          useValue: {
            ask: (message: string, action: string) => {
              asked.push({ message, action });
              return Promise.resolve(answer);
            },
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const session = TestBed.inject(Session);
    session.accounts.set([alex, admin]);
    if (signedInAs !== null) {
      session.signIn(signedInAs.id);
    }
    fixture = TestBed.createComponent(CartPage);
    await fixture.whenStable();
    page = fixture.nativeElement as HTMLElement;
    if (cart !== undefined) {
      http.expectOne('/api/me/cart').flush(cart);
      await fixture.whenStable();
    }
  }

  const text = (selector: string) => page.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
  const button = (label: string) =>
    Array.from(page.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.trim() === label);

  /** Lets everything waiting on an answer run: the confirmation, the request, and the redraw after it. */
  async function settle(): Promise<void> {
    await fixture.whenStable();
    await new Promise((done) => setTimeout(done));
    await fixture.whenStable();
  }

  /** Presses a button and lets the confirmation and what follows it run. */
  async function press(label: string, within: Element = page): Promise<void> {
    Array.from(within.querySelectorAll<HTMLButtonElement>('button'))
      .find((b) => b.textContent?.trim() === label)!
      .click();
    await settle();
  }

  it('lists each line with what it is, who sells it and its price', async () => {
    await show(alex, cartOf([japan, bread]));

    const lines = Array.from(page.querySelectorAll('[data-cart-line]'));
    expect(lines.map((l) => l.querySelector('h2')?.textContent?.trim())).toEqual([
      'Three Weeknights in Japan',
      'The Bread Box',
    ]);
    expect(lines[0].textContent).toContain('Meal plan');
    expect(lines[0].textContent).toContain('by kenji-kitchen');
    expect(lines[0].textContent).toContain('3 recipes');
    expect(lines[0].querySelector('[data-line-price]')?.textContent?.trim()).toBe('$12.99');
    expect(lines[0].querySelector('h2 a')?.getAttribute('href')).toBe('/plans/3');
    expect(lines[0].querySelector('img')?.getAttribute('src')).toBe('/images/products/3.svg');
    expect(lines[1].textContent).toContain('Recipe collection');
  });

  it('counts the items and adds them up, with no tax or delivery on a digital plan', async () => {
    await show(alex, cartOf([japan, bread]));

    expect(page.querySelector('h1')?.textContent).toContain('Your cart');
    expect(text('[data-item-count]')).toBe('2 items · digital plans, yours to keep');
    expect(text('[data-subtotal]')).toBe('$17.98');
    expect(text('[data-total]')).toBe('$17.98');
    const rows = Array.from(page.querySelectorAll('[data-totals] dl > div')).map((row) => [
      row.querySelector('dt')?.textContent?.trim(),
      row.querySelector('dd')?.textContent?.trim(),
    ]);
    expect(rows).toEqual([
      ['Subtotal', '$17.98'],
      ['Tax', '$0.00'],
      ['Delivery', 'None, it is digital'],
      ['Total', '$17.98'],
    ]);
    expect(text('[data-totals]')).toContain('Cookfeed does not take payment');
  });

  it('counts one item as "1 item"', async () => {
    await show(alex, cartOf([bread]));

    expect(text('[data-item-count]')).toContain('1 item ·');
  });

  it('says an empty cart is empty, points to the plans, and cannot be ordered', async () => {
    await show(alex, cartOf([]));

    expect(page.textContent).toContain('Your cart is empty.');
    expect(page.querySelector('[data-empty] a')?.getAttribute('href')).toBe('/plans');
    expect(button('Place order')?.disabled).toBe(true);
    expect(button('Empty cart')).toBeUndefined();
    expect(page.querySelector('[data-still-deciding]')).toBeNull();
  });

  it('names what is no longer for sale instead of dropping it silently', async () => {
    await show(alex, cartOf([japan], ['The Bread Box']));

    expect(text('[data-unavailable]')).toBe('The Bread Box is no longer for sale, so it is not in your order.');
  });

  it('takes a line out after asking, and says so', async () => {
    await show(alex, cartOf([japan, bread]));

    await press('Take out of cart', page.querySelectorAll('[data-cart-line]')[1]);
    expect(asked).toEqual([{ message: 'Take The Bread Box out of your cart?', action: 'Take it out' }]);
    const request = http.expectOne('/api/me/cart/2');
    expect(request.request.method).toBe('DELETE');
    request.flush(cartOf([japan]));
    await settle();

    expect(page.querySelectorAll('[data-cart-line]').length).toBe(1);
    expect(text('[data-total]')).toBe('$12.99');
  });

  it('leaves the line when the question is answered no', async () => {
    await show(alex, cartOf([japan, bread]));
    answer = false;

    await press('Take out of cart', page.querySelectorAll('[data-cart-line]')[1]);

    http.expectNone('/api/me/cart/2');
    expect(page.querySelectorAll('[data-cart-line]').length).toBe(2);
  });

  it('empties the cart after asking how many items go', async () => {
    await show(alex, cartOf([japan, bread]));

    await press('Empty cart');
    expect(asked).toEqual([{ message: 'Remove all 2 items from your cart?', action: 'Empty cart' }]);
    const request = http.expectOne('/api/me/cart');
    expect(request.request.method).toBe('DELETE');
    request.flush(cartOf([]));
    await settle();

    expect(page.textContent).toContain('Your cart is empty.');
  });

  it('places the order after asking, then shows a receipt in place of the cart', async () => {
    await show(alex, cartOf([japan, bread]));
    const order: Order = {
      id: 7,
      status: 'Paid',
      placedAt: '2026-11-21T18:00:00+00:00',
      paidAt: '2026-11-21T18:00:00+00:00',
      totalCents: 1798,
      currency: 'USD',
      items: [
        { productId: 3, productTitle: 'Three Weeknights in Japan', unitPriceCents: 1299, sellerHandle: 'kenji-kitchen', type: 'MealPlan', recipeCount: 3, mealCount: 3 },
        { productId: 2, productTitle: 'The Bread Box', unitPriceCents: 499, sellerHandle: 'maria-cooks', type: 'RecipeCollection', recipeCount: 3, mealCount: null },
      ],
    };

    await press('Place order');
    expect(asked).toEqual([{ message: 'Place this order for $17.98?', action: 'Place order' }]);
    http.expectOne('/api/me/checkout').flush(order, { status: 201, statusText: 'Created' });
    await settle();

    expect(page.querySelector('h1')?.textContent).toContain('Thank you');
    expect(text('[data-receipt] h2')).toBe('Order confirmed');
    expect(text('[data-receipt]')).toContain('Order CF-00007');
    expect(text('[data-receipt]')).toContain('You paid $17.98 for 2 plans');
    expect(text('[data-receipt]')).toContain('Every recipe in them is yours to keep.');
    const links = Array.from(page.querySelectorAll('[data-receipt] li a')).map((a) => a.getAttribute('href'));
    expect(links).toEqual(['/plans/3', '/plans/2']);
    expect(page.querySelector('[data-receipt] a[href="/orders"]')?.textContent).toContain('See your orders');
    expect(page.querySelector('[data-cart-line]')).toBeNull();
    expect(page.querySelector('[data-item-count]')).toBeNull();
  });

  it('words the receipt for one plan', async () => {
    await show(alex, cartOf([bread]));

    await press('Place order');
    http.expectOne('/api/me/checkout').flush(
      {
        id: 12,
        status: 'Paid',
        placedAt: '2026-11-21T18:00:00+00:00',
        paidAt: '2026-11-21T18:00:00+00:00',
        totalCents: 499,
        currency: 'USD',
        items: [{ productId: 2, productTitle: 'The Bread Box', unitPriceCents: 499, sellerHandle: 'maria-cooks', type: 'RecipeCollection', recipeCount: 3, mealCount: null }],
      } satisfies Order,
      { status: 201, statusText: 'Created' },
    );
    await settle();

    expect(text('[data-receipt]')).toContain('Order CF-00012');
    expect(text('[data-receipt]')).toContain('You paid $4.99 for 1 plan:');
    expect(text('[data-receipt]')).toContain('Every recipe in it is yours to keep.');
  });

  it('says what the API said when the order is refused, and keeps the cart', async () => {
    await show(alex, cartOf([bread]));

    await press('Place order');
    http
      .expectOne('/api/me/checkout')
      .flush({ detail: 'There is nothing in your cart that can be bought.' }, { status: 400, statusText: 'Bad Request' });
    await settle();
    // The page reads the cart again, to show what is really there now.
    http.expectOne('/api/me/cart').flush(cartOf([]));
    await fixture.whenStable();

    expect(text('[role="alert"]')).toBe('There is nothing in your cart that can be bought.');
    expect(page.querySelector('h1')?.textContent).toContain('Your cart');
  });

  it('asks a visitor to sign in, and says where to come back to', async () => {
    await show(null);

    const link = page.querySelector('[data-no-cart] a');
    expect(link?.textContent?.trim()).toBe('Sign in to see your cart');
    expect(link?.getAttribute('href')).toBe('/sign-in?next=%2Fcart');
    expect(button('Place order')).toBeUndefined();
    http.expectNone('/api/me/cart');
  });

  it('tells the admin that admin accounts do not shop', async () => {
    await show(admin);

    expect(text('[data-no-cart]')).toBe('Admin accounts do not shop, so there is no cart.');
    http.expectNone('/api/me/cart');
  });

  it('says the cart is loading, then that it could not be loaded', async () => {
    await show(alex);
    expect(page.querySelector('[role="status"]')?.textContent).toContain('Loading');

    http.expectOne('/api/me/cart').flush('down', { status: 503, statusText: 'Service Unavailable' });
    await fixture.whenStable();

    expect(page.querySelector('[role="alert"]')?.textContent).toContain('could not be loaded');
  });

  it('has no accessibility violations a structural check can find', async () => {
    await show(alex, cartOf([japan, bread], ['Summer Grilling']));

    const results = await axe.run(page, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });

    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
});
