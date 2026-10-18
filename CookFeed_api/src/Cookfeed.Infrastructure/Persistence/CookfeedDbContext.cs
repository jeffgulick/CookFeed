using Cookfeed.Domain.Entities;
using Cookfeed.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Cookfeed.Infrastructure.Persistence;

/// <summary>
/// The EF Core session with the Cookfeed database. Each table is mapped by its own
/// <c>IEntityTypeConfiguration</c> class in <c>Persistence/Configurations</c>, written to match its
/// <c>CREATE TABLE</c> in <c>docs/schema.sql</c>.
/// </summary>
public class CookfeedDbContext(DbContextOptions<CookfeedDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();

    public DbSet<Role> Roles => Set<Role>();

    public DbSet<UserRole> UserRoles => Set<UserRole>();

    public DbSet<CreatorProfile> CreatorProfiles => Set<CreatorProfile>();

    public DbSet<Recipe> Recipes => Set<Recipe>();

    public DbSet<RecipeStep> RecipeSteps => Set<RecipeStep>();

    public DbSet<Unit> Units => Set<Unit>();

    public DbSet<Ingredient> Ingredients => Set<Ingredient>();

    public DbSet<RecipeIngredient> RecipeIngredients => Set<RecipeIngredient>();

    public DbSet<SavedRecipe> SavedRecipes => Set<SavedRecipe>();

    public DbSet<MealPlan> MealPlans => Set<MealPlan>();

    public DbSet<MealPlanEntry> MealPlanEntries => Set<MealPlanEntry>();

    public DbSet<Product> Products => Set<Product>();

    public DbSet<ProductRecipe> ProductRecipes => Set<ProductRecipe>();

    public DbSet<CartItem> CartItems => Set<CartItem>();

    public DbSet<Order> Orders => Set<Order>();

    public DbSet<OrderItem> OrderItems => Set<OrderItem>();

    public DbSet<OrderItemRecipe> OrderItemRecipes => Set<OrderItemRecipe>();

    public DbSet<Review> Reviews => Set<Review>();

    public DbSet<AdminAction> AdminActions => Set<AdminAction>();

    protected override void OnModelCreating(ModelBuilder modelBuilder) =>
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(CookfeedDbContext).Assembly);

    /// <summary>
    /// Enums are stored as their names ('Dinner', 'ProductOnly'), in a varchar of the length
    /// <c>schema.sql</c> gives every column of that type, so the data reads naturally in psql and adding a
    /// value never needs an ALTER TYPE (DesignDocument.md §5).
    /// </summary>
    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        configurationBuilder.Properties<UnitCategory>().HaveConversion<string>().HaveMaxLength(10);
        configurationBuilder.Properties<MealSlot>().HaveConversion<string>().HaveMaxLength(10);
        configurationBuilder.Properties<ProductType>().HaveConversion<string>().HaveMaxLength(20);
        configurationBuilder.Properties<OrderStatus>().HaveConversion<string>().HaveMaxLength(12);
        configurationBuilder.Properties<RecipeVisibility>().HaveConversion<string>().HaveMaxLength(12);
    }
}
