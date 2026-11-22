import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, firstValueFrom, map, of, switchMap } from 'rxjs';
import { CookfeedApi } from '../../core/api';
import { Trip } from '../../core/api-types';
import { loadValue } from '../../core/load';
import { Notices, problemText } from '../../core/notices';
import { PEOPLE_MAX, PEOPLE_MIN, peopleProblem } from '../../core/people';
import { Session } from '../../core/session';
import { onNewList } from '../../core/shop-lists';
import { Confirm } from '../../ui/confirm';
import { amount, longDate, plural } from '../../ui/format';
import { LoadStateMessage } from '../../ui/load-state';

/**
 * One shopping list, for one visit to the store, readable on a phone (/list is the list in use; /list/7 is one
 * list, such as a finished one). What to buy is under the aisle each thing is found in. "Have it" takes off what is
 * already at home. The recipes the list cooks can be cooked for more or fewer people, or taken off. The list is
 * built, then shopped, with a box to tick as each thing goes in the basket, then done and kept as a record, from
 * which Shop again makes a new list.
 *
 * The API works the lines out from the recipes and answers every change with the whole list. The ticks are a
 * convenience of this device, kept in the browser, not sent to the API.
 */
@Component({
  selector: 'app-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LoadStateMessage],
  templateUrl: './list.html',
})
export class ListPage {
  private readonly api = inject(CookfeedApi);
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly notices = inject(Notices);
  private readonly confirm = inject(Confirm);
  protected readonly session = inject(Session);

  protected readonly minPeople = PEOPLE_MIN;
  protected readonly maxPeople = PEOPLE_MAX;

