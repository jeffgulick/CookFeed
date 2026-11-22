import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import axe from 'axe-core';
import { Account, Studio, StudioProduct, StudioRecipe } from '../../core/api-types';
import { Notices } from '../../core/notices';
import { Session } from '../../core/session';
import { Confirm } from '../../ui/confirm';
import { StudioPage } from './studio';

/* My studio (the prototype's studio.html), for creators: what they publish, what they sell and what it has earned
   (GET /api/me/studio), with Publish and Unpublish on a recipe and Retire and Restore on a plan. The API decides
   what is allowed and sends the sentence shown beside a button that is off. */
describe('Studio page', () => {
  const kenji: Account = { id: 4, displayName: 'Kenji Watanabe', roles: ['HomeCook', 'Creator'], handle: 'kenji-kitchen' };
  const alex: Account = { id: 1, displayName: 'Alex Rivera', roles: ['HomeCook'], handle: null };

  const tamagoyaki: StudioRecipe = {
    id: 16, title: 'Tamagoyaki', servings: 2, isPublished: true, visibility: 'Public', saveCount: 4, inPlans: [], publishProblem: null,
  };
  const teriyaki: StudioRecipe = {
    id: 5, title: 'Chicken Teriyaki', servings: 2, isPublished: true, visibility: 'ProductOnly', saveCount: 1,
    inPlans: ['Three Weeknights in Japan', 'Bento Box'],
    publishProblem: '"Chicken Teriyaki" is in Three Weeknights in Japan and Bento Box. Take it out of the plan first.',
  };
  const misoDraft: StudioRecipe = {
    id: 13, title: 'Miso Soup', servings: 4, isPublished: false, visibility: 'Public', saveCount: 0, inPlans: [],
    publishProblem: 'Add at least one ingredient first.',
  };
  const readyDraft: StudioRecipe = { ...misoDraft, id: 20, title: 'Dashi', publishProblem: null };
  const premiumDraft: StudioRecipe = { ...readyDraft, id: 21, title: 'Katsu Curry', visibility: 'ProductOnly' };

  const weeknights: StudioProduct = {
    id: 3, title: 'Three Weeknights in Japan', type: 'MealPlan', priceCents: 1299, recipeCount: 3, mealCount: 3,
    isActive: true, isForSale: true, sold: 3, restoreProblem: null,
  };
  const retired: StudioProduct = {
    id: 9, title: 'Old Favorites', type: 'RecipeCollection', priceCents: 499, recipeCount: 2, mealCount: null,
    isActive: false, isForSale: false, sold: 0, restoreProblem: null,
  };
  const emptyRetired: StudioProduct = { ...retired, id: 10, title: 'Empty Box', recipeCount: 0, restoreProblem: '"Empty Box" has no recipes. Add at least one first.' };

  const studio = (changes: Partial<Studio> = {}): Studio => ({
    handle: 'kenji-kitchen',
    isSuspended: false,
    stats: { publishedRecipes: 5, drafts: 1, plansForSale: 1, sales: 3, earnedCents: 3897, saves: 11 },
    recipes: [tamagoyaki, misoDraft, teriyaki],
    products: [weeknights, retired],
    sales: [
      // Noon UTC, so the date reads the same in any time zone the tests run in.
      { placedAt: '2026-08-11T12:00:00+00:00', buyerName: 'Alex Rivera', productTitle: 'Three Weeknights in Japan', unitPriceCents: 1299, status: 'Paid' },
      { placedAt: '2026-08-08T12:00:00+00:00', buyerName: 'Priya Shah', productTitle: 'Weeknights in Japan', unitPriceCents: 999, status: 'Cancelled' },
    ],
    reviews: [
      { id: 1, reviewerName: 'Alex Rivera', rating: 4, body: 'Clear steps, and the list was right.', createdAt: '2026-08-20T12:00:00+00:00', productId: 3, productTitle: 'Three Weeknights in Japan' },
    ],
    ...changes,
  });

  let fixture: ComponentFixture<StudioPage>;
  let page: HTMLElement;
  let http: HttpTestingController;
  let session: Session;

  async function show(signedInAs: Account | null, answer?: Studio): Promise<void> {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [StudioPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(Session);
    session.accounts.set([kenji, alex]);
    if (signedInAs !== null) {
      session.signIn(signedInAs.id);
    }
    fixture = TestBed.createComponent(StudioPage);
    await fixture.whenStable();
    page = fixture.nativeElement as HTMLElement;
    if (answer !== undefined) {
      http.expectOne('/api/me/studio').flush(answer);
      await fixture.whenStable();
    }
  }

  /** Lets the promise chain after a press run: the question, then the request. */
  async function settle(): Promise<void> {
    await fixture.whenStable();
    await new Promise((done) => setTimeout(done));
    await fixture.whenStable();
  }

  const clean = (value: string | null | undefined) => value?.replace(/\s+/g, ' ').trim() ?? '';
  const text = (selector: string) => clean(page.querySelector(selector)?.textContent);
  const texts = (selector: string) => Array.from(page.querySelectorAll(selector)).map((el) => clean(el.textContent));
  const row = (table: string, title: string) =>
    Array.from(page.querySelectorAll<HTMLElement>(`[data-${table}] tbody tr`)).find((r) => r.textContent?.includes(title))!;
  const cells = (table: string, title: string) => Array.from(row(table, title).querySelectorAll('td')).map((td) => clean(td.textContent));
  const button = (table: string, title: string) => row(table, title).querySelector<HTMLButtonElement>('button')!;

  it('says what the studio is, and leads to the creator\'s storefront', async () => {
    await show(kenji, studio());

    expect(text('h1')).toBe('Your recipes and plans');
    expect(text('[data-lede]')).toContain('What you publish, what you sell, and what it has earned.');
    const storefront = page.querySelector('[data-lede] a');
    expect(clean(storefront?.textContent)).toContain('See your storefront');
    expect(storefront?.getAttribute('href')).toBe('/creators/kenji-kitchen');
    expect(texts('h2')).toEqual(['My recipes', 'My plans and collections', 'Sales', 'Reviews of my plans']);
    expect(page.querySelector('[data-suspended]')).toBeNull();
  });

  it('sums the studio up in five figures', async () => {
    await show(kenji, studio());

    expect(texts('[data-stat]')).toEqual([
      '5 published recipes, free and premium, plus 1 draft',
      '1 plan for sale',
      '3 sales',
      '$38.97 earned',
      '11 saves of your recipes',
    ]);
  });

  it('words one of each, and no drafts, correctly', async () => {
    await show(kenji, studio({ stats: { publishedRecipes: 1, drafts: 0, plansForSale: 2, sales: 1, earnedCents: 499, saves: 1 } }));

    expect(texts('[data-stat]')).toEqual([
      '1 published recipe, free and premium',
      '2 plans for sale',
      '1 sale',
      '$4.99 earned',
      '1 save of your recipes',
    ]);
  });

  it('lists each recipe with its status, who may open it, who saved it and the plans it is in', async () => {
    await show(kenji, studio());

    expect(texts('[data-recipes] thead th')).toEqual(['Recipe', 'Status', 'Access', 'Saved by', 'In plans', 'Actions']);
    expect(cells('recipes', 'Tamagoyaki')).toEqual(['Tamagoyaki Serves 2', 'Published', 'Free', '4 cooks', 'none', 'Unpublish']);
    expect(cells('recipes', 'Chicken Teriyaki').slice(0, 5)).toEqual([
      'Chicken Teriyaki Serves 2',
      'Published',
      'Premium',
      '1 cook',
      'Three Weeknights in Japan, Bento Box',
    ]);
    expect(cells('recipes', 'Miso Soup').slice(0, 5)).toEqual(['Miso Soup Serves 4', 'Draft', 'Free', '0 cooks', 'none']);
    expect(row('recipes', 'Tamagoyaki').querySelector('a')?.getAttribute('href')).toBe('/recipes/16');
  });

  it('names each button for the recipe it acts on, and turns it off with the reason as text beside it', async () => {
    await show(kenji, studio());

    const open = button('recipes', 'Tamagoyaki');
    expect(open.getAttribute('aria-label')).toBe('Unpublish: Tamagoyaki');
    expect(open.disabled).toBe(false);
    expect(row('recipes', 'Tamagoyaki').querySelector('[data-why-not]')).toBeNull();

    const off = button('recipes', 'Miso Soup');
    expect(off.getAttribute('aria-label')).toBe('Publish: Miso Soup');
    expect(off.disabled).toBe(true);
    const why = row('recipes', 'Miso Soup').querySelector('[data-why-not]');
    expect(clean(why?.textContent)).toBe('Add at least one ingredient first.');
    // The reason is tied to the button, so a screen reader reads it with the button.
    expect(off.getAttribute('aria-describedby')).toBe(why?.id);
    expect(why?.id).toBeTruthy();
  });

  it('publishes a draft after asking, shows the studio the API answers with, and says so', async () => {
    await show(kenji, studio({ recipes: [readyDraft] }));

    button('recipes', 'Dashi').click();
    await settle();
    const question = TestBed.inject(Confirm).question();
    expect(question?.message).toBe('Publish "Dashi"? Anyone will be able to open and save it.');
    expect(question?.action).toBe('Publish');
    question!.settle(true);
    await settle();
    const request = http.expectOne('/api/me/studio/recipes/20/publish');
    expect(request.request.method).toBe('POST');
    request.flush(studio({ recipes: [{ ...readyDraft, isPublished: true }], stats: { publishedRecipes: 6, drafts: 0, plansForSale: 1, sales: 3, earnedCents: 3897, saves: 11 } }));
    await settle();

    expect(cells('recipes', 'Dashi')[1]).toBe('Published');
    expect(button('recipes', 'Dashi').getAttribute('aria-label')).toBe('Unpublish: Dashi');
    expect(texts('[data-stat]')[0]).toBe('6 published recipes, free and premium');
    expect(TestBed.inject(Notices).message()?.text).toBe('"Dashi" is published.');
  });

  it('asks about publishing a premium recipe in its own words', async () => {
    await show(kenji, studio({ recipes: [premiumDraft] }));

    button('recipes', 'Katsu Curry').click();
    await settle();

    expect(TestBed.inject(Confirm).question()?.message).toBe('Publish "Katsu Curry"? Only buyers of a plan it is in will open it.');
  });

  it('unpublishes a recipe after asking, and sends nothing when the creator cancels', async () => {
    await show(kenji, studio());

    button('recipes', 'Tamagoyaki').click();
    await settle();
    const first = TestBed.inject(Confirm).question();
    expect(first?.message).toBe('Unpublish "Tamagoyaki"? Only you will see it.');
    expect(first?.action).toBe('Unpublish');
    first!.settle(false);
    await settle();
    http.expectNone('/api/me/studio/recipes/16/unpublish');

    button('recipes', 'Tamagoyaki').click();
    await settle();
    TestBed.inject(Confirm).question()!.settle(true);
    await settle();
    http.expectOne('/api/me/studio/recipes/16/unpublish').flush(studio({ recipes: [{ ...tamagoyaki, isPublished: false }] }));
    await settle();

    expect(cells('recipes', 'Tamagoyaki')[1]).toBe('Draft');
    expect(TestBed.inject(Notices).message()?.text).toBe('"Tamagoyaki" is a draft again.');
  });

  it('says why when the API refuses a change, and leaves the table as it was', async () => {
    await show(kenji, studio());

    button('recipes', 'Tamagoyaki').click();
    await settle();
    TestBed.inject(Confirm).question()!.settle(true);
    await settle();
    http.expectOne('/api/me/studio/recipes/16/unpublish').flush(
      { title: 'Not now', detail: 'Cooks have bought "Tamagoyaki", so it stays published for them.' },
      { status: 409, statusText: 'Conflict' },
    );
    await settle();

    const notice = TestBed.inject(Notices).message();
    expect(notice?.kind).toBe('problem');
    expect(notice?.text).toBe('Cooks have bought "Tamagoyaki", so it stays published for them.');
    expect(cells('recipes', 'Tamagoyaki')[1]).toBe('Published');
    expect(button('recipes', 'Tamagoyaki').disabled).toBe(false);
  });

  it('lists each plan with its type, price, contents, whether it is for sale, and how many sold', async () => {
    await show(kenji, studio());

    expect(texts('[data-products] thead th')).toEqual(['Plan', 'Type', 'Price', 'Contents', 'Status', 'Sold', 'Actions']);
    expect(cells('products', 'Three Weeknights in Japan')).toEqual([
      'Three Weeknights in Japan',
      'Meal plan',
      '$12.99',
      '3 recipes',
      'For sale',
      '3',
      'Retire Reviews',
    ]);
    expect(cells('products', 'Old Favorites').slice(0, 6)).toEqual(['Old Favorites', 'Recipe collection', '$4.99', '2 recipes', 'Retired', '0']);
    const plan = row('products', 'Three Weeknights in Japan');
    expect(plan.querySelector('td a')?.getAttribute('href')).toBe('/plans/3');
    const reviews = Array.from(plan.querySelectorAll('a')).find((a) => a.textContent?.includes('Reviews'));
    expect(reviews?.getAttribute('href')).toBe('/plans/3/reviews');
    expect(reviews?.getAttribute('aria-label')).toBe('Reviews: Three Weeknights in Japan');
  });

  it('retires a plan after asking, and says so', async () => {
    await show(kenji, studio());

    button('products', 'Three Weeknights in Japan').click();
    await settle();
    const question = TestBed.inject(Confirm).question();
    expect(question?.message).toBe('Retire "Three Weeknights in Japan"? It leaves the store; everyone who bought it keeps it.');
    expect(question?.action).toBe('Retire');
    question!.settle(true);
    await settle();
    const request = http.expectOne('/api/me/studio/products/3/retire');
    expect(request.request.method).toBe('POST');
    request.flush(studio({ products: [{ ...weeknights, isActive: false, isForSale: false }] }));
    await settle();

    expect(cells('products', 'Three Weeknights in Japan')[4]).toBe('Retired');
    expect(button('products', 'Three Weeknights in Japan').getAttribute('aria-label')).toBe('Restore: Three Weeknights in Japan');
    expect(TestBed.inject(Notices).message()?.text).toBe('"Three Weeknights in Japan" is retired.');
  });

  it('puts a retired plan back on sale after asking, and says so', async () => {
    await show(kenji, studio());

    button('products', 'Old Favorites').click();
    await settle();
    const question = TestBed.inject(Confirm).question();
    expect(question?.message).toBe('Put "Old Favorites" back on sale?');
    expect(question?.action).toBe('Restore');
    question!.settle(true);
    await settle();
    http.expectOne('/api/me/studio/products/9/restore').flush(studio({ products: [{ ...retired, isActive: true, isForSale: true }] }));
    await settle();

    expect(cells('products', 'Old Favorites')[4]).toBe('For sale');
    expect(TestBed.inject(Notices).message()?.text).toBe('"Old Favorites" is for sale again.');
  });

  it('turns Restore off on a plan that cannot go back on sale, with the reason beside it', async () => {
    await show(kenji, studio({ products: [emptyRetired] }));

    const restore = button('products', 'Empty Box');
    expect(restore.disabled).toBe(true);
    const why = row('products', 'Empty Box').querySelector('[data-why-not]');
    expect(clean(why?.textContent)).toBe('"Empty Box" has no recipes. Add at least one first.');
    expect(restore.getAttribute('aria-describedby')).toBe(why?.id);
  });

  it('tells a suspended creator so, and shows their plans as not for sale', async () => {
    await show(kenji, studio({ isSuspended: true, products: [{ ...weeknights, isForSale: false }] }));

    expect(text('[data-suspended]')).toContain('Your account is suspended.');
    expect(text('[data-suspended]')).toContain('Cooks who bought your plans keep them.');
    expect(cells('products', 'Three Weeknights in Japan')[4]).toBe('Not for sale: account suspended');
  });

  it('says a plan holding a draft is not for sale, and why', async () => {
    await show(kenji, studio({ products: [{ ...weeknights, isForSale: false }] }));

    expect(cells('products', 'Three Weeknights in Japan')[4]).toBe('Not for sale: a recipe in it is a draft');
  });

  it('lists the sales newest first at the price of the time, whatever their status', async () => {
    await show(kenji, studio());

    expect(text('[data-sales-summary]')).toBe('3 sales, $38.97 earned. Each line is the price at the time of purchase.');
    expect(texts('[data-sales] thead th')).toEqual(['Date', 'Buyer', 'Plan', 'Paid', 'Status']);
    expect(texts('[data-sales] tbody tr:first-child td')).toEqual(['August 11, 2026', 'Alex Rivera', 'Three Weeknights in Japan', '$12.99', 'Paid']);
    expect(texts('[data-sales] tbody tr:last-child td')).toEqual(['August 8, 2026', 'Priya Shah', 'Weeknights in Japan', '$9.99', 'Cancelled']);
  });

  it('shows the reviews of the creator\'s plans, each with its stars in words', async () => {
    await show(kenji, studio());

    const review = page.querySelector('[data-studio-reviews] [data-review]')!;
    expect(clean(review.textContent)).toContain('Alex Rivera');
    expect(clean(review.textContent)).toContain('on Three Weeknights in Japan');
    expect(clean(review.textContent)).toContain('August 20, 2026');
    expect(clean(review.textContent)).toContain('Clear steps, and the list was right.');
    const stars = review.querySelector('[role="img"]');
    expect(stars?.getAttribute('aria-label')).toBe('4 out of 5 stars');
    expect(clean(stars?.textContent)).toBe('★★★★☆');
  });

  it('says so when there is nothing yet: no recipes, nothing for sale, no sales, no reviews', async () => {
    await show(kenji, studio({
      stats: { publishedRecipes: 0, drafts: 0, plansForSale: 0, sales: 0, earnedCents: 0, saves: 0 },
      recipes: [],
      products: [],
      sales: [],
      reviews: [],
    }));

    expect(text('[data-recipes] tbody')).toBe('No recipes yet.');
    expect(text('[data-products] tbody')).toBe('Nothing for sale yet.');
    expect(text('[data-sales-summary]')).toBe('No sales yet.');
    expect(text('[data-sales] tbody')).toBe('Nothing sold yet.');
    expect(text('[data-studio-reviews]')).toBe('No reviews of your plans yet.');
  });

  it('asks a visitor to sign in, and says where to come back to', async () => {
    await show(null);

    const link = page.querySelector('[data-no-studio] a');
    expect(clean(link?.textContent)).toBe('Sign in to open your studio');
    expect(link?.getAttribute('href')).toBe('/sign-in?next=%2Fstudio');
    expect(text('[data-no-studio]')).toContain('The studio is where creators publish recipes and sell plans.');
    http.expectNone('/api/me/studio');
  });

  it('tells an account that is not a creator who has a studio, and asks the API for nothing', async () => {
    await show(alex);

    expect(text('[data-no-studio]')).toBe('Only creators have a studio. Sign in as Maria, Kenji or Dan to see one.');
    expect(page.querySelector('[data-recipes]')).toBeNull();
    http.expectNone('/api/me/studio');
  });

  it('reads the studio when a creator signs in', async () => {
    await show(alex);

    session.signIn(kenji.id);
    await fixture.whenStable();
    http.expectOne('/api/me/studio').flush(studio());
    await fixture.whenStable();

    expect(page.querySelectorAll('[data-recipes] tbody tr').length).toBe(3);
  });

  it('says it is loading, then that it could not be loaded, rather than showing nothing', async () => {
    await show(kenji);
    expect(page.querySelector('[role="status"]')?.textContent).toContain('Loading');

    http.expectOne('/api/me/studio').flush('down', { status: 503, statusText: 'Service Unavailable' });
    await fixture.whenStable();

    expect(page.querySelector('[role="alert"]')?.textContent).toContain('could not be loaded');
    expect(page.querySelector('[data-recipes]')).toBeNull();
  });

  it('has no accessibility violations a structural check can find', async () => {
    await show(kenji, studio({ products: [weeknights, emptyRetired] }));

    const results = await axe.run(page, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });

    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
});
