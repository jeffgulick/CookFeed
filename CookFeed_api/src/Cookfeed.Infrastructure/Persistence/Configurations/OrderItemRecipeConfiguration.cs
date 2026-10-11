using Cookfeed.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Cookfeed.Infrastructure.Persistence.Configurations;

public class OrderItemRecipeConfiguration : IEntityTypeConfiguration<OrderItemRecipe>
{
    public void Configure(EntityTypeBuilder<OrderItemRecipe> snapshot)
    {
        snapshot.ToTable("order_item_recipes", table =>
        {
            table.HasCheckConstraint("ck_order_item_recipes_day_offset_range", "day_offset IS NULL OR (day_offset BETWEEN 0 AND 6)");
            table.HasCheckConstraint("ck_order_item_recipes_placement_pair", "(day_offset IS NULL) = (slot IS NULL)");
        });

        snapshot.HasOne(oir => oir.OrderItem).WithMany(oi => oi.Recipes)
            .HasForeignKey(oir => oir.OrderItemId).OnDelete(DeleteBehavior.Cascade);
        // A recipe somebody has paid for can never be deleted, only unpublished (§3.3).
        snapshot.HasOne(oir => oir.Recipe).WithMany(r => r.OrderItemRecipes)
            .HasForeignKey(oir => oir.RecipeId).OnDelete(DeleteBehavior.Restrict);

        snapshot.HasIndex(oir => new { oir.OrderItemId, oir.RecipeId, oir.DayOffset, oir.Slot }).IsUnique()
            .AreNullsDistinct(false)
            .HasDatabaseName("ix_order_item_recipes_order_item_id_recipe_id_day_offset_slot");
        snapshot.HasIndex(oir => oir.RecipeId).HasDatabaseName("ix_order_item_recipes_recipe_id");
    }
}
