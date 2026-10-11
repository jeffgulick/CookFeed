using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Contracts.Storefront;

namespace Cookfeed.Application.Storefront;

/// <summary>Looks up a creator's storefront by the handle in its URL.</summary>
public class StorefrontService(ICreatorRepository creators)
{
    /// <summary>The storefront, or null when no creator has the handle (the controller answers 404).</summary>
    public Task<StorefrontDto?> GetStorefrontAsync(string handle, int? viewerId, CancellationToken cancellationToken)
    {
        // A handle is ASCII letters, digits and hyphens, at most 40 characters (ck_creator_profiles_handle_slug and
        // the column length). Anything else cannot be a creator, so it is refused before lower-casing: otherwise
        // ToLowerInvariant would fold look-alikes such as the Kelvin sign (U+212A) into "k" and reach a real
        // storefront under a second spelling.
        if (handle.Length is 0 or > MaxHandleLength || !handle.All(c => char.IsAsciiLetterOrDigit(c) || c == '-'))
        {
            return Task.FromResult<StorefrontDto?>(null);
        }

        // Handles are stored lower-case, so /api/creators/Maria-Cooks finds maria-cooks. Lower-casing the argument,
        // not the column, keeps the lookup on the unique handle index.
        return creators.GetStorefrontAsync(handle.ToLowerInvariant(), viewerId, cancellationToken);
    }

    private const int MaxHandleLength = 40;
}
