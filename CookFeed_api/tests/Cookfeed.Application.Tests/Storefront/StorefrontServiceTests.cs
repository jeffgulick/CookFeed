using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Application.Storefront;
using Cookfeed.Contracts.Storefront;
using NSubstitute;

namespace Cookfeed.Application.Tests.Storefront;

/// <summary>
/// <see cref="StorefrontService"/>: handles are stored lower-case (<c>ck_creator_profiles_handle_slug</c>), so a
/// URL typed with capitals still finds the creator; an unknown handle comes back as null for the controller to
/// turn into a 404.
/// </summary>
public class StorefrontServiceTests
{
    private readonly ICreatorRepository _creators = Substitute.For<ICreatorRepository>();

    private StorefrontService Service => new(_creators);

    [Fact]
    public async Task Looks_the_handle_up_in_lower_case()
    {
        await Service.GetStorefrontAsync("Maria-Cooks", viewerId: null, CancellationToken.None);

        await _creators.Received(1).GetStorefrontAsync("maria-cooks", null, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Passes_the_viewer_to_the_repository()
    {
        await Service.GetStorefrontAsync("maria-cooks", viewerId: 3, CancellationToken.None);

        await _creators.Received(1).GetStorefrontAsync("maria-cooks", 3, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Returns_what_the_repository_finds()
    {
        var storefront = new StorefrontDto("maria-cooks", "Maria Conti", null, null, true, 0, 0, false, [], []);
        _creators.GetStorefrontAsync("maria-cooks", null, Arg.Any<CancellationToken>()).Returns(storefront);

        Assert.Same(storefront, await Service.GetStorefrontAsync("maria-cooks", null, CancellationToken.None));
    }

    [Fact]
    public async Task An_unknown_handle_returns_null()
    {
        _creators.GetStorefrontAsync(Arg.Any<string>(), Arg.Any<int?>(), Arg.Any<CancellationToken>())
            .Returns((StorefrontDto?)null);

        Assert.Null(await Service.GetStorefrontAsync("nobody", null, CancellationToken.None));
    }
}
