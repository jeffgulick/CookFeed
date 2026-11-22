import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { BuyState } from '../core/buy-state';
import { Icon } from './icon';

/**
 * The buy area of a plan or collection: one line that says where the viewer stands with it, and the next step when
 * there is one. The page works out the state with buyState() and passes it in.
 *
 * The "buy" state draws nothing yet: the Add to cart button arrives with the cart. The admin ("noShop") is shown
 * no buying at all.
 */
@Component({
  selector: 'app-buy-area',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  host: { class: 'inline-flex flex-wrap items-center gap-x-3 gap-y-1' },
  template: `
    @switch (state()) {
      @case ('signIn') {
        <!-- next carries this page's address, so the sign-in page can offer the way back. -->
        <a routerLink="/sign-in" [queryParams]="{ next: here }" class="btn btn-secondary btn-small">Sign in to buy</a>
      }
      @case ('inCart') {
        <a routerLink="/cart" class="btn btn-secondary btn-small"
          ><app-icon name="check" [size]="16" /> In your cart: go to cart</a
        >
      }
      @case ('owned') {
        <span class="tag-good"><app-icon name="check" [size]="14" /> You own this {{ noun() }}</span>
        <a routerLink="/orders" class="text-sm font-semibold">See your orders</a>
      }
      @case ('yourOwn') {
        <span class="meta">This is your {{ noun() }}. Creators can't buy their own.</span>
      }
      @case ('notForSale') {
        <span class="meta">No longer for sale</span>
      }
    }
  `,
})
export class BuyArea {
  readonly state = input.required<BuyState>();

  /** "plan" or "collection", for sentences such as "You own this plan". */
  readonly noun = input.required<'plan' | 'collection'>();

  /** The address of the page this sits on. */
  protected readonly here = inject(Router).url;
}
