namespace Cookfeed.Domain.Entities;

/// <summary>An ingredient a cook took off a trip's list: they have it, so its line is left out (§3.9).</summary>
public class ShoppingTripSkip
{
    public int TripId { get; set; }

    public ShoppingTrip Trip { get; set; } = null!;

    public int IngredientId { get; set; }

    public Ingredient Ingredient { get; set; } = null!;
}
