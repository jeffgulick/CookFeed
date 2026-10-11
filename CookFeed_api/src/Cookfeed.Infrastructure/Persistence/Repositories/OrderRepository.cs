using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Contracts.Orders;
using Microsoft.EntityFrameworkCore;

namespace Cookfeed.Infrastructure.Persistence.Repositories;

/// <summary>The EF Core queries over orders. See docs/Queries.md §4 for the SQL.</summary>
public class OrderRepository(CookfeedDbContext db) : IOrderRepository
{
    public async Task<IReadOnlyList<OrderDto>> GetOrderHistoryAsync(int userId, CancellationToken cancellationToken) =>
        // One statement: orders -> items is a single collection, so joining it multiplies no rows (contrast the
        // storefront's two sibling lists, which needed AsSplitQuery). Every status is shown, as in queries.sql Q9.
        await db.Orders.AsNoTracking()
            .Where(o => o.UserId == userId)
            .OrderByDescending(o => o.PlacedAt).ThenByDescending(o => o.Id)
            .Select(o => new OrderDto(
                o.Id,
                ToContract(o.Status),
                o.PlacedAt,
                o.PaidAt,
                o.TotalCents,
                o.Currency,
                o.Items
                    .OrderBy(i => i.Id)
                    // Title, price and seller are the snapshot taken at checkout, not today's product (§6).
                    // creator_id has no foreign key by design, so the seller's handle is looked up, as Q9 does.
                    .Select(i => new OrderItemDto(
                        i.ProductId,
                        i.ProductTitle,
                        i.UnitPriceCents,
                        db.CreatorProfiles.Where(c => c.UserId == i.CreatorId).Select(c => c.Handle).FirstOrDefault()))
                    .ToList()))
            .ToListAsync(cancellationToken);

    // Runs in C# on the fetched status, not in SQL: EF Core evaluates the final projection on the client when it
    // meets a method it cannot translate. Static, so the query does not capture this repository.
    private static OrderStatus ToContract(Domain.Enums.OrderStatus status) => status switch
    {
        Domain.Enums.OrderStatus.Pending => OrderStatus.Pending,
        Domain.Enums.OrderStatus.Paid => OrderStatus.Paid,
        Domain.Enums.OrderStatus.Refunded => OrderStatus.Refunded,
        Domain.Enums.OrderStatus.Cancelled => OrderStatus.Cancelled,
        _ => throw new ArgumentOutOfRangeException(nameof(status), status, "Unknown order status."),
    };
}
