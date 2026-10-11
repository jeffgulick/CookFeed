using Cookfeed.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Cookfeed.Infrastructure.Persistence.Configurations;

public class MealPlanEntryConfiguration : IEntityTypeConfiguration<MealPlanEntry>
{
    public void Configure(EntityTypeBuilder<MealPlanEntry> entry)
    {
        entry.ToTable("meal_plan_entries", table => table.HasCheckConstraint(
            "ck_meal_plan_entries_servings_positive", "servings_override IS NULL OR servings_override > 0"));

        entry.HasOne(e => e.MealPlan).WithMany(mp => mp.Entries)
            .HasForeignKey(e => e.MealPlanId).OnDelete(DeleteBehavior.Cascade);
        entry.HasOne(e => e.Recipe).WithMany(r => r.MealPlanEntries)
            .HasForeignKey(e => e.RecipeId).OnDelete(DeleteBehavior.Cascade);

        entry.HasIndex(e => new { e.MealPlanId, e.PlannedDate, e.Slot })
            .HasDatabaseName("ix_meal_plan_entries_meal_plan_id_planned_date_slot");
        entry.HasIndex(e => e.RecipeId).HasDatabaseName("ix_meal_plan_entries_recipe_id");
    }
}
