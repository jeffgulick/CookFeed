using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Application.Orders;
using Cookfeed.Contracts.Orders;
using NSubstitute;

namespace Cookfeed.Application.Tests.Orders;

/// <summary><see cref="OrderHistoryService"/> reads the caller's orders, and only the caller's.</summary>
public class OrderHistoryServiceTests
{
    private readonly IOrderRepository _orders = Substitute.For<IOrderRepository>();

    private OrderHistoryService Service => new(_orders);

    [Fact]
    public async Task Asks_for_the_callers_orders()
    {
        _orders.GetOrderHistoryAsync(Arg.Any<int>(), Arg.Any<CancellationToken>()).Returns([]);

        await Service.GetOrderHistoryAsync(callerId: 7, CancellationToken.None);

        await _orders.Received(1).GetOrderHistoryAsync(7, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Returns_what_the_repository_finds()
    {
        IReadOnlyList<OrderDto> history =
            [new OrderDto(1, OrderStatus.Paid, DateTimeOffset.UnixEpoch, DateTimeOffset.UnixEpoch, 799, "USD", [])];
        _orders.GetOrderHistoryAsync(1, Arg.Any<CancellationToken>()).Returns(history);

        Assert.Same(history, await Service.GetOrderHistoryAsync(callerId: 1, CancellationToken.None));
    }
}
