namespace Cookfeed.Contracts.Orders;

/// <summary>
/// A product bought in an order, as it was at checkout: the title, price and seller are the snapshot taken then,
/// not the product as it is today (DesignDocument.md §6).
/// </summary>
/// <param name="SellerHandle">The seller's storefront handle; null if that creator no longer has a storefront.</param>
public sealed record OrderItemDto(int ProductId, string ProductTitle, int UnitPriceCents, string? SellerHandle);
