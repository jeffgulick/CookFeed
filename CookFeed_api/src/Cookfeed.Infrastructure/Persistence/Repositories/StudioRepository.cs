using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Application.Studio;
using Cookfeed.Contracts.Studio;
using Cookfeed.Domain.Access;
using Cookfeed.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Cookfeed.Infrastructure.Persistence.Repositories;

/// <summary>The EF Core queries and writes behind a creator's studio. See docs/Queries.md §9.</summary>
public class StudioRepository(CookfeedDbContext db) : IStudioRepository
{
    // The admin actions that take a row down, and the tables they name (DesignDocument.md §3.8).
    private const string UnpublishRecipe = "UnpublishRecipe", RetireProduct = "RetireProduct";
    private const string RecipesTable = "recipes", ProductsTable = "products";

    public Task<StudioCreator?> GetCreatorAsync(int userId, CancellationToken cancellationToken) =>
        db.CreatorProfiles.AsNoTracking()
            .Where(c => c.UserId == userId)
            .Select(c => new StudioCreator(c.Handle, c.SuspendedAt != null))
            .SingleOrDefaultAsync(cancellationToken);

    public async Task<IReadOnlyList<StudioRecipeRow>> GetRecipesAsync(int creatorId, CancellationToken cancellationToken)
    {
        // One row per recipe of this creator, through ix_recipes_creator_id; the counts are subqueries, so no
        // collection multiplies another. The admin's latest word on the recipe is its newest admin_actions row.
        var rows = await db.Recipes.AsNoTracking()
            .Where(r => r.CreatorId == creatorId)
            .OrderByDescending(r => r.Id)
            .Select(r => new
            {
                r.Id,
                r.Title,
                r.Servings,
                r.IsPublished,
                r.Visibility,
                r.SaveCount,
                PlanTitles = r.ProductRecipes.Select(pr => pr.Product.Title).Distinct().OrderBy(title => title).ToList(),
                IngredientCount = r.Ingredients.Count,
                StepCount = r.Steps.Count,
                BuyerCount = r.OrderItemRecipes
                    .Where(oir => oir.OrderItem.Order.Status == OrderStatus.Paid)
                    .Select(oir => oir.OrderItem.Order.UserId)
                    .Distinct()
                    .Count(),
                LatestAdminAction = db.AdminActions
                    .Where(a => a.TargetTable == RecipesTable && a.TargetId == r.Id)
                    .OrderByDescending(a => a.Id)
                    .Select(a => a.Action)
                    .FirstOrDefault(),
            })
            .ToListAsync(cancellationToken);

        return rows
            .Select(r => new StudioRecipeRow(r.Id, r.Title, r.Servings, r.IsPublished,
                ContractEnums.ToContract(r.Visibility), r.SaveCount, r.PlanTitles,
                new RecipePublishFacts(r.LatestAdminAction == UnpublishRecipe, r.IngredientCount, r.StepCount,
                    r.PlanTitles.Count, r.BuyerCount)))
            .ToList();
    }

