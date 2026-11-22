using Cookfeed.Domain.Enums;
using Cookfeed.Domain.ShoppingList;

namespace Cookfeed.Domain.Tests.ShoppingList;

/// <summary>
/// <see cref="TripRules"/>: the life of a shopping list (DesignDocument.md §3.9) and what goes on one. The
/// prototype's <c>db.js</c> (<c>tripEditable</c>, <c>addTripItems</c>, <c>listName</c>) is its twin.
/// </summary>
public class TripRulesTests
{
    [Theory]
    [InlineData(TripStatus.Building, true)]
    [InlineData(TripStatus.Shopping, true)]    // in the store included
    [InlineData(TripStatus.Sent, false)]       // the partner is shopping it
    [InlineData(TripStatus.Done, false)]       // history
    public void A_list_can_change_while_it_is_built_or_shopped(TripStatus status, bool expected)
    {
        Assert.Equal(expected, TripRules.CanChange(status));
    }

    [Theory]
    [InlineData(TripStatus.Building, true)]
    [InlineData(TripStatus.Shopping, false)]
    [InlineData(TripStatus.Sent, false)]
    [InlineData(TripStatus.Done, false)]
    public void Shopping_starts_only_from_a_list_being_built(TripStatus status, bool expected)
    {
        Assert.Equal(expected, TripRules.CanStart(status));
    }

    [Theory]
    [InlineData(TripStatus.Building, false)]
    [InlineData(TripStatus.Shopping, true)]
    [InlineData(TripStatus.Sent, true)]
    [InlineData(TripStatus.Done, false)]
    public void A_list_is_finished_only_once_it_is_being_shopped_or_was_sent(TripStatus status, bool expected)
    {
        Assert.Equal(expected, TripRules.CanFinish(status));
    }

    [Fact]
    public void A_new_list_is_named_for_the_day_it_was_made()
    {
        Assert.Equal("Shopping list, November 21", TripRules.ListName(new DateOnly(2026, 11, 21)));
        Assert.Equal("Shopping list, January 5", TripRules.ListName(new DateOnly(2027, 1, 5)));
    }

    [Theory]
    [InlineData("2026-11-21", "2026-11-22", "2026-11-21")]   // evening west of UTC: the cook's day is the day before
    [InlineData("2026-11-23", "2026-11-22", "2026-11-23")]   // morning east of UTC: the day after
    [InlineData("2026-11-22", "2026-11-22", "2026-11-22")]
    [InlineData("2026-10-01", "2026-11-22", "2026-11-22")]   // no time zone is that far away: the server's day is used
    [InlineData(null, "2026-11-22", "2026-11-22")]           // the app sent no day
    public void A_list_is_dated_by_the_cooks_own_day_when_it_can_be_today_somewhere(string? cooksDay, string utcDay,
        string expected)
    {
        var day = TripRules.ListDay(cooksDay is null ? null : DateOnly.Parse(cooksDay), DateOnly.Parse(utcDay));

        Assert.Equal(DateOnly.Parse(expected), day);
    }

    [Fact]
    public void A_recipe_asked_for_twice_becomes_one_item_for_the_people_of_both()
    {
        // A plan with the oats on two mornings: the list still buys enough for both.
        var items = TripRules.Combine([new TripItem(9, 4), new TripItem(18, 4), new TripItem(9, 4)], alreadyOnList: []);

        Assert.Equal([new TripItem(9, 8), new TripItem(18, 4)], items);
    }

    [Fact]
    public void The_people_for_one_recipe_never_go_past_the_most_a_recipe_can_be_cooked_for()
    {
        var items = TripRules.Combine([new TripItem(9, 30), new TripItem(9, 30)], alreadyOnList: []);

        Assert.Equal([new TripItem(9, TripRules.MaxPeople)], items);
    }

    [Fact]
    public void A_recipe_already_on_the_list_is_not_added_again()
    {
        var items = TripRules.Combine([new TripItem(9, 4), new TripItem(18, 4)], alreadyOnList: [18]);

        Assert.Equal([new TripItem(9, 4)], items);
    }

    [Theory]
    [InlineData(1, true)]
    [InlineData(50, true)]
    [InlineData(0, false)]
    [InlineData(51, false)]
    public void A_recipe_is_cooked_for_1_to_50_people(int people, bool expected)
    {
        Assert.Equal(expected, TripRules.IsPeople(people));
    }
}
