using Cookfeed.Application.Products;
using Cookfeed.Contracts.Products;
using Cookfeed.Contracts.Storefront;

namespace Cookfeed.Application.Abstractions.Persistence;

/// <summary>Reads products (meal plans and recipe collections) from the database. Implemented with EF Core in Infrastructure.</summary>
public interface IProductRepository
{
    /// <summary>
    /// Everything one product's page could show <paramref name="viewerId"/>, or null when no product has the id. A
    /// retired product is still returned, marked as not for sale. It applies no access rule: each recipe comes with
    /// the facts <c>RecipeAccess</c> needs, and the service decides what the viewer sees.
    /// </summary>
    Task<ProductPage?> GetPageAsync(int productId, int? viewerId, CancellationToken cancellationToken);

    /// <summary>
    /// The products for sale, by the same rule as the page's <c>IsForSale</c>, in the order <paramref name="sort"/>
    /// names. <paramref name="type"/> keeps one kind, or both when null; <paramref name="viewerId"/>, when given,
    /// marks the products that viewer owns.
    /// </summary>
    Task<IReadOnlyList<ProductTile>> GetForSaleAsync(ProductType? type, ProductSort sort, int? viewerId,
        CancellationToken cancellationToken);
}
