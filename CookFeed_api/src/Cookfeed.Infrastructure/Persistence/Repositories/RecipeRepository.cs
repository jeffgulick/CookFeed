using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Contracts.Feed;
using Cookfeed.Domain.Access;
using Cookfeed.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Cookfeed.Infrastructure.Persistence.Repositories;

/// <summary>The EF Core queries over recipes. Each method is one SQL statement; see docs/Queries.md for the SQL.</summary>
public class RecipeRepository(CookfeedDbContext db) : IRecipeRepository
{
    public async Task<IReadOnlyList<FeedItemDto>> GetFeedAsync(FeedSort sort, int skip, int take, int? viewerId,
        CancellationToken cancellationToken)
    {
        // Only published Public recipes reach the feed; ProductOnly recipes are for buyers (DesignDocument.md §3.3).
        // AsNoTracking: this is a read, so EF Core does not need to watch the rows for changes.
        var recipes = db.Recipes.AsNoTracking()
            .Where(r => r.IsPublished && r.Visibility == RecipeVisibility.Public);

        // Each order leads with the column its index is sorted on, so PostgreSQL can read the index in order
        // and stop after one page. The trailing id makes the order total, so pages never overlap or skip a row.
        var ordered = sort switch
        {
            FeedSort.Newest => recipes
                .OrderByDescending(r => r.PublishedAt).ThenByDescending(r => r.Id),
            FeedSort.Trending => recipes
                .OrderByDescending(r => r.SaveCount).ThenByDescending(r => r.PublishedAt).ThenByDescending(r => r.Id),
            _ => throw new ArgumentOutOfRangeException(nameof(sort), sort, "Unknown feed sort."),
        };

        // Select into the DTO inside the query, so EF Core fetches only these columns and turns the navigations
        // (Creator, Creator.User, SavedBy) into joins and an EXISTS, all in one statement.
        return await ordered
            .Skip(skip)
            .Take(take)
            .Select(r => new FeedItemDto(
                r.Id,
                r.Title,
                r.VideoUrl,
                r.ThumbnailUrl,
                r.Servings,
                r.PrepMinutes == null && r.CookMinutes == null ? null : (r.PrepMinutes ?? 0) + (r.CookMinutes ?? 0),
                r.SaveCount,
                r.PublishedAt!.Value,
                r.Creator.Handle,
                r.Creator.User.DisplayName,
                r.Creator.IsVerified,
                viewerId != null && r.SavedBy.Any(s => s.UserId == viewerId)))
            .ToListAsync(cancellationToken);
    }

    public Task<RecipeAccessFacts?> GetAccessFactsAsync(int recipeId, int? viewerId,
        CancellationToken cancellationToken) =>
        // One row from the primary key. The EXISTS reads the purchase snapshot, never the live product, as in Q14: a
        // buyer keeps what they bought even after the creator edits the product (DesignDocument.md §3.3).
        db.Recipes.AsNoTracking()
            .Where(r => r.Id == recipeId)
            .Select(r => new RecipeAccessFacts(
                r.CreatorId,
                r.IsPublished,
                r.Visibility,
                viewerId != null && r.OrderItemRecipes.Any(oir =>
                    oir.OrderItem.Order.UserId == viewerId && oir.OrderItem.Order.Status == OrderStatus.Paid)))
            .SingleOrDefaultAsync(cancellationToken);

    public Task<Contracts.Recipes.RecipeDetailDto?> GetDetailAsync(int recipeId, int? viewerId,
        CancellationToken cancellationToken) =>
        // AsSplitQuery: the ingredient lines, the steps and the placements are sibling collections. Joined in one
        // statement they would multiply each other's rows (docs/Queries.md §1b), so EF Core reads each separately.
        db.Recipes.AsNoTracking()
            .AsSplitQuery()
            .Where(r => r.Id == recipeId)
            .Select(r => new Contracts.Recipes.RecipeDetailDto(
                r.Id,
                r.Title,
                r.Description,
                r.VideoUrl,
                r.ThumbnailUrl,
                r.Servings,
                r.PrepMinutes,
                r.CookMinutes,
                r.PrepMinutes == null && r.CookMinutes == null ? null : (r.PrepMinutes ?? 0) + (r.CookMinutes ?? 0),
                r.SaveCount,
                r.IsPublished,
                r.Visibility == RecipeVisibility.Public
                    ? Contracts.Recipes.RecipeVisibility.Public
                    : Contracts.Recipes.RecipeVisibility.ProductOnly,
                r.PublishedAt,
                new Contracts.Recipes.RecipeCreatorDto(
                    r.Creator.Handle, r.Creator.User.DisplayName, r.Creator.AvatarUrl, r.Creator.IsVerified),
                viewerId != null && r.SavedBy.Any(s => s.UserId == viewerId),
                viewerId != null && r.CreatorId == viewerId,
                r.Ingredients
                    .OrderBy(i => i.SortOrder)
                    .Select(i => new Contracts.Recipes.RecipeIngredientDto(
                        i.SortOrder, i.Quantity, i.Unit.Abbreviation, i.Ingredient.Name, i.DisplayText,
                        i.Preparation, i.IsOptional))
                    .ToList(),
                r.Steps
                    .OrderBy(s => s.StepNumber)
                    .Select(s => new Contracts.Recipes.RecipeStepDto(s.StepNumber, s.Instruction, s.VideoTimestampSeconds))
                    .ToList(),
                // Only products on sale: a retired product is no longer somewhere to buy the recipe. One entry per
                // placement, so a meal plan that serves the recipe on two days lists it twice.
                r.ProductRecipes
                    .Where(pr => pr.Product.IsActive)
                    .OrderBy(pr => pr.ProductId).ThenBy(pr => pr.SortOrder)
                    .Select(pr => new Contracts.Recipes.RecipePlacementDto(
                        pr.ProductId,
                        pr.Product.Title,
                        pr.Product.Type == ProductType.MealPlan
                            ? Contracts.Storefront.ProductType.MealPlan
                            : Contracts.Storefront.ProductType.RecipeCollection,
                        pr.DayOffset,
                        ToContract(pr.Slot),
                        viewerId != null && db.OrderItems.Any(oi => oi.ProductId == pr.ProductId
                            && oi.Order.UserId == viewerId && oi.Order.Status == OrderStatus.Paid)))
                    .ToList()))
            .SingleOrDefaultAsync(cancellationToken);

    private static Contracts.Recipes.MealSlot? ToContract(MealSlot? slot) => slot switch
    {
        null => null,
        MealSlot.Breakfast => Contracts.Recipes.MealSlot.Breakfast,
        MealSlot.Lunch => Contracts.Recipes.MealSlot.Lunch,
        MealSlot.Dinner => Contracts.Recipes.MealSlot.Dinner,
        MealSlot.Snack => Contracts.Recipes.MealSlot.Snack,
        _ => throw new ArgumentOutOfRangeException(nameof(slot), slot, "Unknown meal slot."),
    };
}
