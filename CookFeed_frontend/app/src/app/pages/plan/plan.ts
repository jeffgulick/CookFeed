import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';
import { CookfeedApi } from '../../core/api';
import { ProductDetail } from '../../core/api-types';
import { BuyState, buyState } from '../../core/buy-state';
import { Cart } from '../../core/cart';
import { loadValue } from '../../core/load';
import { Notices, problemText } from '../../core/notices';
import { Session } from '../../core/session';
import { BuyArea } from '../../ui/buy-area';
import {
  amount,
  dayAndMeal,
  dayName,
  joinWithAnd,
  plural,
  price,
  productCounts,
  productNoun,
  productTypeLabel,
} from '../../ui/format';
import { LoadStateMessage } from '../../ui/load-state';
import { PlanRecipeCard } from './plan-recipe-card';

/** One line of the pitch: a lead in bold, then the rest of the sentence. */
interface PitchItem {
  lead: string;
  rest: string;
}

/**
 * The page of one meal plan or recipe collection (/plans/3). What it shows follows where the viewer stands with it:
 *
 * - someone deciding (a visitor, or a cook who has not bought it): the price, what it holds, and why buy it;
 * - a cook who owns it: no price or pitch; the recipes opened and the list, both from their purchase;
 * - the creator on their own plan, the admin, or a plan no longer for sale: the plan, without a pitch.
 *
 * "What you'll buy" is read-only here: the amounts as each recipe is written.
 */
@Component({
  selector: 'app-plan',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, BuyArea, LoadStateMessage, PlanRecipeCard],
  templateUrl: './plan.html',
})
export class PlanPage {
  private readonly api = inject(CookfeedApi);
  private readonly session = inject(Session);
  private readonly cart = inject(Cart);
  private readonly title = inject(Title);
  private readonly notices = inject(Notices);

  /** True once the plan has been put on the shopping list from this page, so the page offers the way to the list. */
  protected readonly shopped = signal(false);

  /** True while the plan is being put on the list, so a second press does nothing. */
  protected readonly shopping = signal(false);

