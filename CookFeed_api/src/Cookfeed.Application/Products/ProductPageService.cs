using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Contracts.Products;
using Cookfeed.Contracts.Recipes;
using Cookfeed.Contracts.Storefront;
using Cookfeed.Domain.Access;
using DomainVisibility = Cookfeed.Domain.Enums.RecipeVisibility;

namespace Cookfeed.Application.Products;

/// <summary>The page of one meal plan or collection, with each recipe shown as far as the viewer may see it.</summary>
public class ProductPageService(IProductRepository products)
{
    /// <summary>The page, or null when no product has the id (the controller answers 404).</summary>
    public async Task<ProductDetailDto?> GetProductAsync(int productId, int? viewerId, CancellationToken cancellationToken)
    {
        var page = await products.GetPageAsync(productId, viewerId, cancellationToken);
        if (page is null)
        {
            return null;
        }

        return new ProductDetailDto(
            page.Id,
            page.Type,
            page.Title,
            page.Description,
            page.CoverImageUrl,
            page.PriceCents,
            page.Currency,
            new ProductCreatorDto(page.CreatorHandle, page.CreatorDisplayName, page.CreatorIsVerified),
            // Counted from the list the viewer sees, so a buyer's numbers describe what they bought. A meal plan may
            // serve one recipe on several days, so recipes and meals differ (DesignDocument.md §3.2, Q5).
            RecipeCount: page.Placements.Select(p => p.RecipeId).Distinct().Count(),
            MealCount: page.Type == ProductType.MealPlan ? page.Placements.Count : null,
            Rating(page),
            page.IsForSale,
            page.OwnedByViewer,
            ViewerIsCreator: viewerId == page.CreatorId,
            page.InCart,
            page.Placements.Select(p => Recipe(p, viewerId)).ToList());
    }

    // The same rule as opening the recipe itself. A recipe the viewer may not open keeps its card (title, picture,
    // servings, time) and nothing else: no id to link to, no ingredients, no steps (DesignDocument.md §3.3, §3.7).
    private static ProductRecipeDto Recipe(ProductPagePlacement p, int? viewerId)
    {
        var canOpen = RecipeAccess.CanOpen(p.Access, viewerId);
        return new ProductRecipeDto(
            p.SortOrder,
            p.DayOffset,
            p.Slot,
            p.Title,
            p.ThumbnailUrl,
            p.Servings,
            p.PrepMinutes is null && p.CookMinutes is null ? null : (p.PrepMinutes ?? 0) + (p.CookMinutes ?? 0),
            p.Access.Visibility == DomainVisibility.Public ? RecipeVisibility.Public : RecipeVisibility.ProductOnly,
            canOpen,
            canOpen
                ? new ProductRecipeDetailsDto(p.RecipeId, p.PrepMinutes, p.CookMinutes, p.IngredientCount, p.StepCount,
                    p.FirstStep, p.SaveCount, p.SavedByViewer, p.OwnedThrough)
                : null);
    }

    // The numbers of queries.sql Q13. PostgreSQL's ROUND takes a half away from zero, so this does too.
    private static ProductRatingDto Rating(ProductPage page) =>
        page.ReviewCount == 0
            ? new ProductRatingDto(0, null, null)
            : new ProductRatingDto(
                page.ReviewCount,
                Math.Round((decimal)page.RatingSum / page.ReviewCount, 1, MidpointRounding.AwayFromZero),
                (int)Math.Round(100m * page.RecommendCount / page.ReviewCount, MidpointRounding.AwayFromZero));
}
