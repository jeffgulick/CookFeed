using System.Text.Json.Serialization;

namespace Cookfeed.Contracts.Orders;

/// <summary>
/// Where an order is in its life, as the API reports it. Mirrors <c>Cookfeed.Domain.Enums.OrderStatus</c> so the
/// API's JSON does not depend on the Domain layer. Sent as its name ("Paid"), not a number.
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter<OrderStatus>))]
public enum OrderStatus
{
    Pending,
    Paid,
    Refunded,
    Cancelled,
}
