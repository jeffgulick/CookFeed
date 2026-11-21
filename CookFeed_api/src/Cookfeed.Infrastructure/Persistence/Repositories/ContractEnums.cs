using Cookfeed.Domain.Enums;

namespace Cookfeed.Infrastructure.Persistence.Repositories;

/// <summary>
/// Turns the Domain's enums into the ones the API sends (Cookfeed.Contracts), so the JSON does not depend on the
/// Domain layer. A new enum value has to be added in both places; the switch throws rather than guess.
/// </summary>
internal static class ContractEnums
{
    public static Contracts.Storefront.ProductType ToContract(ProductType type) => type switch
    {
        ProductType.RecipeCollection => Contracts.Storefront.ProductType.RecipeCollection,
        ProductType.MealPlan => Contracts.Storefront.ProductType.MealPlan,
        _ => throw new ArgumentOutOfRangeException(nameof(type), type, "Unknown product type."),
    };

    public static Contracts.Recipes.RecipeVisibility ToContract(RecipeVisibility visibility) => visibility switch
    {
        RecipeVisibility.Public => Contracts.Recipes.RecipeVisibility.Public,
        RecipeVisibility.ProductOnly => Contracts.Recipes.RecipeVisibility.ProductOnly,
        _ => throw new ArgumentOutOfRangeException(nameof(visibility), visibility, "Unknown recipe visibility."),
    };

    public static Contracts.Recipes.MealSlot? ToContract(MealSlot? slot) => slot switch
    {
        null => null,
        MealSlot.Breakfast => Contracts.Recipes.MealSlot.Breakfast,
        MealSlot.Lunch => Contracts.Recipes.MealSlot.Lunch,
        MealSlot.Dinner => Contracts.Recipes.MealSlot.Dinner,
        MealSlot.Snack => Contracts.Recipes.MealSlot.Snack,
        _ => throw new ArgumentOutOfRangeException(nameof(slot), slot, "Unknown meal slot."),
    };
}
