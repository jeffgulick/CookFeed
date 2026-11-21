import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import axe from 'axe-core';
import { FeedItem, FeedPage } from '../../core/api-types';
import { DiscoverPage } from './discover';

/* Discover, the home page (the prototype's index.html): what Cookfeed is, in a sentence and three steps, and the
   recipes home cooks save most, from GET /api/feed?sort=Trending. */
describe('Discover page', () => {
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

  let fixture: ComponentFixture<DiscoverPage>;
  let page: HTMLElement;
  let http: HttpTestingController;

  async function show(): Promise<void> {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [DiscoverPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
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

  it('says what Cookfeed is before anything else', async () => {
    await show();
    await trendingAnswers([]);

    expect(page.querySelector('h1')?.textContent).toContain('Cook the week, shop once');
    expect(page.querySelectorAll('h1').length).toBe(1);
    expect(page.textContent).toContain('a shopping list built from what you cook');
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

  it('says the recipes are loading, then that they could not be loaded, rather than showing nothing', async () => {
    await show();
    expect(page.querySelector('[data-trending] [role="status"]')?.textContent).toContain('Loading');

    http.expectOne((r) => r.url === '/api/feed').flush('down', { status: 503, statusText: 'Service Unavailable' });
    await fixture.whenStable();

    expect(page.querySelector('[data-trending] [role="alert"]')?.textContent).toContain('could not be loaded');
  });

  it('has no accessibility violations a structural check can find', async () => {
    await show();
    await trendingAnswers([recipe(18, 'Sheet-Pan Chicken and Vegetables', 7)]);

    // Color contrast needs a real browser's rendering; the browser tests check it.
    const results = await axe.run(page, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });

    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
});
