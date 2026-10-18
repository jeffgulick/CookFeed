namespace Cookfeed.Domain.Entities;

/// <summary>An account's plan for one week. An account has at most one plan per week.</summary>
public class MealPlan
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public User User { get; set; } = null!;

    public required string Name { get; set; }

    public DateOnly WeekStart { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    /// <summary>When the cook marked this week's shopping list as shopped (§3.9). Null until they do.</summary>
    public DateTimeOffset? ShoppedAt { get; set; }

    public List<MealPlanEntry> Entries { get; set; } = [];
}
