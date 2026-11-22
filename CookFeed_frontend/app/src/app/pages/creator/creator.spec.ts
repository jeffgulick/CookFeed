import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import axe from 'axe-core';
import { Account, Storefront, StorefrontProduct, StorefrontRecipe } from '../../core/api-types';
import { Session } from '../../core/session';
import { CreatorPage } from './creator';

/* A creator's storefront (the prototype's creator.html?handle=): who they are, their free recipes, and what they
   have for sale, each plan with a buy area that says where the viewer stands with it. From GET /api/creators/{handle}. */
describe('Creator storefront page', () => {
  const alex: Account = { id: 1, displayName: 'Alex Rivera', roles: ['HomeCook'], handle: null };
  const kenjiAccount: Account = { id: 4, displayName: 'Kenji Watanabe', roles: ['HomeCook', 'Creator'], handle: 'kenji-kitchen' };
  const admin: Account = { id: 6, displayName: 'Cookfeed Admin', roles: ['Admin'], handle: null };

  const recipe = (id: number, title: string, saveCount: number, publishedAt: string): StorefrontRecipe => ({
    id,
    title,
    thumbnailUrl: `images/recipes/${id}.svg`,
    servings: 2,
    totalMinutes: 15,
    saveCount,
    publishedAt,
  });

  const weeknights: StorefrontProduct = {
    id: 3,
    type: 'MealPlan',
    title: 'Three Weeknights in Japan',
    description: 'Three dinners, one shopping trip.',
    coverImageUrl: 'images/products/3.svg',
    priceCents: 1299,
    currency: 'USD',
    recipeCount: 3,
    mealCount: 3,
    ownedByViewer: false,
    inCart: false,
  };

  // Newest first, as the API sends them. The middle two have the same saves.
  const kenji: Storefront = {
    handle: 'kenji-kitchen',
    displayName: 'Kenji Watanabe',
    bio: 'Japanese home cooking with a weeknight clock.',
    avatarUrl: 'images/creators/kenji-kitchen.svg',
    isVerified: true,
    isSuspended: false,
    recipeCount: 3,
    totalSaves: 11,
    viewerIsCreator: false,
    recipes: [
      recipe(21, 'Miso Soup', 1, '2026-09-01T12:00:00+00:00'),
      recipe(9, 'Tamagoyaki', 5, '2026-08-20T12:00:00+00:00'),
      recipe(7, 'Cucumber Sunomono', 5, '2026-07-02T12:00:00+00:00'),
    ],
    products: [weeknights],
  };

  let harness: RouterTestingHarness;
  let page: HTMLElement;
  let http: HttpTestingController;
  let session: Session;

  async function open(signedInAs: Account | null = null): Promise<void> {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'creators/:handle', component: CreatorPage }]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(Session);
    session.accounts.set([alex, kenjiAccount, admin]);
    if (signedInAs !== null) {
      session.signIn(signedInAs.id);
    }
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/creators/kenji-kitchen', CreatorPage);
    page = harness.routeNativeElement as HTMLElement;
  }

  async function answer(storefront: Storefront): Promise<void> {
    http.expectOne('/api/creators/kenji-kitchen').flush(storefront);
    await harness.fixture.whenStable();
  }

  async function show(storefront: Storefront = kenji, signedInAs: Account | null = null): Promise<void> {
    await open(signedInAs);
    await answer(storefront);
  }

  const text = (selector: string) => page.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const recipeIds = () => Array.from(page.querySelectorAll('[data-recipe-id]')).map((el) => el.getAttribute('data-recipe-id'));
  const button = (name: string) =>
    Array.from(page.querySelectorAll('button')).find((b) => b.textContent?.trim() === name) as HTMLButtonElement;

  it('says who the creator is', async () => {
    await show();

    expect(text('h1')).toContain('Kenji Watanabe');
    expect(page.querySelectorAll('h1').length).toBe(1);
    expect(text('[data-creator-head] .tag-good')).toBe('Verified creator');
    expect(text('[data-creator-head]')).toContain('@kenji-kitchen');
    expect(text('[data-creator-head]')).toContain('Japanese home cooking with a weeknight clock.');
    expect(page.querySelector('[data-creator-head] img')?.getAttribute('src')).toBe('/images/creators/kenji-kitchen.svg');
    expect(page.querySelector('[data-creator-head] img')?.getAttribute('alt')).toBe('Profile picture for kenji-kitchen');
  });

  it('counts the published recipes and the times they were saved', async () => {
    await show();

    expect(text('[data-stat="recipes"]')).toBe('3 published recipes');
    expect(text('[data-stat="saves"]')).toBe('11 times cooks saved these recipes');
  });

  it('leaves the verified mark off a creator who is not verified', async () => {
    await show({ ...kenji, isVerified: false });

    expect(page.querySelector('[data-creator-head] .tag-good')).toBeNull();
  });

  it('names the browser tab after the creator', async () => {
    await show();

    expect(TestBed.inject(Title).getTitle()).toBe('kenji-kitchen | Cookfeed');
  });

  it('lists the recipes most popular first, and newest first on request', async () => {
    await show();

    // Most saved first; the two with five saves keep the newer one ahead.
    expect(recipeIds()).toEqual(['9', '7', '21']);
    expect(button('Most popular').getAttribute('aria-pressed')).toBe('true');
    expect(button('Newest').getAttribute('aria-pressed')).toBe('false');

    button('Newest').click();
    await harness.fixture.whenStable();

    expect(recipeIds()).toEqual(['21', '9', '7']);
    expect(button('Newest').getAttribute('aria-pressed')).toBe('true');
    expect(button('Most popular').getAttribute('aria-pressed')).toBe('false');
  });

  it('says when each recipe was published, since who made it is already known', async () => {
    await show();

    expect(text('[data-recipe-id="9"]')).toContain('Published August 20, 2026');
    expect(text('[data-recipe-id="9"]')).not.toContain('by kenji-kitchen');
    expect(text('[data-recipe-id="9"]')).toContain('Serves 2');
    expect(text('[data-recipe-id="9"]')).toContain('saved by 5 cooks');
    expect(page.querySelector('[data-recipe-id="9"] h3 a')?.getAttribute('href')).toBe('/recipes/9');
  });

  it('says so when the creator has published nothing yet', async () => {
    await show({ ...kenji, recipes: [], recipeCount: 0, totalSaves: 0 });

    expect(text('[data-recipes]')).toContain('No published recipes yet');
  });

  it('lists what is for sale: what it is, what is in it and its price', async () => {
    await show();
    const card = '[data-for-sale] [data-product-id="3"]';

    expect(text(`${card} .pill`)).toBe('Meal plan');
    expect(text(`${card} h3`)).toBe('Three Weeknights in Japan');
    expect(page.querySelector(`${card} h3 a`)?.getAttribute('href')).toBe('/plans/3');
    expect(text(card)).toContain('Three dinners, one shopping trip. 3 recipes.');
    expect(text(`${card} [data-price]`)).toBe('$12.99');
    expect(page.querySelector(`${card} img`)?.getAttribute('src')).toBe('/images/products/3.svg');
  });

  it('asks a visitor to sign in to buy', async () => {
    await show();

    const link = page.querySelector('[data-product-id="3"] app-buy-area a');
    expect(link?.textContent?.trim()).toBe('Sign in to buy');
    expect(link?.getAttribute('href')).toBe('/sign-in?next=%2Fcreators%2Fkenji-kitchen');
  });

  it('tells a cook who bought the plan that they own it', async () => {
    await show({ ...kenji, products: [{ ...weeknights, ownedByViewer: true }] }, alex);

    expect(text('[data-product-id="3"] app-buy-area')).toContain('You own this plan');
  });

  it('leads a cook to the cart when the plan is already in it', async () => {
    await show({ ...kenji, products: [{ ...weeknights, inCart: true }] }, alex);

    expect(page.querySelector('[data-product-id="3"] app-buy-area a')?.getAttribute('href')).toBe('/cart');
  });

  it('shows the creator their own storefront without buying, and points to the studio', async () => {
    await show({ ...kenji, viewerIsCreator: true }, kenjiAccount);

    expect(text('[data-own-storefront]')).toContain('This is your storefront');
    expect(page.querySelector('[data-own-storefront] a')?.getAttribute('href')).toBe('/studio');
    expect(text('[data-product-id="3"] app-buy-area')).toBe("This is your plan. Creators can't buy their own.");
  });

  it('does not call the storefront yours for anyone else', async () => {
    await show(kenji, alex);

    expect(page.querySelector('[data-own-storefront]')).toBeNull();
  });

  it('shows the admin, who cannot shop, no buy area', async () => {
    await show(kenji, admin);

    expect(text('[data-product-id="3"] app-buy-area')).toBe('');
    expect(text('[data-product-id="3"] [data-price]')).toBe('$12.99');
  });

  it('says a suspended creator is suspended, and that nothing is for sale', async () => {
    await show({ ...kenji, isSuspended: true, products: [] });

    expect(text('[data-suspended]')).toContain('This creator is suspended by Cookfeed');
    expect(text('[data-suspended]')).toContain('cooks who already bought one keep it');
    expect(text('[data-for-sale]')).toContain('Nothing for sale right now');
  });

  it('shows no suspension notice for a creator in good standing', async () => {
    await show();

    expect(page.querySelector('[data-suspended]')).toBeNull();
  });

  it('says there is no such creator for a handle nobody has, and leads back', async () => {
    await open();
    http.expectOne('/api/creators/kenji-kitchen').flush('', { status: 404, statusText: 'Not Found' });
    await harness.fixture.whenStable();

    expect(text('h1')).toBe('Creator not found');
    expect(page.textContent).toContain('There is no creator with this handle');
    expect(page.querySelector('a[href="/"]')?.textContent).toContain('Back to Discover');
    expect(TestBed.inject(Title).getTitle()).toBe('Creator not found | Cookfeed');
  });

  it('says it is loading, then that it could not be loaded, rather than showing nothing', async () => {
    await open();
    expect(text('[role="status"]')).toContain('Loading');
    expect(page.querySelectorAll('h1').length).toBe(1);

    http.expectOne('/api/creators/kenji-kitchen').flush('down', { status: 503, statusText: 'Service Unavailable' });
    await harness.fixture.whenStable();

    expect(text('[role="alert"]')).toContain('could not be loaded');
    expect(page.querySelectorAll('h1').length).toBe(1);
  });

  it('asks again when the account changes, so what the viewer owns is never stale', async () => {
    await show();
    expect(text('[data-product-id="3"] app-buy-area')).toContain('Sign in to buy');

    session.signIn(alex.id);
    await harness.fixture.whenStable();
    await answer({ ...kenji, products: [{ ...weeknights, ownedByViewer: true }] });

    expect(text('[data-product-id="3"] app-buy-area')).toContain('You own this plan');
  });

  it('has no accessibility violations a structural check can find', async () => {
    await show({ ...kenji, isSuspended: true, viewerIsCreator: true }, kenjiAccount);

    // Color contrast needs a real browser's rendering; the browser tests check it.
    const results = await axe.run(page, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });

    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
});
