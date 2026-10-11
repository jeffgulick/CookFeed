namespace Cookfeed.Domain.Entities;

/// <summary>A role an account can hold: HomeCook, Creator or Admin (DesignDocument.md §3.1).</summary>
public class Role
{
    public int Id { get; set; }

    public required string Name { get; set; }

    public List<UserRole> UserRoles { get; set; } = [];
}
