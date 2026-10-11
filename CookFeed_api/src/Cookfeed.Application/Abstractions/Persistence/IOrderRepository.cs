using Cookfeed.Contracts.Orders;

namespace Cookfeed.Application.Abstractions.Persistence;

/// <summary>Reads orders from the database. Implemented with EF Core in Infrastructure.</summary>
public interface IOrderRepository
{
    /// <summary>Every order <paramref name="userId"/> has placed, newest first, whatever its status.</summary>
    Task<IReadOnlyList<OrderDto>> GetOrderHistoryAsync(int userId, CancellationToken cancellationToken);
}
