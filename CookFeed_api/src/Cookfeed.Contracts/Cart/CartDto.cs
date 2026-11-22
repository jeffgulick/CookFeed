using Cookfeed.Contracts.Storefront;

namespace Cookfeed.Contracts.Cart;

/// <summary>The caller's cart: the lines that can be bought now, and what they come to.</summary>
/// <param name="Lines">In the order they were added. A product is in a cart once (a digital plan is owned once).</param>
/// <param name="TotalCents">The sum of the lines' prices. Tax and delivery do not apply to a digital plan.</param>
/// <param name="Unavailable">
/// The titles of products that are in the cart but can no longer be bought (retired, their creator suspended, or
/// bought since). They are left out of <paramref name="Lines"/> and of the total, and checkout leaves them out too.
/// </param>
public sealed record CartDto(
    IReadOnlyList<CartLineDto> Lines,
    int TotalCents,
    string Currency,
    IReadOnlyList<string> Unavailable);

/// <summary>One product in the cart, as the product is today.</summary>
/// <param name="RecipeCount">Distinct recipes in the product.</param>
/// <param name="MealCount">Scheduled meals, for a meal plan, which may repeat a recipe (§3.2); null for a collection.</param>
public sealed record CartLineDto(
    int ProductId,
    ProductType Type,
    string Title,
    string? CoverImageUrl,
    string CreatorHandle,
    int RecipeCount,
    int? MealCount,
    int PriceCents);
