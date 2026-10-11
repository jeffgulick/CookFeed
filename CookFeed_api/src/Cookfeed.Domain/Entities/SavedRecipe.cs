namespace Cookfeed.Domain.Entities;

/// <summary>An account saved a recipe. Adding or removing one updates <see cref="Recipe.SaveCount"/>.</summary>
public class SavedRecipe
{
    public int UserId { get; set; }

    public User User { get; set; } = null!;

    public int RecipeId { get; set; }

    public Recipe Recipe { get; set; } = null!;

    public DateTimeOffset SavedAt { get; set; }
}
