using Cookfeed.Domain.Enums;
using Cookfeed.Domain.ShoppingList;

namespace Cookfeed.Domain.Tests.ShoppingList;

/// <summary>
/// <see cref="ShoppingListAggregator"/>, the policy half of the shopping list (DesignDocument.md §7.3–7.5), tested
/// without a database. Each input is what the database hands over: one total per (ingredient, unit category),
/// already in the category's base unit (ml, g or each).
/// </summary>
public class ShoppingListAggregatorTests
{
    private const decimal Cup = 236.588m;

    [Fact]
    public void Flour_in_grams_and_cups_becomes_one_line_in_grams()
    {
        // The example in DesignDocument.md §7.3: 500 g + 2 cups + 2¼ cups at 0.53 g/ml = 1032.91 g.
        var list = ShoppingListAggregator.Aggregate(
        [
            Total(1, "all-purpose flour", "Pantry", UnitCategory.Mass, 500m, density: 0.53m, preferred: Gram),
            Total(1, "all-purpose flour", "Pantry", UnitCategory.Volume, 4.25m * Cup, density: 0.53m, preferred: Gram),
        ]);

        var flour = Assert.Single(list.Lines);
        Assert.Equal(("all-purpose flour", 1032.91m, "g"), (flour.Ingredient, flour.Quantity, flour.Unit));
        Assert.Empty(list.Unmerged);
    }

    [Fact]
    public void Milk_in_grams_converts_toward_millilitres_because_milk_is_shopped_by_volume()
    {
        // §7.4: density converts toward the preferred unit's category. 1.5 cups + 200 g at 1.03 g/ml.
        var list = ShoppingListAggregator.Aggregate(
        [
            Total(6, "whole milk", "Dairy", UnitCategory.Volume, 1.5m * Cup, density: 1.03m, preferred: Millilitre),
            Total(6, "whole milk", "Dairy", UnitCategory.Mass, 200m, density: 1.03m, preferred: Millilitre),
        ]);

        var milk = Assert.Single(list.Lines);
        Assert.Equal((549.06m, "ml"), (milk.Quantity, milk.Unit));
    }

    [Fact]
    public void Without_a_density_grams_and_cups_stay_apart_and_both_lines_are_unmerged()
    {
        // §7.3: a wrong merge is worse than none. The cup total has no way into grams, so it is shown in ml.
        var list = ShoppingListAggregator.Aggregate(
        [
            Total(20, "mozzarella", "Dairy", UnitCategory.Mass, 200m, density: null, preferred: Gram),
            Total(20, "mozzarella", "Dairy", UnitCategory.Volume, Cup, density: null, preferred: Gram),
        ]);

        Assert.Empty(list.Lines);
        Assert.Equal([(200m, "g"), (236.59m, "ml")], list.Unmerged.Select(l => (l.Quantity, l.Unit)).Order());
    }

    [Fact]
    public void A_count_total_cannot_merge_with_mass_even_with_a_density()
    {
        // Density converts volume and mass only; "3 cloves" and "15 g" are two lines.
        var list = ShoppingListAggregator.Aggregate(
        [
            Total(30, "garlic", "Produce", UnitCategory.Count, 3m, density: 0.6m, preferred: Gram),
            Total(30, "garlic", "Produce", UnitCategory.Mass, 15m, density: 0.6m, preferred: Gram),
            Total(31, "lemon", "Produce", UnitCategory.Count, 2m, density: null, preferred: Each),
        ]);

        Assert.Equal(["lemon"], list.Lines.Select(l => l.Ingredient));
        Assert.Equal([(3m, "ea"), (15m, "g")], list.Unmerged.Select(l => (l.Quantity, l.Unit)).Order());
    }

    [Fact]
    public void A_count_only_ingredient_with_a_mass_preference_is_shown_in_the_count_base_unit_not_dropped()
    {
        // §7.4: when the line's category still differs from the preferred unit's, use the base unit (each).
        var list = ShoppingListAggregator.Aggregate(
            [Total(40, "onion", "Produce", UnitCategory.Count, 2m, density: null, preferred: Gram)]);

        Assert.Equal((2m, "ea"), (list.Lines[0].Quantity, list.Lines[0].Unit));
    }

