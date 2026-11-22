using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Contracts.Products;
using Cookfeed.Contracts.ShoppingList;
using Cookfeed.Domain.Access;
using Cookfeed.Domain.ShoppingList;

namespace Cookfeed.Application.Products;

/// <summary>
/// "What you'll buy" for one product: the ingredients of the recipes the viewer may open, as each recipe writes
/// them, joined by <see cref="WrittenShoppingList"/> the way the prototype's product page does. The cook's own
/// shopping list, which converts between units, is <see cref="ShoppingList.ShoppingListService"/>'s.
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

        IReadOnlyList<ShoppingListLine> list = [];
        if (open.Count > 0)
        {
            var linesByRecipe = await shoppingList.GetWrittenLinesAsync(
                open.Select(p => p.RecipeId).Distinct().ToList(), cancellationToken);

            // One pass per meal, in plan order: a recipe the plan serves on two days is bought for both.
            list = WrittenShoppingList.Combine(open.SelectMany(p =>
                linesByRecipe.TryGetValue(p.RecipeId, out var lines) ? lines : []));
        }

        return new ProductShoppingListDto(
            [.. list.Select(ToDto)],
            [.. open.Select(p => p.Title).Distinct()],
            [.. locked.Select(p => p.Title).Distinct()]);
    }

    private static ShoppingListLineDto ToDto(ShoppingListLine line) =>
        new(line.IngredientId, line.Ingredient, line.Aisle, line.Quantity, line.Unit);
}
