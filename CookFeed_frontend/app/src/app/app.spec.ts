import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { App, upFrom } from './app';
import { Account } from './core/api-types';
import { Notices } from './core/notices';
import { Session } from './core/session';

/* The app shell: one navigation on every page, drawn for whoever is signed in. On a wide screen it is a bar of
   links at the top; on a phone it is a row of tabs at the bottom, with the rest behind More. What each account is
   offered follows the prototype (rules.js, sections 3.1 and 3.8). */
/** Stands in for every page: the shell is what these tests look at. */
@Component({ template: '' })
class AnyPage {}

describe('App shell', () => {
  const accounts: Account[] = [
    { id: 1, displayName: 'Alex Rivera', roles: ['HomeCook'], handle: null },
    { id: 4, displayName: 'Kenji Watanabe', roles: ['HomeCook', 'Creator'], handle: 'kenji-kitchen' },
    { id: 6, displayName: 'Cookfeed Admin', roles: ['Admin'], handle: null },
  ];

  let fixture: ComponentFixture<App>;
  let page: HTMLElement;

  async function show(signedInAs: number | null): Promise<void> {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([{ path: '**', component: AnyPage }]), provideHttpClient(), provideHttpClientTesting()],
    });
    const session = TestBed.inject(Session);
    session.accounts.set(accounts);
    if (signedInAs !== null) {
      session.signIn(signedInAs);
    }
    fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    page = fixture.nativeElement as HTMLElement;
  }

  const labels = (selector: string) =>
    Array.from(page.querySelectorAll(selector)).map((element) => element.textContent?.trim().replace(/\s+/g, ' '));

  const topLinks = () => labels('[data-nav="top"] a');
  const tabs = () => labels('[data-nav="tabs"] a, [data-nav="tabs"] button');
  const moreLinks = () => labels('[data-nav="more"] a, [data-nav="more"] button');

  /** Answers the shell's request for the signed-in shopper's cart with this many lines. */
  async function cartHolds(count: number): Promise<void> {
    const line = (productId: number) => ({
      productId,
      type: 'MealPlan',
      title: `Plan ${productId}`,
      coverImageUrl: null,
      creatorHandle: 'kenji-kitchen',
      recipeCount: 3,
      mealCount: 3,
      priceCents: 999,
    });
    TestBed.inject(HttpTestingController)
      .expectOne('/api/me/cart')
      .flush({
        lines: Array.from({ length: count }, (_, index) => line(index + 1)),
        totalCents: 999 * count,
        currency: 'USD',
        unavailable: [],
      });
    await fixture.whenStable();
  }

  it('counts what is in a shopper\'s cart on the cart link, in words a screen reader can say', async () => {
    await show(1);
    await cartHolds(2);

    const cart = page.querySelector('header a[href="/cart"]');
    expect(cart?.getAttribute('aria-label')).toBe('Cart, 2 items');
    expect(cart?.querySelector('[data-cart-count]')?.textContent?.trim()).toBe('2');
    expect(cart?.querySelector('[data-cart-count]')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('counts one item as "1 item"', async () => {
    await show(1);
    await cartHolds(1);
    expect(page.querySelector('header a[href="/cart"]')?.getAttribute('aria-label')).toBe('Cart, 1 item');
  });

  it('shows no count on an empty cart', async () => {
    await show(4);
    await cartHolds(0);
    expect(page.querySelector('header a[href="/cart"]')?.getAttribute('aria-label')).toBe('Cart');
    expect(page.querySelector('[data-cart-count]')).toBeNull();
  });

  it('shows a guest the cart link with no count', async () => {
    await show(null);

    expect(page.querySelector('header a[href="/cart"]')?.getAttribute('aria-label')).toBe('Cart');
    expect(page.querySelector('[data-cart-count]')).toBeNull();
  });

  it('says what just happened in one place every page shares, announced politely', async () => {
    await show(null);
    const toast = page.querySelector('[data-toast]');
    expect(toast?.getAttribute('role')).toBe('status');
    expect(toast?.textContent?.trim()).toBe('');

    TestBed.inject(Notices).say('The Bread Box added to your cart.');
    await fixture.whenStable();

    expect(toast?.textContent?.trim()).toBe('The Bread Box added to your cart.');
  });

  it('starts with a link that skips to the page content', async () => {
    await show(null);

    const first = page.querySelector('a, button') as HTMLAnchorElement;
    expect(first.textContent).toContain('Skip to content');
    expect(first.getAttribute('href')).toBe('#main');
    expect(page.querySelector('main#main')?.getAttribute('tabindex')).toBe('-1');
  });

  it('offers a guest the store, the shopper pages and Sign in', async () => {
    await show(null);

    expect(topLinks()).toEqual(['Discover', 'Plans & collections', 'Recipes', 'My kitchen', 'Your orders', 'Help']);
    expect(page.querySelector('[data-account] a')?.textContent).toContain('Sign in');
    expect(page.querySelector('a[aria-label="Cart"]')).not.toBeNull();
  });

  it('shows a home cook their name, and no studio or Admin link', async () => {
    await show(1);

    expect(topLinks()).toEqual(['Discover', 'Plans & collections', 'Recipes', 'My kitchen', 'Your orders', 'Help']);
    expect(page.querySelector('[data-account]')?.textContent).toContain('Alex Rivera');
    expect(page.querySelector('[data-account]')?.textContent).not.toContain('Sign in');
  });

  it('adds My studio for a creator', async () => {
    await show(4);

    expect(topLinks()).toEqual([
      'Discover', 'Plans & collections', 'Recipes', 'My kitchen', 'Your orders', 'Help', 'My studio',
    ]);
  });

  it('gives the admin the Admin link and none of the shopper links or the cart', async () => {
    await show(6);

    expect(topLinks()).toEqual(['Discover', 'Plans & collections', 'Recipes', 'Help', 'Admin']);
    expect(page.querySelector('a[aria-label="Cart"]')).toBeNull();
  });

  it('gives a phone five tabs, the last one opening the rest', async () => {
    await show(1);

    expect(tabs()).toEqual(['Discover', 'Plans', 'Recipes', 'Kitchen', 'More']);
    const more = page.querySelector('[data-nav="tabs"] button') as HTMLButtonElement;
    expect(more.getAttribute('aria-haspopup')).toBe('dialog');
  });

  it('swaps the kitchen tab for Admin when the admin is signed in', async () => {
    await show(6);

    expect(tabs()).toEqual(['Discover', 'Plans', 'Recipes', 'Admin', 'More']);
  });

  it('puts the remaining pages and the account behind More, for each kind of account', async () => {
    await show(null);
    expect(moreLinks()).toEqual(['Your orders', 'Help', 'Sign in']);

    TestBed.resetTestingModule();
    await show(4);
    expect(moreLinks()).toEqual(['Your orders', 'My studio', 'Help', 'Switch account', 'Sign out']);

    TestBed.resetTestingModule();
    await show(6);
    expect(moreLinks()).toEqual(['Help', 'Switch account', 'Sign out']);
  });

  it('signs out from the More sheet', async () => {
    await show(1);

    const signOut = Array.from(page.querySelectorAll<HTMLButtonElement>('[data-nav="more"] button'))
      .find((button) => button.textContent?.includes('Sign out'))!;
    signOut.click();
    await fixture.whenStable();

    expect(TestBed.inject(Session).user()).toBeNull();
    expect(page.querySelector('[data-account] a')?.textContent).toContain('Sign in');
  });

  it('names both navigations and marks the brand as the way home', async () => {
    await show(null);

    expect(page.querySelector('[data-nav="top"]')?.getAttribute('aria-label')).toBe('Main');
    expect(page.querySelector('[data-nav="tabs"]')?.getAttribute('aria-label')).toBe('Main');
    expect(page.querySelector('header a[href="/"]')?.textContent?.replace(/\s+/g, '')).toBe('Cookfeed');
  });

  /* Back: a phone app opened from the home screen has no browser Back, so the top bar has one on every page the
     navigation does not lead to directly. */
  const backButton = () => page.querySelector<HTMLButtonElement>('header [data-back]');

  async function go(address: string): Promise<void> {
    await TestBed.inject(Router).navigateByUrl(address);
    await fixture.whenStable();
  }

  /** Lets a browser-history move finish: it is announced a moment later, then the router follows it. */
  async function settle(): Promise<void> {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }

  it('has no Back button on the pages the navigation leads to', async () => {
    await show(4);

    for (const address of ['/', '/plans', '/recipes', '/kitchen', '/orders', '/help', '/studio']) {
      await go(address);
      expect(backButton(), address).toBeNull();
    }
  });

  it('has a Back button, named for a screen reader, on a page inside another', async () => {
    await show(1);

    for (const address of ['/plans/3', '/plans/3/reviews', '/recipes/16', '/creators/kenji-kitchen', '/cart', '/list']) {
      await go(address);
      expect(backButton()?.getAttribute('aria-label'), address).toBe('Back');
    }
  });

  it('goes back to the page the cook came from', async () => {
    await show(1);
    // In a test the router follows the browser's history only once it is told to listen.
    TestBed.inject(Router).setUpLocationChangeListener();
    await go('/kitchen');
    await go('/plans/3');

    backButton()!.click();
    await settle();

    expect(TestBed.inject(Router).url).toBe('/kitchen');
  });

  it('goes up a level at a time on a page opened by its address, which has nothing to go back to', async () => {
    await show(1);
    await go('/plans/3/reviews');

    backButton()!.click();
    await settle();
    expect(TestBed.inject(Router).url).toBe('/plans/3');

    backButton()!.click();
    await settle();
    expect(TestBed.inject(Router).url).toBe('/plans');
    expect(backButton()).toBeNull();
  });
});

describe('upFrom: the page one level above an address', () => {
  it.each([
    ['/plans/3/reviews', '/plans/3'],
    ['/plans/3', '/plans'],
    ['/recipes/16', '/recipes'],
    ['/list/7', '/list'],
    ['/list', '/kitchen'],
    ['/cart', '/'],
    ['/sign-in', '/'],
    ['/creators/kenji-kitchen', '/'],
  ])('%s is under %s', (address, above) => {
    expect(upFrom(address)).toBe(above);
  });

  it('puts a recipe opened from a plan under that plan', () => {
    expect(upFrom('/recipes/5?product=3')).toBe('/plans/3');
  });

  it('ignores a plan number that is not a number', () => {
    expect(upFrom('/recipes/5?product=x')).toBe('/recipes');
  });
});
