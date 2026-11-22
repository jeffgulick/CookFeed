using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Application.Trips;
using Cookfeed.Domain.Access;
using Cookfeed.Domain.Entities;
using Cookfeed.Domain.Enums;
using Cookfeed.Domain.ShoppingList;
using Microsoft.EntityFrameworkCore;

namespace Cookfeed.Infrastructure.Persistence.Repositories;

/// <summary>The EF Core queries and writes over shopping lists ("trips"). See docs/Queries.md §8.</summary>
public class TripRepository(CookfeedDbContext db) : ITripRepository
{
    // The role name in the roles table (DesignDocument.md §3.1).
    private const string HomeCook = "HomeCook";

    public Task<bool> CanShopAsync(int userId, CancellationToken cancellationToken) =>
        db.UserRoles.AnyAsync(ur => ur.UserId == userId && ur.Role.Name == HomeCook, cancellationToken);

    public async Task<IReadOnlyList<TripRow>> GetTripsAsync(int userId, CancellationToken cancellationToken) =>
        // One statement, read through ix_shopping_trips_user_id_created_at in its own order.
        await db.ShoppingTrips.AsNoTracking()
            .Where(t => t.UserId == userId)
            .OrderByDescending(t => t.CreatedAt).ThenByDescending(t => t.Id)
            .Select(t => new TripRow(t.Id, t.Name, t.Status, t.CreatedAt, t.CompletedAt, t.Items.Count, new TripItemRow[0],
                new int[0]))
            .ToListAsync(cancellationToken);

    public async Task<TripRow?> GetTripAsync(int userId, int tripId, CancellationToken cancellationToken)
    {
        // The list by primary key, and only if it is this user's. Its recipes and its skips are two sibling
        // collections, so they are read with a statement each rather than joined against one another.
        var trip = await db.ShoppingTrips.AsNoTracking()
            .Where(t => t.Id == tripId && t.UserId == userId)
            .Select(t => new { t.Id, t.Name, t.Status, t.CreatedAt, t.CompletedAt })
            .SingleOrDefaultAsync(cancellationToken);
        if (trip is null)
        {
            return null;
        }

        var items = await db.ShoppingTripItems.AsNoTracking()
            .Where(i => i.TripId == tripId)
            .OrderBy(i => i.Id)
            .Select(i => new TripItemRow(i.RecipeId, i.Recipe.Title, i.Servings))
            .ToListAsync(cancellationToken);
        var skips = await db.ShoppingTripSkips.AsNoTracking()
            .Where(s => s.TripId == tripId)
            .Select(s => s.IngredientId)
            .ToListAsync(cancellationToken);

        return new TripRow(trip.Id, trip.Name, trip.Status, trip.CreatedAt, trip.CompletedAt, items.Count, items, skips);
    }

    public async Task<IReadOnlyDictionary<int, RecipeForTrip>> GetRecipesAsync(int userId,
        IReadOnlyCollection<int> recipeIds, CancellationToken cancellationToken) =>
        // The facts of RecipeRepository.GetAccessFactsAsync, for several recipes at once, with their servings.
        await db.Recipes.AsNoTracking()
            .Where(r => recipeIds.Contains(r.Id))
            .Select(r => new
            {
                r.Id,
                r.Servings,
                Access = new RecipeAccessFacts(
                    r.CreatorId,
                    r.IsPublished,
                    r.Visibility,
                    r.OrderItemRecipes.Any(oir =>
                        oir.OrderItem.Order.UserId == userId && oir.OrderItem.Order.Status == OrderStatus.Paid)),
            })
            .ToDictionaryAsync(r => r.Id, r => new RecipeForTrip(r.Servings, r.Access), cancellationToken);