    [Theory]
    [InlineData(UnitCategory.Volume, "ml")]
    [InlineData(UnitCategory.Mass, "g")]
    [InlineData(UnitCategory.Count, "ea")]
    public void An_ingredient_with_no_preferred_unit_is_shown_in_its_category_base_unit(UnitCategory category, string unit)
    {
        var list = ShoppingListAggregator.Aggregate([Total(50, "salt", "Pantry", category, 10m, density: null, preferred: null)]);

        Assert.Equal((10m, unit), (list.Lines[0].Quantity, list.Lines[0].Unit));
    }

    [Fact]
    public void The_quantity_is_divided_into_the_preferred_unit()
    {
        // Rice shopped by the cup: 473.176 ml is 2 cups. Garlic shopped by the clove: Count base 1 per clove.
        var list = ShoppingListAggregator.Aggregate(
        [
            Total(60, "rice", "Pantry", UnitCategory.Volume, 2m * Cup, density: 0.85m, preferred: CupUnit),
            Total(61, "garlic", "Produce", UnitCategory.Count, 5m, density: null, preferred: Clove),
        ]);

        Assert.Equal([(2.00m, "c"), (5m, "clove")], list.Lines.Select(l => (l.Quantity, l.Unit)));
    }

    [Theory]
    [InlineData(0.125, 0.13)]     // half away from zero, as PostgreSQL's ROUND does; banker's rounding would give 0.12
    [InlineData(0.135, 0.14)]
    [InlineData(10.004, 10.00)]
    public void Quantities_are_rounded_to_two_places_half_away_from_zero(double baseQuantity, double expected)
    {
        var list = ShoppingListAggregator.Aggregate(
            [Total(70, "yeast", "Pantry", UnitCategory.Mass, (decimal)baseQuantity, density: null, preferred: Gram)]);

        Assert.Equal((decimal)expected, list.Lines[0].Quantity);
    }

    [Fact]
    public void Lines_are_sorted_by_aisle_then_ingredient()
    {
        var list = ShoppingListAggregator.Aggregate(
        [
            Total(1, "tomato", "Produce", UnitCategory.Count, 1m, density: null, preferred: Each),
            Total(2, "sugar", "Pantry", UnitCategory.Mass, 1m, density: null, preferred: Gram),
            Total(3, "butter", "Dairy", UnitCategory.Mass, 1m, density: null, preferred: Gram),
            Total(4, "basil", "Produce", UnitCategory.Count, 1m, density: null, preferred: Each),
        ]);

        Assert.Equal(["butter", "sugar", "basil", "tomato"], list.Lines.Select(l => l.Ingredient));
    }

    [Fact]
    public void Nothing_in_gives_an_empty_list()
    {
        var list = ShoppingListAggregator.Aggregate([]);

        Assert.Empty(list.Lines);
        Assert.Empty(list.Unmerged);
    }

    private sealed record Preferred(UnitCategory Category, decimal ToBaseFactor, string Abbreviation);

    private static readonly Preferred Gram = new(UnitCategory.Mass, 1m, "g");
    private static readonly Preferred Millilitre = new(UnitCategory.Volume, 1m, "ml");
    private static readonly Preferred CupUnit = new(UnitCategory.Volume, Cup, "c");
    private static readonly Preferred Each = new(UnitCategory.Count, 1m, "ea");
    private static readonly Preferred Clove = new(UnitCategory.Count, 1m, "clove");

    private static IngredientTotal Total(int id, string name, string aisle, UnitCategory category, decimal baseQuantity,
        decimal? density, Preferred? preferred) =>
        new(id, name, aisle, density, preferred?.Category, preferred?.ToBaseFactor, preferred?.Abbreviation,
            category, baseQuantity);
}
