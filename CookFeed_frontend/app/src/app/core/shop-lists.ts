import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { plural } from '../ui/format';
import { CookfeedApi } from './api';
import { ShopResult, TripSummary } from './api-types';

/** What the cook picked: a list in use, by its id, or a new list. */
export type ListPick = number | 'new';

interface ListQuestion {
  /** The lists in use, newest first. */
  lists: TripSummary[];
  settle: (pick: ListPick | null) => void;
}

/** What a page says after Shop again: "2 recipes are on a new list." */
export const onNewList = (added: number) => `${plural(added, 'recipe', 'recipes')} ${added === 1 ? 'is' : 'are'} on a new list.`;

/**
 * Shopping a recipe or a plan from its page. A cook can keep several shopping lists going, so with a list in use
 * the cook is asked which one, or a new one; with none, a list is made without a question. A page calls shop() and
 * waits; the app shell holds the one dialog that asks (ListChoiceDialog).
 */
@Injectable({ providedIn: 'root' })
export class ShopLists {
  private readonly api = inject(CookfeedApi);

  /** The question being asked, or null. Read by the dialog. */
  readonly question = signal<ListQuestion | null>(null);

  /** Puts the recipe or the plan on a list and answers what happened; null when the cook cancelled. */
  async shop(what: { recipeId: number; servings?: number } | { productId: number }): Promise<ShopResult | null> {
    const lists = (await firstValueFrom(this.api.trips())).open;
    if (lists.length === 0) {
      return firstValueFrom(this.api.shop(what));
    }
    const pick = await this.ask(lists);
    if (pick === null) {
      return null;
    }
    return firstValueFrom(this.api.shop(what, pick === 'new' ? { newList: true } : { tripId: pick }));
  }

  /** Resolves with the list picked, 'new' for a new list, or null for Cancel, Escape or a click outside. */
  ask(lists: TripSummary[]): Promise<ListPick | null> {
    // A second question while one is open answers the first with nothing.
    this.question()?.settle(null);
    return new Promise((settle) => this.question.set({ lists, settle }));
  }
}
