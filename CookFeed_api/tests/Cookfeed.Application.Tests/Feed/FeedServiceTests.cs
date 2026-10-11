using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Application.Feed;
using Cookfeed.Contracts.Feed;
using NSubstitute;

namespace Cookfeed.Application.Tests.Feed;

/// <summary>
/// The paging rule in <see cref="FeedService"/>: ask the repository for one row more than the page holds, and
/// use that extra row only to set <see cref="FeedPageDto.HasMore"/> (docs/Queries.md §1). The repository is a
/// fake, so these tests need no database.
/// </summary>
public class FeedServiceTests
{
    // NSubstitute: Substitute.For<T>() builds a stand-in for the interface. Calls return defaults until a test
    // sets a result with .Returns(...), and .Received() checks afterwards how the service called it.
    private readonly IRecipeRepository _recipes = Substitute.For<IRecipeRepository>();

    private FeedService Service => new(_recipes);

    [Fact]
    public async Task Asks_for_one_row_more_than_the_page_starting_after_the_earlier_pages()
    {
        Returns(Items(0));

        await Service.GetFeedAsync(FeedSort.Newest, page: 3, pageSize: 20, viewerId: null, CancellationToken.None);

        await _recipes.Received(1).GetFeedAsync(FeedSort.Newest, 40, 21, null, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task An_extra_row_is_dropped_and_means_another_page_follows()
    {
        Returns(Items(5));

        var page = await Service.GetFeedAsync(FeedSort.Newest, page: 1, pageSize: 4, viewerId: null, CancellationToken.None);

        Assert.Equal([1, 2, 3, 4], page.Items.Select(i => i.Id));
        Assert.True(page.HasMore);
    }

    [Theory]
    [InlineData(4)]
    [InlineData(2)]
    [InlineData(0)]
    public async Task A_page_with_no_extra_row_is_the_last(int rowsReturned)
    {
        Returns(Items(rowsReturned));

        var page = await Service.GetFeedAsync(FeedSort.Newest, page: 1, pageSize: 4, viewerId: null, CancellationToken.None);

        Assert.Equal(rowsReturned, page.Items.Count);
        Assert.False(page.HasMore);
    }

    [Fact]
    public async Task The_page_echoes_the_page_number_and_size_asked_for()
    {
        Returns(Items(0));

        var page = await Service.GetFeedAsync(FeedSort.Newest, page: 2, pageSize: 10, viewerId: null, CancellationToken.None);

        Assert.Equal(2, page.Page);
        Assert.Equal(10, page.PageSize);
    }

    [Fact]
    public async Task The_sort_and_viewer_are_passed_to_the_repository_unchanged()
    {
        Returns(Items(0));

        await Service.GetFeedAsync(FeedSort.Trending, page: 1, pageSize: 20, viewerId: 7, CancellationToken.None);

        await _recipes.Received(1).GetFeedAsync(FeedSort.Trending, 0, 21, 7, Arg.Any<CancellationToken>());
    }

    private void Returns(IReadOnlyList<FeedItemDto> items) =>
        _recipes.GetFeedAsync(default, default, default, default, default).ReturnsForAnyArgs(items);

    private static List<FeedItemDto> Items(int count) =>
        [.. Enumerable.Range(1, count).Select(id => new FeedItemDto(
            id, $"Recipe {id}", $"https://cdn.example/{id}.mp4", null, 4, 20, 0,
            DateTimeOffset.UnixEpoch, "creator", "Creator", false, false))];
}
