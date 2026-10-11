using System.ComponentModel.DataAnnotations;
using Cookfeed.Application.Orders;
using Cookfeed.Contracts.Orders;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Cookfeed.Api.Controllers;

/// <summary>The caller's own orders. Routes under <c>/api/me</c> never take a user id (DesignDocument.md §9).</summary>
[ApiController]
[Route("api/me/orders")]
public class MyOrdersController(OrderHistoryService orders) : ControllerBase
{
    // Until login exists (Assignment 4), the caller is the X-User-Id header. [BindRequired] makes it mandatory:
    // missing, non-numeric or below 1 is a 400 from [ApiController] before any query runs.
    [HttpGet]
    public Task<IReadOnlyList<OrderDto>> Get(
        [FromHeader(Name = "X-User-Id"), BindRequired, Range(1, int.MaxValue)] int callerId,
        CancellationToken cancellationToken) =>
        orders.GetOrderHistoryAsync(callerId, cancellationToken);
}
