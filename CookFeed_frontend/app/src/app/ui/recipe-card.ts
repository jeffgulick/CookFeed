import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from './icon';

/** What a recipe card shows. The feed's recipes and a storefront's both fit. */
export interface RecipeCardData {
  id: number;
  title: string;
  thumbnailUrl: string | null;
  servings: number;
  /** Prep plus cook time; null when the recipe gives neither. */
  totalMinutes: number | null;
  saveCount: number;
  /** Who made it, for the "by ..." line. Left out where the page already says so. */
  creatorHandle?: string;
  creatorIsVerified?: boolean;
}

/**
 * One free recipe as a card: its picture, title, who made it, how long it takes, how many it serves, and how many
 * cooks saved it. The whole card leads to the recipe; the title is the link a keyboard or screen reader lands on.
 * A page that already says who made the recipes passes a line of its own instead, such as when it was published.
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
      @if (label(); as line) {
        <p class="meta text-sm sm:text-[0.9375rem]">{{ line }}</p>
      } @else if (recipe().creatorHandle; as handle) {
        <p class="meta text-sm sm:text-[0.9375rem]">
          by {{ handle }}
          @if (recipe().creatorIsVerified) {
            <span class="tag-good ml-1 align-middle"><app-icon name="check" [size]="14" /> Verified</span>
          }
        </p>
      }
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
    <!-- A page's own controls, such as My kitchen's Unsave. Above the link that covers the card, so they can be
         pressed; taking no room when a page gives none. -->
    <div data-card-controls class="relative z-10 flex flex-wrap gap-2 px-3 pb-3 empty:hidden sm:px-4 sm:pb-4"><ng-content /></div>
  `,
})
export class RecipeCard {
  readonly recipe = input.required<RecipeCardData>();

  /** A line shown in place of "by ...", such as "Published August 20, 2026". */
  readonly label = input<string>();

  /** The API sends a path such as images/recipes/5.svg; the app serves those from its own /images folder. */
  protected readonly imageUrl = computed(() => '/' + (this.recipe().thumbnailUrl ?? 'images/recipes/new.svg'));

  /** "saved by 1 cook", "saved by 7 cooks": the wording first-time visitors understood best. */
  protected readonly savedBy = computed(() => {
    const count = this.recipe().saveCount;
    return `saved by ${count} ${count === 1 ? 'cook' : 'cooks'}`;
  });
}
