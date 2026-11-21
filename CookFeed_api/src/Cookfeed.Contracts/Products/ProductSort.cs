namespace Cookfeed.Contracts.Products;

/// <summary>The three orders the Plans page offers (the prototype's "Sort by" list).</summary>
public enum ProductSort
{
    /// <summary>Most recently created first.</summary>
    Newest,

    /// <summary>Cheapest first.</summary>
    Price,

    /// <summary>Highest average rating first; products with no reviews come last.</summary>
    Rating,
}
