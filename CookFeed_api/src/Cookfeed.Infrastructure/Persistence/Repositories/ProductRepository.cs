using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Application.Products;
using Cookfeed.Contracts.Products;
using Cookfeed.Domain.Access;
using Cookfeed.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Cookfeed.Infrastructure.Persistence.Repositories;

/// <summary>The EF Core queries over products. See docs/Queries.md §1c.</summary>
public class ProductRepository(CookfeedDbContext db) : IProductRepository
{
    public async Task<ProductPage?> GetPageAsync(int productId, int? viewerId, CancellationToken cancellationToken)
    {
        // 1. The product, its creator, and the viewer's own flags: one row from the primary key.
        var product = await db.Products.AsNoTracking()
            .Where(p => p.Id == productId)
            .Select(p => new
            {
                p.Id,
                p.Type,
                p.Title,
                p.Description,
                p.CoverImageUrl,
                p.PriceCents,
                p.Currency,
                p.CreatorId,
                p.Creator.Handle,
                p.Creator.User.DisplayName,
                p.Creator.IsVerified,
                // rules.js isForSale (DesignDocument.md §3.8): retired, a suspended creator, no recipes, or a recipe
                // that was taken down all stop the sale. Nobody pays for something they could not open.
                // GetForSaleAsync filters by the same rule; a test holds the two to each other.
                IsForSale = p.IsActive && p.Creator.SuspendedAt == null
                    && p.Recipes.Any() && p.Recipes.All(pr => pr.Recipe.IsPublished),
                // The viewer's Paid order line for this product, if any. Owning means a Paid order; a cancelled or
                // refunded one does not count.
                OwnedOrderItemId = db.OrderItems
                    .Where(oi => oi.ProductId == p.Id && oi.Order.UserId == viewerId && oi.Order.Status == OrderStatus.Paid)
                    .OrderBy(oi => oi.Id)
                    .Select(oi => (int?)oi.Id)
                    .FirstOrDefault(),
                InCart = db.CartItems.Any(c => c.ProductId == p.Id && c.UserId == viewerId),
            })
            .SingleOrDefaultAsync(cancellationToken);

        if (product is null)
        {
            return null;
        }

        // 2. The reviews that count, as three numbers (queries.sql Q13): not hidden by the admin, and written by a
        // cook who still owns the product, so a refunded buyer's review leaves the rating (DesignDocument.md §3.5, §3.8).
        var rating = await db.Reviews.AsNoTracking()
            .Where(rv => rv.ProductId == productId && rv.HiddenAt == null
                && db.OrderItems.Any(oi => oi.ProductId == productId && oi.Order.UserId == rv.UserId
                    && oi.Order.Status == OrderStatus.Paid))
            .GroupBy(rv => rv.ProductId)
            .Select(g => new
            {
                Count = g.Count(),
                Sum = g.Sum(rv => (int)rv.Rating),
                Recommending = g.Count(rv => rv.Recommends),
            })
            .SingleOrDefaultAsync(cancellationToken);

        // 3. Where each recipe sits. A buyer sees what they bought: their purchase snapshot, not the product as its
        // creator has edited it since (DesignDocument.md §3.3, Q15). Everyone else sees the product as it is today.
        var places = product.OwnedOrderItemId is { } orderItemId
            ? await db.OrderItemRecipes.AsNoTracking()
                .Where(oir => oir.OrderItemId == orderItemId)
                .OrderBy(oir => oir.SortOrder).ThenBy(oir => oir.Id)
                .Select(oir => new Place(oir.SortOrder, oir.DayOffset, oir.Slot, oir.RecipeId))
                .ToListAsync(cancellationToken)
            : await db.ProductRecipes.AsNoTracking()
                .Where(pr => pr.ProductId == productId)
                .OrderBy(pr => pr.SortOrder).ThenBy(pr => pr.Id)
                .Select(pr => new Place(pr.SortOrder, pr.DayOffset, pr.Slot, pr.RecipeId))
                .ToListAsync(cancellationToken);

        // 4. Each distinct recipe once, with what its card shows and what the access rule needs. A meal plan that
        // serves a recipe twice reads it once here and places it twice below.
        var recipeIds = places.Select(p => p.RecipeId).Distinct().ToList();
        var recipes = await db.Recipes.AsNoTracking()
            .Where(r => recipeIds.Contains(r.Id))
            .Select(r => new
            {
                r.Id,
                r.Title,
                r.ThumbnailUrl,
                r.Servings,
                r.PrepMinutes,
                r.CookMinutes,
                r.SaveCount,
                r.CreatorId,
                r.IsPublished,
                r.Visibility,
                IngredientCount = r.Ingredients.Count(),
                StepCount = r.Steps.Count(),
                FirstStep = r.Steps.OrderBy(s => s.StepNumber).Select(s => s.Instruction).FirstOrDefault(),
                SavedByViewer = r.SavedBy.Any(s => s.UserId == viewerId),
                // The viewer's earliest Paid purchase whose snapshot holds the recipe: "Yours through <plan>". The
                // snapshot, never the live product, decides what a buyer owns (Q14).
                OwnedThrough = r.OrderItemRecipes
                    .Where(oir => oir.OrderItem.Order.UserId == viewerId && oir.OrderItem.Order.Status == OrderStatus.Paid)
                    .OrderBy(oir => oir.OrderItemId)
                    .Select(oir => oir.OrderItem.ProductTitle)
                    .FirstOrDefault(),
            })
            .ToDictionaryAsync(r => r.Id, cancellationToken);

        return new ProductPage(
            product.Id,
            ContractEnums.ToContract(product.Type),
            product.Title,
            product.Description,
            product.CoverImageUrl,
            product.PriceCents,
            product.Currency,
            product.CreatorId,
            product.Handle,
            product.DisplayName,
            product.IsVerified,
            product.IsForSale,
            OwnedByViewer: product.OwnedOrderItemId is not null,
            product.InCart,
            rating?.Count ?? 0,
            rating?.Sum ?? 0,
            rating?.Recommending ?? 0,
            places.Select(place =>
            {
                var r = recipes[place.RecipeId];
                return new ProductPagePlacement(
                    place.SortOrder,
                    place.DayOffset,
                    ContractEnums.ToContract(place.Slot),
                    r.Id,
                    r.Title,
                    r.ThumbnailUrl,
                    r.Servings,
                    r.PrepMinutes,
                    r.CookMinutes,
                    r.IngredientCount,
                    r.StepCount,
                    r.FirstStep,
                    r.SaveCount,
                    r.SavedByViewer,
                    r.OwnedThrough,
                    new RecipeAccessFacts(r.CreatorId, r.IsPublished, r.Visibility,
                        ViewerHoldsPaidSnapshot: r.OwnedThrough is not null));
            }).ToList());
    }

