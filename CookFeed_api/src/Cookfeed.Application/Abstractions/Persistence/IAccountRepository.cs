using Cookfeed.Contracts.Accounts;

namespace Cookfeed.Application.Abstractions.Persistence;

/// <summary>Reads accounts from the database. Implemented with EF Core in Infrastructure.</summary>
public interface IAccountRepository
{
    /// <summary>Every account, by id, with its roles and creator handle.</summary>
    Task<IReadOnlyList<AccountDto>> GetAccountsAsync(CancellationToken cancellationToken);
}
