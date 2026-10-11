using Cookfeed.Domain.Entities;
using Cookfeed.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Cookfeed.Infrastructure.Persistence.Configurations;

public class RecipeConfiguration : IEntityTypeConfiguration<Recipe>
{
    public void Configure(EntityTypeBuilder<Recipe> recipe)
    {
        recipe.ToTable("recipes", table =>
        {
            table.HasCheckConstraint("ck_recipes_servings_positive", "servings > 0");
            table.HasCheckConstraint("ck_recipes_published_has_date", "is_published = false OR published_at IS NOT NULL");
            table.HasCheckConstraint("ck_recipes_visibility", "visibility IN ('Public', 'ProductOnly')");
        });

        recipe.Property(r => r.Title).HasMaxLength(120);
        recipe.Property(r => r.Description).HasMaxLength(2000);
        recipe.Property(r => r.VideoUrl).HasMaxLength(500);
        recipe.Property(r => r.ThumbnailUrl).HasMaxLength(500);
        recipe.Property(r => r.Visibility).HasDefaultValue(RecipeVisibility.Public);
        recipe.Property(r => r.CreatedAt).HasDefaultValueSql("now()");
        // Maintained by the saved_recipes_save_count trigger; EF only reads it.
        recipe.Property(r => r.SaveCount).HasDefaultValue(0);

        recipe.HasOne(r => r.Creator).WithMany(c => c.Recipes)
            .HasForeignKey(r => r.CreatorId).OnDelete(DeleteBehavior.Cascade);

        recipe.HasIndex(r => r.CreatorId).HasDatabaseName("ix_recipes_creator_id");
        // The feed's two orders, newest and trending: WHERE is_published AND visibility = 'Public' ORDER BY … DESC.
        recipe.HasIndex(r => new { r.IsPublished, r.Visibility, r.PublishedAt })
            .IsDescending(false, false, true)
            .HasDatabaseName("ix_recipes_is_published_visibility_published_at");
        recipe.HasIndex(r => new { r.IsPublished, r.Visibility, r.SaveCount })
            .IsDescending(false, false, true)
            .HasDatabaseName("ix_recipes_is_published_visibility_save_count");
    }
}
