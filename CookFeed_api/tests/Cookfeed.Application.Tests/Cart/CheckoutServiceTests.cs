using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Application.Cart;
using Cookfeed.Contracts.Orders;
using Cookfeed.Contracts.Storefront;
using NSubstitute;

namespace Cookfeed.Application.Tests.Cart;

/// <summary>
/// <see cref="CheckoutService"/>: the cart's buyable lines become one Paid order. What cannot be bought any more is
/// left out, as the prototype's <c>placeOrder</c> does; with nothing left to buy there is no order.
/// </summary>
public class CheckoutServiceTests
{
    private const int Caller = 10;
    private static readonly DateTimeOffset Now = new(2026, 11, 21, 18, 0, 0, TimeSpan.Zero);

    private readonly ICartRepository _carts = Substitute.For<ICartRepository>();
    private readonly IOrderRepository _orders = Substitute.For<IOrderRepository>();
    private readonly TimeProvider _clock = Substitute.For<TimeProvider>();

    public CheckoutServiceTests()
    {
        _clock.GetUtcNow().Returns(Now);
        _carts.CanShopAsync(Caller, Arg.Any<CancellationToken>()).Returns(true);
    }

    private CheckoutService Service => new(_carts, _orders, _clock);

    [Fact]
    public async Task The_buyable_lines_become_one_order_placed_now()
    {
        Holds(Line(3), Line(2));
        var order = new OrderDto(7, OrderStatus.Paid, Now, Now, 1798, "USD", []);
        _carts.PlaceOrderAsync(Caller, Arg.Any<IReadOnlyCollection<int>>(), Now, Arg.Any<CancellationToken>()).Returns(7);
        _orders.GetOrderAsync(Caller, 7, Arg.Any<CancellationToken>()).Returns(order);

        var result = await Service.PlaceOrderAsync(Caller, CancellationToken.None);

        Assert.Equal(CheckoutOutcome.Placed, result.Outcome);
        Assert.Same(order, result.Order);
        await _carts.Received(1).PlaceOrderAsync(Caller,
            Arg.Is<IReadOnlyCollection<int>>(ids => ids.SequenceEqual(new[] { 3, 2 })), Now, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Lines_that_can_no_longer_be_bought_are_left_out_of_the_order()
    {
        Holds(Line(3), Line(5, forSale: false), Line(1, owns: true), Line(4, madeIt: true));
        _carts.PlaceOrderAsync(Caller, Arg.Any<IReadOnlyCollection<int>>(), Now, Arg.Any<CancellationToken>()).Returns(7);

        await Service.PlaceOrderAsync(Caller, CancellationToken.None);

        await _carts.Received(1).PlaceOrderAsync(Caller,
            Arg.Is<IReadOnlyCollection<int>>(ids => ids.SequenceEqual(new[] { 3 })), Now, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task An_empty_cart_places_no_order()
    {
        Holds();

        var result = await Service.PlaceOrderAsync(Caller, CancellationToken.None);

        Assert.Equal(CheckoutOutcome.EmptyCart, result.Outcome);
        Assert.Null(result.Order);
        await _carts.DidNotReceive().PlaceOrderAsync(Arg.Any<int>(), Arg.Any<IReadOnlyCollection<int>>(),
            Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task A_cart_with_nothing_left_to_buy_places_no_order()
    {
        Holds(Line(5, forSale: false), Line(1, owns: true));

        var result = await Service.PlaceOrderAsync(Caller, CancellationToken.None);

        Assert.Equal(CheckoutOutcome.EmptyCart, result.Outcome);
    }

    [Fact]
    public async Task An_account_that_cannot_shop_places_no_order()
    {
        _carts.CanShopAsync(6, Arg.Any<CancellationToken>()).Returns(false);

        var result = await Service.PlaceOrderAsync(callerId: 6, CancellationToken.None);

        Assert.Equal(CheckoutOutcome.NoShop, result.Outcome);
        await _carts.DidNotReceive().GetLinesAsync(Arg.Any<int>(), Arg.Any<CancellationToken>());
    }

    private void Holds(params CartLine[] lines) =>
        _carts.GetLinesAsync(Caller, Arg.Any<CancellationToken>()).Returns(lines);

    private static CartLine Line(int productId, bool forSale = true, bool madeIt = false, bool owns = false) =>
        new(productId, ProductType.RecipeCollection, $"Product {productId}", null, "maria-cooks", 3, 3, 499, "USD",
            ForSale: forSale, ViewerMadeProduct: madeIt, ViewerOwnsProduct: owns);
}
