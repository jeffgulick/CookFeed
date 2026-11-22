namespace Cookfeed.Contracts.Storefront;

/// <summary>One creator, as a tile on Discover: enough to show who they are and link to their storefront.</summary>
/// <param name="Handle">The address of the storefront: <c>/api/creators/{handle}</c>.</param>
public sealed record CreatorTileDto(string Handle, string DisplayName, string? AvatarUrl, bool IsVerified);
