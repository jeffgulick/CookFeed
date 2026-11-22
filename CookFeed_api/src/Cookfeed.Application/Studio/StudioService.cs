using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Contracts.Orders;
using Cookfeed.Contracts.Recipes;
using Cookfeed.Contracts.Storefront;
using Cookfeed.Contracts.Studio;
using Cookfeed.Domain.Access;

namespace Cookfeed.Application.Studio;

public sealed record StudioCreator(string Handle, bool IsSuspended);

/// <summary>What the repository reads for one of the creator's recipes.</summary>
public sealed record StudioRecipeRow(int Id, string Title, int Servings, bool IsPublished, RecipeVisibility Visibility,
    int SaveCount, IReadOnlyList<string> PlanTitles, RecipePublishFacts Facts);

/// <summary>What the repository reads for one of the creator's plans.</summary>
/// <param name="PlacementCount">Places in the plan; a meal plan that serves a recipe twice counts it twice.</param>
/// <param name="FirstDraftTitle">The title of a recipe in it that is not published, when there is one.</param>
public sealed record StudioProductRow(int Id, string Title, ProductType Type, int PriceCents, int RecipeCount,
    int PlacementCount, bool IsActive, bool IsForSale, int Sold, string? FirstDraftTitle, ProductRestoreFacts Facts);

/// <summary>How a studio request ended. Everything but <see cref="Done"/> is a refusal, with nothing written.</summary>
public enum StudioOutcome
{
    Done,

    /// <summary>The caller is not a creator.</summary>
    NotACreator,

    /// <summary>The caller has no recipe or plan with the id; another creator's is not revealed.</summary>
    NotFound,

    /// <summary>The rules do not allow the change now; <see cref="StudioResult.Problem"/> says why.</summary>
    NotAllowed,
}

public sealed record StudioResult(StudioOutcome Outcome, StudioDto? Studio = null, string? Problem = null);

/// <summary>
/// A creator's studio (DesignDocument.md §3.8): their own recipes, plans, sales and reviews, and the changes they
/// may make to them. The caller's id comes from their identity, so every read and write is of their own rows. What
/// stops a change is decided by <see cref="StudioRules"/> and said in words here, the same words beside the button
/// that is off and in the refusal if the request is sent anyway.
/// </summary>
public class StudioService(IStudioRepository studio, TimeProvider clock)
{
    public async Task<StudioResult> GetStudioAsync(int callerId, CancellationToken cancellationToken)
    {
        var creator = await studio.GetCreatorAsync(callerId, cancellationToken);
        return creator is null
            ? new StudioResult(StudioOutcome.NotACreator)
            : new StudioResult(StudioOutcome.Done, await ReadAsync(callerId, creator, cancellationToken));
    }

    public async Task<StudioResult> SetRecipePublishedAsync(int callerId, int recipeId, bool publish,
        CancellationToken cancellationToken)
    {
        var creator = await studio.GetCreatorAsync(callerId, cancellationToken);
        if (creator is null)
        {
            return new StudioResult(StudioOutcome.NotACreator);
        }

        var recipe = (await studio.GetRecipesAsync(callerId, cancellationToken)).FirstOrDefault(r => r.Id == recipeId);
        if (recipe is null)
        {
            return new StudioResult(StudioOutcome.NotFound);
        }

        // Asking for the state it is already in changes nothing and is not an error.
        if (recipe.IsPublished != publish)
        {
            var problem = Says(recipe, publish ? StudioRules.WhyNotPublish(recipe.Facts) : StudioRules.WhyNotUnpublish(recipe.Facts));
            if (problem is not null)
            {
                return new StudioResult(StudioOutcome.NotAllowed, Problem: problem);
            }

            await studio.SetRecipePublishedAsync(recipeId, publish, clock.GetUtcNow(), cancellationToken);
        }

        return new StudioResult(StudioOutcome.Done, await ReadAsync(callerId, creator, cancellationToken));
    }

