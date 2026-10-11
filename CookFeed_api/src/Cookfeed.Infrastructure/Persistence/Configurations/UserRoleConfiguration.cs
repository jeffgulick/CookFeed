using Cookfeed.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Cookfeed.Infrastructure.Persistence.Configurations;

public class UserRoleConfiguration : IEntityTypeConfiguration<UserRole>
{
    public void Configure(EntityTypeBuilder<UserRole> userRole)
    {
        userRole.ToTable("user_roles");

        userRole.HasKey(ur => new { ur.UserId, ur.RoleId });
        userRole.Property(ur => ur.GrantedAt).HasDefaultValueSql("now()");

        userRole.HasOne(ur => ur.User).WithMany(u => u.Roles)
            .HasForeignKey(ur => ur.UserId).OnDelete(DeleteBehavior.Cascade);
        userRole.HasOne(ur => ur.Role).WithMany(r => r.UserRoles)
            .HasForeignKey(ur => ur.RoleId).OnDelete(DeleteBehavior.Restrict);

        userRole.HasIndex(ur => ur.RoleId).HasDatabaseName("ix_user_roles_role_id");
    }
}
