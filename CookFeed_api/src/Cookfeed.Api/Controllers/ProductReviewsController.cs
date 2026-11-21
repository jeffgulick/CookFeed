using Cookfeed.Api.Binding;
using Cookfeed.Application.Reviews;
using Cookfeed.Contracts.Reviews;
using Microsoft.AspNetCore.Mvc;

namespace Cookfeed.Api.Controllers;

/// <summary>The reviews of one meal plan or collection.</summary>
[ApiController]
[Route("api/products/{id:int}/reviews")]
public class ProductReviewsController(ProductReviewsService reviews) : ControllerBase
{
    // X-User-Id is optional: anyone may read the reviews that count. The header adds the viewer's own review, what
    // the review form shows them, and, for the admin, the reviews that are hidden or no longer counted.
    [HttpGet]
    [ProducesResponseType<ProductReviewsDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ProductReviewsDto>> Get(
        int id,
        [FromCallerHeader] int? viewerId = null,
        CancellationToken cancellationToken = default)
    {
        var page = await reviews.GetReviewsAsync(id, viewerId, cancellationToken);
        return page is null ? NotFound() : page;
    }
}
