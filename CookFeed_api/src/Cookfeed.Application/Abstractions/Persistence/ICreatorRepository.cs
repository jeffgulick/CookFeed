using Cookfeed.Contracts.Storefront;

namespace Cookfeed.Application.Abstractions.Persistence;

/// <summary>Reads creators and their storefronts from the database. Implemented with EF Core in Infrastructure.</summary>
public interface ICreatorRepository
{
    /// <summary>
    /// The storefront for <paramref name="handle"/>, or null when no creator has it. <paramref name="viewerId"/>,
    /// when given, fills the viewer-specific flags.
    /// </summary>
    Task<StorefrontDto?> GetStorefrontAsync(string handle, int? viewerId, CancellationToken cancellationToken);

    /// <summary>Every creator, in the order they joined, with what a tile shows.</summary>
    Task<IReadOnlyList<CreatorTileDto>> GetTilesAsync(CancellationToken cancellationToken);
}
