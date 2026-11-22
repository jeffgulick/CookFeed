import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Order } from '../../core/api-types';
import { Cart } from '../../core/cart';
import { Notices, problemText } from '../../core/notices';
import { Session } from '../../core/session';
import { Confirm } from '../../ui/confirm';
import { joinWithAnd, orderNumber, plural, price, productCounts, productTypeLabel } from '../../ui/format';
import { Icon } from '../../ui/icon';
import { LoadStateMessage } from '../../ui/load-state';

/**
 * The cart and checkout (/cart): the signed-in cook's cart lines, one copy of each plan because a digital plan is
 * owned once; the totals; taking a line out or emptying the cart; and Place order, which turns the cart into an
 * order and shows a receipt in its place. Cookfeed takes no payment: the order is recorded as paid.
 */
@Component({
  selector: 'app-cart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, LoadStateMessage],
  templateUrl: './cart.html',
})
export class CartPage {
  protected readonly session = inject(Session);
  protected readonly cart = inject(Cart);
  private readonly confirm = inject(Confirm);
  private readonly notices = inject(Notices);
  private readonly injector = inject(Injector);

  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');
  private readonly receiptHeading = viewChild<ElementRef<HTMLElement>>('receiptHeading');

  /** The order just placed. While it is set, the receipt is shown in place of the cart. */
  private readonly placed = signal<Order | null>(null);

  /** What the API said when the order was refused; empty otherwise. */
  protected readonly problem = signal('');

  /** True while the order is being placed, so a second press does nothing. */
  protected readonly busy = signal(false);

  /** The cart in the page's words; null until it has been read. */
  protected readonly view = computed(() => {
    const cart = this.cart.cart();
    if (cart === null) {
      return null;
    }
    const gone = cart.unavailable;
    return {
      count: cart.lines.length,
      itemCount: plural(cart.lines.length, 'item', 'items'),
      total: price(cart.totalCents),
      isEmpty: cart.lines.length === 0,
      lines: cart.lines.map((line) => ({
        id: line.productId,
        title: line.title,
        typeLabel: productTypeLabel(line.type),
        about: `by ${line.creatorHandle} · ${productCounts(line.recipeCount, line.mealCount)}`,
        price: price(line.priceCents),
        // The API sends a path such as images/products/3.svg; the app serves those from its own /images folder.
        imageUrl: '/' + (line.coverImageUrl ?? 'images/products/new.svg'),
      })),
      // "A is", "A and B are": what went off sale, or was bought, since it was put in the cart.
      unavailable:
        gone.length === 0
          ? ''
          : `${joinWithAnd(gone)} ${gone.length === 1 ? 'is' : 'are'} no longer for sale, so ` +
            `${gone.length === 1 ? 'it is' : 'they are'} not in your order.`,
    };
  });

  /** The receipt in the page's words; null until an order is placed. */
  protected readonly receipt = computed(() => {
    const order = this.placed();
    if (order === null) {
      return null;
    }
    const one = order.items.length === 1;
    return {
      number: orderNumber(order.id),
      total: price(order.totalCents),
      plans: plural(order.items.length, 'plan', 'plans'),
      items: order.items.map((item) => ({ id: item.productId, title: item.productTitle })),
      keep: `Every recipe in ${one ? 'it' : 'them'} is yours to keep.`,
      next: `Open ${one ? 'the plan' : 'a plan'} to see its recipes and what to buy for it.`,
    };
  });

  protected async takeOut(line: { id: number; title: string }): Promise<void> {
    if (!(await this.confirm.ask(`Take ${line.title} out of your cart?`, 'Take it out'))) {
      return;
    }
    await this.change(() => this.cart.remove(line.id), `${line.title} is out of your cart.`);
  }

  protected async empty(): Promise<void> {
    const count = this.view()?.count ?? 0;
    if (count === 0 || !(await this.confirm.ask(`Remove all ${plural(count, 'item', 'items')} from your cart?`, 'Empty cart'))) {
      return;
    }
    await this.change(() => this.cart.clear(), 'Your cart is empty.');
  }

  protected async placeOrder(): Promise<void> {
    const view = this.view();
    if (view === null || view.isEmpty || !(await this.confirm.ask(`Place this order for ${view.total}?`, 'Place order'))) {
      return;
    }

    this.busy.set(true);
    this.problem.set('');
    try {
      const order = await this.cart.checkout();
      this.placed.set(order);
      this.notices.say(`Thank you. Your order number is ${orderNumber(order.id)}.`);
      // The receipt replaces the cart: focus moves to its heading, so a screen reader announces the order and a
      // keyboard user carries on from there rather than from a button that no longer exists.
      afterNextRender(() => this.receiptHeading()?.nativeElement.focus(), { injector: this.injector });
    } catch (error) {
      this.problem.set(problemText(error, 'The order could not be placed. Please try again.'));
      // Show what is really in the cart now.
      await this.cart.refresh();
    } finally {
      this.busy.set(false);
    }
  }

  /** Changes the cart, says what happened, and puts focus on the page heading: the pressed button may be gone. */
  private async change(act: () => Promise<void>, done: string): Promise<void> {
    try {
      await act();
      this.notices.say(done);
      afterNextRender(() => this.heading()?.nativeElement.focus(), { injector: this.injector });
    } catch (error) {
      this.notices.problem(problemText(error, 'Your cart could not be changed. Please try again.'));
    }
  }
}
