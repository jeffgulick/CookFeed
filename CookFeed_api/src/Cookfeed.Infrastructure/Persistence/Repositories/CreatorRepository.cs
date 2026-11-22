using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Contracts.Storefront;
using Cookfeed.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Cookfeed.Infrastructure.Persistence.Repositories;

/// <summary>The EF Core queries over creators. See docs/Queries.md §2 for the SQL.</summary>
public class CreatorRepository(CookfeedDbContext db) : ICreatorRepository
{
    // Every creator, suspended or not: a suspended creator keeps a storefront, and only their products leave the
    // store (DesignDocument.md §3.8). The user id is the order they joined in.
    public async Task<IReadOnlyList<CreatorTileDto>> GetTilesAsync(CancellationToken cancellationToken) =>
        await db.CreatorProfiles.AsNoTracking()
            .OrderBy(c => c.UserId)
            .Select(c => new CreatorTileDto(c.Handle, c.User.DisplayName, c.AvatarUrl, c.IsVerified))
            .ToListAsync(cancellationToken);

    public async Task<StorefrontDto?> GetStorefrontAsync(string handle, int? viewerId,
        CancellationToken cancellationToken)
    {
        // AsSplitQuery: the recipe list and the product list are independent, so one statement joining both
        // would return every recipe once per product (recipes x products rows). Split, EF Core sends three
        // statements (creator, recipes, products) that return 1 + recipes + products rows (docs/Queries.md §2).
        var storefront = await db.CreatorProfiles.AsNoTracking()
            .AsSplitQuery()
            .Where(c => c.Handle == handle)
            .Select(c => new
            {
                c.Handle,
                c.User.DisplayName,
                c.Bio,
                c.AvatarUrl,
                c.IsVerified,
                IsSuspended = c.SuspendedAt != null,
                ViewerIsCreator = viewerId != null && c.UserId == viewerId,

                // Only published Public recipes are listed; ProductOnly recipes are for buyers (§3.3).
                Recipes = c.Recipes
                    .Where(r => r.IsPublished && r.Visibility == RecipeVisibility.Public)
                    .OrderByDescending(r => r.PublishedAt).ThenByDescending(r => r.Id)
                    .Select(r => new StorefrontRecipeDto(
                        r.Id,
                        r.Title,
                        r.ThumbnailUrl,
                        r.Servings,
                        r.PrepMinutes == null && r.CookMinutes == null ? null : (r.PrepMinutes ?? 0) + (r.CookMinutes ?? 0),
                        r.SaveCount,
                        r.PublishedAt!.Value))
                    .ToList(),

                // Only what is for sale: a retired product, a suspended creator's, or one holding a recipe that
                // was taken down stays in the table for the orders that refer to it, but is not listed (§3.8).
                Products = c.Products.AsQueryable()
                    .Where(ProductQueries.IsForSale)
                    .OrderBy(p => p.CreatedAt).ThenBy(p => p.Id)
                    .Select(p => new StorefrontProductDto(
                        p.Id,
                        p.Type == Domain.Enums.ProductType.MealPlan ? Contracts.Storefront.ProductType.MealPlan
                            : Contracts.Storefront.ProductType.RecipeCollection,
                        p.Title,
                        p.Description,
                        p.CoverImageUrl,
                        p.PriceCents,
                        p.Currency,
                        // A meal plan may schedule one recipe on several days, so recipes and meals differ (§3.2, Q5).
                        p.Recipes.Select(pr => pr.RecipeId).Distinct().Count(),
                        p.Type == Domain.Enums.ProductType.MealPlan ? p.Recipes.Count() : null,
                        // Owning means a Paid order for the product; a cancelled or refunded one does not count.
                        viewerId != null && db.OrderItems.Any(oi =>
                            oi.ProductId == p.Id && oi.Order.UserId == viewerId && oi.Order.Status == OrderStatus.Paid),
                        viewerId != null && db.CartItems.Any(ci => ci.ProductId == p.Id && ci.UserId == viewerId)))
                    .ToList(),
            })
            .SingleOrDefaultAsync(cancellationToken);

        if (storefront is null)
        {
            return null;
        }

        // The recipe count and total saves are worked out from the list already fetched, rather than with two
        // more subqueries over the same recipes (docs/Queries.md §2).
        return new StorefrontDto(
            storefront.Handle,
            storefront.DisplayName,
            storefront.Bio,
            storefront.AvatarUrl,
            storefront.IsVerified,
            storefront.IsSuspended,
            storefront.Recipes.Count,
            storefront.Recipes.Sum(r => r.SaveCount),
            storefront.ViewerIsCreator,
            storefront.Recipes,
            storefront.Products);
    }
}
