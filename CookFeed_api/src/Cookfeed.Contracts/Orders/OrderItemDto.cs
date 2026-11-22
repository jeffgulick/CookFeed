using Cookfeed.Contracts.Storefront;

namespace Cookfeed.Contracts.Orders;

/// <summary>
/// A product bought in an order, as it was at checkout: the title, price and seller are the snapshot taken then,
/// not the product as it is today (DesignDocument.md §6).
/// </summary>
/// <param name="SellerHandle">The seller's storefront handle; null if that creator no longer has a storefront.</param>
/// <param name="Type">What the product is: a meal plan or a recipe collection.</param>
/// <param name="RecipeCount">Distinct recipes this purchase holds, counted from its snapshot, not from the product today.</param>
/// <param name="MealCount">Meals this purchase holds, for a meal plan, which may repeat a recipe; null for a collection.</param>
public sealed record OrderItemDto(
    int ProductId,
    string ProductTitle,
    int UnitPriceCents,
    string? SellerHandle,
    ProductType Type,
    int RecipeCount,
    int? MealCount);
