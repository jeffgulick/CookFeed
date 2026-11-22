using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Application.Cart;
using Cookfeed.Contracts.Storefront;
using Cookfeed.Domain.Access;
using NSubstitute;

namespace Cookfeed.Application.Tests.Cart;

/// <summary>
/// <see cref="CartService"/>: who has a cart, what may go in it, and which of its lines can still be bought. The
/// rule is <see cref="BuyAccess"/>; the repository is a fake, so these tests need no database.
/// </summary>
public class CartServiceTests
{
    private const int Caller = 8, Product = 3;
    private static readonly DateTimeOffset Now = new(2026, 11, 21, 18, 0, 0, TimeSpan.Zero);

    private readonly ICartRepository _carts = Substitute.For<ICartRepository>();
    private readonly TimeProvider _clock = Substitute.For<TimeProvider>();

    public CartServiceTests()
    {
        _clock.GetUtcNow().Returns(Now);
        _carts.CanShopAsync(Caller, Arg.Any<CancellationToken>()).Returns(true);
        _carts.GetLinesAsync(Caller, Arg.Any<CancellationToken>()).Returns([]);
    }

    private CartService Service => new(_carts, _clock);

    [Fact]
    public async Task The_cart_lists_its_lines_and_adds_up_their_prices()
    {
        Holds(Line(3, "Three Weeknights in Japan", 1299), Line(2, "The Bread Box", 499));

        var result = await Service.GetCartAsync(Caller, CancellationToken.None);

        Assert.Equal(CartOutcome.Done, result.Outcome);
        Assert.Equal([3, 2], result.Cart!.Lines.Select(l => l.ProductId));
        Assert.Equal(1798, result.Cart.TotalCents);
        Assert.Equal("USD", result.Cart.Currency);
        Assert.Empty(result.Cart.Unavailable);
    }

    [Fact]
    public async Task An_empty_cart_totals_zero()
    {
        var result = await Service.GetCartAsync(Caller, CancellationToken.None);

        Assert.Empty(result.Cart!.Lines);
        Assert.Equal(0, result.Cart.TotalCents);
        Assert.Equal("USD", result.Cart.Currency);
    }

    [Fact]
    public async Task A_meal_plan_line_counts_its_meals_and_a_collection_does_not()
    {
        Holds(
            Line(4, "Family Week on a Budget", 999, ProductType.MealPlan, recipes: 5, placements: 6),
            Line(2, "The Bread Box", 499, ProductType.RecipeCollection, recipes: 3, placements: 3));

        var cart = (await Service.GetCartAsync(Caller, CancellationToken.None)).Cart!;

        Assert.Equal((5, 6), (cart.Lines[0].RecipeCount, cart.Lines[0].MealCount));
        Assert.Equal((3, null), (cart.Lines[1].RecipeCount, cart.Lines[1].MealCount));
    }

    [Fact]
    public async Task A_line_that_can_no_longer_be_bought_is_named_but_not_listed_or_charged()
    {
        Holds(
            Line(3, "Three Weeknights in Japan", 1299),
            Line(5, "Summer Grilling", 899, forSale: false),
            Line(1, "Roman Pasta Collection", 799, owns: true));

        var cart = (await Service.GetCartAsync(Caller, CancellationToken.None)).Cart!;

        Assert.Equal([3], cart.Lines.Select(l => l.ProductId));
        Assert.Equal(1299, cart.TotalCents);
        Assert.Equal(["Summer Grilling", "Roman Pasta Collection"], cart.Unavailable);
    }

