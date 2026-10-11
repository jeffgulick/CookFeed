using Cookfeed.Application.Feed;
using Microsoft.Extensions.DependencyInjection;

namespace Cookfeed.Application;

public static class DependencyInjection
{
    /// <summary>Registers the Application services with the API's service container.</summary>
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<FeedService>();
        return services;
    }
}
