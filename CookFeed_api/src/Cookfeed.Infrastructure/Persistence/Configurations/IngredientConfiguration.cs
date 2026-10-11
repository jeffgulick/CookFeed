using Cookfeed.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Cookfeed.Infrastructure.Persistence.Configurations;

public class IngredientConfiguration : IEntityTypeConfiguration<Ingredient>
{
    public void Configure(EntityTypeBuilder<Ingredient> ingredient)
    {
        ingredient.ToTable("ingredients", table => table.HasCheckConstraint(
            "ck_ingredients_density_positive", "density_g_per_ml IS NULL OR density_g_per_ml > 0"));

        ingredient.Property(i => i.Name).HasMaxLength(80);
        ingredient.Property(i => i.Category).HasMaxLength(20);
        ingredient.Property(i => i.DensityGPerMl).HasPrecision(8, 4);

        ingredient.HasOne(i => i.PreferredShoppingUnit).WithMany()
            .HasForeignKey(i => i.PreferredShoppingUnitId).OnDelete(DeleteBehavior.SetNull);

        ingredient.HasIndex(i => i.Name).IsUnique().HasDatabaseName("ix_ingredients_name");
        ingredient.HasIndex(i => i.PreferredShoppingUnitId).HasDatabaseName("ix_ingredients_preferred_shopping_unit_id");
    }
}
