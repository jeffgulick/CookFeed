namespace Cookfeed.Contracts.ShoppingList;

/// <summary>The caller's shopping list, sorted by aisle then ingredient.</summary>
/// <param name="Unmerged">
/// Every line of an ingredient that needs more than one, because its amounts cannot be added up (for example
/// grams and cups of an ingredient with no known density). The client shows them together.
/// </param>
public sealed record ShoppingListDto(IReadOnlyList<ShoppingListLineDto> Lines, IReadOnlyList<ShoppingListLineDto> Unmerged);
