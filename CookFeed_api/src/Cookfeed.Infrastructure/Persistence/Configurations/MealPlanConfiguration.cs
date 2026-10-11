using Cookfeed.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Cookfeed.Infrastructure.Persistence.Configurations;

public class MealPlanConfiguration : IEntityTypeConfiguration<MealPlan>
{
    public void Configure(EntityTypeBuilder<MealPlan> plan)
    {
        plan.ToTable("meal_plans");

        plan.Property(mp => mp.Name).HasMaxLength(80);
        plan.Property(mp => mp.CreatedAt).HasDefaultValueSql("now()");

        plan.HasOne(mp => mp.User).WithMany(u => u.MealPlans)
            .HasForeignKey(mp => mp.UserId).OnDelete(DeleteBehavior.Cascade);

        plan.HasIndex(mp => new { mp.UserId, mp.WeekStart }).IsUnique()
            .HasDatabaseName("ix_meal_plans_user_id_week_start");
    }
}
