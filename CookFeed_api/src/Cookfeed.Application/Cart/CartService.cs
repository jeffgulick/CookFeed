using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Contracts.Cart;
using Cookfeed.Contracts.Storefront;
using Cookfeed.Domain.Access;

namespace Cookfeed.Application.Cart;

/// <summary>
/// What the repository reads for one product in a cart. The counts are raw and the three facts are what
/// <see cref="BuyAccess"/> needs; <see cref="CartService"/> decides whether the line can still be bought.
/// </summary>
/// <param name="RecipeCount">Distinct recipes in the product.</param>
/// <param name="PlacementCount">Places in the product; a meal plan that serves a recipe twice counts it twice.</param>
public sealed record CartLine(
    int ProductId,
    ProductType Type,
    string Title,
    string? CoverImageUrl,
    string CreatorHandle,
    int RecipeCount,
    int PlacementCount,
    int PriceCents,
    string Currency,
    bool ForSale,
    bool ViewerMadeProduct,
    bool ViewerOwnsProduct)
{
    /// <summary>True while a cook who can shop could still check this line out.</summary>
    public bool CanBeBought => BuyAccess.CanCheckOut(BuyAccess.State(signedIn: true,
        new BuyFacts(ViewerCanShop: true, ViewerMadeProduct, ViewerOwnsProduct, ForSale, InCart: true)));
}

/// <summary>How a cart request ended. Everything but <see cref="Done"/> is a refusal, with nothing written.</summary>
public enum CartOutcome
{
    Done,

    /// <summary>No product has the id.</summary>
    NotFound,

    /// <summary>The caller cannot shop: the admin, or an id no account has.</summary>
    NoShop,

    /// <summary>The caller made the product.</summary>
    YourOwn,

    /// <summary>The caller already owns the product.</summary>
    Owned,

    /// <summary>The product is not for sale.</summary>
    NotForSale,
}

/// <summary>The outcome, and the cart as it now is when the request was carried out.</summary>
public sealed record CartResult(CartOutcome Outcome, CartDto? Cart = null);

/// <summary>
/// The caller's cart (DesignDocument.md §3.4): one copy of each product, only for a home cook, and only products
/// that cook may buy. The caller's id comes from their identity, never from the route, so nobody reaches another
/// account's cart.
/// </summary>
public class CartService(ICartRepository carts, TimeProvider clock)
{
    /// <summary>The currency of an empty cart. Every product is sold in it today (DesignDocument.md §9).</summary>
    private const string DefaultCurrency = "USD";

    public async Task<CartResult> GetCartAsync(int callerId, CancellationToken cancellationToken) =>
        await carts.CanShopAsync(callerId, cancellationToken)
            ? new CartResult(CartOutcome.Done, await ReadAsync(callerId, cancellationToken))
            : new CartResult(CartOutcome.NoShop);

    /// <summary>Adds a product. Asking again for one already in the cart changes nothing and is not an error.</summary>
    public async Task<CartResult> AddAsync(int callerId, int productId, CancellationToken cancellationToken)
    {
        if (!await carts.CanShopAsync(callerId, cancellationToken))
        {
            return new CartResult(CartOutcome.NoShop);
        }

        var facts = await carts.GetBuyFactsAsync(callerId, productId, cancellationToken);
        if (facts is null)
        {
            return new CartResult(CartOutcome.NotFound);
        }

        switch (BuyAccess.State(signedIn: true, facts))
        {
            case BuyState.YourOwn:
                return new CartResult(CartOutcome.YourOwn);
            case BuyState.Owned:
                return new CartResult(CartOutcome.Owned);
            case BuyState.NotForSale:
                return new CartResult(CartOutcome.NotForSale);
            case BuyState.Buy:
                await carts.AddAsync(callerId, productId, clock.GetUtcNow(), cancellationToken);
                break;
        }

        return new CartResult(CartOutcome.Done, await ReadAsync(callerId, cancellationToken));
    }

    /// <summary>Takes a product out. Asking for one that is not in the cart changes nothing and is not an error.</summary>
    public async Task<CartResult> RemoveAsync(int callerId, int productId, CancellationToken cancellationToken)
    {
        if (!await carts.CanShopAsync(callerId, cancellationToken))
        {
            return new CartResult(CartOutcome.NoShop);
        }

        await carts.RemoveAsync(callerId, productId, cancellationToken);
        return new CartResult(CartOutcome.Done, await ReadAsync(callerId, cancellationToken));
    }

    public async Task<CartResult> ClearAsync(int callerId, CancellationToken cancellationToken)
    {
        if (!await carts.CanShopAsync(callerId, cancellationToken))
        {
            return new CartResult(CartOutcome.NoShop);
        }

        await carts.ClearAsync(callerId, cancellationToken);
        return new CartResult(CartOutcome.Done, await ReadAsync(callerId, cancellationToken));
    }

    private async Task<CartDto> ReadAsync(int callerId, CancellationToken cancellationToken)
    {
        var lines = await carts.GetLinesAsync(callerId, cancellationToken);
        var buyable = lines.Where(line => line.CanBeBought).ToList();

        return new CartDto(
            buyable.Select(line => new CartLineDto(
                line.ProductId,
                line.Type,
                line.Title,
                line.CoverImageUrl,
                line.CreatorHandle,
                line.RecipeCount,
                // A meal plan may serve one recipe on several days, so recipes and meals differ (§3.2, Q5).
                line.Type == ProductType.MealPlan ? line.PlacementCount : null,
                line.PriceCents)).ToList(),
            buyable.Sum(line => line.PriceCents),
            buyable.FirstOrDefault()?.Currency ?? DefaultCurrency,
            lines.Where(line => !line.CanBeBought).Select(line => line.Title).ToList());
    }
}
