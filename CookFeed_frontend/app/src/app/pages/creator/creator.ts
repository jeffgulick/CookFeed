import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { CookfeedApi } from '../../core/api';
import { buyState } from '../../core/buy-state';
import { Cart } from '../../core/cart';
import { loadValue } from '../../core/load';
import { Session } from '../../core/session';
import { BuyArea } from '../../ui/buy-area';
import { longDate, price, productCounts, productNoun, productTypeLabel } from '../../ui/format';
import { Icon } from '../../ui/icon';
import { LoadStateMessage } from '../../ui/load-state';
import { RecipeCard } from '../../ui/recipe-card';

/**
 * A creator's storefront, addressed by handle (/creators/kenji-kitchen): who they are, their free recipes, and
 * what they have for sale. Each plan carries a buy area that says where the viewer stands with it. A handle
 * nobody has gets "Creator not found", not a blank page.
 */
@Component({
  selector: 'app-creator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, RecipeCard, BuyArea, LoadStateMessage],
  templateUrl: './creator.html',
})
export class CreatorPage {
  private readonly api = inject(CookfeedApi);
  private readonly session = inject(Session);
  private readonly cart = inject(Cart);
  private readonly title = inject(Title);

  private readonly handle = toSignal(inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('handle') ?? '')), {
    requireSync: true,
  });

  /**
   * Read again when the address names another creator, and when the account changes, because the page says what
   * this viewer owns and whether the storefront is their own.
   */
  protected readonly storefront = loadValue(
    () => this.api.storefront(this.handle()),
    computed(() => `${this.handle()} ${this.session.user()?.id ?? 'guest'}`),
  );

  /** "saves" lists the most saved first; "newest" keeps the API's order, newest first. */
  protected readonly sortBy = signal<'saves' | 'newest'>('saves');

  protected readonly recipes = computed(() => {
    const recipes = this.storefront.value()?.recipes ?? [];
    // The sort keeps equal recipes in the order they came, so two with the same saves stay newest first.
    const sorted = this.sortBy() === 'saves' ? [...recipes].sort((a, b) => b.saveCount - a.saveCount) : recipes;
    return sorted.map((recipe) => ({ recipe, label: `Published ${longDate(recipe.publishedAt)}` }));
  });

  /** Each product for sale, with the words its card shows and where this viewer stands with it. */
  protected readonly products = computed(() => {
    const storefront = this.storefront.value();
    return (storefront?.products ?? []).map((product) => ({
      product,
      imageUrl: '/' + (product.coverImageUrl ?? 'images/products/new.svg'),
      typeLabel: productTypeLabel(product.type),
      noun: productNoun(product.type),
      // "Three dinners, one shopping trip. 3 recipes."
      about: [product.description, productCounts(product.recipeCount, product.mealCount) + '.'].filter(Boolean).join(' '),
      price: price(product.priceCents),
      buy: buyState({
        signedIn: this.session.user() !== null,
        canShop: this.session.canShop(),
        viewerIsCreator: storefront?.viewerIsCreator ?? false,
        owned: product.ownedByViewer,
        // The storefront lists only what is for sale.
        forSale: true,
        // The cart as it is now, once it has been read: Add to cart changes it without reloading the page.
        inCart: this.cart.has(product.id) ?? product.inCart,
      }),
    }));
  });

  protected readonly recipeNoun = computed(() =>
    this.storefront.value()?.recipeCount === 1 ? 'published recipe' : 'published recipes',
  );

  protected readonly initial = computed(() => (this.storefront.value()?.displayName ?? '').trim().charAt(0).toUpperCase());

  constructor() {
    // The tab is named after the creator once the storefront is known, as the prototype did.
    effect(() => {
      const state = this.storefront.state();
      const storefront = this.storefront.value();
      if (state === 'missing') {
        this.title.setTitle('Creator not found | Cookfeed');
      } else if (state === 'ready' && storefront !== null) {
        this.title.setTitle(`${storefront.handle} | Cookfeed`);
      }
    });
  }
}
