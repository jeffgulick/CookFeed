using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using Cookfeed.Contracts.ShoppingList;

namespace Cookfeed.Contracts.Trips;

/// <summary>
/// Where a shopping list is in its life, as the API reports it. Mirrors <c>Cookfeed.Domain.Enums.TripStatus</c>.
/// Sent as its name ("Building"), not a number.
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter<TripStatus>))]
public enum TripStatus
{
    Building,
    Shopping,
    Sent,
    Done,
}

/// <summary>The caller's lists, newest first.</summary>
/// <param name="Active">The newest list in use, where a recipe goes when the cook does not say which; null when none is in use.</param>
/// <param name="Open">Every list in use: being built or shopped. A cook can keep several.</param>
/// <param name="Past">The finished ones.</param>
public sealed record TripsDto(TripSummaryDto? Active, IReadOnlyList<TripSummaryDto> Open, IReadOnlyList<TripSummaryDto> Past);

/// <summary>One list in a few words, for My kitchen.</summary>
public sealed record TripSummaryDto(int Id, string Name, TripStatus Status, DateTimeOffset CreatedAt,
    DateTimeOffset? CompletedAt, int RecipeCount);

/// <summary>One shopping list in full.</summary>
/// <param name="CanChange">True while the list is being built or shopped; a done list is read-only.</param>
/// <param name="Items">The recipes it cooks, each for a number of people, in the order added.</param>
/// <param name="Lines">What to buy, by aisle then name. Computed from the items every time, never stored.</param>
/// <param name="Skipped">Ingredients the cook already has at home, taken off the list with "Have it".</param>
public sealed record TripDto(
    int Id,
    string Name,
    TripStatus Status,
    DateTimeOffset CreatedAt,
    DateTimeOffset? CompletedAt,
    bool CanChange,
    IReadOnlyList<TripItemDto> Items,
    IReadOnlyList<ShoppingListLineDto> Lines,
    IReadOnlyList<TripSkippedDto> Skipped);

public sealed record TripItemDto(int RecipeId, string Title, int Servings);

public sealed record TripSkippedDto(int IngredientId, string Ingredient);

/// <summary>"Shop this recipe" or "Shop this plan": exactly one of the two ids.</summary>
/// <param name="Servings">The people to cook the recipe for; left out, the number the recipe is written for.</param>
/// <param name="Today">The date where the cook is (yyyy-MM-dd), to name a new list for their day rather than the server's.</param>
/// <param name="TripId">The list in use to add to. Left out, with <paramref name="NewList"/> false: the newest list in use, made if there is none.</param>
/// <param name="NewList">True to start a new list even though one is in use. Not together with <paramref name="TripId"/>.</param>
public sealed record ShopRequest(int? RecipeId, int? ProductId, [Range(1, 50)] int? Servings, DateOnly? Today = null,
    int? TripId = null, bool NewList = false);

/// <summary>"Shop again", from a finished list.</summary>
/// <param name="Today">The date where the cook is (yyyy-MM-dd), to name the new list for their day.</param>
public sealed record ShopAgainRequest(DateOnly? Today = null);

/// <summary>What shopping did: which list, whether it was made just now, and how many recipes went on.</summary>
/// <param name="AlreadyOnList">Recipes asked for that were on the list already; a recipe is never on it twice.</param>
public sealed record ShopResultDto(int TripId, string TripName, bool Created, int Added, int AlreadyOnList);

/// <summary>The people one recipe on a list is cooked for.</summary>
public sealed record TripServingsRequest([Range(1, 50)] int Servings);
