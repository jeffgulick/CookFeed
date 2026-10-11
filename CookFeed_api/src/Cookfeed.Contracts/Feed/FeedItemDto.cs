namespace Cookfeed.Contracts.Feed;

/// <summary>One recipe card in the feed: the recipe, who made it, and whether the viewer has saved it.</summary>
/// <param name="TotalMinutes">Prep plus cook time; null when the recipe gives neither.</param>
/// <param name="SavedByViewer">False when the request names no viewer.</param>
public sealed record FeedItemDto(
    int Id,
    string Title,
    string VideoUrl,
    string? ThumbnailUrl,
    int Servings,
    int? TotalMinutes,
    int SaveCount,
    DateTimeOffset PublishedAt,
    string CreatorHandle,
    string CreatorDisplayName,
    bool CreatorIsVerified,
    bool SavedByViewer);
