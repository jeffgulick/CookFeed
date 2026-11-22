using Cookfeed.Contracts.Orders;
using Cookfeed.Contracts.Recipes;
using Cookfeed.Contracts.Storefront;

namespace Cookfeed.Contracts.Studio;

/// <summary>A creator's studio: what they publish, what they sell, and what it has earned.</summary>
/// <param name="IsSuspended">True while Cookfeed has the creator suspended: their plans are off the store.</param>
/// <param name="Recipes">The creator's own recipes, drafts included, the newest first.</param>
/// <param name="Sales">Every order line that bought one of their plans, the newest first, whatever the order's status.</param>
/// <param name="Reviews">The reviews of their plans that other cooks see, the newest first.</param>
public sealed record StudioDto(
    string Handle,
    bool IsSuspended,
    StudioStatsDto Stats,
    IReadOnlyList<StudioRecipeDto> Recipes,
    IReadOnlyList<StudioProductDto> Products,
    IReadOnlyList<StudioSaleDto> Sales,
    IReadOnlyList<StudioReviewDto> Reviews);

/// <param name="Sales">Paid order lines.</param>
/// <param name="EarnedCents">The sum of what those lines were paid, at the price of the time.</param>
/// <param name="Saves">How many times the creator's recipes are saved, in all.</param>
public sealed record StudioStatsDto(int PublishedRecipes, int Drafts, int PlansForSale, int Sales, int EarnedCents, int Saves);

/// <param name="InPlans">The titles of the plans that hold it.</param>
/// <param name="PublishProblem">
/// Why the recipe cannot be published (a draft) or unpublished (a published one) right now, in words the page shows
/// beside the button; null when it can.
/// </param>
public sealed record StudioRecipeDto(
    int Id,
    string Title,
    int Servings,
    bool IsPublished,
    RecipeVisibility Visibility,
    int SaveCount,
    IReadOnlyList<string> InPlans,
    string? PublishProblem);

/// <param name="IsActive">False once retired.</param>
/// <param name="IsForSale">On the store now: active, the creator not suspended, and every recipe published.</param>
/// <param name="Sold">Paid order lines for it.</param>
/// <param name="RestoreProblem">Why a retired plan cannot go back on sale right now; null when it can, or when it is not retired.</param>
public sealed record StudioProductDto(
    int Id,
    string Title,
    ProductType Type,
    int PriceCents,
    int RecipeCount,
    int? MealCount,
    bool IsActive,
    bool IsForSale,
    int Sold,
    string? RestoreProblem);

/// <summary>One order line that bought a plan: the title and price are the ones of the time.</summary>
public sealed record StudioSaleDto(DateTimeOffset PlacedAt, string BuyerName, string ProductTitle, int UnitPriceCents,
    OrderStatus Status);

public sealed record StudioReviewDto(int Id, string ReviewerName, int Rating, string Body, DateTimeOffset CreatedAt,
    int ProductId, string ProductTitle);
