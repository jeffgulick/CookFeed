using Cookfeed.Api.Binding;
using Cookfeed.Application.Storefront;
using Cookfeed.Contracts.Storefront;
using Microsoft.AspNetCore.Mvc;

namespace Cookfeed.Api.Controllers;

/// <summary>Creator storefronts, addressed by handle: <c>/api/creators/maria-cooks</c>.</summary>
[ApiController]
[Route("api/creators")]
public class CreatorsController(StorefrontService storefronts) : ControllerBase
{
    // X-User-Id is optional: it only fills the viewer's own flags (owned products, "this is me").
    // ActionResult<T> lets one method return either the storefront (200) or NotFound() (404).
    [HttpGet("{handle}")]
    public async Task<ActionResult<StorefrontDto>> Get(
        string handle,
        [FromCallerHeader] int? viewerId = null,
        CancellationToken cancellationToken = default) =>
        await storefronts.GetStorefrontAsync(handle, viewerId, cancellationToken) is { } storefront
            ? storefront
            : NotFound();
}
