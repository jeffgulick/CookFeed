using Cookfeed.Api.Binding;
using Cookfeed.Application.Products;
using Cookfeed.Contracts.Products;
using Microsoft.AspNetCore.Mvc;

namespace Cookfeed.Api.Controllers;

/// <summary>Meal plans and recipe collections, the products creators sell.</summary>
[ApiController]
[Route("api/products")]
public class ProductsController(ProductPageService products, ProductShoppingListService shoppingLists) : ControllerBase
{
    // X-User-Id is optional: a signed-out visitor sees the product as it is sold, with every premium recipe as a
    // locked card. A retired product is still served (marked not for sale); only an id that names none is a 404.
    [HttpGet("{id:int}")]
    [ProducesResponseType<ProductDetailDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ProductDetailDto>> Get(
        int id,
        [FromCallerHeader] int? viewerId = null,
        CancellationToken cancellationToken = default)
    {
        var product = await products.GetProductAsync(id, viewerId, cancellationToken);
        return product is null ? NotFound() : product;
    }

    // "What you'll buy": the ingredients of the recipes this viewer may open, as each is written. A viewer who can
    // open none gets an empty list and the locked recipes by name, never their ingredients.
    [HttpGet("{id:int}/shopping-list")]
    [ProducesResponseType<ProductShoppingListDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ProductShoppingListDto>> GetShoppingList(
        int id,
        [FromCallerHeader] int? viewerId = null,
        CancellationToken cancellationToken = default)
    {
        var list = await shoppingLists.GetShoppingListAsync(id, viewerId, cancellationToken);
        return list is null ? NotFound() : list;
    }
}