    public async Task<IReadOnlyList<StudioProductRow>> GetProductsAsync(int creatorId, CancellationToken cancellationToken)
    {
        var rows = await db.Products.AsNoTracking()
            .Where(p => p.CreatorId == creatorId)
            .OrderByDescending(p => p.Id)
            .Select(p => new
            {
                p.Id,
                p.Title,
                p.Type,
                p.PriceCents,
                p.IsActive,
                RecipeCount = p.Recipes.Select(pr => pr.RecipeId).Distinct().Count(),
                PlacementCount = p.Recipes.Count,
                DraftCount = p.Recipes.Count(pr => !pr.Recipe.IsPublished),
                FirstDraftTitle = p.Recipes.Where(pr => !pr.Recipe.IsPublished)
                    .OrderBy(pr => pr.SortOrder).Select(pr => pr.Recipe.Title).FirstOrDefault(),
                // For sale by the rule the store lists use.
                IsForSale = db.Products.Where(ProductQueries.IsForSale).Any(sold => sold.Id == p.Id),
                // A sale is a Paid order line, by the seller written on the line at checkout.
                Sold = db.OrderItems.Count(oi => oi.ProductId == p.Id && oi.Order.Status == OrderStatus.Paid),
                LatestAdminAction = db.AdminActions
                    .Where(a => a.TargetTable == ProductsTable && a.TargetId == p.Id)
                    .OrderByDescending(a => a.Id)
                    .Select(a => a.Action)
                    .FirstOrDefault(),
            })
            .ToListAsync(cancellationToken);

        return rows
            .Select(p => new StudioProductRow(p.Id, p.Title, ContractEnums.ToContract(p.Type), p.PriceCents, p.RecipeCount,
                p.PlacementCount, p.IsActive, p.IsForSale, p.Sold, p.FirstDraftTitle,
                new ProductRestoreFacts(p.LatestAdminAction == RetireProduct, p.PlacementCount, p.DraftCount)))
            .ToList();
    }

    public async Task<IReadOnlyList<StudioSaleDto>> GetSalesAsync(int creatorId, CancellationToken cancellationToken)
    {
        // order_items.creator_id is the seller at checkout (a copied value, not a foreign key), as Q10 reads it.
        var rows = await db.OrderItems.AsNoTracking()
            .Where(oi => oi.CreatorId == creatorId)
            .OrderByDescending(oi => oi.Order.PlacedAt).ThenByDescending(oi => oi.Id)
            .Select(oi => new { oi.Order.PlacedAt, oi.Order.User.DisplayName, oi.ProductTitle, oi.UnitPriceCents, oi.Order.Status })
            .ToListAsync(cancellationToken);

        return rows
            .Select(s => new StudioSaleDto(s.PlacedAt, s.DisplayName, s.ProductTitle, s.UnitPriceCents, s.Status switch
            {
                OrderStatus.Pending => Contracts.Orders.OrderStatus.Pending,
                OrderStatus.Paid => Contracts.Orders.OrderStatus.Paid,
                OrderStatus.Refunded => Contracts.Orders.OrderStatus.Refunded,
                OrderStatus.Cancelled => Contracts.Orders.OrderStatus.Cancelled,
                _ => throw new ArgumentOutOfRangeException(nameof(s.Status), s.Status, "Unknown order status."),
            }))
            .ToList();
    }

    public async Task<IReadOnlyList<StudioReviewDto>> GetReviewsAsync(int creatorId, CancellationToken cancellationToken) =>
        await db.Reviews.AsNoTracking()
            .Where(rv => rv.Product.CreatorId == creatorId && rv.HiddenAt == null)
            .OrderByDescending(rv => rv.CreatedAt).ThenByDescending(rv => rv.Id)
            .Select(rv => new StudioReviewDto(rv.Id, rv.User.DisplayName, rv.Rating, rv.Body, rv.CreatedAt, rv.ProductId,
                rv.Product.Title))
            .ToListAsync(cancellationToken);

    public Task SetRecipePublishedAsync(int recipeId, bool published, DateTimeOffset now, CancellationToken cancellationToken) =>
        // One UPDATE. published_at keeps the first date: it is set only when it has none.
        db.Recipes
            .Where(r => r.Id == recipeId)
            .ExecuteUpdateAsync(set => set
                .SetProperty(r => r.IsPublished, published)
                .SetProperty(r => r.PublishedAt, r => published && r.PublishedAt == null ? now : r.PublishedAt),
                cancellationToken);

    public Task SetProductActiveAsync(int productId, bool active, CancellationToken cancellationToken) =>
        db.Products
            .Where(p => p.Id == productId)
            .ExecuteUpdateAsync(set => set.SetProperty(p => p.IsActive, active), cancellationToken);
}
