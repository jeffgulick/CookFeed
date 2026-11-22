using Cookfeed.Api.Binding;
using Cookfeed.Application.Cart;
using Cookfeed.Contracts.Cart;
using Cookfeed.Contracts.Orders;
using Microsoft.AspNetCore.Mvc;

namespace Cookfeed.Api.Controllers;

/// <summary>
/// The caller's own cart, and checkout. Routes under <c>/api/me</c> never take a user id (DesignDocument.md §9), so
/// nobody reaches another account's cart. Every change answers with the cart as it now is, which saves the app a
/// second request.
/// </summary>
[ApiController]
[Route("api/me")]
public class MyCartController(CartService cart, CheckoutService checkout) : ControllerBase
{
    [HttpGet("cart")]
    [ProducesResponseType<CartDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<CartDto>> Get([FromCallerHeader] int callerId, CancellationToken cancellationToken) =>
        Answer(await cart.GetCartAsync(callerId, cancellationToken));

    // PUT, not POST: putting a product in the cart twice leaves it there once, so the request is safe to repeat.
    [HttpPut("cart/{productId:int}")]
    [ProducesResponseType<CartDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CartDto>> Add(int productId, [FromCallerHeader] int callerId,
        CancellationToken cancellationToken) =>
        Answer(await cart.AddAsync(callerId, productId, cancellationToken));

    [HttpDelete("cart/{productId:int}")]
    [ProducesResponseType<CartDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<CartDto>> Remove(int productId, [FromCallerHeader] int callerId,
        CancellationToken cancellationToken) =>
        Answer(await cart.RemoveAsync(callerId, productId, cancellationToken));

    [HttpDelete("cart")]
    [ProducesResponseType<CartDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<CartDto>> Clear([FromCallerHeader] int callerId, CancellationToken cancellationToken) =>
        Answer(await cart.ClearAsync(callerId, cancellationToken));

    // 201 Created with the new order. Location names the caller's orders, where the order is listed; there is no
    // address for one order on its own.
    [HttpPost("checkout")]
    [ProducesResponseType<OrderDto>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<OrderDto>> Checkout([FromCallerHeader] int callerId,
        CancellationToken cancellationToken)
    {
        var result = await checkout.PlaceOrderAsync(callerId, cancellationToken);
        return result.Outcome switch
        {
            CheckoutOutcome.Placed => Created("/api/me/orders", result.Order),
            CheckoutOutcome.EmptyCart => Refuse(StatusCodes.Status400BadRequest, "Nothing to order",
                "There is nothing in your cart that can be bought."),
            _ => NoShop(),
        };
    }

    /// <summary>The cart on success; otherwise a ProblemDetails whose detail is a sentence the app can show.</summary>
    private ActionResult<CartDto> Answer(CartResult result) => result.Outcome switch
    {
        CartOutcome.Done => result.Cart!,
        CartOutcome.NotFound => Refuse(StatusCodes.Status404NotFound, "No such plan",
            "There is no meal plan or collection with that id."),
        CartOutcome.YourOwn => Refuse(StatusCodes.Status400BadRequest, "Your own plan",
            "This is your own plan. Creators cannot buy their own."),
        CartOutcome.Owned => Refuse(StatusCodes.Status409Conflict, "Already yours",
            "You already own this plan, and a plan is bought once."),
        CartOutcome.NotForSale => Refuse(StatusCodes.Status409Conflict, "Not for sale",
            "This plan is no longer for sale."),
        _ => NoShop(),
    };

    private ObjectResult NoShop() => Refuse(StatusCodes.Status403Forbidden, "This account does not shop",
        "Carts and orders belong to home cooks. The admin account holds no shopping role.");

    private ObjectResult Refuse(int status, string title, string detail) =>
        Problem(detail: detail, statusCode: status, title: title);
}
