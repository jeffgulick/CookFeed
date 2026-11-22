using Cookfeed.Contracts.ShoppingList;

namespace Cookfeed.Contracts.Products;

/// <summary>
/// "What you'll buy" on a product's page: every ingredient of the recipes the viewer may open, as each recipe
/// writes it. A recipe served twice is bought for both meals.
/// </summary>
/// <param name="Lines">
/// Sorted by aisle, then ingredient. Two lines are joined only when they name the same ingredient in the same unit;
/// nothing is converted, so an ingredient written in two units has a line for each.
/// </param>
/// <param name="FromRecipes">The recipes on the list, by title, once each, in plan order: "For A, B and C."</param>
/// <param name="LockedRecipes">
/// The recipes left off because the viewer may not open them yet, by title: "Their ingredients are added when you
/// buy the plan."
/// </param>
public sealed record ProductShoppingListDto(
    IReadOnlyList<ShoppingListLineDto> Lines,
    IReadOnlyList<string> FromRecipes,
    IReadOnlyList<string> LockedRecipes);
