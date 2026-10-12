using System.Text.Json.Serialization;

namespace Cookfeed.Contracts.Recipes;

/// <summary>
/// The meal of the day a meal plan puts a recipe on. Mirrors <c>Cookfeed.Domain.Enums.MealSlot</c>; sent as its name.
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter<MealSlot>))]
public enum MealSlot
{
    Breakfast,
    Lunch,
    Dinner,
    Snack,
}
