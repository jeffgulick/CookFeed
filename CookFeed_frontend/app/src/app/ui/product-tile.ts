import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProductTile as ProductTileData } from '../core/api-types';
import { plural, price } from './format';
import { Icon } from './icon';

/**
 * One meal plan or recipe collection for sale, as a tile: what it is, who sells it, what is in it, how buyers rate
 * it, and its price, or that the viewer already owns it. The whole tile leads to the product's page; the title is
 * the link a keyboard or screen reader lands on. The cover is a wide banner, shown whole across the top.
 */
@Component({
  selector: 'app-product-tile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  host: {
    class:
      'card group relative flex flex-col overflow-hidden transition-shadow focus-within:shadow-lift hover:shadow-lift',
    '[attr.data-product-id]': 'product().id',
  },
  template: `
    <!-- Decorative: the title beside it names the product. -->
    <img
      [src]="imageUrl()"
      alt=""
      width="960"
      height="400"
      loading="lazy"
      class="aspect-[12/5] w-full bg-fill object-cover"
    />
    <div class="flex flex-1 flex-col gap-1.5 p-4 sm:gap-2">
      <span class="pill self-start">{{ typeLabel() }}</span>
      <h3 class="text-base leading-snug font-bold sm:text-lg">
        <!-- after:absolute stretches the link over the whole tile, so the tile is one target. -->
        <a [routerLink]="['/plans', product().id]" class="text-ink no-underline after:absolute after:inset-0">{{
          product().title
        }}</a>
      </h3>
      <p class="meta text-sm">by {{ product().creatorHandle }} &middot; {{ counts() }}</p>
      <p class="meta text-sm" data-rating>
        @if (average(); as stars) {
          <span class="sr-only">Rated </span><span aria-hidden="true" class="text-star-text">★</span> {{ stars }}
          <span class="sr-only">out of 5 </span>({{ reviews() }})
        } @else {
          no reviews yet
        }
      </p>
      <p class="mt-auto pt-1">
        @if (product().ownedByViewer) {
          <span data-owned class="tag-good"><app-icon name="check" [size]="14" /> You own this</span>
        } @else {
          <span data-price class="text-lg font-bold">{{ priceText() }}</span>
        }
      </p>
    </div>
  `,
})
export class ProductTile {
  readonly product = input.required<ProductTileData>();

  /** The API sends a path such as images/products/4.svg; the app serves those from its own /images folder. */
  protected readonly imageUrl = computed(() => '/' + (this.product().coverImageUrl ?? 'images/products/new.svg'));

  protected readonly typeLabel = computed(() => (this.product().type === 'MealPlan' ? 'Meal plan' : 'Recipe collection'));

  /** "5 recipes, 6 meals" for a plan that serves a recipe more than once; otherwise just "3 recipes". */
  protected readonly counts = computed(() => {
    const { recipeCount, mealCount } = this.product();
    const recipes = plural(recipeCount, 'recipe', 'recipes');
    return mealCount !== null && mealCount !== recipeCount ? `${recipes}, ${plural(mealCount, 'meal', 'meals')}` : recipes;
  });

  /** The average to one decimal ("4.0"), or null when nobody has reviewed it yet. */
  protected readonly average = computed(() => this.product().rating.average?.toFixed(1) ?? null);

  protected readonly reviews = computed(() => plural(this.product().rating.reviewCount, 'review', 'reviews'));

  protected readonly priceText = computed(() => price(this.product().priceCents));
}
