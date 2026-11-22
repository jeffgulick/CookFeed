using Cookfeed.Api.Binding;
using Cookfeed.Application.Studio;
using Cookfeed.Contracts.Studio;
using Microsoft.AspNetCore.Mvc;

namespace Cookfeed.Api.Controllers;

/// <summary>
/// The caller's own studio, for creators. Routes under <c>/api/me</c> never take a user id (DesignDocument.md §9):
/// every read and change is of the caller's own recipes and plans, and another creator's answers 404. Every change
/// answers with the studio as it now is.
/// </summary>
[ApiController]
[Route("api/me/studio")]
public class MyStudioController(StudioService studio) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType<StudioDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<StudioDto>> Get([FromCallerHeader] int callerId, CancellationToken cancellationToken) =>
        Answer(await studio.GetStudioAsync(callerId, cancellationToken));

    // Each of the four is safe to repeat: asking for the state a row is already in changes nothing.
    [HttpPost("recipes/{id:int}/publish")]
    public async Task<ActionResult<StudioDto>> Publish(int id, [FromCallerHeader] int callerId, CancellationToken cancellationToken) =>
        Answer(await studio.SetRecipePublishedAsync(callerId, id, publish: true, cancellationToken));

    [HttpPost("recipes/{id:int}/unpublish")]
    public async Task<ActionResult<StudioDto>> Unpublish(int id, [FromCallerHeader] int callerId, CancellationToken cancellationToken) =>
        Answer(await studio.SetRecipePublishedAsync(callerId, id, publish: false, cancellationToken));

    [HttpPost("products/{id:int}/retire")]
    public async Task<ActionResult<StudioDto>> Retire(int id, [FromCallerHeader] int callerId, CancellationToken cancellationToken) =>
        Answer(await studio.SetProductActiveAsync(callerId, id, active: false, cancellationToken));

    [HttpPost("products/{id:int}/restore")]
    public async Task<ActionResult<StudioDto>> Restore(int id, [FromCallerHeader] int callerId, CancellationToken cancellationToken) =>
        Answer(await studio.SetProductActiveAsync(callerId, id, active: true, cancellationToken));

    /// <summary>The studio on success; otherwise a ProblemDetails whose detail is a sentence the app can show.</summary>
    private ActionResult<StudioDto> Answer(StudioResult result) => result.Outcome switch
    {
        StudioOutcome.Done => result.Studio!,
        StudioOutcome.NotACreator => Problem(statusCode: StatusCodes.Status403Forbidden, title: "Creators only",
            detail: "The studio is for creators. This account does not publish recipes or sell plans."),
        StudioOutcome.NotAllowed => Problem(statusCode: StatusCodes.Status409Conflict, title: "Not now", detail: result.Problem),
        _ => Problem(statusCode: StatusCodes.Status404NotFound, title: "Not found",
            detail: "You have no recipe or plan with that id."),
    };
}
