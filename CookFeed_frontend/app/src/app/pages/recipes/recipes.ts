import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, map } from 'rxjs';
import { CookfeedApi } from '../../core/api';
import { FeedSort } from '../../core/api-types';
import { loadValue } from '../../core/load';
import { plural } from '../../ui/format';
import { LoadStateMessage } from '../../ui/load-state';
import { RecipeCard } from '../../ui/recipe-card';

/**
 * Every free recipe (/recipes), most saved first or newest first, with a search over the title and the creator.
 * Only free recipes are listed: a premium recipe is sold inside a plan, so it is shown on that plan's page, and
 * listing it here, even locked, would give away what the plan sells. The API searches and sorts.
 */
@Component({
  selector: 'app-recipes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RecipeCard, LoadStateMessage],
  templateUrl: './recipes.html',
})
export class RecipesPage {
  /** How long the page waits after the last key before it searches, so one word is one request, not one per letter. */
  static readonly SearchPauseMs = 250;

  /** The most recipes the API sends in one page. */
  private static readonly PageSize = 50;

  private readonly api = inject(CookfeedApi);

  protected readonly sorts: { value: FeedSort; label: string }[] = [
    { value: 'Trending', label: 'Most saved' },
    { value: 'Newest', label: 'Newest' },
  ];

  protected readonly sortBy = signal<FeedSort>('Trending');

  /** What is in the Find box, as it is typed. */
  protected readonly typed = new Subject<string>();

  /** What to search for: the box's text without the spaces around it, once the typing has paused. */
  private readonly search = toSignal(
    this.typed.pipe(
      map((text) => text.trim()),
      debounceTime(RecipesPage.SearchPauseMs),
      distinctUntilChanged(),
    ),
    { initialValue: '' },
  );

  /** Read again when the order or the search changes. The cards stay on screen until the new ones arrive. */
  protected readonly recipes = loadValue(
    () => this.api.feed(this.sortBy(), RecipesPage.PageSize, this.search()),
    computed(() => `${this.sortBy()} ${this.search()}`),
  );

  protected readonly cards = computed(() => this.recipes.value()?.items ?? []);

  /** "6 free recipes". Nothing until the recipes have been read. */
  protected readonly showing = computed(() => {
    const page = this.recipes.value();
    if (page === null || this.recipes.state() !== 'ready') {
      return '';
    }
    const count = plural(page.items.length, 'free recipe', 'free recipes');
    return page.hasMore ? `The first ${count}. Search to narrow them.` : count;
  });
}
