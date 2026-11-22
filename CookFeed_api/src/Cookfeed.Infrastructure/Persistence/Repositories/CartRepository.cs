using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Application.Cart;
using Cookfeed.Domain.Access;
using Cookfeed.Domain.Entities;
using Cookfeed.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Cookfeed.Infrastructure.Persistence.Repositories;

/// <summary>The EF Core queries and writes over carts, and checkout. See docs/Queries.md §5 for the SQL.</summary>
public class CartRepository(CookfeedDbContext db) : ICartRepository
{
    // The role name in the roles table (DesignDocument.md §3.1).
    private const string HomeCook = "HomeCook";

    public Task<bool> CanShopAsync(int userId, CancellationToken cancellationToken) =>
        db.UserRoles.AnyAsync(ur => ur.UserId == userId && ur.Role.Name == HomeCook, cancellationToken);

    public async Task<IReadOnlyList<CartLine>> GetLinesAsync(int userId, CancellationToken cancellationToken)
    {
        // One row per cart line, read by the primary key's leading column (user_id). The three facts are subqueries:
        // for sale by the rule the product lists use, made by this user, and owned through a Paid order.
        var lines = await db.CartItems.AsNoTracking()
            .Where(c => c.UserId == userId)
            .OrderBy(c => c.AddedAt).ThenBy(c => c.ProductId)
            .Select(c => new
            {
                c.Product.Id,
                c.Product.Type,
                c.Product.Title,
                c.Product.CoverImageUrl,
                c.Product.Creator.Handle,
                RecipeCount = c.Product.Recipes.Select(pr => pr.RecipeId).Distinct().Count(),
                PlacementCount = c.Product.Recipes.Count(),
                c.Product.PriceCents,
                c.Product.Currency,
                ForSale = db.Products.Where(ProductQueries.IsForSale).Any(p => p.Id == c.ProductId),
                MadeIt = c.Product.CreatorId == userId,
                Owns = db.OrderItems.Any(oi =>
                    oi.ProductId == c.ProductId && oi.Order.UserId == userId && oi.Order.Status == OrderStatus.Paid),
            })
            .ToListAsync(cancellationToken);

        return lines
            .Select(l => new CartLine(l.Id, ContractEnums.ToContract(l.Type), l.Title, l.CoverImageUrl, l.Handle,
                l.RecipeCount, l.PlacementCount, l.PriceCents, l.Currency, l.ForSale, l.MadeIt, l.Owns))
            .ToList();
    }

    public Task<BuyFacts?> GetBuyFactsAsync(int userId, int productId, CancellationToken cancellationToken) =>
        // One row from the primary key, or none when no product has the id.
        db.Products.AsNoTracking()
            .Where(p => p.Id == productId)
            .Select(p => new BuyFacts(
                db.UserRoles.Any(ur => ur.UserId == userId && ur.Role.Name == HomeCook),
                p.CreatorId == userId,
                db.OrderItems.Any(oi =>
                    oi.ProductId == p.Id && oi.Order.UserId == userId && oi.Order.Status == OrderStatus.Paid),
                db.Products.Where(ProductQueries.IsForSale).Any(sold => sold.Id == p.Id),
                db.CartItems.Any(c => c.ProductId == p.Id && c.UserId == userId)))
            .SingleOrDefaultAsync(cancellationToken);

    public Task AddAsync(int userId, int productId, DateTimeOffset addedAt, CancellationToken cancellationToken) =>
        // ON CONFLICT DO NOTHING makes the add safe to repeat: the primary key (user_id, product_id) already holds
        // a product to one line, and two requests arriving together leave one row and no error. The values travel
        // as parameters.
        db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO cart_items (user_id, product_id, added_at)
            VALUES ({userId}, {productId}, {addedAt})
            ON CONFLICT (user_id, product_id) DO NOTHING
            """, cancellationToken);

    public Task RemoveAsync(int userId, int productId, CancellationToken cancellationToken) =>
        // ExecuteDelete sends one DELETE and loads nothing. No row to delete is not an error.
        db.CartItems
            .Where(c => c.UserId == userId && c.ProductId == productId)
            .ExecuteDeleteAsync(cancellationToken);

    public Task ClearAsync(int userId, CancellationToken cancellationToken) =>
        db.CartItems.Where(c => c.UserId == userId).ExecuteDeleteAsync(cancellationToken);

    public async Task<int?> PlaceOrderAsync(int userId, IReadOnlyCollection<int> productIds, DateTimeOffset placedAt,
        CancellationToken cancellationToken)
    {
        // One transaction: the order, its lines, their recipe snapshots and the emptied cart all happen, or none do.
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);

        // Take the lines out of the cart first. The DELETE locks those rows, so of two checkouts arriving together
        // the second waits for the first to commit, then finds them gone and places no second order.
        var taken = await db.CartItems
            .Where(c => c.UserId == userId && productIds.Contains(c.ProductId))
            .ExecuteDeleteAsync(cancellationToken);
        if (taken != productIds.Count)
        {
            await transaction.RollbackAsync(cancellationToken);
            return null;
        }

        // What is left in the cart could not be bought (retired or bought since); it goes too.
        await db.CartItems.Where(c => c.UserId == userId).ExecuteDeleteAsync(cancellationToken);

        var products = await db.Products.AsNoTracking()
            .Where(p => productIds.Contains(p.Id))
            .Select(p => new
            {
                p.Id,
                p.CreatorId,
                p.Title,
                p.PriceCents,
                p.Currency,
                Recipes = p.Recipes
                    .OrderBy(pr => pr.SortOrder).ThenBy(pr => pr.Id)
                    .Select(pr => new { pr.RecipeId, pr.SortOrder, pr.DayOffset, pr.Slot })
                    .ToList(),
            })
            .ToDictionaryAsync(p => p.Id, cancellationToken);

        // The lines in the order the cart listed them.
        var bought = productIds.Select(id => products[id]).ToList();
        var order = new Order
        {
            UserId = userId,
            // Payment is simulated (DesignDocument.md §9), so the order is paid the moment it is placed.
            Status = OrderStatus.Paid,
            PlacedAt = placedAt,
            PaidAt = placedAt,
            // Written once, here, as the sum of the lines (§6).
            TotalCents = bought.Sum(p => p.PriceCents),
            Currency = bought[0].Currency,
            Items = bought.Select(p => new OrderItem
            {
                ProductId = p.Id,
                // The seller, title and price as they are now: later edits to the product do not rewrite the order.
                CreatorId = p.CreatorId,
                ProductTitle = p.Title,
                UnitPriceCents = p.PriceCents,
                // What the buyer keeps: the product's recipes as they are now, place for place (§3.3).
                Recipes = p.Recipes.Select(r => new OrderItemRecipe
                {
                    RecipeId = r.RecipeId,
                    SortOrder = r.SortOrder,
                    DayOffset = r.DayOffset,
                    Slot = r.Slot,
                }).ToList(),
            }).ToList(),
        };

        db.Orders.Add(order);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return order.Id;
    }
}
