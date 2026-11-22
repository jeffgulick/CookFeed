using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Application.Reviews;
using Cookfeed.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Cookfeed.Infrastructure.Persistence.Repositories;

/// <summary>The EF Core queries over reviews. See docs/Queries.md §1d.</summary>
public class ReviewRepository(CookfeedDbContext db) : IReviewRepository
{
    // The role names in the roles table (DesignDocument.md §3.1).
    private const string HomeCook = "HomeCook", Admin = "Admin";

    public async Task<ProductReviews?> GetProductReviewsAsync(int productId, int? viewerId,
        CancellationToken cancellationToken)
    {
        // 1. The product, its creator, and three facts about the viewer: may they shop, are they the admin, and do
        // they have a Paid order for this product. One row from the primary key.
        var product = await db.Products.AsNoTracking()
            .Where(p => p.Id == productId)
            .Select(p => new
            {
                p.Id,
                p.Type,
                p.Title,
                p.CreatorId,
                p.Creator.Handle,
                p.Creator.User.DisplayName,
                p.Creator.IsVerified,
                ViewerCanShop = db.UserRoles.Any(ur => ur.UserId == viewerId && ur.Role.Name == HomeCook),
                ViewerIsAdmin = db.UserRoles.Any(ur => ur.UserId == viewerId && ur.Role.Name == Admin),
                ViewerOwnsProduct = db.OrderItems.Any(oi =>
                    oi.ProductId == p.Id && oi.Order.UserId == viewerId && oi.Order.Status == OrderStatus.Paid),
            })
            .SingleOrDefaultAsync(cancellationToken);

        if (product is null)
        {
            return null;
        }

        // 2. Every review of it, newest first (queries.sql Q12), with whether its author still owns the product and
        // whether they are a creator. Hidden reviews are read too: their author and the admin are shown them.
        var reviews = await db.Reviews.AsNoTracking()
            .Where(rv => rv.ProductId == productId)
            .OrderByDescending(rv => rv.CreatedAt).ThenByDescending(rv => rv.Id)
            .Select(rv => new ProductReviewRow(
                rv.Id,
                rv.UserId,
                rv.User.DisplayName,
                rv.Rating,
                rv.Recommends,
                rv.Body,
                rv.CreatedAt,
                rv.HiddenAt != null,
                db.OrderItems.Any(oi => oi.ProductId == productId && oi.Order.UserId == rv.UserId
                    && oi.Order.Status == OrderStatus.Paid),
                rv.User.CreatorProfile != null))
            .ToListAsync(cancellationToken);

        return new ProductReviews(
            product.Id,
            ContractEnums.ToContract(product.Type),
            product.Title,
            product.CreatorId,
            product.Handle,
            product.DisplayName,
            product.IsVerified,
            product.ViewerCanShop,
            product.ViewerIsAdmin,
            product.ViewerOwnsProduct,
            reviews);
    }

    public async Task<bool> AddAsync(int productId, int userId, int rating, bool recommends, string body,
        DateTimeOffset createdAt, CancellationToken cancellationToken)
    {
        // The unique index on (product_id, user_id) allows one review per account and product. ON CONFLICT DO
        // NOTHING turns a second one into "no row inserted" instead of an error, and the count says which
        // happened. The values travel as parameters.
        var inserted = await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO reviews (product_id, user_id, rating, recommends, body, created_at)
            VALUES ({productId}, {userId}, {(short)rating}, {recommends}, {body}, {createdAt})
            ON CONFLICT (product_id, user_id) DO NOTHING
            """, cancellationToken);
        return inserted == 1;
    }

    public Task DeleteAsync(int productId, int userId, CancellationToken cancellationToken) =>
        // One DELETE through the unique index; no row to delete is not an error.
        db.Reviews
            .Where(rv => rv.ProductId == productId && rv.UserId == userId)
            .ExecuteDeleteAsync(cancellationToken);
}
