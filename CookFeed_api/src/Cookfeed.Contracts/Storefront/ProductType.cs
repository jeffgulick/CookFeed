using System.Text.Json.Serialization;

namespace Cookfeed.Contracts.Storefront;

/// <summary>
/// What a product is, as the API reports it. Mirrors <c>Cookfeed.Domain.Enums.ProductType</c> so the API's
/// JSON does not depend on the Domain layer. Sent as its name ("MealPlan"), not a number.
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter<ProductType>))]
public enum ProductType
{
    RecipeCollection,
    MealPlan,
}
