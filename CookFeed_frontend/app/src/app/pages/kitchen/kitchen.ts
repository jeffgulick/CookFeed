import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import { CookfeedApi } from '../../core/api';
import { loadList, loadValue } from '../../core/load';
import { Notices, problemText } from '../../core/notices';
import { Session } from '../../core/session';
import { longDate, plural, productCounts, productTypeLabel } from '../../ui/format';
import { LoadStateMessage } from '../../ui/load-state';
import { RecipeCard } from '../../ui/recipe-card';

/**
 * My kitchen (/kitchen): the signed-in cook's shopping list, the plans they bought, the recipes they saved, and the
 * lists they finished, each leading to its page.
 * A plan is listed as it was titled when it was bought, with what that purchase holds. A guest is asked to sign in;
 * the admin, who does not shop or save, is told so.
 */
@Component({
  selector: 'app-kitchen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RecipeCard, LoadStateMessage],
  templateUrl: './kitchen.html',
})
export class KitchenPage {
  private readonly api = inject(CookfeedApi);
  private readonly notices = inject(Notices);
  protected readonly session = inject(Session);

  /** Who the kitchen belongs to: read again when the account changes. A guest and the admin have none. */
  private readonly cook = computed(() => (this.session.canShop() ? (this.session.user()?.id ?? null) : null));

  /** Goes up after each unsave, so the saved list is read again and shows what is saved now. */
  private readonly savesChanged = signal(0);

  protected readonly plans = loadList(() => (this.cook() === null ? of([]) : this.api.purchases()), this.cook);

  protected readonly saved = loadList(
    () => (this.cook() === null ? of([]) : this.api.saves()),
    computed(() => `${this.cook()} ${this.savesChanged()}`),
  );

  /** The cook's shopping lists: the one in use, and the finished ones. */
  protected readonly lists = loadValue(
    () => (this.cook() === null ? of({ active: null, past: [] }) : this.api.trips()),
    this.cook,
  );

  /** The list in use, in a line: "2 recipes · Shopping". Null when there is none. */
  protected readonly activeList = computed(() => {
    const active = this.lists.value()?.active ?? null;
    return active === null
      ? null
      : { name: active.name, about: `${plural(active.recipeCount, 'recipe', 'recipes')} · ${active.status}` };
  });

  protected readonly pastLists = computed(() =>
    (this.lists.value()?.past ?? []).map((list) => ({
      id: list.id,
      name: list.name,
      made: longDate(list.createdAt),
      recipes: list.recipeCount,
      status: list.status === 'Done' && list.completedAt !== null ? `Done ${longDate(list.completedAt)}` : list.status,
    })),
  );

  protected readonly planTiles = computed(() =>
    this.plans.items().map((plan) => ({
      id: plan.productId,
      title: plan.title,
      typeLabel: productTypeLabel(plan.type),
      // "5 recipes, 6 meals · yours to keep": counted from what this purchase holds.
      about: `${productCounts(plan.recipeCount, plan.mealCount)} · yours to keep`,
      // The API sends a path such as images/products/4.svg; the app serves those from its own /images folder.
      imageUrl: '/' + (plan.coverImageUrl ?? 'images/products/new.svg'),
    })),
  );

  protected async unsave(recipe: { id: number; title: string }): Promise<void> {
    try {
      await firstValueFrom(this.api.unsave(recipe.id));
      this.notices.say(`${recipe.title} is no longer saved.`);
      this.savesChanged.update((count) => count + 1);
    } catch (error) {
      this.notices.problem(problemText(error, 'That could not be unsaved. Please try again.'));
    }
  }
}
