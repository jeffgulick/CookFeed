using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Contracts.Feed;
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
}
