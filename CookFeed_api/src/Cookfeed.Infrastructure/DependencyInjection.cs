using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Infrastructure.Persistence;
using Cookfeed.Infrastructure.Persistence.Repositories;
using Cookfeed.Infrastructure.Persistence.Seed;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Cookfeed.Infrastructure;

public static class DependencyInjection
{
    /// <summary>Registers the database and everything in Infrastructure with the API's service container.</summary>
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, string connectionString)
    {
        services.AddDbContext<CookfeedDbContext>(options => options.UseCookfeedDatabase(connectionString));
        services.AddScoped<DbSeeder>();

        // Scoped: one repository per HTTP request, sharing that request's DbContext.
        services.AddScoped<IRecipeRepository, RecipeRepository>();
        services.AddScoped<ICreatorRepository, CreatorRepository>();
        services.AddScoped<IOrderRepository, OrderRepository>();
        services.AddScoped<IShoppingListRepository, ShoppingListRepository>();
        return services;
    }

    /// <summary>
    /// How Cookfeed talks to PostgreSQL. Shared by the API and the integration tests so both build the
    /// database the same way: Npgsql, with C# names like <c>SaveCount</c> mapped to <c>save_count</c>.
    /// </summary>
    public static DbContextOptionsBuilder UseCookfeedDatabase(this DbContextOptionsBuilder options, string connectionString) =>
        options.UseNpgsql(connectionString).UseSnakeCaseNamingConvention();
}
