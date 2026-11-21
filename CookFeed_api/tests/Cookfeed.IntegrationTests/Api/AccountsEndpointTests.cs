using System.Net;
using System.Net.Http.Json;
using Cookfeed.Contracts.Accounts;
using Cookfeed.IntegrationTests.Support;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Cookfeed.IntegrationTests.Api;

/// <summary>
/// <c>GET /api/accounts</c>: the accounts the app's sign-in picker offers until login exists (the prototype's
/// <c>signin.html</c>). It is a development aid, like the OpenAPI document: served only where
/// <c>Accounts:PickerEnabled</c> is set (<c>appsettings.Development.json</c>), a 404 everywhere else, and it never
/// sends an email address or a password hash. These tests only read.
/// </summary>
public sealed class AccountsEndpointTests(DatabaseFixture databases) : IAsyncDisposable
{
    private readonly List<WebApplicationFactory<Program>> _factories = [];

    [Fact]
    public async Task Lists_every_account_with_its_roles_and_creator_handle()
    {
        var expected = await Sql.QueryLinesAsync(await databases.EfWithDbSeederAsync(), """
            SELECT u.id, u.display_name,
                   (SELECT string_agg(r.name, ',' ORDER BY r.id) FROM user_roles ur JOIN roles r ON r.id = ur.role_id
                    WHERE ur.user_id = u.id),
                   c.handle
            FROM users u LEFT JOIN creator_profiles c ON c.user_id = u.id
            ORDER BY u.id
            """);

        var accounts = await GetAccountsAsync();

        Assert.Equal(10, expected.Count);
        Assert.Equal(expected, accounts.Select(a => string.Join(" | ", a.Id, a.DisplayName, string.Join(',', a.Roles), a.Handle)));
    }

    [Theory]
    [InlineData("Alex Rivera", "HomeCook", null)]
    [InlineData("Kenji Watanabe", "HomeCook,Creator", "kenji-kitchen")]   // every creator can also shop (§3.1)
    [InlineData("Cookfeed Admin", "Admin", null)]                         // the admin holds no other role
    public async Task Each_kind_of_account_carries_the_roles_the_app_shows_controls_by(string name, string roles, string? handle)
    {
        var account = Assert.Single(await GetAccountsAsync(), a => a.DisplayName == name);

        Assert.Equal((roles, handle), (string.Join(',', account.Roles), account.Handle));
    }

    [Fact]
    public async Task Sends_no_email_address_and_no_password_hash()
    {
        var response = await (await ApiAsync(enabled: true)).CreateClient()
            .GetAsync("/api/accounts", TestContext.Current.CancellationToken);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.DoesNotContain("@", body);
        Assert.DoesNotContain("email", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("password", body, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Without_the_setting_the_list_is_not_served()
    {
        var response = await (await ApiAsync(enabled: false)).CreateClient()
            .GetAsync("/api/accounts", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private async Task<List<AccountDto>> GetAccountsAsync()
    {
        var response = await (await ApiAsync(enabled: true)).CreateClient()
            .GetAsync("/api/accounts", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<List<AccountDto>>(TestContext.Current.CancellationToken))!;
    }

    private async Task<WebApplicationFactory<Program>> ApiAsync(bool enabled)
    {
        WebApplicationFactory<Program> api = new CookfeedApiFactory(await databases.EfWithDbSeederAsync());
        _factories.Add(api);
        if (enabled)
        {
            // The same setting appsettings.Development.json makes; the tests run in the Testing environment.
            api = api.WithWebHostBuilder(builder => builder.UseSetting("Accounts:PickerEnabled", "true"));
            _factories.Add(api);
        }
        return api;
    }

    public async ValueTask DisposeAsync()
    {
        foreach (var factory in _factories)
        {
            await factory.DisposeAsync();
        }
    }
}
