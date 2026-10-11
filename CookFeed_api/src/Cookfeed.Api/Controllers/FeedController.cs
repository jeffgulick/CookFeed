using System.ComponentModel.DataAnnotations;
using Cookfeed.Application.Feed;
using Cookfeed.Contracts.Feed;
using Microsoft.AspNetCore.Mvc;

namespace Cookfeed.Api.Controllers;

/// <summary>The recipe feed: published Public recipes, newest or trending, one page at a time.</summary>
[ApiController]
[Route("api/feed")]
public class FeedController(FeedService feed) : ControllerBase
{
    // [ApiController] checks the [Range] attributes and the types (an unknown sort name, a non-numeric user id)
    // before this method runs, and answers 400 with a ProblemDetails body naming the bad parameter.
    // X-User-Id is optional here: it only marks the viewer's own saves, so no one else's data is exposed.
    [HttpGet]
    public Task<FeedPageDto> Get(
        [FromQuery] FeedSort sort = FeedSort.Newest,
        [FromQuery, Range(1, FeedService.MaxPage)] int page = 1,
        [FromQuery, Range(1, FeedService.MaxPageSize)] int pageSize = 20,
        [FromHeader(Name = "X-User-Id")] int? viewerId = null,
        CancellationToken cancellationToken = default) =>
        feed.GetFeedAsync(sort, page, pageSize, viewerId, cancellationToken);
}
