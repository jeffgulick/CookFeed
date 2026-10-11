using System.Globalization;
using Cookfeed.Api.Binding;
using Cookfeed.Application.ShoppingList;
using Cookfeed.Contracts.ShoppingList;
using Microsoft.AspNetCore.Mvc;

namespace Cookfeed.Api.Controllers;

/// <summary>The caller's shopping list. Routes under <c>/api/me</c> never take a user id (DesignDocument.md §9).</summary>
[ApiController]
[Route("api/me/shopping-list")]
public class MyShoppingListController(ShoppingListService shoppingList) : ControllerBase
{
    // The caller is the required X-User-Id header until login exists, as on /api/me/orders. weekStart, when given,
    // must be an ISO date (2026-09-21): it is parsed here, not by model binding, because .NET's default date
    // conversion would also accept culture formats such as 09/21/2026. Leaving it out takes every plan; a date that
    // starts no plan of the caller's leaves only the saved recipes.
    [HttpGet]
    public async Task<ActionResult<ShoppingListDto>> Get(
        [FromCallerHeader] int callerId,
        [FromQuery] string? weekStart,
        CancellationToken cancellationToken)
    {
        DateOnly? week = null;
        if (weekStart is not null)
        {
            if (!DateOnly.TryParseExact(weekStart, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None,
                    out var parsed))
            {
                ModelState.AddModelError(nameof(weekStart), "weekStart must be a date written yyyy-MM-dd, e.g. 2026-09-21.");
                return ValidationProblem(ModelState);
            }
            week = parsed;
        }

        return await shoppingList.GetShoppingListAsync(callerId, week, cancellationToken);
    }
}
