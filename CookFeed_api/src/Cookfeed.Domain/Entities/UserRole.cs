namespace Cookfeed.Domain.Entities;

/// <summary>A role held by an account. An admin holds no other role; the database refuses the combination.</summary>
public class UserRole
{
    public int UserId { get; set; }

    public User User { get; set; } = null!;

    public int RoleId { get; set; }

    public Role Role { get; set; } = null!;

    public DateTimeOffset GrantedAt { get; set; }
}
