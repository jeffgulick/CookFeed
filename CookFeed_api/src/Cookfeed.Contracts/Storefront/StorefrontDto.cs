namespace Cookfeed.Contracts.Storefront;

/// <summary>A creator's storefront: who they are, their public recipes, and the products they sell today.</summary>
/// <param name="RecipeCount">How many public recipes the storefront lists.</param>
/// <param name="TotalSaves">The saves across those recipes.</param>
/// <param name="ViewerIsCreator">True when the viewer is this creator; the client hides "Add to cart" (§3.1).</param>
public sealed record StorefrontDto(
    string Handle,
    string DisplayName,
    string? Bio,
    string? AvatarUrl,
    bool IsVerified,
    int RecipeCount,
    int TotalSaves,
    bool ViewerIsCreator,
    IReadOnlyList<StorefrontRecipeDto> Recipes,
    IReadOnlyList<StorefrontProductDto> Products);
