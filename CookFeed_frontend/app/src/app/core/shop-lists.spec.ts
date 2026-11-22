import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { isoDay } from '../ui/format';
import { ShopResult, TripSummary, Trips } from './api-types';
import { ShopLists, onNewList } from './shop-lists';

/* Shopping a recipe or a plan: straight onto a new list when the cook has none in use; otherwise the cook is asked
   which list, or a new one. */
describe('ShopLists', () => {
  const list = (id: number, name: string): TripSummary => ({
    id,
    name,
    status: 'Building',
    createdAt: '2026-11-21T12:00:00+00:00',
    completedAt: null,
    recipeCount: 1,
  });
  const first = list(7, 'Shopping list, November 21');
  const second = list(8, 'Shopping list, November 21 (2)');
  const result: ShopResult = { tripId: 7, tripName: first.name, created: false, added: 1, alreadyOnList: 0 };
  const today = isoDay(new Date());

  let http: HttpTestingController;
  let lists: ShopLists;

  /** Lets the promise chain between two requests run. */
  const tick = () => new Promise((done) => setTimeout(done));

  async function cookHas(open: TripSummary[]): Promise<void> {
    http.expectOne('/api/me/trips').flush({ active: open[0] ?? null, open, past: [] } satisfies Trips);
    await tick();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    lists = TestBed.inject(ShopLists);
  });

  it('puts a recipe straight on a new list when the cook has none in use, without asking', async () => {
    const shopped = lists.shop({ recipeId: 16, servings: 2 });
    await cookHas([]);

    expect(lists.question()).toBeNull();
    const request = http.expectOne('/api/me/trips/items');
    expect(request.request.body).toEqual({ recipeId: 16, servings: 2, today });
    request.flush(result);
    expect(await shopped).toEqual(result);
  });

  it('asks which list when the cook has lists in use, newest first, and adds to the one picked', async () => {
    const shopped = lists.shop({ recipeId: 16, servings: 2 });
    await cookHas([second, first]);

    expect(lists.question()?.lists).toEqual([second, first]);
    http.expectNone('/api/me/trips/items');

    lists.question()!.settle(first.id);
    await tick();
    const request = http.expectOne('/api/me/trips/items');
    expect(request.request.body).toEqual({ recipeId: 16, servings: 2, today, tripId: 7 });
    request.flush(result);
    expect(await shopped).toEqual(result);
  });

  it('starts a new list when the cook asks for one, for a plan as for a recipe', async () => {
    const shopped = lists.shop({ productId: 4 });
    await cookHas([first]);

    lists.question()!.settle('new');
    await tick();
    const request = http.expectOne('/api/me/trips/items');
    expect(request.request.body).toEqual({ productId: 4, today, newList: true });
    request.flush({ ...result, tripId: 9, created: true });
    expect((await shopped)?.tripId).toBe(9);
  });

  it('adds nothing when the cook cancels', async () => {
    const shopped = lists.shop({ recipeId: 16 });
    await cookHas([first]);

    lists.question()!.settle(null);

    expect(await shopped).toBeNull();
    http.expectNone('/api/me/trips/items');
  });

  it('says how many recipes went on a new list', () => {
    expect(onNewList(1)).toBe('1 recipe is on a new list.');
    expect(onNewList(3)).toBe('3 recipes are on a new list.');
  });
});
