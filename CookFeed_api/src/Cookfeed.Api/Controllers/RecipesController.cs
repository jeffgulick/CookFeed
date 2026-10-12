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
    // X-User-Id is optional: a signed-out visitor opens Public recipes. A recipe the viewer may not open (ProductOnly
    // and not bought, or a draft that is not theirs) is a 404 like an unknown id, so its existence is not revealed.
    [HttpGet("{id:int}")]
    [ProducesResponseType<RecipeDetailDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RecipeDetailDto>> Get(
        int id,
        [FromCallerHeader] int? viewerId = null,
        CancellationToken cancellationToken = default)
    {
        var recipe = await recipes.GetRecipeAsync(id, viewerId, cancellationToken);
        return recipe is null ? NotFound() : recipe;
    }
}
