namespace Cookfeed.Domain.Entities;

/// <summary>An account. What it may do comes from its roles (<see cref="UserRole"/>).</summary>
public class User
{
    public int Id { get; set; }

    public required string Email { get; set; }

    public required string DisplayName { get; set; }

    /// <summary>A password hash, never the password itself.</summary>
    public required string PasswordHash { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public List<UserRole> Roles { get; set; } = [];

    /// <summary>The storefront, for an account that sells. Null for everyone else.</summary>
    public CreatorProfile? CreatorProfile { get; set; }

    public List<SavedRecipe> SavedRecipes { get; set; } = [];

    public List<MealPlan> MealPlans { get; set; } = [];

    public List<CartItem> CartItems { get; set; } = [];

    public List<Order> Orders { get; set; } = [];

    public List<Review> Reviews { get; set; } = [];
}
