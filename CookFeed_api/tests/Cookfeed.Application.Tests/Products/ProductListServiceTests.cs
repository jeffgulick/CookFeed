using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Application.Products;
using Cookfeed.Contracts.Products;
using Cookfeed.Contracts.Storefront;
using NSubstitute;

namespace Cookfeed.Application.Tests.Products;

/// <summary>
/// <see cref="ProductListService"/> turns the rows the repository read into the tiles of the Plans page: it works
/// out each rating the way the product page does, reports meals only for a meal plan, and leaves the filter, the
/// sort and the order to the repository.
/// </summary>
public class ProductListServiceTests
{
    private const int Viewer = 7;

    private readonly IProductRepository _products = Substitute.For<IProductRepository>();

    private ProductListService Service => new(_products);

    [Fact]
    public async Task A_meal_plan_reports_its_meals_and_a_collection_reports_none()
    {
        Given(Tile(1, ProductType.MealPlan) with { RecipeCount = 5, PlacementCount = 6 },
              Tile(2, ProductType.RecipeCollection) with { RecipeCount = 3, PlacementCount = 3 });

        var tiles = await GetAsync();

        Assert.Equal([(5, 6), (3, null)], tiles.Select(t => (t.RecipeCount, t.MealCount)));
    }

    [Fact]
    public async Task The_rating_is_worked_out_as_on_the_product_page()
    {
        Given(Tile(1) with { ReviewCount = 3, RatingSum = 13, RecommendCount = 2 }, Tile(2));

        var tiles = await GetAsync();

        Assert.Equal(new ProductRatingDto(3, 4.3m, 67), tiles[0].Rating);
        Assert.Equal(new ProductRatingDto(0, null, null), tiles[1].Rating);
    }

    [Fact]
    public async Task Each_tile_carries_what_the_repository_read()
    {
        Given(Tile(4, ProductType.MealPlan) with { OwnedByViewer = true });

        var tile = Assert.Single(await GetAsync());

        Assert.Equal((4, ProductType.MealPlan, "Product 4", "cover-4", 1299, "USD", "creator-4", true),
            (tile.Id, tile.Type, tile.Title, tile.CoverImageUrl, tile.PriceCents, tile.Currency, tile.CreatorHandle,
             tile.OwnedByViewer));
    }

    [Fact]
    public async Task The_filter_the_sort_and_the_viewer_go_to_the_repository_and_its_order_is_kept()
    {
        _products.GetForSaleAsync(ProductType.MealPlan, ProductSort.Price, Viewer, Arg.Any<CancellationToken>())
            .Returns([Tile(9), Tile(2), Tile(5)]);

        var tiles = await Service.GetProductsAsync(ProductType.MealPlan, ProductSort.Price, Viewer, CancellationToken.None);

        Assert.Equal([9, 2, 5], tiles.Select(t => t.Id));
    }

    private void Given(params ProductTile[] tiles) =>
        _products.GetForSaleAsync(null, ProductSort.Newest, null, Arg.Any<CancellationToken>()).Returns(tiles);

    private Task<IReadOnlyList<ProductTileDto>> GetAsync() =>
        Service.GetProductsAsync(type: null, ProductSort.Newest, viewerId: null, CancellationToken.None);

    private static ProductTile Tile(int id, ProductType type = ProductType.RecipeCollection) =>
        new(id, type, $"Product {id}", $"cover-{id}", 1299, "USD", $"creator-{id}",
            RecipeCount: 2, PlacementCount: 2, ReviewCount: 0, RatingSum: 0, RecommendCount: 0, OwnedByViewer: false);
}
