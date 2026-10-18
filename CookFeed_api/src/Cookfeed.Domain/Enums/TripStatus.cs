namespace Cookfeed.Domain.Enums;

/// <summary>
/// Where a shopping trip is in its life (§3.9): being built, being shopped in the store, sent to a delivery
/// partner, or done, which clears it from the cook's active trips and keeps it as history.
/// </summary>
public enum TripStatus
{
    Building,
    Shopping,
    Sent,
    Done,
}
