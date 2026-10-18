using Cookfeed.Domain.Entities;
using Cookfeed.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Cookfeed.Infrastructure.Persistence.Configurations;

public class ShoppingTripConfiguration : IEntityTypeConfiguration<ShoppingTrip>
{
    public void Configure(EntityTypeBuilder<ShoppingTrip> trip)
    {
        trip.ToTable("shopping_trips", table =>
            table.HasCheckConstraint("ck_shopping_trips_status", "status IN ('Building', 'Shopping', 'Sent', 'Done')"));

        trip.Property(t => t.Name).HasMaxLength(80);
        trip.Property(t => t.Status).HasDefaultValue(TripStatus.Building);
        trip.Property(t => t.SentTo).HasMaxLength(20);
        trip.Property(t => t.CreatedAt).HasDefaultValueSql("now()");

        trip.HasOne(t => t.User).WithMany()
            .HasForeignKey(t => t.UserId).OnDelete(DeleteBehavior.Cascade);

        trip.HasIndex(t => new { t.UserId, t.CreatedAt }).IsDescending(false, true)
            .HasDatabaseName("ix_shopping_trips_user_id_created_at");
    }
}

public class ShoppingTripItemConfiguration : IEntityTypeConfiguration<ShoppingTripItem>
{
    public void Configure(EntityTypeBuilder<ShoppingTripItem> item)
    {
        item.ToTable("shopping_trip_items", table =>
            table.HasCheckConstraint("ck_shopping_trip_items_servings_positive", "servings > 0"));

        item.HasOne(i => i.Trip).WithMany(t => t.Items)
            .HasForeignKey(i => i.TripId).OnDelete(DeleteBehavior.Cascade);
        item.HasOne(i => i.Recipe).WithMany()
            .HasForeignKey(i => i.RecipeId).OnDelete(DeleteBehavior.Cascade);

        item.HasIndex(i => i.TripId).HasDatabaseName("ix_shopping_trip_items_trip_id");
        item.HasIndex(i => i.RecipeId).HasDatabaseName("ix_shopping_trip_items_recipe_id");
    }
}

public class ShoppingTripSkipConfiguration : IEntityTypeConfiguration<ShoppingTripSkip>
{
    public void Configure(EntityTypeBuilder<ShoppingTripSkip> skip)
    {
        skip.ToTable("shopping_trip_skips");
        skip.HasKey(s => new { s.TripId, s.IngredientId });

        skip.HasOne(s => s.Trip).WithMany(t => t.Skips)
            .HasForeignKey(s => s.TripId).OnDelete(DeleteBehavior.Cascade);
        skip.HasOne(s => s.Ingredient).WithMany()
            .HasForeignKey(s => s.IngredientId).OnDelete(DeleteBehavior.Cascade);

        skip.HasIndex(s => s.IngredientId).HasDatabaseName("ix_shopping_trip_skips_ingredient_id");
    }
}
