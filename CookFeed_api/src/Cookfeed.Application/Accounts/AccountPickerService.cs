using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Contracts.Accounts;

namespace Cookfeed.Application.Accounts;

/// <summary>
/// The accounts the app's sign-in picker lists while the caller is still the <c>X-User-Id</c> header
/// (DesignDocument.md §9). Login replaces the picker; this goes with it.
/// </summary>
public class AccountPickerService(IAccountRepository accounts)
{
    public Task<IReadOnlyList<AccountDto>> GetAccountsAsync(CancellationToken cancellationToken) =>
        accounts.GetAccountsAsync(cancellationToken);
}
