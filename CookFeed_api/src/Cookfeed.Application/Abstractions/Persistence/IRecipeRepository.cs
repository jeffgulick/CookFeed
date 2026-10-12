using Cookfeed.Contracts.Feed;
using Cookfeed.Contracts.Recipes;
using Cookfeed.Domain.Access;

namespace Cookfeed.Application.Abstractions.Persistence;

/// <summary>Reads recipes from the database. Implemented with EF Core in Infrastructure.</summary>
public interface IRecipeRepository
{
    /// <summary>
    /// Published <c>Public</c> recipes in <paramref name="sort"/> order, skipping <paramref name="skip"/> and
    /// returning at most <paramref name="take"/>. <paramref name="viewerId"/>, when given, fills
    /// <see cref="FeedItemDto.SavedByViewer"/>.
    /// </summary>
    Task<IReadOnlyList<FeedItemDto>> GetFeedAsync(FeedSort sort, int skip, int take, int? viewerId,
        CancellationToken cancellationToken);

    /// <summary>
    /// What <see cref="RecipeAccess"/> needs to decide whether <paramref name="viewerId"/> may open the recipe, or
    /// null when no recipe has the id.
    /// </summary>
    Task<RecipeAccessFacts?> GetAccessFactsAsync(int recipeId, int? viewerId, CancellationToken cancellationToken);

    /// <summary>
    /// The recipe in full, as <paramref name="viewerId"/> sees it, or null when no recipe has the id. It applies no
    /// access rule: call it only once <see cref="RecipeAccess"/> has allowed the viewer.
    /// </summary>
    Task<RecipeDetailDto?> GetDetailAsync(int recipeId, int? viewerId, CancellationToken cancellationToken);
}