    public async Task<IReadOnlyList<ProductTile>> GetForSaleAsync(Contracts.Storefront.ProductType? type,
        ProductSort sort, int? viewerId, CancellationToken cancellationToken)
    {
        // For sale, by the rule GetPageAsync reports as IsForSale (rules.js isForSale, DesignDocument.md §3.8).
        var forSale = db.Products.AsNoTracking()
            .Where(p => p.IsActive && p.Creator.SuspendedAt == null
                && p.Recipes.Any() && p.Recipes.All(pr => pr.Recipe.IsPublished));

        if (type is { } wanted)
        {
            var domainType = wanted == Contracts.Storefront.ProductType.MealPlan
                ? ProductType.MealPlan
                : ProductType.RecipeCollection;
            forSale = forSale.Where(p => p.Type == domainType);
        }

        // One row per product. The reviews that count are the ones Q13 counts: not hidden by the admin, and
        // written by a cook who still owns the product.
        var tiles = forSale.Select(p => new
        {
            p.Id,
            p.Type,
            p.Title,
            p.CoverImageUrl,
            p.PriceCents,
            p.Currency,
            p.CreatedAt,
            p.Creator.Handle,
            RecipeCount = p.Recipes.Select(pr => pr.RecipeId).Distinct().Count(),
            PlacementCount = p.Recipes.Count(),
            ReviewCount = db.Reviews.Count(rv => rv.ProductId == p.Id && rv.HiddenAt == null
                && db.OrderItems.Any(oi => oi.ProductId == p.Id && oi.Order.UserId == rv.UserId
                    && oi.Order.Status == OrderStatus.Paid)),
            RatingSum = db.Reviews
                .Where(rv => rv.ProductId == p.Id && rv.HiddenAt == null
                    && db.OrderItems.Any(oi => oi.ProductId == p.Id && oi.Order.UserId == rv.UserId
                        && oi.Order.Status == OrderStatus.Paid))
                .Sum(rv => (int)rv.Rating),
            RecommendCount = db.Reviews.Count(rv => rv.ProductId == p.Id && rv.HiddenAt == null && rv.Recommends
                && db.OrderItems.Any(oi => oi.ProductId == p.Id && oi.Order.UserId == rv.UserId
                    && oi.Order.Status == OrderStatus.Paid)),
            // Owning means a Paid order for the product; a cancelled or refunded one does not count.
            OwnedByViewer = viewerId != null && db.OrderItems.Any(oi =>
                oi.ProductId == p.Id && oi.Order.UserId == viewerId && oi.Order.Status == OrderStatus.Paid),
        });

        // The prototype's three orders (plans.js). Every one ends on the id, so the order never depends on chance.
        var ordered = sort switch
        {
            ProductSort.Price => tiles.OrderBy(t => t.PriceCents).ThenBy(t => t.Id),
            // Best average first; a product nobody has reviewed sorts below every rated one.
            ProductSort.Rating => tiles
                .OrderByDescending(t => t.ReviewCount == 0 ? -1.0 : (double)t.RatingSum / t.ReviewCount)
                .ThenBy(t => t.Id),
            _ => tiles.OrderByDescending(t => t.CreatedAt).ThenByDescending(t => t.Id),
        };

        var rows = await ordered.ToListAsync(cancellationToken);

        return rows.Select(t => new ProductTile(
            t.Id,
            ContractEnums.ToContract(t.Type),
            t.Title,
            t.CoverImageUrl,
            t.PriceCents,
            t.Currency,
            t.Handle,
            t.RecipeCount,
            t.PlacementCount,
            t.ReviewCount,
            t.RatingSum,
            t.RecommendCount,
            t.OwnedByViewer)).ToList();
    }

    /// <summary>One recipe's place in a product or in a purchase snapshot; the two tables share these columns.</summary>
    private sealed record Place(int SortOrder, int? DayOffset, MealSlot? Slot, int RecipeId);
}
