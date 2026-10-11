namespace Cookfeed.Domain.Enums;

/// <summary>Who may see a published recipe (DesignDocument.md §3.3).</summary>
public enum RecipeVisibility
{
    /// <summary>In the free feed, the trending list, the storefront and search.</summary>
    Public,

    /// <summary>Only for buyers whose purchase contains it; absent from the feed and search.</summary>
    ProductOnly,
}
