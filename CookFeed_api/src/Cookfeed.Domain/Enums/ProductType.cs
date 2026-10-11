namespace Cookfeed.Domain.Enums;

/// <summary>
/// What a creator sells. A meal plan places each recipe on a day and in a meal slot; a collection is an
/// ordered list of recipes with no schedule.
/// </summary>
public enum ProductType
{
    RecipeCollection,
    MealPlan,
}
