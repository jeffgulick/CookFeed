import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import axe from 'axe-core';
import { Account, CreatorTile, FeedItem, FeedPage, ProductTile } from '../../core/api-types';
import { Session } from '../../core/session';
import { DiscoverPage } from './discover';

/* Discover, the home page (the prototype's index.html): what Cookfeed is, in a sentence and three steps, then three
   lists from the store: the plans and collections for sale (GET /api/products), the recipes home cooks save most
   (GET /api/feed?sort=Trending), and the creators (GET /api/creators). */
describe('Discover page', () => {
  const alex: Account = { id: 1, displayName: 'Alex Rivera', roles: ['HomeCook'], handle: null };

  const recipe = (id: number, title: string, saveCount: number): FeedItem => ({
    id,
    title,
    videoUrl: 'video',
    thumbnailUrl: `images/recipes/${id}.svg`,
    servings: 4,
    totalMinutes: 35,
    saveCount,
    publishedAt: '2026-08-01T12:00:00+00:00',
    creatorHandle: 'dan-meal-preps',
    creatorDisplayName: 'Dan Okafor',
    creatorIsVerified: false,
    savedByViewer: false,
  });

  const plan = (id: number, title: string, ownedByViewer = false): ProductTile => ({
    id,
    type: 'MealPlan',
    title,
    coverImageUrl: `images/products/${id}.svg`,
    priceCents: 1499,
    currency: 'USD',
    creatorHandle: 'dan-meal-preps',
    recipeCount: 5,
    mealCount: 6,
    rating: { reviewCount: 0, average: null, percentRecommend: null },
    ownedByViewer,
  });

  const creator = (handle: string, displayName: string): CreatorTile => ({
    handle,
    displayName,
    avatarUrl: `images/creators/${handle}.svg`,
    isVerified: true,
  });

  let fixture: ComponentFixture<DiscoverPage>;
  let page: HTMLElement;
  let http: HttpTestingController;
  let session: Session;

  async function show(signedInAs: Account | null = null): Promise<void> {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [DiscoverPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(Session);
    session.accounts.set([alex]);
    if (signedInAs !== null) {
      session.signIn(signedInAs.id);
    }
    fixture = TestBed.createComponent(DiscoverPage);
    await fixture.whenStable();
    page = fixture.nativeElement as HTMLElement;
  }

  async function trendingAnswers(items: FeedItem[]): Promise<void> {
    const request = http.expectOne((r) => r.url === '/api/feed');
    expect(request.request.params.get('sort')).toBe('Trending');
    expect(request.request.params.get('pageSize')).toBe('6');
    request.flush({ items, page: 1, pageSize: 6, hasMore: false } satisfies FeedPage);
    await fixture.whenStable();
  }

  async function plansAnswer(items: ProductTile[]): Promise<void> {
    http.expectOne('/api/products').flush(items);
    await fixture.whenStable();
  }

  async function creatorsAnswer(items: CreatorTile[]): Promise<void> {
    http.expectOne('/api/creators').flush(items);
    await fixture.whenStable();
  }

  const ids = (selector: string, attribute: string) =>
    Array.from(page.querySelectorAll(selector)).map((el) => el.getAttribute(attribute));

  it('says what Cookfeed is before anything else', async () => {
    await show();
    await trendingAnswers([]);

    expect(page.querySelector('h1')?.textContent).toContain('Cook the week, shop once');
    expect(page.querySelectorAll('h1').length).toBe(1);
    expect(page.querySelector('[data-greeting]')?.textContent).toContain('a shopping list built from what you cook');
  });

  it('greets a signed-in cook by first name', async () => {
    await show(alex);

    expect(page.querySelector('[data-greeting]')?.textContent?.trim()).toBe('Welcome back, Alex.');
  });

  it('explains how it works in three steps, in order', async () => {
    await show();
    await trendingAnswers([]);

    const steps = Array.from(page.querySelectorAll('[data-how-it-works] li h3')).map((h) => h.textContent?.trim());
    expect(steps).toEqual(['Watch', 'Plan', 'Shop once']);
  });

  it('leads to the plans and to the free recipes', async () => {
    await show();
    await trendingAnswers([]);

    const hrefs = Array.from(page.querySelectorAll('[data-hero] a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/plans', '/recipes']);
  });

  it('puts what is for sale first, then the free recipes, then the creators', async () => {
    await show();

    const headings = Array.from(page.querySelectorAll('h2')).map((h) => h.textContent?.trim());
    expect(headings).toEqual(['How Cookfeed works', 'Meal plans and collections', 'Trending recipes', 'Creators']);
  });

  it('lists the plans and collections for sale in the order the API sends them, newest first', async () => {
    await show();
    await plansAnswer([plan(4, 'Family Meal-Prep Week'), plan(1, 'Roman Pasta Night'), plan(3, 'Three Weeknights')]);

    expect(ids('[data-plans] [data-product-id]', 'data-product-id')).toEqual(['4', '1', '3']);
    expect(page.querySelector('[data-plans]')?.textContent).toContain('Buy once and keep it');
    expect(page.querySelector('[data-plans] a[href="/plans"]')?.textContent).toContain('See every plan and collection');
  });

  it('says so when nothing is for sale', async () => {
    await show();
    await plansAnswer([]);

    expect(page.querySelector('[data-plans]')?.textContent).toContain('Nothing is for sale right now');
  });

  it('asks for the plans again when the account changes, so what the viewer owns is never stale', async () => {
    await show();
    await plansAnswer([plan(4, 'Family Meal-Prep Week')]);
    expect(page.querySelector('[data-plans] [data-owned]')).toBeNull();

    session.signIn(alex.id);
    await fixture.whenStable();
    await plansAnswer([plan(4, 'Family Meal-Prep Week', true)]);

    expect(page.querySelector('[data-plans] [data-owned]')?.textContent).toContain('You own this');
    expect(page.querySelector('[data-greeting]')?.textContent).toContain('Welcome back, Alex.');
  });

  it('shows the trending recipes as cards that link to each recipe', async () => {
    await show();
    await trendingAnswers([recipe(18, 'Sheet-Pan Chicken and Vegetables', 7), recipe(14, 'Cacio e Pepe', 1)]);

    const cards = Array.from(page.querySelectorAll('[data-recipe-id]'));
    expect(cards.map((card) => card.getAttribute('data-recipe-id'))).toEqual(['18', '14']);
    expect(cards[0].querySelector('h3 a')?.getAttribute('href')).toBe('/recipes/18');
    expect(cards[0].querySelector('h3')?.textContent).toContain('Sheet-Pan Chicken and Vegetables');
    expect(cards[0].querySelector('img')?.getAttribute('src')).toBe('/images/recipes/18.svg');
    expect(cards[0].textContent).toContain('Serves 4');
    expect(cards[0].textContent).toContain('35 min');
    expect(cards[0].textContent).toContain('dan-meal-preps');
  });

  it('counts saves in words a first-time visitor understands', async () => {
    await show();
    await trendingAnswers([recipe(18, 'Sheet-Pan Chicken and Vegetables', 7), recipe(14, 'Cacio e Pepe', 1)]);

    const cards = Array.from(page.querySelectorAll('[data-recipe-id]'));
    expect(cards[0].textContent).toContain('saved by 7 cooks');
    expect(cards[1].textContent).toContain('saved by 1 cook');
    expect(cards[1].textContent).not.toContain('saved by 1 cooks');
  });

  it('lists the creators, each leading to a storefront', async () => {
    await show();
    await creatorsAnswer([creator('maria-cooks', 'Maria Conti'), creator('kenji-kitchen', 'Kenji Watanabe')]);

    expect(ids('[data-creators] [data-creator-handle]', 'data-creator-handle')).toEqual(['maria-cooks', 'kenji-kitchen']);
    expect(page.querySelector('[data-creators] a[href="/creators/kenji-kitchen"]')?.textContent).toContain('Kenji Watanabe');
  });

  it('says the recipes are loading, then that they could not be loaded, rather than showing nothing', async () => {
    await show();
    expect(page.querySelector('[data-trending] [role="status"]')?.textContent).toContain('Loading');

    http.expectOne((r) => r.url === '/api/feed').flush('down', { status: 503, statusText: 'Service Unavailable' });
    await fixture.whenStable();

    expect(page.querySelector('[data-trending] [role="alert"]')?.textContent).toContain('could not be loaded');
  });

  it('lets one list fail without taking the others with it', async () => {
    await show();
    expect(page.querySelector('[data-plans] [role="status"]')?.textContent).toContain('Loading');
    expect(page.querySelector('[data-creators] [role="status"]')?.textContent).toContain('Loading');

    http.expectOne('/api/products').flush('down', { status: 503, statusText: 'Service Unavailable' });
    await fixture.whenStable();
    await creatorsAnswer([creator('maria-cooks', 'Maria Conti')]);
    await trendingAnswers([recipe(18, 'Sheet-Pan Chicken and Vegetables', 7)]);

    expect(page.querySelector('[data-plans] [role="alert"]')?.textContent).toContain('could not be loaded');
    expect(page.querySelectorAll('[data-creators] [data-creator-handle]').length).toBe(1);
    expect(page.querySelectorAll('[data-trending] [data-recipe-id]').length).toBe(1);
  });

  it('has no accessibility violations a structural check can find', async () => {
    await show(alex);
    await plansAnswer([plan(4, 'Family Meal-Prep Week', true), plan(1, 'Roman Pasta Night')]);
    await trendingAnswers([recipe(18, 'Sheet-Pan Chicken and Vegetables', 7)]);
    await creatorsAnswer([creator('maria-cooks', 'Maria Conti')]);

    // Color contrast needs a real browser's rendering; the browser tests check it.
    const results = await axe.run(page, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });

    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
});
