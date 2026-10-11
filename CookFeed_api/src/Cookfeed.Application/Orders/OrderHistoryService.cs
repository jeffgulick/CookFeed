using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Contracts.Orders;

namespace Cookfeed.Application.Orders;

/// <summary>The caller's order history.</summary>
public class OrderHistoryService(IOrderRepository orders)
{
    /// <summary>
    /// The orders of <paramref name="callerId"/>, the user making the request. The id comes from the caller's
    /// identity, never from the route, so no one can ask for another user's orders (DesignDocument.md §9).
    /// </summary>
    public Task<IReadOnlyList<OrderDto>> GetOrderHistoryAsync(int callerId, CancellationToken cancellationToken) =>
        orders.GetOrderHistoryAsync(callerId, cancellationToken);
}
