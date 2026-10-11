using Cookfeed.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Cookfeed.Infrastructure.Persistence.Configurations;

public class CartItemConfiguration : IEntityTypeConfiguration<CartItem>
{
    public void Configure(EntityTypeBuilder<CartItem> item)
    {
        item.ToTable("cart_items");

        item.HasKey(ci => new { ci.UserId, ci.ProductId });
        item.Property(ci => ci.AddedAt).HasDefaultValueSql("now()");

        item.HasOne(ci => ci.User).WithMany(u => u.CartItems)
            .HasForeignKey(ci => ci.UserId).OnDelete(DeleteBehavior.Cascade);
        item.HasOne(ci => ci.Product).WithMany()
            .HasForeignKey(ci => ci.ProductId).OnDelete(DeleteBehavior.Cascade);

        item.HasIndex(ci => ci.ProductId).HasDatabaseName("ix_cart_items_product_id");
    }
}