    [Fact]
    public async Task An_account_that_cannot_shop_has_no_cart()
    {
        _carts.CanShopAsync(6, Arg.Any<CancellationToken>()).Returns(false);

        var result = await Service.GetCartAsync(callerId: 6, CancellationToken.None);

        Assert.Equal(CartOutcome.NoShop, result.Outcome);
        Assert.Null(result.Cart);
        await _carts.DidNotReceive().GetLinesAsync(Arg.Any<int>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Adding_a_product_writes_the_line_with_the_time_and_returns_the_cart()
    {
        Product3Is(new BuyFacts(ViewerCanShop: true, ViewerMadeProduct: false, ViewerOwnsProduct: false, ForSale: true, InCart: false));
        Holds(Line(3, "Three Weeknights in Japan", 1299));

        var result = await Service.AddAsync(Caller, Product, CancellationToken.None);

        Assert.Equal(CartOutcome.Done, result.Outcome);
        Assert.Equal([3], result.Cart!.Lines.Select(l => l.ProductId));
        await _carts.Received(1).AddAsync(Caller, Product, Now, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Adding_a_product_already_in_the_cart_changes_nothing()
    {
        Product3Is(new BuyFacts(true, false, false, ForSale: true, InCart: true));

        var result = await Service.AddAsync(Caller, Product, CancellationToken.None);

        Assert.Equal(CartOutcome.Done, result.Outcome);
        await _carts.DidNotReceive().AddAsync(Arg.Any<int>(), Arg.Any<int>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task A_product_that_does_not_exist_cannot_be_added()
    {
        _carts.GetBuyFactsAsync(Caller, 999, Arg.Any<CancellationToken>()).Returns((BuyFacts?)null);

        var result = await Service.AddAsync(Caller, 999, CancellationToken.None);

        Assert.Equal(CartOutcome.NotFound, result.Outcome);
        Assert.Null(result.Cart);
    }

    [Theory]
    [InlineData(true, false, true, CartOutcome.YourOwn)]      // the caller made it
    [InlineData(false, true, true, CartOutcome.Owned)]        // already bought
    [InlineData(false, false, false, CartOutcome.NotForSale)] // retired, or its creator suspended
    public async Task A_product_the_caller_may_not_buy_is_refused_and_nothing_is_written(bool madeIt, bool owns,
        bool forSale, CartOutcome expected)
    {
        Product3Is(new BuyFacts(ViewerCanShop: true, madeIt, owns, forSale, InCart: false));

        var result = await Service.AddAsync(Caller, Product, CancellationToken.None);

        Assert.Equal(expected, result.Outcome);
        Assert.Null(result.Cart);
        await _carts.DidNotReceive().AddAsync(Arg.Any<int>(), Arg.Any<int>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task An_account_that_cannot_shop_adds_nothing()
    {
        _carts.CanShopAsync(6, Arg.Any<CancellationToken>()).Returns(false);

        var result = await Service.AddAsync(callerId: 6, Product, CancellationToken.None);

        Assert.Equal(CartOutcome.NoShop, result.Outcome);
        await _carts.DidNotReceive().AddAsync(Arg.Any<int>(), Arg.Any<int>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Taking_a_product_out_removes_the_line_and_returns_the_cart()
    {
        var result = await Service.RemoveAsync(Caller, Product, CancellationToken.None);

        Assert.Equal(CartOutcome.Done, result.Outcome);
        Assert.NotNull(result.Cart);
        await _carts.Received(1).RemoveAsync(Caller, Product, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Emptying_the_cart_removes_every_line()
    {
        var result = await Service.ClearAsync(Caller, CancellationToken.None);

        Assert.Equal(CartOutcome.Done, result.Outcome);
        Assert.Empty(result.Cart!.Lines);
        await _carts.Received(1).ClearAsync(Caller, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task An_account_that_cannot_shop_removes_nothing()
    {
        _carts.CanShopAsync(6, Arg.Any<CancellationToken>()).Returns(false);

        Assert.Equal(CartOutcome.NoShop, (await Service.RemoveAsync(6, Product, CancellationToken.None)).Outcome);
        Assert.Equal(CartOutcome.NoShop, (await Service.ClearAsync(6, CancellationToken.None)).Outcome);
        await _carts.DidNotReceive().RemoveAsync(Arg.Any<int>(), Arg.Any<int>(), Arg.Any<CancellationToken>());
        await _carts.DidNotReceive().ClearAsync(Arg.Any<int>(), Arg.Any<CancellationToken>());
    }

    private void Holds(params CartLine[] lines) =>
        _carts.GetLinesAsync(Caller, Arg.Any<CancellationToken>()).Returns(lines);

    private void Product3Is(BuyFacts facts) =>
        _carts.GetBuyFactsAsync(Caller, Product, Arg.Any<CancellationToken>()).Returns(facts);

    private static CartLine Line(int productId, string title, int priceCents,
        ProductType type = ProductType.MealPlan, int recipes = 3, int placements = 3, bool forSale = true,
        bool madeIt = false, bool owns = false) =>
        new(productId, type, title, $"images/products/{productId}.svg", "kenji-kitchen", recipes, placements,
            priceCents, "USD", ForSale: forSale, ViewerMadeProduct: madeIt, ViewerOwnsProduct: owns);
}
