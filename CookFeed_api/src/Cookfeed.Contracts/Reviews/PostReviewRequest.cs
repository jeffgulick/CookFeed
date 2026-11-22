using System.ComponentModel.DataAnnotations;

namespace Cookfeed.Contracts.Reviews;

/// <summary>
/// A new review, as the review form sends it. The reviewer is the caller and the name shown is their account's,
/// so neither is in the body.
/// </summary>
/// <param name="Rating">1 to 5 stars.</param>
/// <param name="Recommends">Whether the reviewer would recommend the product to another home cook.</param>
/// <param name="Body">15 to 2,000 characters, not counting spaces around it.</param>
public sealed record PostReviewRequest(
    [Range(1, 5)] int Rating,
    bool Recommends,
    [Required, StringLength(PostReviewRequest.MaxBodyLength, MinimumLength = PostReviewRequest.MinBodyLength)] string Body)
{
    public const int MinBodyLength = 15;
    public const int MaxBodyLength = 2000;
}
