using Cookfeed.Contracts.Feed;

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
}
