import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import axe from 'axe-core';
import { Account, ProductDetail, ProductRecipe, ProductShoppingList } from '../../core/api-types';
import { Notices } from '../../core/notices';
import { Session } from '../../core/session';
import { isoDay } from '../../ui/format';
import { PlanPage } from './plan';

/* A meal plan or collection's page (the prototype's product.html?id=). What it shows follows where the viewer
   stands with it (buyState): someone deciding gets the price and the pitch; a buyer gets the recipes opened and
   the list; the creator, the admin and a plan off sale get the plan without a pitch. From GET /api/products/{id}
   and GET /api/products/{id}/shopping-list. */
describe('Plan page', () => {
  const alex: Account = { id: 1, displayName: 'Alex Rivera', roles: ['HomeCook'], handle: null };
  const kenji: Account = { id: 4, displayName: 'Kenji Watanabe', roles: ['HomeCook', 'Creator'], handle: 'kenji-kitchen' };
  const admin: Account = { id: 6, displayName: 'Cookfeed Admin', roles: ['Admin'], handle: null };

  const locked = (sortOrder: number, dayOffset: number | null, title: string): ProductRecipe => ({
    sortOrder,
    dayOffset,
    slot: dayOffset === null ? null : 'Dinner',
    title,
    thumbnailUrl: `images/recipes/${sortOrder}.svg`,
    servings: 2,
    totalMinutes: 20,
    visibility: 'ProductOnly',
    canOpen: false,
    details: null,
  });

  const open = (recipe: ProductRecipe, recipeId: number): ProductRecipe => ({
    ...recipe,
    canOpen: true,
    details: {
      recipeId,
      prepMinutes: 5,
      cookMinutes: 15,
      ingredientCount: 7,
      stepCount: 3,
      firstStep: 'Sear the thighs skin-side down.',
      saveCount: 3,
      savedByViewer: false,
      ownedThrough: 'Three Weeknights in Japan',
    },
  });

  const teriyaki = locked(1, 0, 'Chicken Teriyaki');
  const stirFry = locked(2, 1, 'Ginger Garlic Stir-Fry');
  const onigiri = locked(3, 3, 'Onigiri Three Ways');

  const plan: ProductDetail = {
    id: 3,
    type: 'MealPlan',
    title: 'Three Weeknights in Japan',
    description: 'Three dinners, one shopping trip.',
    coverImageUrl: 'images/products/3.svg',
    priceCents: 1299,
    currency: 'USD',
    creator: { handle: 'kenji-kitchen', displayName: 'Kenji Watanabe', isVerified: true },
    recipeCount: 3,
    mealCount: 3,
    rating: { reviewCount: 3, average: 4, percentRecommend: 67 },
    isForSale: true,
    ownedByViewer: false,
    viewerIsCreator: false,
    inCart: false,
    recipes: [teriyaki, stirFry, onigiri],
  };

  const owned: ProductDetail = {
    ...plan,
    ownedByViewer: true,
    recipes: [open(teriyaki, 5), open(stirFry, 7), open(onigiri, 6)],
  };

  const nothingListed: ProductShoppingList = {
    lines: [],
    fromRecipes: [],
    lockedRecipes: ['Chicken Teriyaki', 'Ginger Garlic Stir-Fry', 'Onigiri Three Ways'],
  };

  const fullList: ProductShoppingList = {
    lines: [
      { ingredientId: 24, ingredient: 'sake', aisle: 'Beverages', quantity: 2, unit: 'tbsp' },
      { ingredientId: 19, ingredient: 'chicken thigh', aisle: 'Meat', quantity: 500, unit: 'g' },
      { ingredientId: 8, ingredient: 'olive oil', aisle: 'Pantry', quantity: 0.666, unit: 'c' },
      { ingredientId: 9, ingredient: 'rice', aisle: 'Pantry', quantity: 2.5, unit: 'c' },
    ],
    fromRecipes: ['Chicken Teriyaki', 'Ginger Garlic Stir-Fry', 'Onigiri Three Ways'],
    lockedRecipes: [],
  };

  let harness: RouterTestingHarness;
  let page: HTMLElement;
  let http: HttpTestingController;

  async function openPage(signedInAs: Account | null = null): Promise<void> {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'plans/:id', component: PlanPage }]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    const session = TestBed.inject(Session);
    session.accounts.set([alex, kenji, admin]);
    if (signedInAs !== null) {
      session.signIn(signedInAs.id);
    }
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/plans/3', PlanPage);
    page = harness.routeNativeElement as HTMLElement;
  }

  async function show(product: ProductDetail, list: ProductShoppingList, signedInAs: Account | null = null): Promise<void> {
    await openPage(signedInAs);
    http.expectOne('/api/products/3').flush(product);
    http.expectOne('/api/products/3/shopping-list').flush(list);
    await harness.fixture.whenStable();
  }

  const text = (selector: string) => page.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const texts = (selector: string) =>
    Array.from(page.querySelectorAll(selector)).map((el) => el.textContent?.replace(/\s+/g, ' ').trim());

  it('says what the plan is and who sells it', async () => {
    await show(plan, nothingListed);

    expect(text('h1')).toBe('Three Weeknights in Japan');
    expect(page.querySelectorAll('h1').length).toBe(1);
    expect(text('[data-plan-head] .pill')).toBe('Meal plan');
    expect(text('[data-plan-head]')).toContain('Three dinners, one shopping trip.');
    expect(text('[data-byline]')).toContain('by kenji-kitchen (Verified creator)');
    expect(page.querySelector('[data-byline] a[href="/creators/kenji-kitchen"]')?.textContent?.trim()).toBe('kenji-kitchen');
    expect(page.querySelector('[data-plan-head] img')?.getAttribute('src')).toBe('/images/products/3.svg');
    expect(page.querySelector('[data-plan-head] img')?.getAttribute('alt')).toBe('Cover of Three Weeknights in Japan');
    expect(TestBed.inject(Title).getTitle()).toBe('Three Weeknights in Japan | Cookfeed');
  });

  it('links the rating to the reviews, and says so when there are none', async () => {
    await show(plan, nothingListed);
    expect(text('[data-byline] a[href="/plans/3/reviews"]')).toBe('Rated ★ 4.0 out of 5 (3 reviews)');

    TestBed.resetTestingModule();
    await show({ ...plan, rating: { reviewCount: 0, average: null, percentRecommend: null } }, nothingListed);
    expect(text('[data-byline] a[href="/plans/3/reviews"]')).toBe('no reviews yet');
  });

  it('shows someone deciding the price, what it covers, and a way to buy', async () => {
    await show(plan, nothingListed);

    expect(text('[data-price]')).toBe('$12.99');
    expect(text('[data-price-note]')).toBe('One-time purchase · yours to keep · 3 recipes');
    expect(text('app-buy-area')).toBe('Sign in to buy');
    expect(text('[data-reviews-prompt]')).toContain('See what other home cooks thought of this plan');
    expect(page.querySelector('[data-reviews-prompt] a')?.getAttribute('href')).toBe('/plans/3/reviews');
  });

  it('tells someone deciding what a meal plan gets them', async () => {
    await show(plan, nothingListed);

    expect(text('[data-what-you-get] h2')).toBe('What your $12.99 gets you');
    const items = texts('[data-what-you-get] li');
    expect(items.length).toBe(5);
    expect(items[0]).toContain('3 full cooking videos.');
    expect(items[1]).toContain('Every ingredient for all 3 meals, combined and sorted by aisle.');
    expect(items[2]).toContain('Meals on Monday, Tuesday and Thursday');
    expect(items[3]).toContain('Every recipe in this plan is premium');
    expect(items[4]).toContain('No subscription, and the plan stays in your account.');
  });

  it('words the pitch for a collection, which has no days', async () => {
    const collection = { ...plan, type: 'RecipeCollection' as const, mealCount: null, recipes: [locked(1, null, 'Focaccia')], recipeCount: 1 };
    await show(collection, { ...nothingListed, lockedRecipes: ['Focaccia'] });

    const items = texts('[data-what-you-get] li');
    expect(items[0]).toContain('1 full cooking video.');
    expect(items[1]).toContain('Every ingredient for every recipe,');
    expect(items[2]).toContain('Chosen by Kenji Watanabe, in the order they would cook them.');
    expect(items[4]).toContain('the collection stays in your account');
    expect(text('[data-what-you-buy]')).toContain('Buy it and every ingredient for all 1 recipe is listed here');
    expect(page.querySelector('[data-included] [data-label]')).toBeNull();
  });

  it('shows each locked recipe on its day, with no link and what unlocks it', async () => {
    await show(plan, nothingListed);

    expect(texts('[data-included] [data-label]')).toEqual(['Monday dinner', 'Tuesday dinner', 'Thursday dinner']);
    expect(texts('[data-included] h3')).toEqual(['Chicken Teriyaki', 'Ginger Garlic Stir-Fry', 'Onigiri Three Ways']);
    expect(texts('[data-included] [data-locked]')).toEqual(Array(3).fill('Included when you buy the plan'));
    expect(page.querySelectorAll('[data-included] a').length).toBe(0);
    expect(text('[data-included] [data-plan-recipe]')).toContain('Serves 2 · 20 min');
  });

  it('tells someone deciding what the list will hold, instead of an empty table', async () => {
    await show(plan, nothingListed);

    expect(text('[data-what-you-buy]')).toContain(
      'Buy it and every ingredient for all 3 meals is listed here, combined, sorted by aisle.',
    );
    expect(page.querySelector('[data-what-you-buy] table')).toBeNull();
  });

  it('shows a buyer the recipes opened, with a quick look at each, and no price or pitch', async () => {
    await show(owned, fullList, alex);

    expect(text('app-buy-area')).toContain('You own this plan');
    expect(page.querySelector('[data-price]')).toBeNull();
    expect(page.querySelector('[data-price-note]')).toBeNull();
    expect(page.querySelector('[data-what-you-get]')).toBeNull();
    expect(page.querySelector('[data-reviews-prompt]')).toBeNull();

    const first = '[data-included] [data-plan-recipe]';
    expect(page.querySelector(`${first} h3 a`)?.getAttribute('href')).toBe('/recipes/5?product=3');
    expect(text(first)).toContain('5 min prep · 15 min cook');
    expect(text(first)).toContain('7 ingredients · 3 steps');
    expect(text(first)).toContain('First: Sear the thighs skin-side down.');
    expect(text(first)).toContain('Yours through Three Weeknights in Japan');
    expect(text(first)).toContain('saved by 3 cooks');
    expect(page.querySelector('[data-included] [data-locked]')).toBeNull();
  });

  it('lists what a buyer will buy: amount, ingredient and aisle, as the API sorted them', async () => {
    await show(owned, fullList, alex);

    expect(text('[data-what-you-buy]')).toContain('For Chicken Teriyaki, Ginger Garlic Stir-Fry and Onigiri Three Ways.');
    expect(text('[data-what-you-buy]')).toContain('Amounts as each recipe is written.');
    expect(texts('[data-what-you-buy] thead th')).toEqual(['Amount', 'Ingredient', 'Aisle']);
    expect(texts('[data-what-you-buy] tbody [data-amount]')).toEqual(['2 tbsp', '500 g', '0.67 c', '2.5 c']);
    expect(texts('[data-what-you-buy] tbody [data-ingredient]')).toEqual(['sake', 'chicken thigh', 'olive oil', 'rice']);
    expect(texts('[data-what-you-buy] tbody [data-aisle]')).toEqual(['Beverages', 'Meat', 'Pantry', 'Pantry']);
    expect(page.querySelector('[data-not-on-list]')).toBeNull();
  });

  it('names the recipes that are not on the list yet', async () => {
    const some = { ...plan, recipes: [open(teriyaki, 5), stirFry, onigiri] };
    await show(some, { ...fullList, fromRecipes: ['Chicken Teriyaki'], lockedRecipes: ['Ginger Garlic Stir-Fry', 'Onigiri Three Ways'] }, alex);
    expect(text('[data-not-on-list]')).toBe(
      'Not on this list yet: Ginger Garlic Stir-Fry and Onigiri Three Ways. Their ingredients are added when you buy the plan.',
    );

    TestBed.resetTestingModule();
    await show(some, { ...fullList, fromRecipes: ['Chicken Teriyaki'], lockedRecipes: ['Onigiri Three Ways'] }, alex);
    expect(text('[data-not-on-list]')).toBe(
      'Not on this list yet: Onigiri Three Ways. Its ingredients are added when you buy the plan.',
    );
  });

  it('shows the creator their own plan with its price and no pitch', async () => {
    await show({ ...owned, ownedByViewer: false, viewerIsCreator: true }, fullList, kenji);

    expect(text('[data-price]')).toBe('$12.99');
    expect(text('app-buy-area')).toBe("This is your plan. Creators can't buy their own.");
    expect(page.querySelector('[data-price-note]')).toBeNull();
    expect(page.querySelector('[data-what-you-get]')).toBeNull();
    expect(page.querySelector('[data-what-you-buy] table')).not.toBeNull();
  });

  it('shows the admin, who cannot shop, no price, no list, and the premium recipes closed', async () => {
    await show(plan, nothingListed, admin);

    expect(text('app-buy-area')).toBe('');
    expect(page.querySelector('[data-price]')).toBeNull();
    expect(page.querySelector('[data-what-you-get]')).toBeNull();
    expect(page.querySelector('[data-what-you-buy]')).toBeNull();
    expect(texts('[data-included] [data-locked]')).toEqual(Array(3).fill('Premium recipe'));
  });

  it('says a plan is no longer for sale, without a pitch or a list', async () => {
    await show({ ...plan, isForSale: false }, nothingListed);

    expect(text('app-buy-area')).toBe('No longer for sale');
    expect(page.querySelector('[data-price]')).toBeNull();
    expect(page.querySelector('[data-what-you-get]')).toBeNull();
    expect(page.querySelector('[data-what-you-buy]')).toBeNull();
    expect(texts('[data-included] [data-locked]')).toEqual(Array(3).fill('Premium recipe'));
  });

  it('says so when a plan has no recipes listed', async () => {
    await show({ ...plan, recipes: [], recipeCount: 0, mealCount: 0 }, { lines: [], fromRecipes: [], lockedRecipes: [] });

    expect(text('[data-included]')).toContain('This plan has no recipes listed.');
    expect(page.querySelector('[data-what-you-buy]')).toBeNull();
  });

  it('says there is no such plan at an address that names none, and leads to the plans', async () => {
    await openPage();
    http.expectOne('/api/products/3').flush('', { status: 404, statusText: 'Not Found' });
    http.expectOne('/api/products/3/shopping-list').flush('', { status: 404, statusText: 'Not Found' });
    await harness.fixture.whenStable();

    expect(text('h1')).toBe('Plan not found');
    expect(page.textContent).toContain('There is no meal plan or collection at this address.');
    expect(page.querySelector('a[href="/plans"]')?.textContent).toContain('See every plan and collection');
    expect(TestBed.inject(Title).getTitle()).toBe('Plan not found | Cookfeed');
  });

  it('says it is loading, then that it could not be loaded, rather than showing nothing', async () => {
    await openPage();
    expect(text('[role="status"]')).toContain('Loading');
    expect(page.querySelectorAll('h1').length).toBe(1);

    http.expectOne('/api/products/3').flush('down', { status: 503, statusText: 'Service Unavailable' });
    http.expectOne('/api/products/3/shopping-list').flush('down', { status: 503, statusText: 'Service Unavailable' });
    await harness.fixture.whenStable();

    expect(text('[role="alert"]')).toContain('could not be loaded');
  });

  it('has no accessibility violations a structural check can find', async () => {
    await show({ ...owned, recipes: [open(teriyaki, 5), stirFry, onigiri] }, { ...fullList, lockedRecipes: ['Onigiri Three Ways'] }, alex);

    // Color contrast needs a real browser's rendering; the browser tests check it.
    const results = await axe.run(page, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });

    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });

  it('lets a buyer shop the whole plan, says how many recipes went on the list, and leads to it', async () => {
    await show(owned, { lines: [], fromRecipes: [], lockedRecipes: [] } as unknown as ProductShoppingList, alex);
    const shop = Array.from(page.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Shop this plan')!;

    shop.click();
    // The page first asks which lists the cook has in use: none, so a list is made without a question.
    http.expectOne('/api/me/trips').flush({ active: null, open: [], past: [] });
    await new Promise((done) => setTimeout(done));
    const request = http.expectOne('/api/me/trips/items');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ productId: owned.id, today: isoDay(new Date()) });
    request.flush({ tripId: 7, tripName: 'Shopping list, November 21', created: true, added: 3, alreadyOnList: 0 });
    await harness.fixture.whenStable();
    await new Promise((done) => setTimeout(done));
    await harness.fixture.whenStable();

    expect(TestBed.inject(Notices).message()?.text).toBe(`3 recipes from ${owned.title} are on your shopping list.`);
    expect(page.querySelector('[data-shop-plan] a')?.getAttribute('href')).toBe('/list/7');
  });

  it('offers Shop this plan only to someone who owns the plan', async () => {
    await show({ ...owned, ownedByViewer: false }, { lines: [], fromRecipes: [], lockedRecipes: [] } as unknown as ProductShoppingList, alex);

    expect(Array.from(page.querySelectorAll('button')).some((b) => b.textContent?.trim() === 'Shop this plan')).toBe(false);
  });
});
