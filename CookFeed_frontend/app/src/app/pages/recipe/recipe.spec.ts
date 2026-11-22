import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import axe from 'axe-core';
import { Account, ProductDetail, RecipeDetail, RecipeLocked } from '../../core/api-types';
import { Notices } from '../../core/notices';
import { Session } from '../../core/session';
import { RecipePage } from './recipe';

/* A recipe's page (the prototype's recipe.html?id=): what goes in, for however many people, and how to make it,
   with steps that jump the video. From GET /api/recipes/{id}; a 403 is a premium recipe the viewer has not bought,
   and its body says which plans it comes with. */
describe('Recipe page', () => {
  const alex: Account = { id: 1, displayName: 'Alex Rivera', roles: ['HomeCook'], handle: null };
  const kenji: Account = { id: 4, displayName: 'Kenji Watanabe', roles: ['HomeCook', 'Creator'], handle: 'kenji-kitchen' };
  const admin: Account = { id: 6, displayName: 'Cookfeed Admin', roles: ['Admin'], handle: null };

  const tamagoyaki: RecipeDetail = {
    id: 16,
    title: 'Tamagoyaki',
    description: 'The rolled Japanese omelet.',
    videoUrl: 'video',
    thumbnailUrl: 'images/recipes/16.svg',
    servings: 2,
    prepMinutes: 5,
    cookMinutes: 10,
    totalMinutes: 15,
    saveCount: 4,
    isPublished: true,
    visibility: 'Public',
    publishedAt: '2026-07-18T12:00:00+00:00',
    creator: { handle: 'kenji-kitchen', displayName: 'Kenji Watanabe', avatarUrl: null, isVerified: true },
    savedByViewer: false,
    viewerIsCreator: false,
    ownedThrough: null,
    ingredients: [
      { sortOrder: 1, quantity: 4, unit: 'ea', ingredient: 'egg', displayText: null, preparation: null, isOptional: false },
      { sortOrder: 2, quantity: 1, unit: 'tsp', ingredient: 'vegetable oil', displayText: null, preparation: 'for the pan', isOptional: false },
      { sortOrder: 3, quantity: 0.333, unit: 'c', ingredient: 'dashi', displayText: null, preparation: null, isOptional: false },
    ],
    steps: [
      { stepNumber: 1, instruction: 'Beat the eggs.', videoTimestampSeconds: 8 },
      { stepNumber: 2, instruction: 'Pour a thin layer and roll.', videoTimestampSeconds: 76 },
      { stepNumber: 3, instruction: 'Rest, then slice.', videoTimestampSeconds: null },
    ],
    includedIn: [],
  };

  const teriyaki: RecipeDetail = {
    ...tamagoyaki,
    id: 5,
    title: 'Chicken Teriyaki',
    visibility: 'ProductOnly',
    ownedThrough: 'Three Weeknights in Japan',
  };

  const weeknights = {
    id: 3,
    type: 'MealPlan',
    title: 'Three Weeknights in Japan',
    recipeCount: 3,
    mealCount: 3,
    recipes: [{ dayOffset: 0, slot: 'Dinner', details: { recipeId: 5 } }],
  } as ProductDetail;

  let harness: RouterTestingHarness;
  let page: HTMLElement;
  let http: HttpTestingController;

  async function openPage(address: string, signedInAs: Account | null = null): Promise<void> {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'recipes/:id', component: RecipePage }]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    const session = TestBed.inject(Session);
    session.accounts.set([alex, kenji, admin]);
    if (signedInAs !== null) {
      session.signIn(signedInAs.id);
    }
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(address, RecipePage);
    page = harness.routeNativeElement as HTMLElement;
  }

  async function show(recipe: RecipeDetail, signedInAs: Account | null = null): Promise<void> {
    await openPage(`/recipes/${recipe.id}`, signedInAs);
    http.expectOne(`/api/recipes/${recipe.id}`).flush(recipe);
    await harness.fixture.whenStable();
  }

  const text = (selector: string) => page.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const texts = (selector: string) =>
    Array.from(page.querySelectorAll(selector)).map((el) => el.textContent?.replace(/\s+/g, ' ').trim());
  const button = (name: string) =>
    Array.from(page.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === name || b.getAttribute('aria-label') === name,
    ) as HTMLButtonElement;

  async function typePeople(value: string): Promise<void> {
    const input = page.querySelector('#servingsInput') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await harness.fixture.whenStable();
  }

  it('says what the recipe is and who made it', async () => {
    await show(tamagoyaki);

    expect(text('h1')).toBe('Tamagoyaki');
    expect(page.querySelectorAll('h1').length).toBe(1);
    expect(text('[data-crumb]')).toBe('Kenji Watanabe › Recipes');
    expect(page.querySelector('[data-crumb] a')?.getAttribute('href')).toBe('/creators/kenji-kitchen');
    expect(text('[data-recipe-head] .pill')).toBe('Recipe');
    expect(text('[data-byline]')).toBe('by kenji-kitchen Verified creator');
    expect(text('[data-recipe-head]')).toContain('The rolled Japanese omelet.');
    expect(text('[data-facts]')).toBe('Serves 2 · 15 min total · saved by 4 cooks');
    expect(page.querySelector('[data-player] img')?.getAttribute('src')).toBe('/images/recipes/16.svg');
    expect(TestBed.inject(Title).getTitle()).toBe('Tamagoyaki | Cookfeed');
    expect(page.querySelector('[data-owned-note]')).toBeNull();
  });

  it('lists the ingredients as written, with how each is prepared', async () => {
    await show(tamagoyaki);

    expect(text('[data-ingredients] h2')).toBe('Ingredients for 2');
    expect(texts('[data-ingredients] li')).toEqual(['4 ea egg', '1 tsp vegetable oil, for the pan', '0.33 c dashi']);
    expect((page.querySelector('#servingsInput') as HTMLInputElement).value).toBe('2');
    expect(text('[data-servings-error]')).toBe('');
  });

  it('rescales the ingredients for the people being cooked for', async () => {
    await show(tamagoyaki);

    button('One more person').click();
    await harness.fixture.whenStable();
    expect(text('[data-ingredients] h2')).toBe('Ingredients for 3');
    expect(texts('[data-ingredients] li')).toEqual(['6 ea egg', '1.5 tsp vegetable oil, for the pan', '0.5 c dashi']);

    await typePeople('8');
    expect(texts('[data-ingredients] li')[0]).toBe('16 ea egg');

    button('One fewer person').click();
    await harness.fixture.whenStable();
    expect(texts('[data-ingredients] li')[0]).toBe('14 ea egg');
  });

  it('says what is wrong with a number of people it cannot use, and keeps the last list', async () => {
    await show(tamagoyaki);

    await typePeople('60');
    expect(text('[data-servings-error]')).toBe('Choose between 1 and 50 people.');
    expect(page.querySelector('#servingsInput')?.getAttribute('aria-invalid')).toBe('true');
    expect(texts('[data-ingredients] li')[0]).toBe('4 ea egg');

    await typePeople('');
    expect(text('[data-servings-error]')).toBe('Enter how many people you are cooking for.');

    button('Reset to 2 as written').click();
    await harness.fixture.whenStable();
    expect(text('[data-servings-error]')).toBe('');
    expect((page.querySelector('#servingsInput') as HTMLInputElement).value).toBe('2');
  });

  it('stops the stepper at one person and at fifty', async () => {
    await show({ ...tamagoyaki, servings: 1 });
    expect(button('One fewer person').disabled).toBe(true);
    expect(button('One more person').disabled).toBe(false);

    await typePeople('50');
    expect(button('One more person').disabled).toBe(true);
  });

  it('lists the steps in order, with a way to watch each one that is marked in the video', async () => {
    await show(tamagoyaki);

    expect(texts('[data-method] li [data-instruction]')).toEqual(['Beat the eggs.', 'Pour a thin layer and roll.', 'Rest, then slice.']);
    expect(texts('[data-method] li button')).toEqual(['Watch at 0:08', 'Watch at 1:16']);
    expect(text('[data-player-note]')).toBe('Tap a step below to jump to that moment.');
    expect(text('[data-player-time]')).toBe('0:00');
  });

  it('jumps the video to a step and marks the step being watched', async () => {
    await show(tamagoyaki);

    button('Watch at 1:16').click();
    await harness.fixture.whenStable();

    expect(text('[data-player-note]')).toBe('Step 2 of 3');
    expect(text('[data-player-time]')).toBe('1:16');
    expect(texts('[data-method] li[aria-current="step"] [data-instruction]')).toEqual(['Pour a thin layer and roll.']);
  });

  it('starts at the first marked step when Play is pressed', async () => {
    await show(tamagoyaki);

    button('Play the video').click();
    await harness.fixture.whenStable();

    expect(text('[data-player-note]')).toBe('Step 1 of 3');
    expect(text('[data-player-time]')).toBe('0:08');
  });

  it('asks a visitor to sign in to save, and says what signing in offers', async () => {
    await show(tamagoyaki);

    const link = page.querySelector('[data-save-area] a');
    expect(link?.textContent?.trim()).toBe('Sign in to save');
    expect(link?.getAttribute('href')).toBe('/sign-in?next=%2Frecipes%2F16');
    expect(text('[data-save-note]')).toBe('Sign in to keep this recipe in My kitchen, put it on your week, and shop it.');
  });

  it('offers a cook Save recipe, and saves it when pressed', async () => {
    await show(tamagoyaki, alex);
    expect(text('[data-save-area]')).toBe('Save recipe');

    button('Save recipe').click();
    const request = http.expectOne('/api/me/saves/16');
    expect(request.request.method).toBe('PUT');
    request.flush({ recipeId: 16, saved: true, saveCount: 5 });
    await harness.fixture.whenStable();

    expect(text('[data-save-area]')).toBe('Saved in My kitchen Unsave');
    expect(text('[data-facts]')).toBe('Serves 2 · 15 min total · saved by 5 cooks');
    expect(TestBed.inject(Notices).message()?.text).toBe('Tamagoyaki is saved in My kitchen.');
  });

  it('unsaves a saved recipe when Unsave is pressed', async () => {
    await show({ ...tamagoyaki, savedByViewer: true, saveCount: 5 }, alex);

    button('Unsave').click();
    const request = http.expectOne('/api/me/saves/16');
    expect(request.request.method).toBe('DELETE');
    request.flush({ recipeId: 16, saved: false, saveCount: 4 });
    await harness.fixture.whenStable();

    expect(text('[data-save-area]')).toBe('Save recipe');
    expect(text('[data-facts]')).toBe('Serves 2 · 15 min total · saved by 4 cooks');
    expect(TestBed.inject(Notices).message()?.text).toBe('Tamagoyaki is no longer saved.');
  });

  it('says what the API said when the recipe cannot be saved, and leaves it unsaved', async () => {
    await show(tamagoyaki, alex);

    button('Save recipe').click();
    http
      .expectOne('/api/me/saves/16')
      .flush({ detail: 'There is no recipe with that id that you can save.' }, { status: 404, statusText: 'Not Found' });
    await harness.fixture.whenStable();

    const notice = TestBed.inject(Notices).message();
    expect(notice?.kind).toBe('problem');
    expect(notice?.text).toBe('There is no recipe with that id that you can save.');
    expect(text('[data-save-area]')).toBe('Save recipe');
  });

  it('offers no Save on a draft, which cannot be saved even by its creator', async () => {
    await show({ ...tamagoyaki, isPublished: false, publishedAt: null, viewerIsCreator: true }, kenji);

    expect(text('[data-save-area]')).toBe('');
  });

  it('lets a buyer save a premium recipe they own', async () => {
    await show(teriyaki, alex);

    expect(text('[data-save-area]')).toBe('Save recipe');
  });

  it('tells a cook when the recipe is already saved, and shows the admin nothing about saving', async () => {
    await show({ ...tamagoyaki, savedByViewer: true }, alex);
    expect(text('[data-save-area]')).toBe('Saved in My kitchen Unsave');
    expect(page.querySelector('[data-save-note]')).toBeNull();

    TestBed.resetTestingModule();
    await show(tamagoyaki, admin);
    expect(text('[data-save-area]')).toBe('');
    expect(page.querySelector('[data-save-note]')).toBeNull();
  });

  it('leads on to the creator when the recipe was opened on its own', async () => {
    await show(tamagoyaki);

    expect(text('[data-recipe-foot]')).toContain('More from Kenji Watanabe');
    expect(page.querySelector('[data-recipe-foot] a')?.getAttribute('href')).toBe('/creators/kenji-kitchen');
    expect(text('[data-recipe-foot] a')).toContain('See every recipe from kenji-kitchen');
  });

  it('leads back to the plan when the recipe was opened from one', async () => {
    await openPage('/recipes/5?product=3', alex);
    http.expectOne('/api/recipes/5').flush(teriyaki);
    http.expectOne('/api/products/3').flush(weeknights);
    await harness.fixture.whenStable();

    expect(text('[data-crumb]')).toBe('Three Weeknights in Japan › Monday dinner');
    expect(page.querySelector('[data-crumb] a')?.getAttribute('href')).toBe('/plans/3');
    expect(text('[data-recipe-head] .pill')).toBe('Monday dinner');
    expect(text('[data-owned-note]')).toBe('Yours through Three Weeknights in Japan');
    expect(text('[data-recipe-foot]')).toContain('One of 3 recipes in Three Weeknights in Japan.');
    expect(page.querySelector('[data-recipe-foot] a')?.getAttribute('href')).toBe('/plans/3');
    expect(text('[data-recipe-foot] a')).toContain('Back to Three Weeknights in Japan');
  });

  it('tells a buyer when the recipe has left the store but stays theirs', async () => {
    await show({ ...teriyaki, isPublished: false }, alex);

    expect(text('[data-owned-note]')).toBe('Yours through Three Weeknights in Japan. It is no longer in the store; you keep it.');
  });

  it('tells a creator about their own premium recipe, and marks their own draft', async () => {
    await show({ ...teriyaki, ownedThrough: null, viewerIsCreator: true }, kenji);
    expect(text('[data-owned-note]')).toBe('Only buyers of your plans can open this recipe.');
    expect(text('[data-recipe-head] .pill')).toBe('Recipe');

    TestBed.resetTestingModule();
    await show({ ...tamagoyaki, isPublished: false, publishedAt: null, viewerIsCreator: true }, kenji);
    expect(text('[data-owned-note]')).toBe('A draft. Only you can see it until you publish it.');
    expect(text('[data-recipe-head] .pill')).toBe('Draft');
  });

  it('names the plans a premium recipe comes with, to a viewer who has not bought it', async () => {
    await openPage('/recipes/5');
    const locked: RecipeLocked = {
      title: 'Chicken Teriyaki',
      availableIn: [
        { productId: 3, title: 'Three Weeknights in Japan', type: 'MealPlan' },
        { productId: 8, title: 'Japan at Home', type: 'RecipeCollection' },
      ],
    };
    http.expectOne('/api/recipes/5').flush(locked, { status: 403, statusText: 'Forbidden' });
    await harness.fixture.whenStable();

    expect(text('h1')).toBe('Chicken Teriyaki');
    expect(text('[data-locked]')).toBe('This recipe comes with Three Weeknights in Japan and Japan at Home. Buy it to open the recipe.');
    expect(Array.from(page.querySelectorAll('[data-locked] a')).map((a) => a.getAttribute('href'))).toEqual(['/plans/3', '/plans/8']);
    expect(page.querySelector('[data-ingredients]')).toBeNull();
    expect(TestBed.inject(Title).getTitle()).toBe('Chicken Teriyaki | Cookfeed');
  });

  it('says where to look instead when no plan holding it is for sale', async () => {
    await openPage('/recipes/5');
    http.expectOne('/api/recipes/5').flush({ title: 'Chicken Teriyaki', availableIn: [] }, { status: 403, statusText: 'Forbidden' });
    await harness.fixture.whenStable();

    expect(text('[data-locked]')).toBe(
      'This recipe came with a plan that is no longer for sale. Browse the free recipes or see the plans.',
    );
    expect(Array.from(page.querySelectorAll('[data-locked] a')).map((a) => a.getAttribute('href'))).toEqual(['/recipes', '/plans']);
  });

  it('tells the admin, who never buys, who can open a premium recipe', async () => {
    await openPage('/recipes/5', admin);
    http.expectOne('/api/recipes/5').flush({ title: 'Chicken Teriyaki', availableIn: [] }, { status: 403, statusText: 'Forbidden' });
    await harness.fixture.whenStable();

    expect(text('[data-locked]')).toBe('A premium recipe. Only its creator and the cooks who own its plan can open it.');
  });

  it('says there is no recipe at an address that names none', async () => {
    await openPage('/recipes/999');
    http.expectOne('/api/recipes/999').flush('', { status: 404, statusText: 'Not Found' });
    await harness.fixture.whenStable();

    expect(text('h1')).toBe('Recipe not found');
    expect(page.textContent).toContain('There is no recipe at this address.');
    expect(TestBed.inject(Title).getTitle()).toBe('Recipe not found | Cookfeed');
  });

  it('says it is loading, then that it could not be loaded, rather than showing nothing', async () => {
    await openPage('/recipes/16');
    expect(text('[role="status"]')).toContain('Loading');
    expect(page.querySelectorAll('h1').length).toBe(1);

    http.expectOne('/api/recipes/16').flush('down', { status: 503, statusText: 'Service Unavailable' });
    await harness.fixture.whenStable();

    expect(text('[role="alert"]')).toContain('could not be loaded');
  });

  it('has no accessibility violations a structural check can find', async () => {
    await show({ ...teriyaki, savedByViewer: true }, alex);
    button('Watch at 1:16').click();
    await typePeople('60');

    // Color contrast needs a real browser's rendering; the browser tests check it.
    const results = await axe.run(page, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });

    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
});
