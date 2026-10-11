namespace Cookfeed.Contracts.Storefront;

/// <summary>One public recipe on a storefront.</summary>
/// <param name="TotalMinutes">Prep plus cook time; null when the recipe gives neither.</param>
public sealed record StorefrontRecipeDto(
    int Id,
    string Title,
    string? ThumbnailUrl,
    int? TotalMinutes,
    int SaveCount,
    DateTimeOffset PublishedAt);
