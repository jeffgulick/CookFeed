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

    /// <summary>The longest search text a caller may send; no recipe title or creator name is longer.</summary>
    public const int MaxSearchLength = 100;

    /// <summary>
    /// One page of the feed. <paramref name="page"/> starts at 1; the controller validates both numbers.
    /// <paramref name="search"/>, when not blank, keeps only the recipes whose title, creator handle or creator name
    /// holds that text.
    /// </summary>
    public async Task<FeedPageDto> GetFeedAsync(FeedSort sort, int page, int pageSize, int? viewerId, string? search,
        CancellationToken cancellationToken)
    {
        // Spaces around the text are not part of what the cook is looking for, and nothing but spaces is no search.
        var text = string.IsNullOrWhiteSpace(search) ? null : search.Trim();

        // Ask for one row past the page: if it comes back, another page follows. That answers HasMore without a
        // second COUNT(*) query (docs/Queries.md §1). The extra row is never shown.
        var rows = await recipes.GetFeedAsync(sort, (page - 1) * pageSize, pageSize + 1, viewerId, text, cancellationToken);
        var hasMore = rows.Count > pageSize;
        var items = hasMore ? rows.Take(pageSize).ToList() : rows;

        return new FeedPageDto(items, page, pageSize, hasMore);
    }
}
