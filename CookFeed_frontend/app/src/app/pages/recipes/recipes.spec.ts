import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import axe from 'axe-core';
import { FeedItem, FeedPage, FeedSort } from '../../core/api-types';
import { RecipesPage } from './recipes';

/* The Recipes page (the prototype's recipes.html): every free recipe (GET /api/feed), most saved first or newest
   first, with a search the API runs over the title and the creator. */
describe('Recipes page', () => {
  const recipe = (id: number, title: string, creatorHandle = 'maria-cooks'): FeedItem => ({
    id,
    title,
    videoUrl: 'video',
    thumbnailUrl: `images/recipes/${id}.svg`,
    servings: 2,
    totalMinutes: 20,
    saveCount: 5,
    publishedAt: '2026-07-15T12:00:00+00:00',
    creatorHandle,
    creatorDisplayName: 'Maria Conti',
    creatorIsVerified: true,
    savedByViewer: false,
  });

  let fixture: ComponentFixture<RecipesPage>;
  let page: HTMLElement;
  let http: HttpTestingController;

  async function show(): Promise<void> {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [RecipesPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(RecipesPage);
    await fixture.whenStable();
    page = fixture.nativeElement as HTMLElement;
  }

  /** The page's one open request for recipes, after checking what it asked for. */
  function asked(sort: FeedSort, search: string | null): TestRequest {
    const request = http.expectOne((r) => r.url === '/api/feed');
    expect(request.request.params.get('sort')).toBe(sort);
    expect(request.request.params.get('pageSize')).toBe('50');
    expect(request.request.params.get('search')).toBe(search);
    return request;
  }

  async function answer(request: TestRequest, items: FeedItem[], hasMore = false): Promise<void> {
    request.flush({ items, page: 1, pageSize: 50, hasMore } satisfies FeedPage);
    await fixture.whenStable();
  }

  /** Types into Find, as a cook would: the box's value changes and an input event follows. */
  function type(text: string): void {
    const box = page.querySelector<HTMLInputElement>('#recipeSearch')!;
    box.value = text;
    box.dispatchEvent(new Event('input'));
  }

  /** Waits out the pause the page leaves after the last key before it searches. */
  async function pause(): Promise<void> {
    await new Promise((done) => setTimeout(done, RecipesPage.SearchPauseMs + 30));
    await fixture.whenStable();
  }

  const titles = () => Array.from(page.querySelectorAll('[data-recipe-id] h3')).map((h) => h.textContent?.trim());
  const showing = () => page.querySelector('[data-showing]')?.textContent?.trim();
  const button = (label: string) =>
    Array.from(page.querySelectorAll<HTMLButtonElement>('[data-sorts] button')).find(
      (b) => b.textContent?.trim() === label,
    )!;

  it('says what the page lists, and where the premium recipes are', async () => {
    await show();

    expect(page.querySelectorAll('h1').length).toBe(1);
    expect(page.querySelector('h1')?.textContent).toContain('Free recipes');
    expect(page.textContent).toContain('Every free recipe on Cookfeed, yours to open and save.');
    expect(page.querySelector('[data-lede] a[href="/plans"]')?.textContent).toContain('meal plans and collections');
  });

  it('lists the free recipes most saved first, as cards that say who made each', async () => {
    await show();
    await answer(asked('Trending', null), [recipe(14, 'Cacio e Pepe'), recipe(16, 'Tamagoyaki', 'kenji-kitchen')]);

    expect(titles()).toEqual(['Cacio e Pepe', 'Tamagoyaki']);
    expect(page.querySelectorAll('[data-recipe-id]')[1].textContent).toContain('by kenji-kitchen');
    expect(page.querySelector('[data-recipe-id] h3 a')?.getAttribute('href')).toBe('/recipes/14');
    expect(showing()).toBe('2 free recipes');
    expect(button('Most saved').getAttribute('aria-pressed')).toBe('true');
    expect(button('Newest').getAttribute('aria-pressed')).toBe('false');
  });

  it('counts one recipe as "1 free recipe"', async () => {
    await show();
    await answer(asked('Trending', null), [recipe(14, 'Cacio e Pepe')]);

    expect(showing()).toBe('1 free recipe');
  });

  it('asks the API for the newest first when Newest is pressed', async () => {
    await show();
    await answer(asked('Trending', null), [recipe(14, 'Cacio e Pepe'), recipe(15, 'Caprese Salad')]);

    button('Newest').click();
    await fixture.whenStable();
    await answer(asked('Newest', null), [recipe(15, 'Caprese Salad'), recipe(14, 'Cacio e Pepe')]);

    expect(titles()).toEqual(['Caprese Salad', 'Cacio e Pepe']);
    expect(button('Newest').getAttribute('aria-pressed')).toBe('true');
    expect(button('Most saved').getAttribute('aria-pressed')).toBe('false');
  });

  it('searches once the typing pauses, without the spaces around the text', async () => {
    await show();
    await answer(asked('Trending', null), [recipe(14, 'Cacio e Pepe'), recipe(15, 'Caprese Salad')]);

    type('c');
    type('ca');
    type(' cap ');
    await pause();
    await answer(asked('Trending', 'cap'), [recipe(15, 'Caprese Salad')]);

    expect(titles()).toEqual(['Caprese Salad']);
    expect(showing()).toBe('1 free recipe');
  });

  it('keeps the search when the order changes, and shows everything again when the box is cleared', async () => {
    await show();
    await answer(asked('Trending', null), [recipe(14, 'Cacio e Pepe')]);
    type('maria');
    await pause();
    await answer(asked('Trending', 'maria'), [recipe(14, 'Cacio e Pepe')]);

    button('Newest').click();
    await fixture.whenStable();
    await answer(asked('Newest', 'maria'), [recipe(14, 'Cacio e Pepe')]);

    type('');
    await pause();
    await answer(asked('Newest', null), [recipe(14, 'Cacio e Pepe'), recipe(15, 'Caprese Salad')]);

    expect(titles().length).toBe(2);
  });

  it('says so when no free recipe matches', async () => {
    await show();
    await answer(asked('Trending', null), [recipe(14, 'Cacio e Pepe')]);
    type('teriyaki');
    await pause();
    await answer(asked('Trending', 'teriyaki'), []);

    expect(page.textContent).toContain('No free recipe matches.');
    expect(page.querySelectorAll('[data-recipe-id]').length).toBe(0);
    expect(showing()).toBe('0 free recipes');
  });

  it('says when there are more recipes than one page holds', async () => {
    await show();
    await answer(asked('Trending', null), [recipe(14, 'Cacio e Pepe'), recipe(15, 'Caprese Salad')], true);

    expect(showing()).toBe('The first 2 free recipes. Search to narrow them.');
  });

  it('names the search box, and ties it to the count a screen reader hears', async () => {
    await show();

    const box = page.querySelector<HTMLInputElement>('#recipeSearch')!;
    expect(page.querySelector('label[for="recipeSearch"]')?.textContent).toContain('Find');
    expect(box.getAttribute('placeholder')).toBe('a recipe or a creator');
    expect(box.getAttribute('aria-describedby')).toBe(page.querySelector('[data-showing]')?.id);
    expect(page.querySelector('[data-showing]')?.getAttribute('aria-live')).toBe('polite');
  });

  it('says the recipes are loading, then that they could not be loaded', async () => {
    await show();
    expect(page.querySelector('[role="status"]')?.textContent).toContain('Loading');

    asked('Trending', null).flush('down', { status: 503, statusText: 'Service Unavailable' });
    await fixture.whenStable();

    expect(page.querySelector('[role="alert"]')?.textContent).toContain('could not be loaded');
  });

  it('has no accessibility violations a structural check can find', async () => {
    await show();
    await answer(asked('Trending', null), [recipe(14, 'Cacio e Pepe'), recipe(15, 'Caprese Salad')]);

    // Color contrast needs a real browser's rendering; the browser tests check it.
    const results = await axe.run(page, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });

    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
});
