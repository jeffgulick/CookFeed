import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { CookfeedApi } from '../../core/api';
import { FeedItem } from '../../core/api-types';
import { Icon } from '../../ui/icon';
import { RecipeCard } from '../../ui/recipe-card';

/**
 * Discover, the home page. It says what Cookfeed is before it shows anything to buy: one sentence, then the three
 * steps a cook takes, then the recipes home cooks save most.
 */
@Component({
  selector: 'app-discover',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, RecipeCard],
  templateUrl: './discover.html',
})
export class DiscoverPage {
  /** How many trending recipes the home page shows: two rows of three on a wide screen. */
  private static readonly TrendingCount = 6;

  protected readonly trending = signal<FeedItem[]>([]);
  protected readonly state = signal<'loading' | 'ready' | 'failed'>('loading');

  constructor() {
    inject(CookfeedApi)
      .feed('Trending', DiscoverPage.TrendingCount)
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (page) => {
          this.trending.set(page.items);
          this.state.set('ready');
        },
        error: () => this.state.set('failed'),
      });
  }
}
