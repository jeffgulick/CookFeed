import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import axe from 'axe-core';
import { Account, Purchase, SavedRecipe, Trips } from '../../core/api-types';
import { Notices } from '../../core/notices';
import { Session } from '../../core/session';
import { isoDay } from '../../ui/format';
import { KitchenPage } from './kitchen';

/* My kitchen (the prototype's kitchen.html): the plans a cook bought (GET /api/me/purchases) and the recipes they
   saved (GET /api/me/saves), each leading to its page, with Unsave on a saved recipe. */
describe('Kitchen page', () => {
  const alex: Account = { id: 1, displayName: 'Alex Rivera', roles: ['HomeCook'], handle: null };
  const admin: Account = { id: 6, displayName: 'Cookfeed Admin', roles: ['Admin'], handle: null };

  const purchase = (productId: number, title: string, extra: Partial<Purchase> = {}): Purchase => ({
    productId,
    type: 'MealPlan',
    title,
    coverImageUrl: `images/products/${productId}.svg`,
    purchasedAt: '2026-08-31T12:00:00+00:00',
    recipeCount: 3,
    mealCount: 3,
    recipes: [],
    ...extra,
  });
  const saved = (id: number, title: string): SavedRecipe => ({
    id,
    title,
    thumbnailUrl: `images/recipes/${id}.svg`,
    servings: 2,
    totalMinutes: 10,
    saveCount: 5,
    creatorHandle: 'maria-cooks',
    creatorIsVerified: true,
    visibility: 'Public',
    savedAt: '2026-08-17T12:00:00+00:00',
  });

  const noLists: Trips = { active: null, open: [], past: [] };

  let fixture: ComponentFixture<KitchenPage>;
  let page: HTMLElement;
  let http: HttpTestingController;
  let session: Session;

  async function show(signedInAs: Account | null, plans?: Purchase[], recipes?: SavedRecipe[], lists?: Trips): Promise<void> {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [KitchenPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(Session);
    session.accounts.set([alex, admin]);
    if (signedInAs !== null) {
      session.signIn(signedInAs.id);
    }
    fixture = TestBed.createComponent(KitchenPage);
    await fixture.whenStable();
    page = fixture.nativeElement as HTMLElement;
    if (plans !== undefined && recipes !== undefined) {
      await answer(plans, recipes, lists);
    }
  }

  async function answer(plans: Purchase[], recipes: SavedRecipe[], lists: Trips = noLists): Promise<void> {
    http.expectOne('/api/me/purchases').flush(plans);
    http.expectOne('/api/me/saves').flush(recipes);
    http.expectOne('/api/me/trips').flush(lists);
    await fixture.whenStable();
  }

  const text = (selector: string) => page.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
  const titles = (selector: string) =>
    Array.from(page.querySelectorAll(selector)).map((el) => el.textContent?.trim());

  it('says what the kitchen holds', async () => {
    await show(alex, [], []);

    expect(page.querySelectorAll('h1').length).toBe(1);
    expect(text('h1')).toBe('Your kitchen');
    expect(text('[data-kitchen-summary]')).toBe('Your shopping list, the plans you bought and the recipes you saved.');
    expect(titles('h2')).toEqual(['Your shopping list', 'Your plans', 'Saved recipes', 'Past lists']);
  });

  it('lists the plans the cook bought, as they were titled then, each leading to its page', async () => {
    await show(
      alex,
      [
        purchase(1, 'Roman Pasta Collection', { type: 'RecipeCollection', recipeCount: 4, mealCount: null }),
        purchase(4, 'Family Week on a Budget', { recipeCount: 5, mealCount: 6 }),
      ],
      [],
    );

    const plans = Array.from(page.querySelectorAll('[data-your-plans] [data-product-id]'));
    expect(plans.map((p) => p.querySelector('h3')?.textContent?.trim())).toEqual([
      'Roman Pasta Collection',
      'Family Week on a Budget',
    ]);
    expect(plans[0].querySelector('h3 a')?.getAttribute('href')).toBe('/plans/1');
    expect(plans[0].textContent).toContain('Recipe collection');
    expect(plans[0].textContent).toContain('4 recipes · yours to keep');
    expect(plans[1].textContent).toContain('Meal plan');
    expect(plans[1].textContent).toContain('5 recipes, 6 meals · yours to keep');
    expect(plans[1].querySelector('img')?.getAttribute('src')).toBe('/images/products/4.svg');
  });

  it('points a cook who has bought nothing to the plans', async () => {
    await show(alex, [], [saved(15, 'Caprese Salad')]);

    expect(text('[data-your-plans]')).toContain('You have not bought a plan yet.');
    expect(page.querySelector('[data-your-plans] a')?.getAttribute('href')).toBe('/plans');
  });

  it('lists the saved recipes in the order the API sends them, each with Unsave named for it', async () => {
    await show(alex, [], [saved(15, 'Caprese Salad'), saved(14, 'Cacio e Pepe')]);

    const cards = Array.from(page.querySelectorAll('[data-saved-recipes] [data-recipe-id]'));
    expect(cards.map((c) => c.querySelector('h3')?.textContent?.trim())).toEqual(['Caprese Salad', 'Cacio e Pepe']);
    expect(cards[0].querySelector('h3 a')?.getAttribute('href')).toBe('/recipes/15');
    expect(cards[0].textContent).toContain('by maria-cooks');
    const unsave = cards[0].querySelector('button');
    expect(unsave?.textContent?.trim()).toBe('Unsave');
    expect(unsave?.getAttribute('aria-label')).toBe('Unsave Caprese Salad');
  });

  it('tells a cook with nothing saved how saving works, and where the recipes are', async () => {
    await show(alex, [purchase(4, 'Family Week on a Budget')], []);

    expect(text('[data-saved-recipes]')).toContain('You have not saved any recipes yet.');
    expect(text('[data-saved-recipes]')).toContain('Press Save recipe on any recipe and it will appear here.');
    expect(page.querySelector('[data-saved-recipes] a')?.getAttribute('href')).toBe('/recipes');
  });

  it('unsaves a recipe, takes it off the list, and says so', async () => {
    await show(alex, [], [saved(15, 'Caprese Salad'), saved(14, 'Cacio e Pepe')]);

    page.querySelector<HTMLButtonElement>('[data-saved-recipes] [data-recipe-id] button')!.click();
    const request = http.expectOne('/api/me/saves/15');
    expect(request.request.method).toBe('DELETE');
    request.flush({ recipeId: 15, saved: false, saveCount: 4 });
    await fixture.whenStable();
    await new Promise((done) => setTimeout(done));
    // The list is read again, so it shows what is saved now.
    http.expectOne('/api/me/saves').flush([saved(14, 'Cacio e Pepe')]);
    await fixture.whenStable();

    expect(titles('[data-saved-recipes] [data-recipe-id] h3')).toEqual(['Cacio e Pepe']);
    expect(TestBed.inject(Notices).message()?.text).toBe('Caprese Salad is no longer saved.');
  });

  it('shows the list in use with how many recipes it cooks, and leads to it', async () => {
    const inUse = { id: 7, name: 'Shopping list, November 21', status: 'Shopping', createdAt: '2026-11-21T12:00:00+00:00', completedAt: null, recipeCount: 2 } as const;
    await show(alex, [], [], { active: inUse, open: [inUse], past: [] });

    expect(text('[data-your-list] h2')).toBe('Your shopping list');
    expect(text('[data-your-list]')).toContain('Shopping list, November 21');
    expect(text('[data-your-list]')).toContain('2 recipes · Shopping');
    const link = page.querySelector('[data-your-list] a');
    expect(link?.textContent?.trim()).toContain('Open list');
    expect(link?.getAttribute('href')).toBe('/list/7');
  });

  it('shows every list in use, newest first, each leading to its own list', async () => {
    const first = { id: 7, name: 'Shopping list, November 21', status: 'Shopping', createdAt: '2026-11-21T12:00:00+00:00', completedAt: null, recipeCount: 2 } as const;
    const second = { ...first, id: 8, name: 'Shopping list, November 21 (2)', status: 'Building', recipeCount: 1 } as const;
    await show(alex, [], [], { active: second, open: [second, first], past: [] });

    expect(text('[data-your-list] h2')).toBe('Your shopping lists');
    const cards = Array.from(page.querySelectorAll('[data-your-list] [data-open-list]'));
    expect(cards.map((card) => card.querySelector('strong')?.textContent?.trim())).toEqual([
      'Shopping list, November 21 (2)',
      'Shopping list, November 21',
    ]);
    expect(cards.map((card) => card.querySelector('.meta')?.textContent?.trim())).toEqual(['1 recipe · Building', '2 recipes · Shopping']);
    expect(cards.map((card) => card.querySelector('a')?.getAttribute('href'))).toEqual(['/list/8', '/list/7']);
    // Each link says which list it opens, for a screen reader moving from link to link.
    expect(cards.map((card) => card.querySelector('a')?.textContent?.replace(/\s*→$/, '').trim())).toEqual([
      'Open list: Shopping list, November 21 (2)',
      'Open list: Shopping list, November 21',
    ]);
  });

  it('tells a cook with no list how to start one', async () => {
    await show(alex, [], []);

    expect(text('[data-your-list]')).toContain('You have no shopping list yet.');
    expect(text('[data-your-list]')).toContain('Press Shop this recipe on a recipe, or Shop this plan on a plan you own.');
    expect(text('[data-past-lists]')).toContain('Lists you finish are kept here.');
  });

  it('keeps the finished lists in a table, each leading to its list', async () => {
    await show(alex, [], [], {
      active: null,
      open: [],
      past: [
        { id: 7, name: 'Shopping list, November 21', status: 'Done', createdAt: '2026-11-21T12:00:00+00:00', completedAt: '2026-11-22T12:00:00+00:00', recipeCount: 2 },
      ],
    });

    // The fifth column holds Shop again; its heading is read out, not shown.
    expect(titles('[data-past-lists] th')).toEqual(['List', 'Made', 'Recipes', 'Status', 'Actions']);
    const cells = titles('[data-past-lists] tbody td');
    expect(cells).toEqual(['Shopping list, November 21', 'November 21, 2026', '2', 'Done November 22, 2026', 'Shop again']);
    expect(page.querySelector('[data-past-lists] tbody a')?.getAttribute('href')).toBe('/list/7');
  });

  it('shops a finished list again: makes a new list from it, says so, and opens it', async () => {
    await show(alex, [], [], {
      active: null,
      open: [],
      past: [
        { id: 7, name: 'Shopping list, November 21', status: 'Done', createdAt: '2026-11-21T12:00:00+00:00', completedAt: '2026-11-22T12:00:00+00:00', recipeCount: 2 },
      ],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const again = page.querySelector<HTMLButtonElement>('[data-past-lists] tbody button')!;
    expect(again.getAttribute('aria-label')).toBe('Shop again: Shopping list, November 21');

    again.click();
    const request = http.expectOne('/api/me/trips/7/again');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ today: isoDay(new Date()) });
    request.flush({ tripId: 9, tripName: 'Shopping list, November 23', created: true, added: 2, alreadyOnList: 0 });
    await new Promise((done) => setTimeout(done));

    expect(TestBed.inject(Notices).message()?.text).toBe('2 recipes are on a new list.');
    expect(navigate).toHaveBeenCalledWith(['/list', 9]);
  });

  it('says why when a finished list cannot be shopped again', async () => {
    await show(alex, [], [], {
      active: null,
      open: [],
      past: [
        { id: 7, name: 'Shopping list, November 21', status: 'Done', createdAt: '2026-11-21T12:00:00+00:00', completedAt: '2026-11-22T12:00:00+00:00', recipeCount: 2 },
      ],
    });

    page.querySelector<HTMLButtonElement>('[data-past-lists] tbody button')!.click();
    http.expectOne('/api/me/trips/7/again').flush(
      { title: 'Not found', detail: 'There is no such list, or nothing there that you can cook from.' },
      { status: 404, statusText: 'Not Found' },
    );
    await new Promise((done) => setTimeout(done));

    const notice = TestBed.inject(Notices).message();
    expect(notice?.kind).toBe('problem');
    expect(notice?.text).toBe('There is no such list, or nothing there that you can cook from.');
  });

  it('asks a visitor to sign in, and says where to come back to', async () => {
    await show(null);

    const link = page.querySelector('[data-no-kitchen] a');
    expect(link?.textContent?.trim()).toBe('Sign in to see your kitchen');
    expect(link?.getAttribute('href')).toBe('/sign-in?next=%2Fkitchen');
    http.expectNone('/api/me/purchases');
    http.expectNone('/api/me/saves');
  });

  it('tells the admin that admin accounts have no kitchen', async () => {
    await show(admin);

    expect(text('[data-no-kitchen]')).toBe('Admin accounts do not save recipes or shop.');
    http.expectNone('/api/me/saves');
  });

  it('reads the kitchen again when the account changes', async () => {
    await show(null);

    session.signIn(alex.id);
    await fixture.whenStable();
    await answer([purchase(4, 'Family Week on a Budget')], [saved(15, 'Caprese Salad')]);

    expect(page.querySelectorAll('[data-your-plans] [data-product-id]').length).toBe(1);
    expect(page.querySelectorAll('[data-saved-recipes] [data-recipe-id]').length).toBe(1);
  });

  it('says each list is loading, then that it could not be loaded, without taking the other with it', async () => {
    await show(alex);
    expect(page.querySelector('[data-your-plans] [role="status"]')?.textContent).toContain('Loading');

    http.expectOne('/api/me/purchases').flush('down', { status: 503, statusText: 'Service Unavailable' });
    http.expectOne('/api/me/saves').flush([saved(15, 'Caprese Salad')]);
    http.expectOne('/api/me/trips').flush(noLists);
    await fixture.whenStable();

    expect(page.querySelector('[data-your-plans] [role="alert"]')?.textContent).toContain('could not be loaded');
    expect(page.querySelectorAll('[data-saved-recipes] [data-recipe-id]').length).toBe(1);
  });

  it('has no accessibility violations a structural check can find', async () => {
    await show(alex, [purchase(4, 'Family Week on a Budget')], [saved(15, 'Caprese Salad'), saved(14, 'Cacio e Pepe')]);

    const results = await axe.run(page, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });

    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
});
