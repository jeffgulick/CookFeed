import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { BuyState } from '../core/buy-state';
import { Cart } from '../core/cart';
import { Notices, problemText } from '../core/notices';
import { Icon } from './icon';

/**
 * The buy area of a plan or collection: one line that says where the viewer stands with it, and the next step when
 * there is one. The page works out the state with buyState() and passes it in. A cook who can buy it gets Add to
 * cart, which puts it in their cart and says so. The admin ("noShop") is shown no buying at all.
 */
@Component({
  selector: 'app-buy-area',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  host: { class: 'inline-flex flex-wrap items-center gap-x-3 gap-y-1' },
  template: `
    @switch (state()) {
      @case ('buy') {
        <button type="button" class="btn btn-primary" [disabled]="adding()" (click)="add()">Add to cart</button>
      }
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

  /** The plan this buy area is for. */
  readonly productId = input.required<number>();

  /** Its title, for "Three Weeknights in Japan added to your cart." */
  readonly title = input.required<string>();

  /** The address of the page this sits on. */
  protected readonly here = inject(Router).url;

  /** True while the plan is being added, so a second press does nothing. */
  protected readonly adding = signal(false);

  private readonly cart = inject(Cart);
  private readonly notices = inject(Notices);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected async add(): Promise<void> {
    this.adding.set(true);
    try {
      await this.cart.add(this.productId());
      this.notices.say(`${this.title()} added to your cart.`);
      // The button is replaced by the link to the cart: move focus there, so a keyboard user is not left nowhere.
      afterNextRender(() => this.host.nativeElement.querySelector('a')?.focus(), { injector: this.injector });
    } catch (error) {
      this.notices.problem(problemText(error, 'That could not be added to your cart. Please try again.'));
    } finally {
      this.adding.set(false);
    }
  }
}
