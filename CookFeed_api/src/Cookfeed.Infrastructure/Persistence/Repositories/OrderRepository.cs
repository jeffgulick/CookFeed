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

    public async Task<IReadOnlyList<Contracts.Purchases.PurchaseDto>> GetPurchasesAsync(int userId,
        CancellationToken cancellationToken)
    {
        // The Paid order lines and, for each, its recipe snapshot (order_item_recipes): what the buyer keeps, whatever
        // the creator has done to the product since (DesignDocument.md §3.3, queries.sql Q11 and Q15). The title is
        // the one written at checkout. One collection under each line, so a single statement multiplies no rows.
        var lines = await db.OrderItems.AsNoTracking()
            .Where(oi => oi.Order.UserId == userId && oi.Order.Status == Domain.Enums.OrderStatus.Paid)
            .OrderBy(oi => oi.Id)
            .Select(oi => new
            {
                oi.ProductId,
                oi.Product.Type,
                oi.ProductTitle,
                oi.Product.CoverImageUrl,
                oi.Order.PlacedAt,
                Recipes = oi.Recipes
                    .OrderBy(r => r.SortOrder).ThenBy(r => r.Id)
                    .Select(r => new
                    {
                        r.RecipeId,
                        r.Recipe.Title,
                        r.Recipe.ThumbnailUrl,
                        r.Recipe.Visibility,
                        r.SortOrder,
                        r.DayOffset,
                        r.Slot,
                    })
                    .ToList(),
            })
            .ToListAsync(cancellationToken);

        // A product is owned once. The cart refuses one already owned, so a second Paid line for the same product
        // should not exist; if one ever does, the first purchase is the one shown.
        return lines
            .DistinctBy(line => line.ProductId)
            .Select(line => new Contracts.Purchases.PurchaseDto(
                line.ProductId,
                ContractEnums.ToContract(line.Type),
                line.ProductTitle,
                line.CoverImageUrl,
                line.PlacedAt,
                // A meal plan may serve one recipe on several days, so recipes and meals differ (§3.2, Q5).
                RecipeCount: line.Recipes.Select(r => r.RecipeId).Distinct().Count(),
                MealCount: line.Type == Domain.Enums.ProductType.MealPlan ? line.Recipes.Count : null,
                line.Recipes
                    .Select(r => new Contracts.Purchases.PurchasedRecipeDto(
                        r.RecipeId,
                        r.Title,
                        r.ThumbnailUrl,
                        ContractEnums.ToContract(r.Visibility),
                        r.SortOrder,
                        r.DayOffset,
                        ContractEnums.ToContract(r.Slot)))
                    .ToList()))
            .ToList();
    }

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
