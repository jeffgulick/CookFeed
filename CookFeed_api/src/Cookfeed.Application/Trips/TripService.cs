using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Contracts.ShoppingList;
using Cookfeed.Contracts.Trips;
using Cookfeed.Domain.Access;
using Cookfeed.Domain.ShoppingList;
using TripStatus = Cookfeed.Domain.Enums.TripStatus;

namespace Cookfeed.Application.Trips;

/// <summary>What the repository reads for one list. <see cref="RecipeCount"/> is filled where the items are not.</summary>
public sealed record TripRow(int Id, string Name, TripStatus Status, DateTimeOffset CreatedAt,
    DateTimeOffset? CompletedAt, int RecipeCount, IReadOnlyList<TripItemRow> Items, IReadOnlyList<int> SkippedIngredientIds);

public sealed record TripItemRow(int RecipeId, string Title, int Servings);

/// <summary>A recipe someone wants to shop: the people it is written for, and whether they may cook from it.</summary>
public sealed record RecipeForTrip(int Servings, RecipeAccessFacts Access);

/// <summary>How a shopping-list request ended. Everything but <see cref="Done"/> is a refusal, with nothing written.</summary>
public enum TripOutcome
{
    Done,

    /// <summary>The caller has no list with the id, the recipe is not on it, or nothing asked for can be cooked from.</summary>
    NotFound,

    /// <summary>The caller cannot shop: the admin, or an id no account has.</summary>
    NoShop,

    /// <summary>The list is not in a state that allows this: a done list cannot change, a list being built cannot be finished.</summary>
    NotNow,
}

public sealed record TripResult(TripOutcome Outcome, TripDto? Trip = null, TripsDto? Trips = null,
    ShopResultDto? Shopped = null);

/// <summary>
/// The caller's shopping lists (DesignDocument.md §3.9). There is one list in use at a time, so nothing asks which:
/// "Shop this recipe" and "Shop this plan" add straight to it and make it when there is none. A list's lines are
/// worked out from its recipes each time it is read, with the shopping list's arithmetic (§7.5), never stored.
/// </summary>
public class TripService(ITripRepository trips, TimeProvider clock)
{
    public async Task<TripResult> GetTripsAsync(int callerId, CancellationToken cancellationToken)
    {
        if (!await trips.CanShopAsync(callerId, cancellationToken))
        {
            return new TripResult(TripOutcome.NoShop);
        }

        var all = await trips.GetTripsAsync(callerId, cancellationToken);
        // The list in use is the one being built or shopped; a sent or done list is not it.
        var active = all.FirstOrDefault(t => TripRules.CanChange(t.Status));
        return new TripResult(TripOutcome.Done, Trips: new TripsDto(
            active is null ? null : Summary(active),
            [.. all.Where(t => !TripRules.CanChange(t.Status)).Select(Summary)]));
    }

    public Task<TripResult> GetTripAsync(int callerId, int tripId, CancellationToken cancellationToken) =>
        WithTripAsync(callerId, tripId, _ => true, _ => Task.CompletedTask, cancellationToken);

    /// <summary>
    /// Puts a recipe, or every recipe of a plan the caller owns, on their list, making the list when there is none.
    /// A recipe the caller may not cook from is left out; when nothing is left, nothing is written, so no empty list
    /// is left behind.
    /// </summary>
    public async Task<TripResult> ShopAsync(int callerId, int? recipeId, int? productId, int? servings,
        DateOnly? cooksDay, CancellationToken cancellationToken)
    {
        if (!await trips.CanShopAsync(callerId, cancellationToken))
        {
            return new TripResult(TripOutcome.NoShop);
        }

        // A plan is shopped from the purchase: what the buyer owns, whatever the creator has changed since.
        var asked = recipeId is { } one
            ? [one]
            : await trips.GetPurchasedRecipeIdsAsync(callerId, productId!.Value, cancellationToken);
        if (asked is null)
        {
            return new TripResult(TripOutcome.NotFound);
        }

        // The same rule as saving: a home cook who may open the recipe (the prototype's canPlan).
        var recipes = await trips.GetRecipesAsync(callerId, [.. asked.Distinct()], cancellationToken);
        var wanted = asked
            .Where(id => recipes.TryGetValue(id, out var recipe)
                && RecipeAccess.CanSave(recipe.Access, callerId, viewerCanShop: true))
            .Select(id => new TripItem(id, servings ?? recipes[id].Servings))
            .ToList();
        if (wanted.Count == 0)
        {
            return new TripResult(TripOutcome.NotFound);
        }

        var all = await trips.GetTripsAsync(callerId, cancellationToken);
        var active = all.FirstOrDefault(t => TripRules.CanChange(t.Status));
        var now = clock.GetUtcNow();
        var name = active?.Name
            ?? TripRules.ListName(TripRules.ListDay(cooksDay, DateOnly.FromDateTime(now.UtcDateTime)));
        var tripId = active?.Id ?? await trips.CreateAsync(callerId, name, now, cancellationToken);

        var onList = active is null
            ? []
            : (await trips.GetTripAsync(callerId, tripId, cancellationToken))!.Items.Select(i => i.RecipeId).ToList();
        var toAdd = TripRules.Combine(wanted, onList);
        if (toAdd.Count > 0)
        {
            await trips.AddItemsAsync(tripId, toAdd, cancellationToken);
        }

        return new TripResult(TripOutcome.Done, Shopped: new ShopResultDto(tripId, name, Created: active is null,
            Added: toAdd.Count, AlreadyOnList: wanted.Select(w => w.RecipeId).Distinct().Count() - toAdd.Count));
    }

