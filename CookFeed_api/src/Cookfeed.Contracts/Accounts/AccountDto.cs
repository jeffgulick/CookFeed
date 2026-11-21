namespace Cookfeed.Contracts.Accounts;

/// <summary>
/// One account the sign-in picker offers, with what the app needs to decide which controls to show. Never the
/// email address or anything about the password.
/// </summary>
/// <param name="Roles">The role names: <c>HomeCook</c>, <c>Creator</c>, <c>Admin</c> (DesignDocument.md §3.1).</param>
/// <param name="Handle">The creator's storefront handle; null for an account that is not a creator.</param>
public sealed record AccountDto(int Id, string DisplayName, IReadOnlyList<string> Roles, string? Handle);
