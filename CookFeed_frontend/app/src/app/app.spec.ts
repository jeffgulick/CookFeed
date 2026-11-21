import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { Account } from './core/api-types';
import { Session } from './core/session';

/* The app shell: one navigation on every page, drawn for whoever is signed in. On a wide screen it is a bar of
   links at the top; on a phone it is a row of tabs at the bottom, with the rest behind More. What each account is
   offered follows the prototype (rules.js, sections 3.1 and 3.8). */
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
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
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
});
