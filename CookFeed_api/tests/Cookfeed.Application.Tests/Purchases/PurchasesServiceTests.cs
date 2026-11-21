using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Application.Purchases;
using Cookfeed.Contracts.Purchases;
using Cookfeed.Contracts.Storefront;
using NSubstitute;

namespace Cookfeed.Application.Tests.Purchases;

/// <summary><see cref="PurchasesService"/> reads the caller's purchases, and only the caller's.</summary>
public class PurchasesServiceTests
{
    private readonly IOrderRepository _orders = Substitute.For<IOrderRepository>();

    private PurchasesService Service => new(_orders);

    [Fact]
    public async Task Asks_for_the_callers_purchases()
    {
        _orders.GetPurchasesAsync(Arg.Any<int>(), Arg.Any<CancellationToken>()).Returns([]);

        await Service.GetPurchasesAsync(callerId: 7, CancellationToken.None);

        await _orders.Received(1).GetPurchasesAsync(7, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Returns_what_the_repository_finds()
    {
        IReadOnlyList<PurchaseDto> purchases =
            [new PurchaseDto(3, ProductType.MealPlan, "Three Weeknights in Japan", null, DateTimeOffset.UnixEpoch, 3, 3, [])];
        _orders.GetPurchasesAsync(1, Arg.Any<CancellationToken>()).Returns(purchases);

        Assert.Same(purchases, await Service.GetPurchasesAsync(callerId: 1, CancellationToken.None));
    }
}
