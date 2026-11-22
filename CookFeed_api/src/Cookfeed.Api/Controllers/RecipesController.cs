using Cookfeed.Api.Binding;
using Cookfeed.Application.Recipes;
using Cookfeed.Contracts.Recipes;
using Microsoft.AspNetCore.Mvc;

namespace Cookfeed.Api.Controllers;

/// <summary>One recipe in full, for any viewer allowed to open it.</summary>
[ApiController]
[Route("api/recipes")]
public class RecipesController(RecipeDetailService recipes) : ControllerBase
{
    // X-User-Id is optional: a signed-out visitor opens Public recipes. A published premium recipe the viewer has not
    // bought is a 403 whose body names it and the plans selling it, and nothing else. A draft that is not theirs is a
    // 404 like an unknown id, so its existence is not revealed.
    [HttpGet("{id:int}")]
    [ProducesResponseType<RecipeDetailDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<RecipeLockedDto>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RecipeDetailDto>> Get(
        int id,
        [FromCallerHeader] int? viewerId = null,
        CancellationToken cancellationToken = default)
    {
        var found = await recipes.GetRecipeAsync(id, viewerId, cancellationToken);
        return found switch
        {
            { Recipe: { } recipe } => recipe,
            { Locked: { } locked } => StatusCode(StatusCodes.Status403Forbidden, locked),
            _ => NotFound(),
        };
    }
}
