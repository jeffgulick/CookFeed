namespace Cookfeed.Contracts.Recipes;

/// <summary>
/// What a viewer is told about a published premium recipe they have not bought: its title, and where to get it. The
/// body of a 403 from <c>GET /api/recipes/{id}</c>. Nothing of the recipe itself is in it.
/// </summary>
/// <param name="AvailableIn">The products for sale that hold the recipe; empty when none is for sale any more.</param>
public sealed record RecipeLockedDto(string Title, IReadOnlyList<RecipeLockedProductDto> AvailableIn);

/// <summary>One product a cook can buy to open the recipe.</summary>
public sealed record RecipeLockedProductDto(int ProductId, string Title, Storefront.ProductType Type);
