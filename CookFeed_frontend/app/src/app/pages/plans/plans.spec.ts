import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import axe from 'axe-core';
import { Account, ProductSort, ProductTile, ProductType } from '../../core/api-types';
import { Session } from '../../core/session';
import { PlansPage } from './plans';

/* The Plans page (the prototype's plans.html): every meal plan and collection for sale (GET /api/products), with a
   filter by kind and a sort. The API sorts; the page filters what it was sent, so it can say "2 of 4". */
describe('Plans page', () => {
  const alex: Account = { id: 1, displayName: 'Alex Rivera', roles: ['HomeCook'], handle: null };

  const plan = (id: number, title: string, type: ProductType, ownedByViewer = false): ProductTile => ({
    id,
    type,
    title,
    coverImageUrl: `images/products/${id}.svg`,
    priceCents: 999,
    currency: 'USD',
    creatorHandle: 'dan-meal-preps',
    recipeCount: 3,
    mealCount: type === 'MealPlan' ? 3 : null,
    rating: { reviewCount: 0, average: null, percentRecommend: null },
    ownedByViewer,
  });

  const three = [
    plan(4, 'Family Week on a Budget', 'MealPlan'),
    plan(2, 'The Bread Box', 'RecipeCollection'),
    plan(1, 'Roman Pasta Collection', 'RecipeCollection'),
  ];

  let fixture: ComponentFixture<PlansPage>;
  let page: HTMLElement;
  let http: HttpTestingController;
  let session: Session;

  async function show(signedInAs: Account | null = null): Promise<void> {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [PlansPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(Session);
    session.accounts.set([alex]);
    if (signedInAs !== null) {
      session.signIn(signedInAs.id);
    }
    fixture = TestBed.createComponent(PlansPage);
    await fixture.whenStable();
    page = fixture.nativeElement as HTMLElement;
  }

  /** Answers the page's one request for the plans, after checking the order it asked for. */
  async function answer(items: ProductTile[], sort: ProductSort = 'Newest'): Promise<void> {
    const request = http.expectOne((r) => r.url === '/api/products');
    expect(request.request.params.get('sort')).toBe(sort);
    expect(request.request.params.has('type')).toBe(false);
    request.flush(items);
    await fixture.whenStable();
  }

  const titles = () => Array.from(page.querySelectorAll('[data-product-id] h3')).map((h) => h.textContent?.trim());
  const button = (label: string) =>
    Array.from(page.querySelectorAll<HTMLButtonElement>('[data-kinds] button')).find(
      (b) => b.textContent?.trim() === label,
    )!;
  const showing = () => page.querySelector('[data-showing]')?.textContent?.trim();

  async function press(label: string): Promise<void> {
    button(label).click();
    await fixture.whenStable();
  }

  async function sortBy(value: ProductSort): Promise<void> {
    const select = page.querySelector<HTMLSelectElement>('#planSort')!;
    select.value = value;
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
  }

  it('says what the page is and what buying a plan gets you', async () => {
    await show();

    expect(page.querySelectorAll('h1').length).toBe(1);
    expect(page.querySelector('h1')?.textContent).toContain('Meal plans and collections');
    expect(page.textContent).toContain('Buy once and keep it');
  });

  it('lists everything for sale in the order the API sends it, and says how many', async () => {
    await show();
    await answer(three);

    expect(titles()).toEqual(['Family Week on a Budget', 'The Bread Box', 'Roman Pasta Collection']);
    expect(showing()).toBe('Showing all 3 plans');
    expect(button('All').getAttribute('aria-pressed')).toBe('true');
    expect(button('Meal plans').getAttribute('aria-pressed')).toBe('false');
  });

  it('counts one plan as "1 plan"', async () => {
    await show();
    await answer([three[0]]);

    expect(showing()).toBe('Showing all 1 plan');
  });

  it('narrows to meal plans or to collections without asking the API again', async () => {
    await show();
    await answer(three);

    await press('Meal plans');
    expect(titles()).toEqual(['Family Week on a Budget']);
    expect(showing()).toBe('Showing 1 of 3');
    expect(button('Meal plans').getAttribute('aria-pressed')).toBe('true');
    expect(button('All').getAttribute('aria-pressed')).toBe('false');

    await press('Collections');
    expect(titles()).toEqual(['The Bread Box', 'Roman Pasta Collection']);
    expect(showing()).toBe('Showing 2 of 3');

    await press('All');
    expect(titles().length).toBe(3);
    http.verify();
  });

  it('asks the API for another order, and keeps the filter', async () => {
    await show();
    await answer(three);
    await press('Collections');

    await sortBy('Price');
    await answer([three[2], three[0], three[1]], 'Price');

    expect(titles()).toEqual(['Roman Pasta Collection', 'The Bread Box']);

    await sortBy('Rating');
    await answer(three, 'Rating');
  });

  it('offers the three orders by name', async () => {
    await show();

    const options = Array.from(page.querySelectorAll('#planSort option')).map((o) => o.textContent?.trim());
    expect(options).toEqual(['Newest', 'Price, low to high', 'Best rated']);
    expect(page.querySelector('label[for="planSort"]')?.textContent).toContain('Sort by');
  });

  it('says so when a group has nothing for sale', async () => {
    await show();
    await answer([three[1]]);

    await press('Meal plans');

    expect(page.textContent).toContain('Nothing for sale in this group right now.');
    expect(showing()).toBe('Showing 0 of 1');
  });

  it('reads the plans again when the account changes, so what the viewer owns is never stale', async () => {
    await show();
    await answer(three);
    expect(page.querySelector('[data-owned]')).toBeNull();

    session.signIn(alex.id);
    await fixture.whenStable();
    await answer([plan(4, 'Family Week on a Budget', 'MealPlan', true)]);

    expect(page.querySelector('[data-owned]')?.textContent).toContain('You own this');
  });

  it('says the plans are loading, then that they could not be loaded', async () => {
    await show();
    expect(page.querySelector('[role="status"]')?.textContent).toContain('Loading');

    http.expectOne((r) => r.url === '/api/products').flush('down', { status: 503, statusText: 'Service Unavailable' });
    await fixture.whenStable();

    expect(page.querySelector('[role="alert"]')?.textContent).toContain('could not be loaded');
    expect(page.querySelector('[data-showing]')?.textContent?.trim() ?? '').toBe('');
  });

  it('has no accessibility violations a structural check can find', async () => {
    await show(alex);
    await answer(three);

    // Color contrast needs a real browser's rendering; the browser tests check it.
    const results = await axe.run(page, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });

    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
});
