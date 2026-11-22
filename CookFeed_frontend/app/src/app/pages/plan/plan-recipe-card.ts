import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProductRecipe } from '../../core/api-types';
import { plural } from '../../ui/format';
import { Icon } from '../../ui/icon';

/**
 * One recipe in a plan or collection. A recipe the viewer may open links to it and gives a quick look: the times,
 * how much is in it, and how it starts. A premium recipe the viewer has not bought shows only its card, with no
 * link, and says what would open it.
 */
@Component({
  selector: 'app-plan-recipe-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  host: {
    class: 'card relative flex flex-col overflow-hidden',
    'data-plan-recipe': '',
    '[class.bg-fill]': '!recipe().canOpen',
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
      [class.opacity-80]="!recipe().canOpen"
    />
    <div class="flex flex-1 flex-col gap-1.5 p-3 sm:gap-2 sm:p-4">
      @if (label(); as when) {
        <p data-label class="text-xs font-bold tracking-wide text-brand-dark uppercase sm:text-sm">{{ when }}</p>
      }
      <h3 class="text-base leading-snug font-bold sm:text-lg">
        @if (recipe().details; as details) {
          <a [routerLink]="['/recipes', details.recipeId]" [queryParams]="{ product: productId() }" class="text-ink">{{
            recipe().title
          }}</a>
        } @else {
          {{ recipe().title }}
        }
      </h3>
      <p class="meta text-sm sm:text-[0.9375rem]">{{ servesAndTime() }}</p>

      @if (recipe().details; as details) {
        <!-- The quick look: always shown, so it works by touch and by keyboard as well as with a mouse. -->
        <p class="meta text-sm">{{ times() }}</p>
        <p class="meta text-sm">{{ counts() }}</p>
        @if (details.firstStep) {
          <p class="text-sm text-ink-soft">First: {{ details.firstStep }}</p>
        }
        @if (details.ownedThrough) {
          <p class="text-sm font-semibold text-good">Yours through {{ details.ownedThrough }}</p>
        }
        <p class="meta mt-auto inline-flex items-center gap-1 pt-1 text-sm">
          <app-icon name="saved" [size]="16" /> {{ savedBy() }}
        </p>
      } @else {
        <p data-locked class="mt-auto inline-flex items-center gap-1.5 pt-1 text-sm font-semibold text-ink-soft">
          <app-icon name="lock" [size]="16" />{{ lockText() }}
        </p>
      }
    </div>
  `,
})
export class PlanRecipeCard {
  readonly recipe = input.required<ProductRecipe>();

  /** The plan this card is shown in; the recipe's link carries it, so the recipe page knows where the cook came from. */
  readonly productId = input.required<number>();

  /** "Monday dinner" for a meal plan's placement; nothing for a collection. */
  readonly label = input<string>();

  /** What a locked recipe says: "Included when you buy the plan", or "Premium recipe" where nothing can be bought. */
  readonly lockText = input.required<string>();

  protected readonly imageUrl = computed(() => '/' + (this.recipe().thumbnailUrl ?? 'images/recipes/new.svg'));

  /** "Serves 2 · 20 min". */
  protected readonly servesAndTime = computed(() => {
    const { servings, totalMinutes } = this.recipe();
    return totalMinutes === null ? `Serves ${servings}` : `Serves ${servings} · ${totalMinutes} min`;
  });

  /** "5 min prep · 15 min cook", with whichever of the two the recipe gives. */
  protected readonly times = computed(() => {
    const details = this.recipe().details;
    return [
      details?.prepMinutes != null ? `${details.prepMinutes} min prep` : null,
      details?.cookMinutes != null ? `${details.cookMinutes} min cook` : null,
    ]
      .filter((part) => part !== null)
      .join(' · ');
  });

  /** "7 ingredients · 3 steps". */
  protected readonly counts = computed(() => {
    const details = this.recipe().details;
    return details === null
      ? ''
      : `${plural(details.ingredientCount, 'ingredient', 'ingredients')} · ${plural(details.stepCount, 'step', 'steps')}`;
  });

  protected readonly savedBy = computed(() => `saved by ${plural(this.recipe().details?.saveCount ?? 0, 'cook', 'cooks')}`);
}
