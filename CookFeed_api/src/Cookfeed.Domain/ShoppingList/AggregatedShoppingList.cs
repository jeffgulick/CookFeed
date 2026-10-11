namespace Cookfeed.Domain.ShoppingList;

/// <summary>
/// A finished shopping list. <see cref="Unmerged"/> holds every line of an ingredient that needs more than one,
/// because its amounts are in categories that cannot be added up, such as mozzarella in grams and in cups with no
/// known density. They are kept apart rather than guessed (DesignDocument.md §7.3).
/// </summary>
public sealed record AggregatedShoppingList(IReadOnlyList<ShoppingListLine> Lines, IReadOnlyList<ShoppingListLine> Unmerged);
