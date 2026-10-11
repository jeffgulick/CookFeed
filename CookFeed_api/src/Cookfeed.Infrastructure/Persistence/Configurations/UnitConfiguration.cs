using Cookfeed.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Cookfeed.Infrastructure.Persistence.Configurations;

public class UnitConfiguration : IEntityTypeConfiguration<Unit>
{
    public void Configure(EntityTypeBuilder<Unit> unit)
    {
        unit.ToTable("units", table =>
            table.HasCheckConstraint("ck_units_factor_positive", "to_base_factor > 0"));

        unit.Property(u => u.Name).HasMaxLength(40);
        unit.Property(u => u.Abbreviation).HasMaxLength(10);
        unit.Property(u => u.ToBaseFactor).HasPrecision(12, 6);

        unit.HasIndex(u => u.Name).IsUnique().HasDatabaseName("ix_units_name");
        unit.HasIndex(u => u.Abbreviation).IsUnique().HasDatabaseName("ix_units_abbreviation");
    }
}
