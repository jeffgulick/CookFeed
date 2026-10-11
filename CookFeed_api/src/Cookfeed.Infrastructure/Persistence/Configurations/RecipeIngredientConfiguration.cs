using Cookfeed.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Cookfeed.Infrastructure.Persistence.Configurations;

public class RecipeIngredientConfiguration : IEntityTypeConfiguration<RecipeIngredient>
{
    public void Configure(EntityTypeBuilder<RecipeIngredient> line)
    {
        line.ToTable("recipe_ingredients", table =>
            table.HasCheckConstraint("ck_recipe_ingredients_quantity_positive", "quantity > 0"));

        line.Property(ri => ri.Quantity).HasPrecision(10, 3);
        line.Property(ri => ri.DisplayText).HasMaxLength(120);
        line.Property(ri => ri.Preparation).HasMaxLength(80);

        line.HasOne(ri => ri.Recipe).WithMany(r => r.Ingredients)
            .HasForeignKey(ri => ri.RecipeId).OnDelete(DeleteBehavior.Cascade);
        line.HasOne(ri => ri.Ingredient).WithMany()
            .HasForeignKey(ri => ri.IngredientId).OnDelete(DeleteBehavior.Restrict);
        line.HasOne(ri => ri.Unit).WithMany()
            .HasForeignKey(ri => ri.UnitId).OnDelete(DeleteBehavior.Restrict);

        line.HasIndex(ri => new { ri.RecipeId, ri.SortOrder }).HasDatabaseName("ix_recipe_ingredients_recipe_id_sort_order");
        line.HasIndex(ri => ri.IngredientId).HasDatabaseName("ix_recipe_ingredients_ingredient_id");
        line.HasIndex(ri => ri.UnitId).HasDatabaseName("ix_recipe_ingredients_unit_id");
    }
}
