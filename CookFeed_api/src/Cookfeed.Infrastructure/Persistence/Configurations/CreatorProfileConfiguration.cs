using Cookfeed.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Cookfeed.Infrastructure.Persistence.Configurations;

public class CreatorProfileConfiguration : IEntityTypeConfiguration<CreatorProfile>
{
    public void Configure(EntityTypeBuilder<CreatorProfile> profile)
    {
        profile.ToTable("creator_profiles", table => table.HasCheckConstraint(
            "ck_creator_profiles_handle_slug", "handle ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'"));

        // Shared primary key: the profile's key is its user's id, so a user has at most one profile.
        profile.HasKey(c => c.UserId);
        profile.HasOne(c => c.User).WithOne(u => u.CreatorProfile)
            .HasForeignKey<CreatorProfile>(c => c.UserId).OnDelete(DeleteBehavior.Cascade);

        profile.Property(c => c.Handle).HasMaxLength(40);
        profile.Property(c => c.Bio).HasMaxLength(1000);
        profile.Property(c => c.AvatarUrl).HasMaxLength(500);

        profile.HasIndex(c => c.Handle).IsUnique().HasDatabaseName("ix_creator_profiles_handle");
    }
}
