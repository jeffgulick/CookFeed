namespace Cookfeed.Contracts.Feed;

/// <summary>The two orders the feed can be read in (docs/Queries.md §1).</summary>
public enum FeedSort
{
    /// <summary>Most recently published first.</summary>
    Newest,

    /// <summary>Most saved first; newest wins a tie, as in queries.sql Q3.</summary>
    Trending,
}
