import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { CookfeedApi } from '../../core/api';
import { loadList } from '../../core/load';
import { Session } from '../../core/session';
import { longDate, orderNumber, plural, price, productCounts } from '../../ui/format';
import { LoadStateMessage } from '../../ui/load-state';

/**
 * Your orders (/orders): the signed-in cook's orders, newest first, cancelled ones included. Each line shows the
 * title and the price paid as they were at checkout, which the order keeps, so they may differ from the plan today.
 */
@Component({
  selector: 'app-orders',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LoadStateMessage],
  templateUrl: './orders.html',
})
export class OrdersPage {
  private readonly api = inject(CookfeedApi);
  protected readonly session = inject(Session);

  /** Read again when the account changes. A guest and the admin have no orders, so nothing is asked for them. */
  protected readonly orders = loadList(
    () => (this.session.canShop() ? this.api.orders() : of([])),
    computed(() => this.session.user()?.id ?? null),
  );

  protected readonly cards = computed(() =>
    this.orders.items().map((order) => ({
      id: order.id,
      number: orderNumber(order.id),
      date: longDate(order.placedAt),
      status: order.status,
      isPaid: order.status === 'Paid',
      total: price(order.totalCents),
      // Only a paid order owns anything: "This order was cancelled, so nothing in it is yours."
      notOwned: order.status === 'Paid' ? '' : `This order was ${order.status.toLowerCase()}, so nothing in it is yours.`,
      items: order.items.map((item) => ({
        productId: item.productId,
        title: item.productTitle,
        counts: productCounts(item.recipeCount, item.mealCount),
        price: price(item.unitPriceCents),
      })),
    })),
  );

  /** "3 orders, newest first.", or where orders will show up when there are none. Nothing while they load. */
  protected readonly summary = computed(() => {
    if (!this.session.canShop()) {
      return 'Plans you buy show up here.';
    }
    if (this.orders.state() !== 'ready') {
      return '';
    }
    const count = this.orders.items().length;
    return count === 0 ? 'Plans you buy show up here.' : `${plural(count, 'order', 'orders')}, newest first.`;
  });
}
