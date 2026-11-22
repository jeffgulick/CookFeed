import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { CookfeedApi } from '../../core/api';
import { loadList } from '../../core/load';
import { Session } from '../../core/session';
import { CreatorTile } from '../../ui/creator-tile';
import { Icon } from '../../ui/icon';
import { LoadStateMessage } from '../../ui/load-state';
import { ProductTile } from '../../ui/product-tile';
import { RecipeCard } from '../../ui/recipe-card';

/**
 * Discover, the home page. It says what Cookfeed is before it shows anything to buy: one sentence, then the three
 * steps a cook takes. Then three lists from the store: the plans and collections for sale, the recipes home cooks
 * save most, and the creators.
 */
@Component({
  selector: 'app-discover',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, RecipeCard, ProductTile, CreatorTile, LoadStateMessage],
  templateUrl: './discover.html',
})
export class DiscoverPage {
  /** How many trending recipes the home page shows: two rows of three on a wide screen. */
  private static readonly TrendingCount = 6;

  private readonly api = inject(CookfeedApi);
  private readonly session = inject(Session);

  /** A guest is told what Cookfeed is; a signed-in cook is welcomed back by first name. */
  protected readonly greeting = computed(() => {
    const user = this.session.user();
    return user === null
      ? 'Short cooking videos, real recipes, and a shopping list built from what you cook.'
      : `Welcome back, ${user.displayName.split(' ')[0]}.`;
  });

  /**
   * The plans and collections for sale, newest first, as the API sends them. Read again when the account changes,
   * because each tile says whether this viewer already owns it.
   */
  protected readonly plans = loadList(
    () => this.api.products(),
    computed(() => this.session.user()?.id ?? null),
  );

  protected readonly trending = loadList(() =>
    this.api.feed('Trending', DiscoverPage.TrendingCount).pipe(map((page) => page.items)),
  );

  protected readonly creators = loadList(() => this.api.creators());
}
