using Cookfeed.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Cookfeed.Infrastructure.Persistence.Configurations;

public class RecipeStepConfiguration : IEntityTypeConfiguration<RecipeStep>
{
    public void Configure(EntityTypeBuilder<RecipeStep> step)
    {
        step.ToTable("recipe_steps", table =>
            table.HasCheckConstraint("ck_recipe_steps_number_positive", "step_number > 0"));

        step.Property(s => s.Instruction).HasMaxLength(2000);

        step.HasOne(s => s.Recipe).WithMany(r => r.Steps)
            .HasForeignKey(s => s.RecipeId).OnDelete(DeleteBehavior.Cascade);

        step.HasIndex(s => new { s.RecipeId, s.StepNumber }).IsUnique()
            .HasDatabaseName("ix_recipe_steps_recipe_id_step_number");
    }
}
