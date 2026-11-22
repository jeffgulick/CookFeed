using Cookfeed.Domain.ShoppingList;

namespace Cookfeed.Domain.Tests.ShoppingList;

/// <summary>
/// <see cref="WrittenShoppingList"/> is "What you'll buy" on a plan's page, as the prototype's
/// <c>buildShoppingList</c> works it out: every ingredient line as its recipe writes it, two lines joined only when
/// they name the same ingredient in the same unit, sorted by aisle and then by ingredient. Nothing is converted
/// between units; that belongs to the cook's own shopping list (<see cref="ShoppingListAggregator"/>).
/// </summary>
public class WrittenShoppingListTests
{
    [Fact]
    public void Two_lines_of_one_ingredient_in_one_unit_become_one_line()
    {
        var list = WrittenShoppingList.Combine([
            Line(1, "soy sauce", "Pantry", 3m, "tbsp"),
            Line(1, "soy sauce", "Pantry", 2m, "tbsp"),
        ]);

        Assert.Equal([new ShoppingListLine(1, "soy sauce", "Pantry", 5m, "tbsp")], list);
    }

    [Fact]
    public void One_ingredient_in_two_units_keeps_a_line_for_each_in_the_order_they_came()
    {
        var list = WrittenShoppingList.Combine([
            Line(2, "granulated sugar", "Baking", 2m, "tbsp"),
            Line(2, "granulated sugar", "Baking", 0.5m, "c"),
            Line(2, "granulated sugar", "Baking", 1m, "tbsp"),
        ]);

        Assert.Equal(
            [new ShoppingListLine(2, "granulated sugar", "Baking", 3m, "tbsp"), new ShoppingListLine(2, "granulated sugar", "Baking", 0.5m, "c")],
            list);
    }

    [Fact]
    public void The_list_is_sorted_by_aisle_and_then_by_ingredient()
    {
        var list = WrittenShoppingList.Combine([
            Line(1, "soy sauce", "Pantry", 1m, "tbsp"),
            Line(2, "chicken thigh", "Meat", 500m, "g"),
            Line(3, "rice", "Pantry", 2m, "c"),
            Line(4, "ginger", "Produce", 20m, "g"),
        ]);

        Assert.Equal(["chicken thigh", "rice", "soy sauce", "ginger"], list.Select(l => l.Ingredient));
    }

    [Fact]
    public void Amounts_are_added_exactly_and_left_for_the_page_to_round()
    {
        var list = WrittenShoppingList.Combine([
            Line(1, "olive oil", "Pantry", 0.333m, "c"),
            Line(1, "olive oil", "Pantry", 0.333m, "c"),
        ]);

        Assert.Equal(0.666m, Assert.Single(list).Quantity);
    }

    [Fact]
    public void No_lines_make_an_empty_list()
    {
        Assert.Empty(WrittenShoppingList.Combine([]));
    }

    private static WrittenIngredientLine Line(int ingredientId, string ingredient, string aisle, decimal quantity, string unit) =>
        new(ingredientId, ingredient, aisle, quantity, unit);
}
