using System.Text.Json.Serialization;

namespace Cookfeed.Contracts.Recipes;

/// <summary>
/// Who may see a published recipe, as the API reports it. Mirrors <c>Cookfeed.Domain.Enums.RecipeVisibility</c> so
/// the API's JSON does not depend on the Domain layer. Sent as its name ("ProductOnly"), not a number.
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter<RecipeVisibility>))]
public enum RecipeVisibility
{
    Public,
    ProductOnly,
}
