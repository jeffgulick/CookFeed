using Cookfeed.Api.Binding;
using Cookfeed.Application.Saves;
using Cookfeed.Contracts.Saves;
using Microsoft.AspNetCore.Mvc;

namespace Cookfeed.Api.Controllers;

/// <summary>
/// The caller's own saved recipes: what My kitchen lists. Routes under <c>/api/me</c> never take a user id
/// (DesignDocument.md §9), so nobody reaches another account's saves.
/// </summary>
[ApiController]
[Route("api/me/saves")]
public class MySavesController(SaveService saves) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType<IReadOnlyList<SavedRecipeDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<IReadOnlyList<SavedRecipeDto>>> Get([FromCallerHeader] int callerId,
        CancellationToken cancellationToken)
    {
        var result = await saves.GetSavedAsync(callerId, cancellationToken);
        return result.Outcome == SaveOutcome.Done ? Ok(result.Saved) : NoShop();
    }

    // PUT and DELETE, both safe to repeat: saving twice leaves one save, and unsaving what is not saved changes
    // nothing. Each answers with whether the caller now has the recipe saved and how many cooks do.
    [HttpPut("{recipeId:int}")]
    [ProducesResponseType<SaveStateDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<SaveStateDto>> Save(int recipeId, [FromCallerHeader] int callerId,
        CancellationToken cancellationToken) =>
        Answer(await saves.SaveAsync(callerId, recipeId, cancellationToken));

    [HttpDelete("{recipeId:int}")]
    [ProducesResponseType<SaveStateDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<SaveStateDto>> Unsave(int recipeId, [FromCallerHeader] int callerId,
        CancellationToken cancellationToken) =>
        Answer(await saves.UnsaveAsync(callerId, recipeId, cancellationToken));

    private ActionResult<SaveStateDto> Answer(SaveResult result) => result.Outcome switch
    {
        SaveOutcome.Done => result.State!,
        SaveOutcome.NotFound => Problem(detail: "There is no recipe with that id that you can save.",
            statusCode: StatusCodes.Status404NotFound, title: "No such recipe"),
        _ => NoShop(),
    };

    private ObjectResult NoShop() => Problem(
        detail: "Saved recipes belong to home cooks. The admin account holds no shopping role.",
        statusCode: StatusCodes.Status403Forbidden, title: "This account does not save recipes");
}
