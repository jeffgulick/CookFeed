import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FeedItem } from '../core/api-types';
import { Icon } from './icon';

/**
 * One free recipe as a card: its picture, title, who made it, how long it takes, how many it serves, and how many
 * cooks saved it. The whole card leads to the recipe; the title is the link a keyboard or screen reader lands on.
 */
@Component({
  selector: 'app-recipe-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  host: {
    class:
      'card group relative flex flex-col overflow-hidden transition-shadow focus-within:shadow-lift hover:shadow-lift',
    '[attr.data-recipe-id]': 'recipe().id',
  },
  template: `
    <!-- Decorative: the title beside it says what the dish is. -->
    <img
      [src]="imageUrl()"
      alt=""
      width="400"
      height="300"
      loading="lazy"
      class="aspect-[4/3] w-full bg-fill object-cover"
    />
    <div class="flex flex-1 flex-col gap-1.5 p-3 sm:gap-2 sm:p-4">
      <h3 class="text-base leading-snug font-bold sm:text-lg">
        <!-- after:absolute stretches the link over the whole card, so the card is one target. -->
        <a [routerLink]="['/recipes', recipe().id]" class="text-ink no-underline after:absolute after:inset-0">{{
          recipe().title
        }}</a>
      </h3>
      <p class="meta text-sm sm:text-[0.9375rem]">
        by {{ recipe().creatorHandle }}
        @if (recipe().creatorIsVerified) {
          <span class="tag-good ml-1 align-middle"><app-icon name="check" [size]="14" /> Verified</span>
        }
      </p>
      <p class="meta mt-auto flex flex-wrap items-center gap-x-3 gap-y-0.5 pt-1 text-sm sm:gap-x-4 sm:text-[0.9375rem]">
        <span class="inline-flex items-center gap-1"
          ><app-icon name="servings" [size]="16" /> Serves {{ recipe().servings }}</span
        >
        @if (recipe().totalMinutes !== null) {
          <span class="inline-flex items-center gap-1"
            ><app-icon name="clock" [size]="16" /> {{ recipe().totalMinutes }} min</span
          >
        }
        <span class="inline-flex items-center gap-1"><app-icon name="saved" [size]="16" /> {{ savedBy() }}</span>
      </p>
    </div>
  `,
})
export class RecipeCard {
  readonly recipe = input.required<FeedItem>();

  /** The API sends a path such as images/recipes/5.svg; the app serves those from its own /images folder. */
  protected readonly imageUrl = computed(() => '/' + (this.recipe().thumbnailUrl ?? 'images/recipes/new.svg'));

  /** "saved by 1 cook", "saved by 7 cooks": the wording first-time visitors understood best. */
  protected readonly savedBy = computed(() => {
    const count = this.recipe().saveCount;
    return `saved by ${count} ${count === 1 ? 'cook' : 'cooks'}`;
  });
}
