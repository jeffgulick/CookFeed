namespace Cookfeed.Domain.Entities;

/// <summary>One recipe on a shopping trip, cooked for <see cref="Servings"/> people. The same recipe may be on a trip twice.</summary>
public class ShoppingTripItem
{
    public int Id { get; set; }

    public int TripId { get; set; }

    public ShoppingTrip Trip { get; set; } = null!;

    public int RecipeId { get; set; }

    public Recipe Recipe { get; set; } = null!;

    public int Servings { get; set; }
}
