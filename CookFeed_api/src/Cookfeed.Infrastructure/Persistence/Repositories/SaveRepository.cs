using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Contracts.Saves;
using Microsoft.EntityFrameworkCore;

namespace Cookfeed.Infrastructure.Persistence.Repositories;

/// <summary>The EF Core queries and writes over saved recipes. See docs/Queries.md §6.</summary>
public class SaveRepository(CookfeedDbContext db) : ISaveRepository
{
    // The role name in the roles table (DesignDocument.md §3.1).
    private const string HomeCook = "HomeCook";

    public Task<bool> CanShopAsync(int userId, CancellationToken cancellationToken) =>
        db.UserRoles.AnyAsync(ur => ur.UserId == userId && ur.Role.Name == HomeCook, cancellationToken);

    public async Task<IReadOnlyList<SavedRecipeDto>> GetSavedAsync(int userId, CancellationToken cancellationToken)
    {
        // One statement, read by the leading column of the primary key (user_id, recipe_id), like Q6 with the
        // columns a card needs. The newest save first, as the prototype's kitchen lists them.
        var rows = await db.SavedRecipes.AsNoTracking()
            .Where(s => s.UserId == userId)
            .OrderByDescending(s => s.SavedAt).ThenByDescending(s => s.RecipeId)
            .Select(s => new
            {
                s.Recipe.Id,
                s.Recipe.Title,
                s.Recipe.ThumbnailUrl,
                s.Recipe.Servings,
                s.Recipe.PrepMinutes,
                s.Recipe.CookMinutes,
                s.Recipe.SaveCount,
                s.Recipe.Creator.Handle,
                s.Recipe.Creator.IsVerified,
                s.Recipe.Visibility,
                s.SavedAt,
            })
            .ToListAsync(cancellationToken);

        return rows
            .Select(r => new SavedRecipeDto(r.Id, r.Title, r.ThumbnailUrl, r.Servings,
                r.PrepMinutes is null && r.CookMinutes is null ? null : (r.PrepMinutes ?? 0) + (r.CookMinutes ?? 0),
                r.SaveCount, r.Handle, r.IsVerified, ContractEnums.ToContract(r.Visibility), r.SavedAt))
            .ToList();
    }

    public Task AddAsync(int userId, int recipeId, DateTimeOffset savedAt, CancellationToken cancellationToken) =>
        // ON CONFLICT DO NOTHING makes the save safe to repeat: the primary key (user_id, recipe_id) holds a recipe
        // to one save per cook, and a repeat inserts no row, so the saved_recipes_save_count trigger, which fires
        // per inserted row, does not count it twice. The application never writes recipes.save_count itself.
        db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO saved_recipes (user_id, recipe_id, saved_at)
            VALUES ({userId}, {recipeId}, {savedAt})
            ON CONFLICT (user_id, recipe_id) DO NOTHING
            """, cancellationToken);

    public Task RemoveAsync(int userId, int recipeId, CancellationToken cancellationToken) =>
        // One DELETE; the trigger takes one off the count for the row it removes, and nothing when there was none.
        db.SavedRecipes
            .Where(s => s.UserId == userId && s.RecipeId == recipeId)
            .ExecuteDeleteAsync(cancellationToken);

    public async Task<int?> GetSaveCountAsync(int recipeId, CancellationToken cancellationToken) =>
        await db.Recipes.AsNoTracking()
            .Where(r => r.Id == recipeId)
            .Select(r => (int?)r.SaveCount)
            .SingleOrDefaultAsync(cancellationToken);
}