    public async Task<IReadOnlyList<int>?> GetPurchasedRecipeIdsAsync(int userId, int productId,
        CancellationToken cancellationToken)
    {
        // The earliest Paid line for the product, then its recipe snapshot in order: what the buyer owns (§3.3).
        var orderItemId = await db.OrderItems.AsNoTracking()
            .Where(oi => oi.ProductId == productId && oi.Order.UserId == userId && oi.Order.Status == OrderStatus.Paid)
            .OrderBy(oi => oi.Id)
            .Select(oi => (int?)oi.Id)
            .FirstOrDefaultAsync(cancellationToken);
        if (orderItemId is null)
        {
            return null;
        }

        return await db.OrderItemRecipes.AsNoTracking()
            .Where(r => r.OrderItemId == orderItemId)
            .OrderBy(r => r.SortOrder).ThenBy(r => r.Id)
            .Select(r => r.RecipeId)
            .ToListAsync(cancellationToken);
    }

    public async Task<int> CreateAsync(int userId, string name, DateTimeOffset createdAt, CancellationToken cancellationToken)
    {
        var trip = new ShoppingTrip { UserId = userId, Name = name, CreatedAt = createdAt, Status = TripStatus.Building };
        db.ShoppingTrips.Add(trip);
        await db.SaveChangesAsync(cancellationToken);
        return trip.Id;
    }

    public async Task AddItemsAsync(int tripId, IReadOnlyList<TripItem> items, CancellationToken cancellationToken)
    {
        db.ShoppingTripItems.AddRange(items.Select(item =>
            new ShoppingTripItem { TripId = tripId, RecipeId = item.RecipeId, Servings = item.Servings }));
        await db.SaveChangesAsync(cancellationToken);
    }

    public Task SetServingsAsync(int tripId, int recipeId, int servings, CancellationToken cancellationToken) =>
        // ExecuteUpdate sends one UPDATE and loads nothing.
        db.ShoppingTripItems
            .Where(i => i.TripId == tripId && i.RecipeId == recipeId)
            .ExecuteUpdateAsync(set => set.SetProperty(i => i.Servings, servings), cancellationToken);

    public Task RemoveItemAsync(int tripId, int recipeId, CancellationToken cancellationToken) =>
        db.ShoppingTripItems
            .Where(i => i.TripId == tripId && i.RecipeId == recipeId)
            .ExecuteDeleteAsync(cancellationToken);

    public Task SetSkipAsync(int tripId, int ingredientId, bool skipped, CancellationToken cancellationToken) =>
        skipped
            // The primary key (trip_id, ingredient_id) holds an ingredient to one skip; a repeat inserts nothing. An
            // ingredient id that names no ingredient inserts nothing either, rather than breaking the foreign key.
            ? db.Database.ExecuteSqlInterpolatedAsync($"""
                INSERT INTO shopping_trip_skips (trip_id, ingredient_id)
                SELECT {tripId}, id FROM ingredients WHERE id = {ingredientId}
                ON CONFLICT (trip_id, ingredient_id) DO NOTHING
                """, cancellationToken)
            : db.ShoppingTripSkips
                .Where(s => s.TripId == tripId && s.IngredientId == ingredientId)
                .ExecuteDeleteAsync(cancellationToken);

    public Task SetStatusAsync(int tripId, TripStatus status, DateTimeOffset? completedAt,
        CancellationToken cancellationToken) =>
        db.ShoppingTrips
            .Where(t => t.Id == tripId)
            .ExecuteUpdateAsync(set => set
                .SetProperty(t => t.Status, status)
                .SetProperty(t => t.CompletedAt, completedAt), cancellationToken);

    public Task DeleteAsync(int tripId, CancellationToken cancellationToken) =>
        // The items and skips go with it: both reference the trip ON DELETE CASCADE.
        db.ShoppingTrips.Where(t => t.Id == tripId).ExecuteDeleteAsync(cancellationToken);

    public async Task<IReadOnlyList<IngredientTotal>> GetIngredientTotalsAsync(int tripId,
        CancellationToken cancellationToken)
    {
        // Each recipe on the list at the scale of the people it is cooked for; then the same sums as the week's list.
        var recipes =
            from item in db.ShoppingTripItems
            join r in db.Recipes on item.RecipeId equals r.Id
            where item.TripId == tripId
            select new ShoppingListRepository.RecipeAtScale { RecipeId = item.RecipeId, Scale = (decimal)item.Servings / r.Servings };

        return await ShoppingListRepository.Totals(db, recipes).ToListAsync(cancellationToken);
    }
}
