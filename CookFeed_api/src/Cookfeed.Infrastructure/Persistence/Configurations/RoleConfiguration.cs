using Cookfeed.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Cookfeed.Infrastructure.Persistence.Configurations;

public class RoleConfiguration : IEntityTypeConfiguration<Role>
{
    public void Configure(EntityTypeBuilder<Role> role)
    {
        role.ToTable("roles");

        role.Property(r => r.Name).HasMaxLength(40);

        role.HasIndex(r => r.Name).IsUnique().HasDatabaseName("ix_roles_name");
    }
}
