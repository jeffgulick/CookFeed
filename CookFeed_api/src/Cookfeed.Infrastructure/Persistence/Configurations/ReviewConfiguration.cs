using Cookfeed.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Cookfeed.Infrastructure.Persistence.Configurations;

public class ReviewConfiguration : IEntityTypeConfiguration<Review>
{
    public void Configure(EntityTypeBuilder<Review> review)
    {
        review.ToTable("reviews", table =>
            table.HasCheckConstraint("ck_reviews_rating_range", "rating BETWEEN 1 AND 5"));

        review.Property(rv => rv.Body).HasMaxLength(2000);
        review.Property(rv => rv.CreatedAt).HasDefaultValueSql("now()");

        review.HasOne(rv => rv.Product).WithMany(p => p.Reviews)
            .HasForeignKey(rv => rv.ProductId).OnDelete(DeleteBehavior.Cascade);
        review.HasOne(rv => rv.User).WithMany(u => u.Reviews)
            .HasForeignKey(rv => rv.UserId).OnDelete(DeleteBehavior.Cascade);

        // One review per account per product.
        review.HasIndex(rv => new { rv.ProductId, rv.UserId }).IsUnique().HasDatabaseName("ix_reviews_product_id_user_id");
        review.HasIndex(rv => new { rv.ProductId, rv.CreatedAt }).IsDescending(false, true)
            .HasDatabaseName("ix_reviews_product_id_created_at");
        review.HasIndex(rv => rv.UserId).HasDatabaseName("ix_reviews_user_id");
    }
}
