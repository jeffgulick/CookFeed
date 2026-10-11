namespace Cookfeed.Contracts.ShoppingList;

/// <summary>One line of the caller's shopping list, e.g. all-purpose flour, 1032.91 g, in the Pantry aisle.</summary>
public sealed record ShoppingListLineDto(int IngredientId, string Ingredient, string Aisle, decimal Quantity, string Unit);
