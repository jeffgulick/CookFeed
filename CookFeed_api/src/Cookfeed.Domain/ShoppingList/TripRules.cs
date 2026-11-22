using System.Globalization;
using Cookfeed.Domain.Enums;

namespace Cookfeed.Domain.ShoppingList;

/// <summary>One recipe on a shopping list, for a number of people.</summary>
public sealed record TripItem(int RecipeId, int Servings);

/// <summary>
/// The life of a shopping list and what goes on one (DesignDocument.md §3.9). A list is built, then shopped, then
/// done; a sent list waits for delivery. The prototype's <c>db.js</c> (<c>tripEditable</c>, <c>addTripItems</c>,
/// <c>listName</c>) is its twin.
/// </summary>
public static class TripRules
{
    /// <summary>A recipe is cooked for 1 to 50 people, on a list as on its own page.</summary>
    public const int MinPeople = 1, MaxPeople = 50;

    /// <summary>
    /// A list can change while it is built or shopped, in the store included. Once sent, the partner is shopping it;
    /// once done, it is history.
    /// </summary>
    public static bool CanChange(TripStatus status) => status is TripStatus.Building or TripStatus.Shopping;

    public static bool CanStart(TripStatus status) => status == TripStatus.Building;

    /// <summary>Done shopping, or the sent items arrived.</summary>
    public static bool CanFinish(TripStatus status) => status is TripStatus.Shopping or TripStatus.Sent;

    public static bool IsPeople(int people) => people is >= MinPeople and <= MaxPeople;

    /// <summary>
    /// The day to name a new list for: the cook's own day, as their app reports it, when it is within a day of the
    /// server's UTC day, which is as far as any time zone is from it; otherwise the server's day. Late in the evening
    /// west of UTC the two differ, and a list made on the 21st should not be named for the 22nd.
    /// </summary>
    public static DateOnly ListDay(DateOnly? cooksDay, DateOnly utcDay) =>
        cooksDay is { } day && Math.Abs(day.DayNumber - utcDay.DayNumber) <= 1 ? day : utcDay;

    /// <summary>A new list is named for the day it was made: "Shopping list, November 21".</summary>
    public static string ListName(DateOnly today) =>
        "Shopping list, " + today.ToString("MMMM d", CultureInfo.InvariantCulture);

    /// <summary>
    /// What to add to a list: a recipe already on it is left out, and a recipe asked for twice (a plan with the oats
    /// on two mornings) becomes one item for the people of both, so the list still buys enough, up to the most a
    /// recipe can be cooked for. In the order first asked for.
    /// </summary>
    public static IReadOnlyList<TripItem> Combine(IEnumerable<TripItem> wanted, IReadOnlyCollection<int> alreadyOnList) =>
        wanted
            .Where(item => !alreadyOnList.Contains(item.RecipeId))
            .GroupBy(item => item.RecipeId)
            .Select(group => new TripItem(group.Key, Math.Min(MaxPeople, group.Sum(item => item.Servings))))
            .ToList();
}
