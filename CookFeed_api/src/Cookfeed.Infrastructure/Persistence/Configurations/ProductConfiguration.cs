using Cookfeed.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Cookfeed.Infrastructure.Persistence.Configurations;

public class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> product)
    {
        product.ToTable("products", table =>
            table.HasCheckConstraint("ck_products_price_nonnegative", "price_cents >= 0"));

        product.Property(p => p.Title).HasMaxLength(120);
        product.Property(p => p.Description).HasMaxLength(2000);
        product.Property(p => p.CoverImageUrl).HasMaxLength(500);
        product.Property(p => p.Currency).HasMaxLength(3);
        product.Property(p => p.CreatedAt).HasDefaultValueSql("now()");

        product.HasOne(p => p.Creator).WithMany(c => c.Products)
            .HasForeignKey(p => p.CreatorId).OnDelete(DeleteBehavior.Cascade);

        product.HasIndex(p => new { p.CreatorId, p.IsActive }).HasDatabaseName("ix_products_creator_id_is_active");
    }
}
