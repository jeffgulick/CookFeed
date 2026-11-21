using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Contracts.Purchases;

namespace Cookfeed.Application.Purchases;

/// <summary>The plans and collections the caller owns.</summary>
public class PurchasesService(IOrderRepository orders)
{
    /// <summary>
    /// What <paramref name="callerId"/>, the user making the request, owns through Paid orders. The id comes from the
    /// caller's identity, never from the route, so no one can ask for another user's purchases (DesignDocument.md §9).
    /// </summary>
    public Task<IReadOnlyList<PurchaseDto>> GetPurchasesAsync(int callerId, CancellationToken cancellationToken) =>
        orders.GetPurchasesAsync(callerId, cancellationToken);
}
