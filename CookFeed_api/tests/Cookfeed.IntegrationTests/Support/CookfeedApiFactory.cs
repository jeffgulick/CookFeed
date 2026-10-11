using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Cookfeed.IntegrationTests.Support;

/// <summary>
/// The whole API, started in memory against one of the test databases. <see cref="WebApplicationFactory{T}"/>
/// runs <c>Program.cs</c> as it is, with an in-memory server in place of Kestrel; <c>CreateClient()</c>
/// returns an <see cref="HttpClient"/> wired straight to it, so tests exercise routing, model binding,
/// validation and JSON exactly as the Angular app will.
/// </summary>
public sealed class CookfeedApiFactory(string connectionString) : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // UseSetting is applied before Program.cs reads its configuration, so this replaces the connection string
        // from appsettings. "Testing" is not Development, so the startup seeder leaves the database alone.
        builder.UseSetting("ConnectionStrings:Cookfeed", connectionString);
        builder.UseEnvironment("Testing");
    }
}
