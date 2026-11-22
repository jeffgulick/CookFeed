using Cookfeed.Api.Binding;
using Cookfeed.Application.Reviews;
using Cookfeed.Contracts.Reviews;
using Microsoft.AspNetCore.Mvc;

namespace Cookfeed.Api.Controllers;

/// <summary>The reviews of one meal plan or collection.</summary>
[ApiController]
[Route("api/products/{id:int}/reviews")]
public class ProductReviewsController(ProductReviewsService reviews, ReviewWriteService writes) : ControllerBase
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

    // The caller is required here: a review is written by an account, under its name. 201 with the reviews page as
    // the caller now sees it, their review first, so the app redraws without a second request.
    [HttpPost]
    [ProducesResponseType<ProductReviewsDto>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ProductReviewsDto>> Post(
        int id,
        [FromBody] PostReviewRequest request,
        [FromCallerHeader] int callerId,
        CancellationToken cancellationToken)
    {
        // [ApiController] has already checked the rating and the length as sent. The length that counts is without
        // the spaces around the text, which is how the review is stored.
        if (request.Body.Trim().Length < PostReviewRequest.MinBodyLength)
        {
            ModelState.AddModelError(nameof(request.Body),
                $"Write at least {PostReviewRequest.MinBodyLength} characters.");
            return ValidationProblem(ModelState);
        }

        var result = await writes.PostAsync(callerId, id, request.Rating, request.Recommends, request.Body,
            cancellationToken);
        return result.Outcome == ReviewWriteOutcome.Done
            ? Created($"/api/products/{id}/reviews", result.Page)
            : Refuse(result.Outcome);
    }

    // "mine": the caller's own review of this product, never one named by id, so nobody deletes another's.
    [HttpDelete("mine")]
    [ProducesResponseType<ProductReviewsDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ProductReviewsDto>> DeleteMine(
        int id,
        [FromCallerHeader] int callerId,
        CancellationToken cancellationToken)
    {
        var result = await writes.DeleteMineAsync(callerId, id, cancellationToken);
        return result.Outcome == ReviewWriteOutcome.Done ? result.Page! : Refuse(result.Outcome);
    }

    /// <summary>A ProblemDetails whose detail is a sentence the app can show.</summary>
    private ObjectResult Refuse(ReviewWriteOutcome outcome) => outcome switch
    {
        ReviewWriteOutcome.AlreadyReviewed => Problem(statusCode: StatusCodes.Status409Conflict, title: "Already reviewed",
            detail: "You have already reviewed this plan. An account reviews a plan once."),
        ReviewWriteOutcome.Hidden => Problem(statusCode: StatusCodes.Status409Conflict, title: "Hidden by Cookfeed",
            detail: "Cookfeed hid your review, so it cannot be deleted."),
        ReviewWriteOutcome.NotAllowed => Problem(statusCode: StatusCodes.Status403Forbidden, title: "Buyers only",
            detail: "Only cooks who bought this plan can review it, and creators cannot review their own."),
        _ => Problem(statusCode: StatusCodes.Status404NotFound, title: "Not found",
            detail: "There is no such plan, or you have no review of it."),
    };
}
