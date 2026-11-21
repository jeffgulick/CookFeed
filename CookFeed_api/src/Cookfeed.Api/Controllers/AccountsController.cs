using Cookfeed.Application.Accounts;
using Cookfeed.Contracts.Accounts;
using Microsoft.AspNetCore.Mvc;

namespace Cookfeed.Api.Controllers;

/// <summary>The accounts the app's sign-in picker offers until login exists.</summary>
[ApiController]
[Route("api/accounts")]
public class AccountsController(AccountPickerService accounts, IConfiguration configuration) : ControllerBase
{
    // A development aid, like the OpenAPI document: listing every account is useful while the caller is a header
    // anyone can set, and would be a leak anywhere else. Served only where Accounts:PickerEnabled is set
    // (appsettings.Development.json); a 404 otherwise, as if the route did not exist.
    [HttpGet]
    [ProducesResponseType<IReadOnlyList<AccountDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IReadOnlyList<AccountDto>>> Get(CancellationToken cancellationToken)
    {
        if (!configuration.GetValue<bool>("Accounts:PickerEnabled"))
        {
            return NotFound();
        }

        return Ok(await accounts.GetAccountsAsync(cancellationToken));
    }
}
