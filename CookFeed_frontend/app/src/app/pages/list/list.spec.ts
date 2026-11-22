import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import axe from 'axe-core';
import { Account, ShoppingListLine, Trip, Trips } from '../../core/api-types';
import { Notices } from '../../core/notices';
import { Session } from '../../core/session';
import { Confirm } from '../../ui/confirm';
import { isoDay } from '../../ui/format';
import { ListPage } from './list';

/* A shopping list (the prototype's list.html): what to buy, under the aisle each thing is found in; "Have it" for
   what is already at home; the recipes the list cooks, each for a number of people; and the list's life, with only
   the buttons that fit where it is. /list is the list in use; /list/7 is one list, such as a finished one. */
describe('Shopping list page', () => {
  const noor: Account = { id: 8, displayName: 'Noor Haddad', roles: ['HomeCook'], handle: null };
  const admin: Account = { id: 6, displayName: 'Cookfeed Admin', roles: ['Admin'], handle: null };

  const line = (ingredientId: number, ingredient: string, aisle: string, quantity: number, unit: string): ShoppingListLine => ({
    ingredientId,
    ingredient,
    aisle,
    quantity,
    unit,
  });
  const chicken = line(11, 'chicken thigh', 'Meat', 800, 'g');
  const broccoli = line(21, 'broccoli', 'Produce', 2, 'ea');
  const carrot = line(22, 'carrot', 'Produce', 3, 'ea');

  const building: Trip = {
    id: 7,
    name: 'Shopping list, November 21',
    status: 'Building',
    // Noon UTC, so the date reads the same in any time zone the tests run in.
    createdAt: '2026-11-21T12:00:00+00:00',
    completedAt: null,
    canChange: true,
    items: [{ recipeId: 18, title: 'Sheet-Pan Chicken and Vegetables', servings: 4 }],
    lines: [chicken, broccoli, carrot],
    skipped: [],
  };
  const shopping: Trip = { ...building, status: 'Shopping' };
  const done: Trip = { ...building, status: 'Done', canChange: false, completedAt: '2026-11-22T12:00:00+00:00' };
  const active = (trip: Trip): Trips => {
    const summary = { id: trip.id, name: trip.name, status: trip.status, createdAt: trip.createdAt, completedAt: null, recipeCount: 1 };
    return { active: summary, open: [summary], past: [] };
  };

  let harness: RouterTestingHarness;
  let page: HTMLElement;
  let http: HttpTestingController;

  async function open(address: string, signedInAs: Account | null = noor): Promise<void> {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'list', component: ListPage },
          { path: 'list/:id', component: ListPage },
          { path: 'kitchen', component: ListPage },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const session = TestBed.inject(Session);
    session.accounts.set([noor, admin]);
    if (signedInAs !== null) {
      session.signIn(signedInAs.id);
    }
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(address, ListPage);
    page = harness.routeNativeElement as HTMLElement;
  }

  /** Opens /list for a cook whose list in use is this one. */
  async function show(trip: Trip): Promise<void> {
    await open('/list');
    http.expectOne('/api/me/trips').flush(active(trip));
    await settle();
    http.expectOne(`/api/me/trips/${trip.id}`).flush(trip);
    await settle();
  }

  /** Lets a press, the request it sends and the redraw after it all finish. */
  async function settle(): Promise<void> {
    await harness.fixture.whenStable();
    await new Promise((done) => setTimeout(done));
    await harness.fixture.whenStable();
  }

  const text = (selector: string) => page.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const texts = (selector: string) =>
    Array.from(page.querySelectorAll(selector)).map((el) => el.textContent?.replace(/\s+/g, ' ').trim());
  const button = (name: string) =>
    Array.from(page.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === name || b.getAttribute('aria-label') === name,
    ) as HTMLButtonElement | undefined;

  it('names the list, says where it is in its life, and what it cooks', async () => {
    await show(building);

    expect(page.querySelectorAll('h1').length).toBe(1);
    expect(text('h1')).toBe('Shopping list, November 21');
    expect(text('[data-status]')).toBe('Building');
    expect(text('[data-summary]')).toBe('1 recipe, made November 21, 2026');
    expect(page.querySelector('[data-list-recipe] a')?.getAttribute('href')).toBe('/recipes/18');
    expect(text('[data-list-recipe] a')).toBe('Sheet-Pan Chicken and Vegetables');
    expect((page.querySelector('[data-list-recipe] input') as HTMLInputElement).value).toBe('4');
    expect(page.querySelector('[data-back] a')?.getAttribute('href')).toBe('/kitchen');
  });

  it('lists what to buy under the aisle each thing is found in, in the order the API sends', async () => {
    await show(building);

    expect(text('[data-to-buy] h2')).toBe('3 items to buy');
    expect(texts('[data-to-buy] h3')).toEqual(['Meat', 'Produce']);
    expect(texts('[data-line] [data-line-name]')).toEqual(['chicken thigh', 'broccoli', 'carrot']);
    expect(texts('[data-line] [data-line-amount]')).toEqual(['800 g', '2 ea', '3 ea']);
  });

  it('offers Start shopping while the list is being built, with no boxes to tick yet', async () => {
    await show(building);

    expect(button('Start shopping')).toBeDefined();
    expect(button('Done shopping')).toBeUndefined();
    expect(page.querySelectorAll('input[type="checkbox"]').length).toBe(0);
    expect(text('[data-hint]')).toContain('Press Have it on anything you already have at home.');
  });

  it('takes a line off with Have it, and shows what the API answers', async () => {
    await show(building);

    button('Have it: broccoli')!.click();
    const request = http.expectOne('/api/me/trips/7/skips/21');
    expect(request.request.method).toBe('PUT');
    request.flush({ ...building, lines: [chicken, carrot], skipped: [{ ingredientId: 21, ingredient: 'broccoli' }] });
    await settle();

    expect(texts('[data-line] [data-line-name]')).toEqual(['chicken thigh', 'carrot']);
    expect(text('[data-skipped]')).toContain('Already at home, off the list: broccoli');
    expect(text('[data-to-buy] h2')).toBe('2 items to buy');
  });

  it('puts a line back from the strip of things already at home', async () => {
    await show({ ...building, lines: [chicken, carrot], skipped: [{ ingredientId: 21, ingredient: 'broccoli' }] });

    button('Put back: broccoli')!.click();
    const request = http.expectOne('/api/me/trips/7/skips/21');
    expect(request.request.method).toBe('DELETE');
    request.flush(building);
    await settle();

    expect(page.querySelector('[data-skipped]')).toBeNull();
    expect(page.querySelectorAll('[data-line]').length).toBe(3);
  });

  it('changes the people a recipe is cooked for, and says so', async () => {
    await show(building);
    const people = page.querySelector('[data-list-recipe] input') as HTMLInputElement;
    expect(people.getAttribute('aria-label')).toBe('People for Sheet-Pan Chicken and Vegetables');

    people.value = '8';
    people.dispatchEvent(new Event('change'));
    const request = http.expectOne('/api/me/trips/7/items/18');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ servings: 8 });
    request.flush({ ...building, items: [{ ...building.items[0], servings: 8 }], lines: [{ ...chicken, quantity: 1600 }] });
    await settle();

    expect(texts('[data-line] [data-line-amount]')).toEqual(['1600 g']);
    expect(TestBed.inject(Notices).message()?.text).toBe('Sheet-Pan Chicken and Vegetables is now for 8 people.');
  });

  it('refuses a number of people a recipe cannot be cooked for, and sends nothing', async () => {
    await show(building);
    const people = page.querySelector('[data-list-recipe] input') as HTMLInputElement;

    for (const typed of ['0', '51', '2.5', '']) {
      people.value = typed;
      people.dispatchEvent(new Event('change'));
      await settle();
      expect(text('[data-people-error]')).not.toBe('');
    }

    http.expectNone('/api/me/trips/7/items/18');
  });

  it('takes a recipe off the list', async () => {
    await show(building);

    button('Take off list: Sheet-Pan Chicken and Vegetables')!.click();
    const request = http.expectOne('/api/me/trips/7/items/18');
    expect(request.request.method).toBe('DELETE');
    request.flush({ ...building, items: [], lines: [] });
    await settle();

    expect(page.querySelectorAll('[data-list-recipe]').length).toBe(0);
    expect(text('[data-to-buy]')).toContain('Nothing to buy yet.');
    expect(text('[data-cooks]')).toContain('No recipes on this list yet.');
  });

  it('starts shopping, then gives each line a box to tick and counts what is left', async () => {
    await show(building);

    button('Start shopping')!.click();
    const request = http.expectOne('/api/me/trips/7/start');
    expect(request.request.method).toBe('POST');
    request.flush(shopping);
    await settle();

    expect(text('[data-status]')).toBe('Shopping');
    const boxes = Array.from(page.querySelectorAll<HTMLInputElement>('[data-line] input[type="checkbox"]'));
    expect(boxes.map((box) => box.getAttribute('aria-label'))).toEqual([
      'In my basket: chicken thigh',
      'In my basket: broccoli',
      'In my basket: carrot',
    ]);
    expect(text('[data-progress]')).toBe('3 of 3 items still to buy');

    boxes[0].checked = true;
    boxes[0].dispatchEvent(new Event('change'));
    await settle();
    expect(text('[data-progress]')).toBe('2 of 3 items still to buy');
    // Ticks are kept on this device, not sent to the API.
    http.expectNone((r) => r.method !== 'GET');
  });

  it('says so when everything is in the basket', async () => {
    await show({ ...shopping, lines: [chicken] });

    const box = page.querySelector<HTMLInputElement>('[data-line] input[type="checkbox"]')!;
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    await settle();

    expect(text('[data-progress]')).toBe('All done. Everything is in your basket.');
  });

  it('finishes the list after asking, and then offers nothing that would change it', async () => {
    await show(shopping);

    button('Done shopping')!.click();
    await settle();
    const question = TestBed.inject(Confirm).question();
    expect(question?.message).toBe('Done shopping? The list is marked done and kept in your past lists.');
    expect(question?.action).toBe('Done shopping');
    question!.settle(true);
    await settle();
    const request = http.expectOne('/api/me/trips/7/done');
    expect(request.request.method).toBe('POST');
    request.flush(done);
    await settle();

    expect(text('[data-status]')).toBe('Done November 22, 2026');
    expect(button('Start shopping')).toBeUndefined();
    expect(button('Done shopping')).toBeUndefined();
    expect(button('Have it: broccoli')).toBeUndefined();
    expect(page.querySelector('[data-list-recipe] input')).toBeNull();
    expect(text('[data-list-recipe]')).toContain('for 4 people');
    expect(text('[data-hint]')).toBe('This list is done and kept as a record. Shop again makes a new list from it.');
  });

  it('shops a finished list again: makes a new list from it, says so, and opens it', async () => {
    await open('/list/7');
    http.expectOne('/api/me/trips/7').flush(done);
    await settle();
    expect(button('Shop again')).toBeDefined();

    button('Shop again')!.click();
    const request = http.expectOne('/api/me/trips/7/again');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ today: isoDay(new Date()) });
    request.flush({ tripId: 9, tripName: 'Shopping list, November 23', created: true, added: 1, alreadyOnList: 0 });
    await settle();

    expect(TestBed.inject(Notices).message()?.text).toBe('1 recipe is on a new list.');
    expect(TestBed.inject(Router).url).toBe('/list/9');
    http.expectOne('/api/me/trips/9').flush({ ...building, id: 9, name: 'Shopping list, November 23' });
    await settle();
    expect(text('h1')).toBe('Shopping list, November 23');
  });

  it('offers Shop again only on a finished list', async () => {
    await show(building);
    expect(button('Shop again')).toBeUndefined();
  });

  it('deletes the list after asking, and goes back to the kitchen', async () => {
    await show(building);

    button('Delete this list')!.click();
    await settle();
    const question = TestBed.inject(Confirm).question();
    expect(question?.message).toBe('Delete "Shopping list, November 21"? It cannot be brought back.');
    question!.settle(true);
    await settle();
    const request = http.expectOne('/api/me/trips/7');
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content' });
    await settle();

    expect(TestBed.inject(Router).url).toBe('/kitchen');
  });

  it('tells a cook with no list in use how to start one', async () => {
    await open('/list');
    http.expectOne('/api/me/trips').flush({ active: null, open: [], past: [] } satisfies Trips);
    await settle();

    expect(text('h1')).toBe('Shopping list');
    expect(text('[data-no-list]')).toContain('You have no shopping list yet.');
    expect(text('[data-no-list]')).toContain('Press Shop this recipe on a recipe, or Shop this plan on a plan you own');
    expect(page.querySelector('[data-no-list] a')?.getAttribute('href')).toBe('/recipes');
  });

  it('opens one list by its id, such as a finished one', async () => {
    await open('/list/7');
    http.expectOne('/api/me/trips/7').flush(done);
    await settle();

    expect(text('h1')).toBe('Shopping list, November 21');
    expect(text('[data-status]')).toBe('Done November 22, 2026');
  });

  it('says so when the address names no list of the cook\'s', async () => {
    await open('/list/999');
    http.expectOne('/api/me/trips/999').flush({ detail: 'There is no such list.' }, { status: 404, statusText: 'Not Found' });
    await settle();

    expect(text('h1')).toBe('List not found');
  });

  it('asks a visitor to sign in, and tells the admin that admins do not shop', async () => {
    await open('/list', null);
    const link = page.querySelector('[data-no-list-here] a');
    expect(link?.textContent?.trim()).toBe('Sign in to see your shopping list');
    expect(link?.getAttribute('href')).toBe('/sign-in?next=%2Flist');
    http.expectNone('/api/me/trips');

    TestBed.resetTestingModule();
    await open('/list', admin);
    expect(text('[data-no-list-here]')).toBe('Admin accounts do not shop, so there is no shopping list.');
    http.expectNone('/api/me/trips');
  });

  it('has no accessibility violations a structural check can find', async () => {
    await show({ ...shopping, skipped: [{ ingredientId: 30, ingredient: 'olive oil' }] });

    const results = await axe.run(page, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });

    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
});
