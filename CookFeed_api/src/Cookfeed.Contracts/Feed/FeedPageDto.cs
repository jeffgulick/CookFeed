namespace Cookfeed.Contracts.Feed;

/// <summary>One page of the feed. <see cref="HasMore"/> says whether asking for the next page is worthwhile.</summary>
public sealed record FeedPageDto(IReadOnlyList<FeedItemDto> Items, int Page, int PageSize, bool HasMore);
