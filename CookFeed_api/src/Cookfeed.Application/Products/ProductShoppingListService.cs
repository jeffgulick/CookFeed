using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Contracts.Products;
using Cookfeed.Contracts.ShoppingList;
using Cookfeed.Domain.Access;
using Cookfeed.Domain.ShoppingList;

namespace Cookfeed.Application.Products;

/// <summary>
/// "What you'll buy" for one product: the ingredients of the recipes the viewer may open, combined by
/// <see cref="ShoppingListAggregator"/> the same way the caller's own shopping list is (DesignDocument.md §7.5).
/// </summary>
public class ProductShoppingListService(IProductRepository products, IShoppingListRepository shoppingList)
{
    /// <summary>The list, or null when no product has the id (the controller answers 404).</summary>
    public async Task<ProductShoppingListDto?> GetShoppingListAsync(int productId, int? viewerId,
        CancellationToken cancellationToken)
    {
        // The same placements the page shows: a buyer's purchase snapshot, or the product as it is today.
        var page = await products.GetPageAsync(productId, viewerId, cancellationToken);
        if (page is null)
        {
            return null;
        }

        // The rule that opens a recipe also decides whether its ingredients are listed, so a premium recipe gives
        // nothing away until it is bought (DesignDocument.md §3.3, §3.7).
        var byAccess = page.Placements.ToLookup(p => RecipeAccess.CanOpen(p.Access, viewerId));
        var (open, locked) = (byAccess[true].ToList(), byAccess[false].ToList());

        // One entry per meal: a recipe the plan serves on two days is bought for both.
        var timesByRecipe = open.GroupBy(p => p.RecipeId).ToDictionary(g => g.Key, g => g.Count());
        var list = timesByRecipe.Count == 0
            ? new AggregatedShoppingList([], [])
            : ShoppingListAggregator.Aggregate(
                await shoppingList.GetIngredientTotalsForRecipesAsync(timesByRecipe, cancellationToken));

        return new ProductShoppingListDto(
            [.. list.Lines.Select(ToDto)],
            [.. list.Unmerged.Select(ToDto)],
            [.. open.Select(p => p.Title).Distinct()],
            [.. locked.Select(p => p.Title).Distinct()]);
    }

    private static ShoppingListLineDto ToDto(ShoppingListLine line) =>
        new(line.IngredientId, line.Ingredient, line.Aisle, line.Quantity, line.Unit);
}
