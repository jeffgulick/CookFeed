using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Contracts.Storefront;

namespace Cookfeed.Application.Storefront;

/// <summary>Looks up a creator's storefront by the handle in its URL.</summary>
public class StorefrontService(ICreatorRepository creators)
{
    /// <summary>The storefront, or null when no creator has the handle (the controller answers 404).</summary>
    public Task<StorefrontDto?> GetStorefrontAsync(string handle, int? viewerId, CancellationToken cancellationToken) =>
        // Handles are stored lower-case (ck_creator_profiles_handle_slug), so /api/creators/Maria-Cooks finds
        // maria-cooks. Lower-casing the argument, not the column, keeps the lookup on the unique handle index.
        creators.GetStorefrontAsync(handle.ToLowerInvariant(), viewerId, cancellationToken);
}