    public Task<TripResult> SetServingsAsync(int callerId, int tripId, int recipeId, int servings,
        CancellationToken cancellationToken) =>
        WithTripAsync(callerId, tripId,
            trip => TripRules.CanChange(trip.Status),
            _ => trips.SetServingsAsync(tripId, recipeId, servings, cancellationToken),
            cancellationToken,
            onTrip: trip => trip.Items.Any(i => i.RecipeId == recipeId));

    public Task<TripResult> RemoveItemAsync(int callerId, int tripId, int recipeId, CancellationToken cancellationToken) =>
        WithTripAsync(callerId, tripId,
            trip => TripRules.CanChange(trip.Status),
            _ => trips.RemoveItemAsync(tripId, recipeId, cancellationToken),
            cancellationToken);

    /// <summary>"Have it": takes an ingredient the cook has at home off the list, or puts it back.</summary>
    public Task<TripResult> SetSkipAsync(int callerId, int tripId, int ingredientId, bool skipped,
        CancellationToken cancellationToken) =>
        WithTripAsync(callerId, tripId,
            trip => TripRules.CanChange(trip.Status),
            _ => trips.SetSkipAsync(tripId, ingredientId, skipped, cancellationToken),
            cancellationToken);

    public Task<TripResult> StartAsync(int callerId, int tripId, CancellationToken cancellationToken) =>
        WithTripAsync(callerId, tripId,
            trip => TripRules.CanStart(trip.Status),
            _ => trips.SetStatusAsync(tripId, TripStatus.Shopping, null, cancellationToken),
            cancellationToken);

    public Task<TripResult> FinishAsync(int callerId, int tripId, CancellationToken cancellationToken) =>
        WithTripAsync(callerId, tripId,
            trip => TripRules.CanFinish(trip.Status),
            _ => trips.SetStatusAsync(tripId, TripStatus.Done, clock.GetUtcNow(), cancellationToken),
            cancellationToken);

    public async Task<TripResult> DeleteAsync(int callerId, int tripId, CancellationToken cancellationToken)
    {
        if (!await trips.CanShopAsync(callerId, cancellationToken))
        {
            return new TripResult(TripOutcome.NoShop);
        }

        if (await trips.GetTripAsync(callerId, tripId, cancellationToken) is null)
        {
            return new TripResult(TripOutcome.NotFound);
        }

        await trips.DeleteAsync(tripId, cancellationToken);
        return new TripResult(TripOutcome.Done);
    }

    /// <summary>
    /// The shape every request about one list shares: the caller must shop, the list must be theirs, it must be in a
    /// state that allows the change, and the answer is the list as it now is.
    /// </summary>
    private async Task<TripResult> WithTripAsync(int callerId, int tripId, Func<TripRow, bool> allowed,
        Func<TripRow, Task> change, CancellationToken cancellationToken, Func<TripRow, bool>? onTrip = null)
    {
        if (!await trips.CanShopAsync(callerId, cancellationToken))
        {
            return new TripResult(TripOutcome.NoShop);
        }

        // The caller's id is part of the read, so another cook's list is simply not found.
        var trip = await trips.GetTripAsync(callerId, tripId, cancellationToken);
        if (trip is null || onTrip?.Invoke(trip) == false)
        {
            return new TripResult(TripOutcome.NotFound);
        }

        if (!allowed(trip))
        {
            return new TripResult(TripOutcome.NotNow);
        }

        await change(trip);
        var after = (await trips.GetTripAsync(callerId, tripId, cancellationToken))!;
        return new TripResult(TripOutcome.Done, Trip: await DtoAsync(after, cancellationToken));
    }

    private async Task<TripDto> DtoAsync(TripRow trip, CancellationToken cancellationToken)
    {
        // The database sums each ingredient per unit category; the aggregator converts and chooses the unit to shop
        // in. What it could not merge is listed too, as its own line, rather than dropped.
        var list = ShoppingListAggregator.Aggregate(await trips.GetIngredientTotalsAsync(trip.Id, cancellationToken));
        var all = list.Lines.Concat(list.Unmerged)
            .OrderBy(l => l.Aisle, StringComparer.Ordinal)
            .ThenBy(l => l.Ingredient, StringComparer.Ordinal)
            .ThenBy(l => l.Unit, StringComparer.Ordinal)
            .ToList();
        var skipped = trip.SkippedIngredientIds.ToHashSet();

        return new TripDto(
            trip.Id,
            trip.Name,
            ToContract(trip.Status),
            trip.CreatedAt,
            trip.CompletedAt,
            TripRules.CanChange(trip.Status),
            [.. trip.Items.Select(i => new TripItemDto(i.RecipeId, i.Title, i.Servings))],
            [.. all.Where(l => !skipped.Contains(l.IngredientId))
                .Select(l => new ShoppingListLineDto(l.IngredientId, l.Ingredient, l.Aisle, l.Quantity, l.Unit))],
            // Only what the list would otherwise hold: a skip for an ingredient no recipe on it uses is not shown.
            [.. all.Where(l => skipped.Contains(l.IngredientId))
                .Select(l => new TripSkippedDto(l.IngredientId, l.Ingredient)).Distinct()]);
    }

    private static TripSummaryDto Summary(TripRow trip) =>
        new(trip.Id, trip.Name, ToContract(trip.Status), trip.CreatedAt, trip.CompletedAt, trip.RecipeCount);

    private static Contracts.Trips.TripStatus ToContract(TripStatus status) => status switch
    {
        TripStatus.Building => Contracts.Trips.TripStatus.Building,
        TripStatus.Shopping => Contracts.Trips.TripStatus.Shopping,
        TripStatus.Sent => Contracts.Trips.TripStatus.Sent,
        TripStatus.Done => Contracts.Trips.TripStatus.Done,
        _ => throw new ArgumentOutOfRangeException(nameof(status), status, "Unknown trip status."),
    };
}
