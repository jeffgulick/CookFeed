using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Contracts.Accounts;
using Microsoft.EntityFrameworkCore;

namespace Cookfeed.Infrastructure.Persistence.Repositories;

/// <summary>The EF Core queries over accounts.</summary>
public class AccountRepository(CookfeedDbContext db) : IAccountRepository
{
    public async Task<IReadOnlyList<AccountDto>> GetAccountsAsync(CancellationToken cancellationToken)
    {
        // Only the columns the picker shows are selected, so an email address or a password hash never leaves the
        // database. Roles in id order: HomeCook, Creator, Admin.
        var accounts = await db.Users.AsNoTracking()
            .OrderBy(u => u.Id)
            .Select(u => new
            {
                u.Id,
                u.DisplayName,
                Roles = u.Roles.OrderBy(ur => ur.RoleId).Select(ur => ur.Role.Name).ToList(),
                Handle = u.CreatorProfile != null ? u.CreatorProfile.Handle : null,
            })
            .ToListAsync(cancellationToken);

        return accounts.Select(a => new AccountDto(a.Id, a.DisplayName, a.Roles, a.Handle)).ToList();
    }
}
