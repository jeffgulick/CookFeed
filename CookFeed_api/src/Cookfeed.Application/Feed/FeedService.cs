using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Contracts.Feed;

namespace Cookfeed.Application.Feed;

/// <summary>Turns a page request into a repository read and works out whether another page follows.</summary>
public class FeedService(IRecipeRepository recipes)
{
    /// <summary>The largest page a caller may ask for.</summary>
    public const int MaxPageSize = 50;

    /// <summary>The highest page number whose offset, <c>(page - 1) * pageSize</c>, still fits in an int.</summary>
    public const int MaxPage = int.MaxValue / MaxPageSize;

    /// <summary>One page of the feed. <paramref name="page"/> starts at 1; the controller validates both numbers.</summary>
    public async Task<FeedPageDto> GetFeedAsync(FeedSort sort, int page, int pageSize, int? viewerId,
        CancellationToken cancellationToken)
    {
        // Ask for one row past the page: if it comes back, another page follows. That answers HasMore without a
        // second COUNT(*) query (docs/Queries.md §1). The extra row is never shown.
        var rows = await recipes.GetFeedAsync(sort, (page - 1) * pageSize, pageSize + 1, viewerId, cancellationToken);
        var hasMore = rows.Count > pageSize;
        var items = hasMore ? rows.Take(pageSize).ToList() : rows;

        return new FeedPageDto(items, page, pageSize, hasMore);
    }
}
