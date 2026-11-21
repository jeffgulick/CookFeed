using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Contracts.Storefront;

namespace Cookfeed.Application.Storefront;

/// <summary>Every creator, as the tiles on Discover that lead to each storefront.</summary>
public class CreatorListService(ICreatorRepository creators)
{
    public Task<IReadOnlyList<CreatorTileDto>> GetCreatorsAsync(CancellationToken cancellationToken) =>
        creators.GetTilesAsync(cancellationToken);
}
