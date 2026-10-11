using Cookfeed.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Cookfeed.Infrastructure.Persistence.Configurations;

public class OrderItemConfiguration : IEntityTypeConfiguration<OrderItem>
{
    public void Configure(EntityTypeBuilder<OrderItem> item)
    {
        item.ToTable("order_items", table =>
            table.HasCheckConstraint("ck_order_items_price_nonnegative", "unit_price_cents >= 0"));

        item.Property(oi => oi.ProductTitle).HasMaxLength(120);

        item.HasOne(oi => oi.Order).WithMany(o => o.Items)
            .HasForeignKey(oi => oi.OrderId).OnDelete(DeleteBehavior.Cascade);
        // A product that has been sold cannot be deleted; it is retired with is_active = false instead.
        item.HasOne(oi => oi.Product).WithMany()
            .HasForeignKey(oi => oi.ProductId).OnDelete(DeleteBehavior.Restrict);

        item.HasIndex(oi => new { oi.OrderId, oi.ProductId }).IsUnique().HasDatabaseName("ix_order_items_order_id_product_id");
        item.HasIndex(oi => oi.ProductId).HasDatabaseName("ix_order_items_product_id");
        item.HasIndex(oi => oi.CreatorId).HasDatabaseName("ix_order_items_creator_id");
    }
}
