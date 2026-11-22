using Cookfeed.Application.Studio;
using Cookfeed.Contracts.Studio;

namespace Cookfeed.Application.Abstractions.Persistence;

/// <summary>Reads and changes what a creator's studio shows. Implemented with EF Core in Infrastructure.</summary>
public interface IStudioRepository
{
    /// <summary>The creator's handle and whether they are suspended; null when <paramref name="userId"/> is not a creator.</summary>
    Task<StudioCreator?> GetCreatorAsync(int userId, CancellationToken cancellationToken);

    /// <summary>The creator's own recipes, drafts included, the newest first, each with what the publishing rule needs.</summary>
    Task<IReadOnlyList<StudioRecipeRow>> GetRecipesAsync(int creatorId, CancellationToken cancellationToken);

    /// <summary>The creator's own plans, retired ones included, the newest first, each with what the restoring rule needs.</summary>
    Task<IReadOnlyList<StudioProductRow>> GetProductsAsync(int creatorId, CancellationToken cancellationToken);

    /// <summary>Every order line whose seller is the creator, the newest first.</summary>
    Task<IReadOnlyList<StudioSaleDto>> GetSalesAsync(int creatorId, CancellationToken cancellationToken);

    /// <summary>The reviews of the creator's plans that are not hidden, the newest first.</summary>
    Task<IReadOnlyList<StudioReviewDto>> GetReviewsAsync(int creatorId, CancellationToken cancellationToken);

    /// <summary>Publishes or unpublishes a recipe. The date it was first published is kept.</summary>
    Task SetRecipePublishedAsync(int recipeId, bool published, DateTimeOffset now, CancellationToken cancellationToken);

    /// <summary>Retires a plan, or puts it back on sale.</summary>
    Task SetProductActiveAsync(int productId, bool active, CancellationToken cancellationToken);
}
