using Cookfeed.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Cookfeed.Infrastructure.Persistence.Configurations;

public class SavedRecipeConfiguration : IEntityTypeConfiguration<SavedRecipe>
{
    public void Configure(EntityTypeBuilder<SavedRecipe> save)
    {
        save.ToTable("saved_recipes");

        save.HasKey(s => new { s.UserId, s.RecipeId });
        save.Property(s => s.SavedAt).HasDefaultValueSql("now()");

        save.HasOne(s => s.User).WithMany(u => u.SavedRecipes)
            .HasForeignKey(s => s.UserId).OnDelete(DeleteBehavior.Cascade);
        save.HasOne(s => s.Recipe).WithMany(r => r.SavedBy)
            .HasForeignKey(s => s.RecipeId).OnDelete(DeleteBehavior.Cascade);

        save.HasIndex(s => s.RecipeId).HasDatabaseName("ix_saved_recipes_recipe_id");
    }
}
