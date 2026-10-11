using Cookfeed.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Cookfeed.Infrastructure.Persistence.Configurations;

public class ProductRecipeConfiguration : IEntityTypeConfiguration<ProductRecipe>
{
    public void Configure(EntityTypeBuilder<ProductRecipe> placement)
    {
        placement.ToTable("product_recipes", table =>
        {
            table.HasCheckConstraint("ck_product_recipes_day_offset_range", "day_offset IS NULL OR (day_offset BETWEEN 0 AND 6)");
            table.HasCheckConstraint("ck_product_recipes_placement_pair", "(day_offset IS NULL) = (slot IS NULL)");
        });

        placement.HasOne(pr => pr.Product).WithMany(p => p.Recipes)
            .HasForeignKey(pr => pr.ProductId).OnDelete(DeleteBehavior.Cascade);
        // A recipe cannot be deleted while a live product contains it.
        placement.HasOne(pr => pr.Recipe).WithMany(r => r.ProductRecipes)
            .HasForeignKey(pr => pr.RecipeId).OnDelete(DeleteBehavior.Restrict);

        // "A recipe at most once per (product, day, slot)". For a collection day and slot are NULL, and
        // NULLS NOT DISTINCT treats those as equal, so the same index means "once per collection" (§3.2).
        placement.HasIndex(pr => new { pr.ProductId, pr.RecipeId, pr.DayOffset, pr.Slot }).IsUnique()
            .AreNullsDistinct(false)
            .HasDatabaseName("ix_product_recipes_product_id_recipe_id_day_offset_slot");
        placement.HasIndex(pr => new { pr.ProductId, pr.SortOrder }).HasDatabaseName("ix_product_recipes_product_id_sort_order");
        placement.HasIndex(pr => pr.RecipeId).HasDatabaseName("ix_product_recipes_recipe_id");
    }
}
