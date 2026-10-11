using Cookfeed.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Cookfeed.Infrastructure.Persistence.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> user)
    {
        user.ToTable("users");

        user.Property(u => u.Email).HasMaxLength(254);
        user.Property(u => u.DisplayName).HasMaxLength(80);
        user.Property(u => u.PasswordHash).HasMaxLength(255);
        user.Property(u => u.CreatedAt).HasDefaultValueSql("now()");

        user.HasIndex(u => u.Email).IsUnique().HasDatabaseName("ix_users_email");
    }
}
