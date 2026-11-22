using Cookfeed.Application.Accounts;
using Cookfeed.Application.Cart;
using Cookfeed.Application.Feed;
using Cookfeed.Application.Orders;
using Cookfeed.Application.Products;
using Cookfeed.Application.Purchases;
using Cookfeed.Application.Recipes;
using Cookfeed.Application.Reviews;
using Cookfeed.Application.Saves;
using Cookfeed.Application.ShoppingList;
using Cookfeed.Application.Storefront;
using Microsoft.Extensions.DependencyInjection;

namespace Cookfeed.Application;

public static class DependencyInjection
{
    /// <summary>Registers the Application services with the API's service container.</summary>
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<FeedService>();
        services.AddScoped<StorefrontService>();
        services.AddScoped<OrderHistoryService>();
        services.AddScoped<ShoppingListService>();
        services.AddScoped<RecipeDetailService>();
        services.AddScoped<CreatorListService>();
        services.AddScoped<ProductListService>();
        services.AddScoped<ProductPageService>();
        services.AddScoped<ProductShoppingListService>();
        services.AddScoped<PurchasesService>();
        services.AddScoped<ProductReviewsService>();
        services.AddScoped<AccountPickerService>();
        services.AddScoped<CartService>();
        services.AddScoped<CheckoutService>();
        services.AddScoped<SaveService>();
        // The clock the services read the time from, so a test can set it.
        services.AddSingleton(TimeProvider.System);
        return services;
    }
}
