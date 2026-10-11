using Cookfeed.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Cookfeed.Infrastructure.Persistence.Configurations;

public class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> order)
    {
        order.ToTable("orders", table =>
            table.HasCheckConstraint("ck_orders_total_nonnegative", "total_cents >= 0"));

        order.Property(o => o.PlacedAt).HasDefaultValueSql("now()");
        order.Property(o => o.Currency).HasMaxLength(3);
        order.Property(o => o.PaymentReference).HasMaxLength(100);

        // Financial history: an account with orders cannot be deleted (DesignDocument.md §5).
        order.HasOne(o => o.User).WithMany(u => u.Orders)
            .HasForeignKey(o => o.UserId).OnDelete(DeleteBehavior.Restrict);

        order.HasIndex(o => new { o.UserId, o.PlacedAt }).IsDescending(false, true)
            .HasDatabaseName("ix_orders_user_id_placed_at");
    }
}
