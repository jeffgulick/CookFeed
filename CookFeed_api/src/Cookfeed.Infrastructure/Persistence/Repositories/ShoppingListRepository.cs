using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Domain.Enums;
using Cookfeed.Domain.ShoppingList;
using Microsoft.EntityFrameworkCore;

namespace Cookfeed.Infrastructure.Persistence.Repositories;

/// <summary>The SQL half of the shopping list (DesignDocument.md §7.5). See docs/Queries.md §3 for the SQL.</summary>
public class ShoppingListRepository(CookfeedDbContext db) : IShoppingListRepository
{
    public async Task<IReadOnlyList<IngredientTotal>> GetIngredientTotalsAsync(int userId, DateOnly? weekStart,
        CancellationToken cancellationToken)
    {
        // The caller's plan entries, limited to one week when asked.
        var entries =
            from e in db.MealPlanEntries
            join mp in db.MealPlans on e.MealPlanId equals mp.Id
            where mp.UserId == userId && (weekStart == null || mp.WeekStart == weekStart)
            select e;

        // Which recipes, at what scale (§7.6). A planned entry scales by its servings override; a recipe planned on
        // two nights is two entries, so it counts twice. A saved recipe counts once at its own size, unless it is
        // planned: then the plan's scale wins.
        var planned =
            from e in entries
            join r in db.Recipes on e.RecipeId equals r.Id
            select new RecipeAtScale { RecipeId = e.RecipeId, Scale = (decimal)(e.ServingsOverride ?? r.Servings) / r.Servings };
        var savedNotPlanned =
            from s in db.SavedRecipes
            where s.UserId == userId && !entries.Any(e => e.RecipeId == s.RecipeId)
            select new RecipeAtScale { RecipeId = s.RecipeId, Scale = 1m };

        // UNION ALL, then every non-optional ingredient line of those recipes, summed per (ingredient, unit category)
        // in the category's base unit. Converting between categories is policy, so it is left to the aggregator.
        // Explicit joins, not navigations: with ri.Unit.ToBaseFactor and the like inside the grouped rows, EF Core
        // turned every SUM into a correlated subquery that re-ran the whole recipe set once per line
        // (docs/Queries.md §3).
        var totals =
            from source in planned.Concat(savedNotPlanned)
            join ri in db.RecipeIngredients on source.RecipeId equals ri.RecipeId
            join unit in db.Units on ri.UnitId equals unit.Id
            join i in db.Ingredients on ri.IngredientId equals i.Id
            join preferred in db.Units on i.PreferredShoppingUnitId equals preferred.Id into preferredUnits
            from preferred in preferredUnits.DefaultIfEmpty()
            where !ri.IsOptional
            group new { ri.Quantity, source.Scale, unit.ToBaseFactor } by new
            {
                IngredientId = i.Id,
                i.Name,
                Aisle = i.Category,
                i.DensityGPerMl,
                PreferredUnitCategory = (UnitCategory?)preferred!.Category,
                PreferredUnitToBaseFactor = (decimal?)preferred.ToBaseFactor,
                PreferredUnitAbbreviation = preferred.Abbreviation,
                UnitCategory = unit.Category,
            }
            into g
            select new IngredientTotal(
                g.Key.IngredientId,
                g.Key.Name,
                g.Key.Aisle,
                g.Key.DensityGPerMl,
                g.Key.PreferredUnitCategory,
                g.Key.PreferredUnitToBaseFactor,
                g.Key.PreferredUnitAbbreviation,
                g.Key.UnitCategory,
                // Each line is rounded to 6 places before it is summed: PostgreSQL divides the scale exactly (16+
                // decimals), so an unrounded sum can carry more digits than a .NET decimal holds (28). Six places of
                // a gram or millilitre is far below the two the list shows.
                g.Sum(x => Math.Round(x.Quantity * x.Scale * x.ToBaseFactor, 6)));

        return await totals.ToListAsync(cancellationToken);
    }

    /// <summary>A recipe going onto the list and how many times its quantities count (1 = as written).</summary>
    private sealed class RecipeAtScale
    {
        public int RecipeId { get; init; }

        public decimal Scale { get; init; }
    }
}
