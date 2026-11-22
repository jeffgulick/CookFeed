using System.Linq.Expressions;
using Cookfeed.Domain.Entities;

namespace Cookfeed.Infrastructure.Persistence.Repositories;

/// <summary>Conditions on products that more than one query needs, written once so they cannot drift apart.</summary>
internal static class ProductQueries
{
    /// <summary>
    /// For sale (rules.js isForSale, DesignDocument.md §3.8): the product is active, its creator is not suspended, and
    /// it holds at least one recipe and none that was taken down. Nobody pays for something they could not open.
    /// The list of plans and the storefront filter by this; the product page reports the same rule as IsForSale, and
    /// tests hold the three to each other.
    /// </summary>
    public static readonly Expression<Func<Product, bool>> IsForSale = p =>
        p.IsActive && p.Creator.SuspendedAt == null
        && p.Recipes.Any() && p.Recipes.All(pr => pr.Recipe.IsPublished);
}
