import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CookfeedApi } from '../../core/api';
import { ProductSort, ProductType } from '../../core/api-types';
import { loadList } from '../../core/load';
import { Session } from '../../core/session';
import { plural } from '../../ui/format';
import { LoadStateMessage } from '../../ui/load-state';
import { ProductTile } from '../../ui/product-tile';

type Kind = 'all' | ProductType;

/**
 * Every meal plan and collection for sale (/plans), with a filter by kind and a sort. The API puts them in order,
 * since it holds the ratings and the dates; the page filters what it was sent, so it can say "Showing 2 of 4"
 * without a second request.
 */
@Component({
  selector: 'app-plans',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProductTile, LoadStateMessage],
  templateUrl: './plans.html',
})
export class PlansPage {
  private readonly api = inject(CookfeedApi);
  private readonly session = inject(Session);

  protected readonly kinds: { value: Kind; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'MealPlan', label: 'Meal plans' },
    { value: 'RecipeCollection', label: 'Collections' },
  ];

  protected readonly kind = signal<Kind>('all');
  protected readonly sortBy = signal<ProductSort>('Newest');

  /**
   * Everything for sale in the chosen order. Read again when the order changes, and when the account does, because
   * each tile says whether this viewer already owns it.
   */
  protected readonly plans = loadList(
    () => this.api.products({ sort: this.sortBy() }),
    computed(() => `${this.sortBy()} ${this.session.user()?.id ?? 'guest'}`),
  );

  protected readonly shown = computed(() => {
    const kind = this.kind();
    return this.plans.items().filter((plan) => kind === 'all' || plan.type === kind);
  });

  /** "Showing all 4 plans", or "Showing 2 of 4" under a filter. Nothing until the plans have been read. */
  protected readonly showing = computed(() => {
    if (this.plans.state() !== 'ready') {
      return '';
    }
    const all = this.plans.items().length;
    const shown = this.shown().length;
    return shown === all ? `Showing all ${plural(all, 'plan', 'plans')}` : `Showing ${shown} of ${all}`;
  });

  protected setSort(value: string): void {
    this.sortBy.set(value as ProductSort);
  }
}
