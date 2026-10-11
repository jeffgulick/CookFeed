using Cookfeed.Api.Binding;
using Cookfeed.Application.Orders;
using Cookfeed.Contracts.Orders;
using Microsoft.AspNetCore.Mvc;

namespace Cookfeed.Api.Controllers;

/// <summary>The caller's own orders. Routes under <c>/api/me</c> never take a user id (DesignDocument.md §9).</summary>
[ApiController]
[Route("api/me/orders")]
public class MyOrdersController(OrderHistoryService orders) : ControllerBase
{
    // Until login exists (Assignment 4), the caller is the X-User-Id header, required here (an int, not int?):
    // missing or not a plain number of 1 or more is a 400 from [ApiController] before any query runs.
    [HttpGet]
    public Task<IReadOnlyList<OrderDto>> Get(
        [FromCallerHeader] int callerId,
        CancellationToken cancellationToken) =>
        orders.GetOrderHistoryAsync(callerId, cancellationToken);
}
