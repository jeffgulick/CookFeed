using System.ComponentModel.DataAnnotations;
using Cookfeed.Application.ShoppingList;
using Cookfeed.Contracts.ShoppingList;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Cookfeed.Api.Controllers;

/// <summary>The caller's shopping list. Routes under <c>/api/me</c> never take a user id (DesignDocument.md §9).</summary>
[ApiController]
[Route("api/me/shopping-list")]
public class MyShoppingListController(ShoppingListService shoppingList) : ControllerBase
{
    // The caller is the required X-User-Id header until login exists, as on /api/me/orders. weekStart is an ISO
    // date (2026-09-21); leaving it out takes every plan. A malformed date is a 400 from [ApiController].
    [HttpGet]
    public Task<ShoppingListDto> Get(
        [FromHeader(Name = "X-User-Id"), BindRequired, Range(1, int.MaxValue)] int callerId,
        [FromQuery] DateOnly? weekStart,
        CancellationToken cancellationToken) =>
        shoppingList.GetShoppingListAsync(callerId, weekStart, cancellationToken);
}
