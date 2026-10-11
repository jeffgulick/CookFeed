namespace Cookfeed.Domain.Entities;

/// <summary>One numbered instruction, tied to the moment in the video where it happens.</summary>
public class RecipeStep
{
    public int Id { get; set; }

    public int RecipeId { get; set; }

    public Recipe Recipe { get; set; } = null!;

    public int StepNumber { get; set; }

    public required string Instruction { get; set; }

    public int? VideoTimestampSeconds { get; set; }

    public int? DurationMinutes { get; set; }
}
