using Cookfeed.Contracts.Orders;
using Cookfeed.Contracts.Purchases;

namespace Cookfeed.Application.Abstractions.Persistence;

/// <summary>Reads orders from the database. Implemented with EF Core in Infrastructure.</summary>
public interface IOrderRepository
{
    /// <summary>Every order <paramref name="userId"/> has placed, newest first, whatever its status.</summary>
    Task<IReadOnlyList<OrderDto>> GetOrderHistoryAsync(int userId, CancellationToken cancellationToken);

    /// <summary>One order of <paramref name="userId"/>, or null when they have no order with the id.</summary>
    Task<OrderDto?> GetOrderAsync(int userId, int orderId, CancellationToken cancellationToken);

    /// <summary>
    /// The products <paramref name="userId"/> owns through Paid orders, in order-line order (the prototype's order), each once, with
    /// the recipes its purchase snapshot holds (queries.sql Q11). A cancelled or refunded order owns nothing.
    /// </summary>
    Task<IReadOnlyList<PurchaseDto>> GetPurchasesAsync(int userId, CancellationToken cancellationToken);
}