  /** The list the address names, or null on /list, which means the list in use. */
  private readonly id = toSignal(inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('id'))), {
    requireSync: true,
  });

  /** Whose lists these are: a guest and the admin have none, so nothing is asked for them. */
  private readonly cook = computed(() => (this.session.canShop() ? (this.session.user()?.id ?? null) : null));

  /** Null, with the state "ready", is a cook with no list in use. */
  private readonly loaded = loadValue(
    () => this.read(),
    computed(() => `${this.id()} ${this.cook()}`),
  );
  protected readonly state = this.loaded.state;

  /** The list on screen: what was read, then whatever the last change answered with. */
  protected readonly trip = signal<Trip | null>(null);

  /** The ingredients ticked off in the store, by ingredient id and unit. Kept in the browser for this list. */
  private readonly ticked = signal<ReadonlySet<string>>(new Set());

  /** What is wrong with a number of people just typed; empty when nothing is. */
  protected readonly peopleError = signal('');

  /** True while a change is on its way, so a second press does nothing. */
  protected readonly busy = signal(false);

  protected readonly view = computed(() => {
    const trip = this.trip();
    if (trip === null) {
      return null;
    }
    const ticked = this.ticked();
    const shopping = trip.status === 'Shopping';
    const lines = trip.lines.map((line) => {
      const key = `${line.ingredientId} ${line.unit}`;
      return { ...line, key, amount: `${amount(line.quantity)} ${line.unit}`, ticked: shopping && ticked.has(key) };
    });
    // The lines arrive sorted by aisle, so each aisle is one run.
    const aisles: { name: string; lines: typeof lines }[] = [];
    for (const line of lines) {
      const last = aisles[aisles.length - 1];
      if (last?.name === line.aisle) {
        last.lines.push(line);
      } else {
        aisles.push({ name: line.aisle, lines: [line] });
      }
    }
    const remaining = lines.filter((line) => !line.ticked).length;

    return {
      status: trip.status === 'Done' && trip.completedAt !== null ? `Done ${longDate(trip.completedAt)}` : trip.status,
      summary: `${plural(trip.items.length, 'recipe', 'recipes')}, made ${longDate(trip.createdAt)}`,
      heading: `${plural(lines.length, 'item', 'items')} to buy`,
      aisles,
      shopping,
      // The tick boxes mean "in my basket", so they appear once the cook starts shopping, not while building.
      progress:
        lines.length > 0 && remaining === 0
          ? 'All done. Everything is in your basket.'
          : `${remaining} of ${lines.length} items still to buy`,
      hint:
        trip.status === 'Building'
          ? 'Press Have it on anything you already have at home. Then start shopping.'
          : trip.status === 'Shopping'
            ? 'Tick each thing as it goes in your basket. You can still change the list.'
            : 'This list is done and kept as a record. Shop again makes a new list from it.',
    };
  });

  constructor() {
    // What was read becomes the list on screen, with the ticks this browser kept for it.
    effect(() => {
      const trip = this.loaded.value();
      this.trip.set(trip);
      this.ticked.set(new Set(trip === null ? [] : readTicks(trip.id)));
      this.peopleError.set('');
    });

    effect(() => {
      const name = this.state() === 'missing' ? 'List not found' : (this.trip()?.name ?? 'Shopping list');
      this.title.setTitle(`${name} | Cookfeed`);
    });
  }

  /** "Have it" takes an ingredient off the list; "put back" returns it. */
  protected setSkip(ingredientId: number, skipped: boolean): Promise<void> {
    return this.change((trip) => this.api.setTripSkip(trip.id, ingredientId, skipped));
  }

  /** A whole number of people from 1 to 50 rescales the list; anything else says what is wrong and sends nothing. */
  protected async setPeople(recipe: { recipeId: number; title: string }, typed: string): Promise<void> {
    const problem = peopleProblem(typed);
    this.peopleError.set(problem);
    if (problem !== '') {
      return;
    }
    const people = Number(typed);
    await this.change(
      (trip) => this.api.setTripServings(trip.id, recipe.recipeId, people),
      `${recipe.title} is now for ${plural(people, 'person', 'people')}.`,
    );
  }

  protected takeOff(recipe: { recipeId: number; title: string }): Promise<void> {
    return this.change((trip) => this.api.removeTripRecipe(trip.id, recipe.recipeId), `${recipe.title} is off the list.`);
  }

  protected start(): Promise<void> {
    return this.change((trip) => this.api.moveTrip(trip.id, 'start'), 'Tick each thing as it goes in your basket.');
  }

  protected async finish(): Promise<void> {
    if (!(await this.confirm.ask('Done shopping? The list is marked done and kept in your past lists.', 'Done shopping'))) {
      return;
    }
    const tripId = this.trip()?.id;
    await this.change((trip) => this.api.moveTrip(trip.id, 'done'), 'The list is done. It stays in your past lists.');
    if (tripId !== undefined) {
      forgetTicks(tripId);
    }
  }

  /** "Shop again": a new list with this finished list's recipes and people; this one stays as it is. */
  protected async shopAgain(): Promise<void> {
    const trip = this.trip();
    if (trip === null || this.busy()) {
      return;
    }
    this.busy.set(true);
    try {
      const result = await firstValueFrom(this.api.shopAgain(trip.id));
      this.notices.say(onNewList(result.added));
      await this.router.navigate(['/list', result.tripId]);
    } catch (error) {
      this.notices.problem(problemText(error, 'A new list could not be made. Please try again.'));
    } finally {
      this.busy.set(false);
    }
  }

  protected async deleteList(): Promise<void> {
    const trip = this.trip();
    if (trip === null || !(await this.confirm.ask(`Delete "${trip.name}"? It cannot be brought back.`, 'Delete list'))) {
      return;
    }
    try {
      await firstValueFrom(this.api.deleteTrip(trip.id));
      forgetTicks(trip.id);
      this.notices.say(`"${trip.name}" is deleted.`);
      await this.router.navigateByUrl('/kitchen');
    } catch (error) {
      this.notices.problem(problemText(error, 'The list could not be deleted. Please try again.'));
    }
  }

  /** Ticks a line as in the basket, or unticks it. Nothing is sent: the ticks belong to this device. */
  protected tick(key: string, inBasket: boolean): void {
    const trip = this.trip();
    if (trip === null) {
      return;
    }
    const ticked = new Set(this.ticked());
    if (inBasket) {
      ticked.add(key);
    } else {
      ticked.delete(key);
    }
    this.ticked.set(ticked);
    writeTicks(trip.id, [...ticked]);
  }

  /** The list in use when the address names none; otherwise the list it names. */
  private read(): Observable<Trip | null> {
    if (this.cook() === null) {
      return of(null);
    }
    const id = this.id();
    return id !== null
      ? this.api.trip(id)
      : this.api.trips().pipe(switchMap((trips) => (trips.active === null ? of(null) : this.api.trip(trips.active.id))));
  }

  /** Sends one change, shows the list the API answers with, and says what happened. */
  private async change(send: (trip: Trip) => Observable<Trip>, done?: string): Promise<void> {
    const trip = this.trip();
    if (trip === null || this.busy()) {
      return;
    }
    this.busy.set(true);
    try {
      this.trip.set(await firstValueFrom(send(trip)));
      if (done !== undefined) {
        this.notices.say(done);
      }
    } catch (error) {
      this.notices.problem(problemText(error, 'The list could not be changed. Please try again.'));
    } finally {
      this.busy.set(false);
    }
  }
}

/* The ticks made in the store are kept in the browser, one entry per list (the prototype's tripHaveKey). */
const ticksKey = (tripId: number) => `cookfeed.have.trip.${tripId}`;

function readTicks(tripId: number): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(ticksKey(tripId)) ?? '[]');
    return Array.isArray(stored) ? stored.filter((key): key is string => typeof key === 'string') : [];
  } catch {
    return [];
  }
}

function writeTicks(tripId: number, keys: string[]): void {
  try {
    localStorage.setItem(ticksKey(tripId), JSON.stringify(keys));
  } catch {
    // Storage can be switched off (private windows): the ticks then last until the page is reloaded.
  }
}

function forgetTicks(tripId: number): void {
  try {
    localStorage.removeItem(ticksKey(tripId));
  } catch {
    // Nothing was stored, so there is nothing to remove.
  }
}
