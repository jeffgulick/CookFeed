using Cookfeed.Application.Cart;
using Cookfeed.Domain.Access;

namespace Cookfeed.Application.Abstractions.Persistence;

/// <summary>Reads and changes carts, and turns one into an order. Implemented with EF Core in Infrastructure.</summary>
public interface ICartRepository
{
    /// <summary>True when <paramref name="userId"/> holds the HomeCook role. False for the admin and for an id no account has.</summary>
    Task<bool> CanShopAsync(int userId, CancellationToken cancellationToken);

    /// <summary>
    /// Every product in the cart of <paramref name="userId"/>, in the order added, with what <c>BuyAccess</c> needs to
    /// decide whether it can still be bought. It filters nothing: the service decides.
    /// </summary>
    Task<IReadOnlyList<CartLine>> GetLinesAsync(int userId, CancellationToken cancellationToken);

    /// <summary>What <c>BuyAccess</c> needs to know about <paramref name="userId"/> and one product; null when no product has the id.</summary>
    Task<BuyFacts?> GetBuyFactsAsync(int userId, int productId, CancellationToken cancellationToken);

    /// <summary>Puts the product in the cart. Does nothing if it is already there.</summary>
    Task AddAsync(int userId, int productId, DateTimeOffset addedAt, CancellationToken cancellationToken);

    /// <summary>Takes the product out of the cart. Does nothing if it is not there.</summary>
    Task RemoveAsync(int userId, int productId, CancellationToken cancellationToken);

    /// <summary>Takes everything out of the cart.</summary>
    Task ClearAsync(int userId, CancellationToken cancellationToken);

    /// <summary>
    /// Checkout, all or nothing (DesignDocument.md §6): one Paid order for <paramref name="productIds"/>, in that
    /// order, each line with the product's title, price and seller as they are now and a copy of every recipe in
    /// it; then the whole cart is emptied. Returns the new order's id, or null, with nothing written, when those
    /// products are no longer all in the cart (another checkout got there first).
    /// </summary>
    Task<int?> PlaceOrderAsync(int userId, IReadOnlyCollection<int> productIds, DateTimeOffset placedAt,
        CancellationToken cancellationToken);
}