    public async Task<StudioResult> SetProductActiveAsync(int callerId, int productId, bool active,
        CancellationToken cancellationToken)
    {
        var creator = await studio.GetCreatorAsync(callerId, cancellationToken);
        if (creator is null)
        {
            return new StudioResult(StudioOutcome.NotACreator);
        }

        var product = (await studio.GetProductsAsync(callerId, cancellationToken)).FirstOrDefault(p => p.Id == productId);
        if (product is null)
        {
            return new StudioResult(StudioOutcome.NotFound);
        }

        if (product.IsActive != active)
        {
            // Retiring is always allowed; going back on sale has rules.
            var problem = active ? Says(product, StudioRules.WhyNotRestore(product.Facts)) : null;
            if (problem is not null)
            {
                return new StudioResult(StudioOutcome.NotAllowed, Problem: problem);
            }

            await studio.SetProductActiveAsync(productId, active, cancellationToken);
        }

        return new StudioResult(StudioOutcome.Done, await ReadAsync(callerId, creator, cancellationToken));
    }

    private async Task<StudioDto> ReadAsync(int creatorId, StudioCreator creator, CancellationToken cancellationToken)
    {
        var recipes = await studio.GetRecipesAsync(creatorId, cancellationToken);
        var products = await studio.GetProductsAsync(creatorId, cancellationToken);
        var sales = await studio.GetSalesAsync(creatorId, cancellationToken);
        var reviews = await studio.GetReviewsAsync(creatorId, cancellationToken);
        var paid = sales.Where(s => s.Status == OrderStatus.Paid).ToList();

        return new StudioDto(
            creator.Handle,
            creator.IsSuspended,
            new StudioStatsDto(
                recipes.Count(r => r.IsPublished),
                recipes.Count(r => !r.IsPublished),
                products.Count(p => p.IsForSale),
                paid.Count,
                paid.Sum(s => s.UnitPriceCents),
                recipes.Sum(r => r.SaveCount)),
            [.. recipes.Select(r => new StudioRecipeDto(r.Id, r.Title, r.Servings, r.IsPublished, r.Visibility, r.SaveCount,
                r.PlanTitles,
                // The problem with the one thing its button does: publish a draft, or unpublish a published recipe.
                Says(r, r.IsPublished ? StudioRules.WhyNotUnpublish(r.Facts) : StudioRules.WhyNotPublish(r.Facts))))],
            [.. products.Select(p => new StudioProductDto(p.Id, p.Title, p.Type, p.PriceCents, p.RecipeCount,
                // A meal plan may serve one recipe on several days, so recipes and meals differ (§3.2, Q5).
                p.Type == ProductType.MealPlan ? p.PlacementCount : null,
                p.IsActive, p.IsForSale, p.Sold,
                p.IsActive ? null : Says(p, StudioRules.WhyNotRestore(p.Facts))))],
            sales,
            reviews);
    }

    private static string? Says(StudioRecipeRow recipe, PublishProblem problem) => problem switch
    {
        PublishProblem.None => null,
        PublishProblem.TakenDownByCookfeed =>
            $"Cookfeed took \"{recipe.Title}\" down, so it cannot be published again from the studio.",
        PublishProblem.NoIngredients => "Add at least one ingredient first.",
        PublishProblem.NoSteps => "Add at least one step first.",
        PublishProblem.InAPlan =>
            $"\"{recipe.Title}\" is in {string.Join(" and ", recipe.PlanTitles)}. Take it out of the plan first.",
        PublishProblem.BoughtByCooks => $"Cooks have bought \"{recipe.Title}\", so it stays published for them.",
        _ => throw new ArgumentOutOfRangeException(nameof(problem), problem, "Unknown publish problem."),
    };

    private static string? Says(StudioProductRow product, RestoreProblem problem) => problem switch
    {
        RestoreProblem.None => null,
        RestoreProblem.RetiredByCookfeed =>
            $"Cookfeed retired \"{product.Title}\", so it cannot go back on sale from the studio.",
        RestoreProblem.NoRecipes => $"\"{product.Title}\" has no recipes. Add at least one first.",
        RestoreProblem.HoldsADraft =>
            $"\"{product.FirstDraftTitle}\" in this plan is not published. Take it out, or publish it, first.",
        _ => throw new ArgumentOutOfRangeException(nameof(problem), problem, "Unknown restore problem."),
    };
}
