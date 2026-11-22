using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Contracts.Orders;

namespace Cookfeed.Application.Cart;

/// <summary>How a checkout ended.</summary>
public enum CheckoutOutcome
{
    Placed,

    /// <summary>The caller cannot shop: the admin, or an id no account has.</summary>
    NoShop,

    /// <summary>Nothing in the cart can be bought, so there is nothing to order.</summary>
    EmptyCart,
}

/// <summary>The outcome, and the new order when one was placed.</summary>
public sealed record CheckoutResult(CheckoutOutcome Outcome, OrderDto? Order = null);

/// <summary>
/// Checkout (DesignDocument.md §6): the lines of the caller's cart that can still be bought become one Paid order,
/// and the cart is emptied. Payment is simulated (§9), so the order is Paid as it is placed. A line that can no
/// longer be bought (retired since, bought since) is left out, as the prototype's <c>placeOrder</c> does.
/// </summary>
public class CheckoutService(ICartRepository carts, IOrderRepository orders, TimeProvider clock)
{
    public async Task<CheckoutResult> PlaceOrderAsync(int callerId, CancellationToken cancellationToken)
    {
        if (!await carts.CanShopAsync(callerId, cancellationToken))
        {
            return new CheckoutResult(CheckoutOutcome.NoShop);
        }

        var buyable = (await carts.GetLinesAsync(callerId, cancellationToken))
            .Where(line => line.CanBeBought)
            .Select(line => line.ProductId)
            .ToList();
        if (buyable.Count == 0)
        {
            return new CheckoutResult(CheckoutOutcome.EmptyCart);
        }

        // Null when another checkout emptied the cart between the read above and the write: nothing to order.
        var orderId = await carts.PlaceOrderAsync(callerId, buyable, clock.GetUtcNow(), cancellationToken);
        if (orderId is null)
        {
            return new CheckoutResult(CheckoutOutcome.EmptyCart);
        }

        return new CheckoutResult(CheckoutOutcome.Placed,
            await orders.GetOrderAsync(callerId, orderId.Value, cancellationToken));
    }
}