  protected readonly id = toSignal(inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('id') ?? '')), {
    requireSync: true,
  });

  /** Read again when the address names another plan, and when the account changes: both decide what is shown. */
  private readonly reloadWhen = computed(() => `${this.id()} ${this.session.user()?.id ?? 'guest'}`);

  protected readonly product = loadValue(() => this.api.product(this.id()), this.reloadWhen);
  protected readonly list = loadValue(() => this.api.productShoppingList(this.id()), this.reloadWhen);

  protected readonly state = computed<BuyState>(() => {
    const product = this.product.value();
    return buyState({
      signedIn: this.session.user() !== null,
      canShop: this.session.canShop(),
      viewerIsCreator: product?.viewerIsCreator ?? false,
      owned: product?.ownedByViewer ?? false,
      forSale: product?.isForSale ?? false,
      // The cart as it is now, once it has been read: Add to cart changes it without reloading the page.
      inCart: (product ? this.cart.has(product.id) : null) ?? product?.inCart ?? false,
    });
  });

  /** True for someone who could still buy it: a visitor, or a cook who neither owns nor made it. */
  protected readonly deciding = computed(() => ['buy', 'inCart', 'signIn'].includes(this.state()));

  /** The price shows to someone deciding and to the creator; the pitch only to someone deciding. */
  protected readonly showPrice = computed(() => this.deciding() || this.state() === 'yourOwn');

  /** The words the page shows, worked out once from the plan. */
  protected readonly view = computed(() => {
    const product = this.product.value();
    if (product === null) {
      return null;
    }
    const noun = productNoun(product.type);
    return {
      noun,
      typeLabel: productTypeLabel(product.type),
      coverUrl: '/' + (product.coverImageUrl ?? 'images/products/new.svg'),
      price: price(product.priceCents),
      priceNote: `One-time purchase · yours to keep · ${productCounts(product.recipeCount, product.mealCount)}`,
      average: product.rating.average?.toFixed(1) ?? null,
      reviews: plural(product.rating.reviewCount, 'review', 'reviews'),
      pitch: pitch(product, noun),
      // "Included when you buy" only means something to someone who can buy it.
      lockText: this.deciding() ? `Included when you buy the ${noun}` : 'Premium recipe',
      recipes: product.recipes.map((recipe) => ({
        recipe,
        // "Monday dinner" for a meal plan's placement; nothing for a collection.
        label: recipe.dayOffset === null ? undefined : dayAndMeal(recipe.dayOffset, recipe.slot),
      })),
    };
  });

  /**
   * "What you'll buy". Left out for the admin, for a plan no longer for sale that the viewer does not own, and for
   * a plan with no recipes: nobody there is going to buy anything. A viewer who can open none of the recipes yet
   * gets a sentence about the list instead of an empty table.
   */
  protected readonly whatYouBuy = computed(() => {
    const product = this.product.value();
    const list = this.list.value();
    const state = this.state();
    if (product === null || list === null || state === 'noShop' || state === 'notForSale' || product.recipes.length === 0) {
      return null;
    }
    const noun = productNoun(product.type);
    const all = product.type === 'MealPlan'
      ? plural(product.mealCount ?? 0, 'meal', 'meals')
      : plural(product.recipeCount, 'recipe', 'recipes');
    return {
      nothingOpen: list.fromRecipes.length === 0,
      preview: `Buy it and every ingredient for all ${all} is listed here, combined, sorted by aisle.`,
      from: `For ${joinWithAnd(list.fromRecipes)}.`,
      lines: list.lines.map((line) => ({ ...line, amount: `${amount(line.quantity)} ${line.unit}` })),
      notOnList:
        list.lockedRecipes.length === 0
          ? null
          : `Not on this list yet: ${joinWithAnd(list.lockedRecipes)}. ${list.lockedRecipes.length === 1 ? 'Its' : 'Their'} ` +
            `ingredients are added when you buy the ${noun}.`,
    };
  });

  /**
   * "Shop this plan": every recipe of the purchase goes on the cook's shopping list, each for the people it is
   * written for; one that is served twice goes on once, for both meals. The list is made if there is none.
   */
  protected async shopPlan(): Promise<void> {
    const plan = this.product.value();
    if (plan === null) {
      return;
    }
    this.shopping.set(true);
    try {
      const result = await firstValueFrom(this.api.shop({ productId: plan.id }));
      this.shopped.set(true);
      this.notices.say(
        result.added > 0
          ? `${plural(result.added, 'recipe', 'recipes')} from ${plan.title} ${result.added === 1 ? 'is' : 'are'} on your shopping list.`
          : `Everything in ${plan.title} is already on your shopping list.`,
      );
    } catch (error) {
      this.notices.problem(problemText(error, 'That could not be put on your shopping list. Please try again.'));
    } finally {
      this.shopping.set(false);
    }
  }

  constructor() {
    // The tab is named after the plan once it is known, as the prototype did.
    effect(() => {
      const state = this.product.state();
      const product = this.product.value();
      if (state === 'missing') {
        this.title.setTitle('Plan not found | Cookfeed');
      } else if (state === 'ready' && product !== null) {
        this.title.setTitle(`${product.title} | Cookfeed`);
      }
    });
  }
}

/** Why buy it: what the price covers, in the prototype's words. */
function pitch(product: ProductDetail, noun: 'plan' | 'collection'): PitchItem[] {
  const items: PitchItem[] = [
    {
      lead: `${plural(product.recipeCount, 'full cooking video', 'full cooking videos')}.`,
      rest: 'Every step is marked in the video, so you can jump straight to the part you are on.',
    },
  ];
  if (product.type === 'MealPlan') {
    // The distinct days of the plan, in order: "Monday, Wednesday and Thursday".
    const days = [...new Set(product.recipes.map((recipe) => dayName(recipe.dayOffset ?? 0)))];
    items.push(
      {
        lead: `Every ingredient for all ${plural(product.mealCount ?? 0, 'meal', 'meals')},`,
        rest: 'combined and sorted by aisle. Shop this plan puts it all on your shopping list in one press.',
      },
      {
        lead: 'A plan that is already worked out.',
        rest: `Meals on ${joinWithAnd(days)}, chosen so the ingredients overlap and little goes to waste.`,
      },
    );
  } else {
    items.push(
      {
        lead: 'Every ingredient for every recipe,',
        rest: 'combined and sorted by aisle. Shop this collection puts it all on your shopping list in one press.',
      },
      { lead: `Chosen by ${product.creator.displayName},`, rest: 'in the order they would cook them.' },
    );
  }
  // A product sells only premium recipes (design 3.3; the database refuses anything else).
  if (product.recipes.length > 0) {
    items.push({
      lead: 'Recipes you will not find in the feed.',
      rest: `Every recipe in this ${noun} is premium: none of them is free to save.`,
    });
  }
  items.push({ lead: 'Yours to keep.', rest: `Pay once. No subscription, and the ${noun} stays in your account.` });
  return items;
}
