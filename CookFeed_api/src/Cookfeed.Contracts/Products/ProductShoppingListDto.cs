using Cookfeed.Contracts.ShoppingList;

namespace Cookfeed.Contracts.Products;

/// <summary>
/// "What you'll buy" on a product's page: every ingredient of the recipes the viewer may open, as each recipe is
/// written, combined and sorted by aisle then ingredient. A recipe served twice is bought for both meals.
/// </summary>
/// <param name="Unmerged">
/// Every line of an ingredient that needs more than one, because its amounts cannot be added up (for example grams
/// and cups of an ingredient with no known density). The client shows them together.
/// </param>
/// <param name="FromRecipes">The recipes on the list, by title, once each, in plan order: "For A, B and C."</param>
/// <param name="LockedRecipes">
/// The recipes left off because the viewer may not open them yet, by title: "Their ingredients are added when you
/// buy the plan."
/// </param>
public sealed record ProductShoppingListDto(
    IReadOnlyList<ShoppingListLineDto> Lines,
    IReadOnlyList<ShoppingListLineDto> Unmerged,
    IReadOnlyList<string> FromRecipes,
    IReadOnlyList<string> LockedRecipes);
