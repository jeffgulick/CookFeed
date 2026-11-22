using Cookfeed.Api.Binding;
using Cookfeed.Application.Trips;
using Cookfeed.Contracts.Trips;
using Microsoft.AspNetCore.Mvc;

namespace Cookfeed.Api.Controllers;

/// <summary>
/// The caller's own shopping lists. Routes under <c>/api/me</c> never take a user id (DesignDocument.md §9), and a
/// list that is someone else's answers 404, like one that does not exist. Every change answers with the list as it
/// now is, lines included, so the app redraws without a second request.
/// </summary>
[ApiController]
[Route("api/me/trips")]
public class MyTripsController(TripService trips) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType<TripsDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<TripsDto>> List([FromCallerHeader] int callerId, CancellationToken cancellationToken)
    {
        var result = await trips.GetTripsAsync(callerId, cancellationToken);
        return result.Outcome == TripOutcome.Done ? result.Trips! : Refuse(result.Outcome);
    }

    [HttpGet("{id:int}")]
    [ProducesResponseType<TripDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TripDto>> Get(int id, [FromCallerHeader] int callerId, CancellationToken cancellationToken) =>
        Answer(await trips.GetTripAsync(callerId, id, cancellationToken));

    // "Shop this recipe" and "Shop this plan": onto the list the cook names, a new one when asked for, and otherwise
    // the newest list in use, which is made when there is none.
    [HttpPost("items")]
    [ProducesResponseType<ShopResultDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ShopResultDto>> Shop([FromBody] ShopRequest request, [FromCallerHeader] int callerId,
        CancellationToken cancellationToken)
    {
        if (request.RecipeId is null == request.ProductId is null)
        {
            ModelState.AddModelError(nameof(request.RecipeId), "Name a recipe or a plan to shop, and only one of them.");
            return ValidationProblem(ModelState);
        }

        if (request.TripId is not null && request.NewList)
        {
            ModelState.AddModelError(nameof(request.TripId), "Name a list to add to, or ask for a new one, not both.");
            return ValidationProblem(ModelState);
        }

        var result = await trips.ShopAsync(callerId, request.RecipeId, request.ProductId, request.Servings, request.Today,
            request.TripId, request.NewList, cancellationToken);
        return result.Outcome == TripOutcome.Done ? result.Shopped! : Refuse(result.Outcome);
    }

    // "Shop again": a new list from a finished one, which stays as it was.
    [HttpPost("{id:int}/again")]
    [ProducesResponseType<ShopResultDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ShopResultDto>> ShopAgain(int id, [FromBody] ShopAgainRequest request,
        [FromCallerHeader] int callerId, CancellationToken cancellationToken)
    {
        var result = await trips.ShopAgainAsync(callerId, id, request.Today, cancellationToken);
        return result.Outcome == TripOutcome.Done ? result.Shopped! : Refuse(result.Outcome);
    }

    [HttpPut("{id:int}/items/{recipeId:int}")]
    public async Task<ActionResult<TripDto>> SetServings(int id, int recipeId, [FromBody] TripServingsRequest request,
        [FromCallerHeader] int callerId, CancellationToken cancellationToken) =>
        Answer(await trips.SetServingsAsync(callerId, id, recipeId, request.Servings, cancellationToken));

    [HttpDelete("{id:int}/items/{recipeId:int}")]
    public async Task<ActionResult<TripDto>> RemoveItem(int id, int recipeId, [FromCallerHeader] int callerId,
        CancellationToken cancellationToken) =>
        Answer(await trips.RemoveItemAsync(callerId, id, recipeId, cancellationToken));

    // "Have it": PUT takes the ingredient off the list, DELETE puts it back. Both are safe to repeat.
    [HttpPut("{id:int}/skips/{ingredientId:int}")]
    public async Task<ActionResult<TripDto>> Skip(int id, int ingredientId, [FromCallerHeader] int callerId,
        CancellationToken cancellationToken) =>
        Answer(await trips.SetSkipAsync(callerId, id, ingredientId, skipped: true, cancellationToken));

    [HttpDelete("{id:int}/skips/{ingredientId:int}")]
    public async Task<ActionResult<TripDto>> Unskip(int id, int ingredientId, [FromCallerHeader] int callerId,
        CancellationToken cancellationToken) =>
        Answer(await trips.SetSkipAsync(callerId, id, ingredientId, skipped: false, cancellationToken));

    [HttpPost("{id:int}/start")]
    public async Task<ActionResult<TripDto>> Start(int id, [FromCallerHeader] int callerId, CancellationToken cancellationToken) =>
        Answer(await trips.StartAsync(callerId, id, cancellationToken));

    [HttpPost("{id:int}/done")]
    public async Task<ActionResult<TripDto>> Finish(int id, [FromCallerHeader] int callerId, CancellationToken cancellationToken) =>
        Answer(await trips.FinishAsync(callerId, id, cancellationToken));

    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int id, [FromCallerHeader] int callerId, CancellationToken cancellationToken)
    {
        var result = await trips.DeleteAsync(callerId, id, cancellationToken);
        return result.Outcome == TripOutcome.Done ? NoContent() : Refuse(result.Outcome);
    }

    private ActionResult<TripDto> Answer(TripResult result) =>
        result.Outcome == TripOutcome.Done ? result.Trip! : Refuse(result.Outcome);

    /// <summary>A ProblemDetails whose detail is a sentence the app can show.</summary>
    private ObjectResult Refuse(TripOutcome outcome) => outcome switch
    {
        TripOutcome.NoShop => Problem(statusCode: StatusCodes.Status403Forbidden, title: "This account does not shop",
            detail: "Shopping lists belong to home cooks. The admin account holds no shopping role."),
        TripOutcome.NotNow => Problem(statusCode: StatusCodes.Status409Conflict, title: "Not now",
            detail: "This list cannot do that where it is: a finished list is kept as a record and cannot change, and only a finished list is shopped again."),
        _ => Problem(statusCode: StatusCodes.Status404NotFound, title: "Not found",
            detail: "There is no such list, or nothing there that you can cook from."),
    };
}
