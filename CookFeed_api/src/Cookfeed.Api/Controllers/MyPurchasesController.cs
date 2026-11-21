using Cookfeed.Api.Binding;
using Cookfeed.Application.Purchases;
using Cookfeed.Contracts.Purchases;
using Microsoft.AspNetCore.Mvc;

namespace Cookfeed.Api.Controllers;

/// <summary>What the caller owns. Routes under <c>/api/me</c> never take a user id (DesignDocument.md §9).</summary>
[ApiController]
[Route("api/me/purchases")]
public class MyPurchasesController(PurchasesService purchases) : ControllerBase
{
    // The caller is the required X-User-Id header until login exists, as on /api/me/orders: missing, or not a plain
    // number of 1 or more, is a 400 before any query runs.
    [HttpGet]
    public Task<IReadOnlyList<PurchaseDto>> Get(
        [FromCallerHeader] int callerId,
        CancellationToken cancellationToken) =>
        purchases.GetPurchasesAsync(callerId, cancellationToken);
}
