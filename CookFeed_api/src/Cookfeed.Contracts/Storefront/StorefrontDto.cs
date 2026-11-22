namespace Cookfeed.Contracts.Storefront;

/// <summary>A creator's storefront: who they are, their public recipes, and the products they have for sale today.</summary>
/// <param name="IsSuspended">
/// True while Cookfeed has the creator suspended (§3.8). The storefront still opens and says so; nothing is for
/// sale, so <paramref name="Products"/> is empty.
/// </param>
/// <param name="RecipeCount">How many public recipes the storefront lists.</param>
/// <param name="TotalSaves">The saves across those recipes.</param>
/// <param name="ViewerIsCreator">True when the viewer is this creator; the client hides "Add to cart" (§3.1).</param>
/// <param name="Products">
/// For sale only, by the rule the product page reports as <c>IsForSale</c>: active, the creator not suspended, at
/// least one recipe and none taken down.
/// </param>
public sealed record StorefrontDto(
    string Handle,
    string DisplayName,
    string? Bio,
    string? AvatarUrl,
    bool IsVerified,
    bool IsSuspended,
    int RecipeCount,
    int TotalSaves,
    bool ViewerIsCreator,
    IReadOnlyList<StorefrontRecipeDto> Recipes,
    IReadOnlyList<StorefrontProductDto> Products);
