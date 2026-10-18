using Cookfeed.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Cookfeed.Infrastructure.Persistence.Configurations;

public class AdminActionConfiguration : IEntityTypeConfiguration<AdminAction>
{
    public void Configure(EntityTypeBuilder<AdminAction> action)
    {
        action.ToTable("admin_actions");

        action.Property(a => a.Action).HasMaxLength(40);
        action.Property(a => a.TargetTable).HasMaxLength(40);
        action.Property(a => a.Note).HasMaxLength(500);
        action.Property(a => a.CreatedAt).HasDefaultValueSql("now()");

        // The audit trail outlives the admin account that wrote it.
        action.HasOne(a => a.AdminUser).WithMany()
            .HasForeignKey(a => a.AdminUserId).OnDelete(DeleteBehavior.Restrict);

        action.HasIndex(a => new { a.AdminUserId, a.CreatedAt }).IsDescending(false, true)
            .HasDatabaseName("ix_admin_actions_admin_user_id_created_at");
        action.HasIndex(a => new { a.TargetTable, a.TargetId }).HasDatabaseName("ix_admin_actions_target_table_target_id");
    }
}
