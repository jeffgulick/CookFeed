using Cookfeed.Api.OpenApi;
using Cookfeed.Application;
using Cookfeed.Infrastructure;
using Cookfeed.Infrastructure.Persistence.Seed;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("Cookfeed")
    ?? throw new InvalidOperationException("Connection string 'Cookfeed' is not configured.");

builder.Services.AddApplication();
builder.Services.AddInfrastructure(connectionString);
builder.Services.AddControllers();
// Every error is a ProblemDetails body (application/problem+json): validation errors already are, and with this
// so are unknown routes and unexpected failures, which otherwise come back as an empty body.
builder.Services.AddProblemDetails();

// The web origins a browser may call the API from: the Angular dev server in Development (appsettings.Development.json),
// whatever a deployment configures, and none otherwise. The caller header, the login token's header and PUT/DELETE make
// the browser send a preflight OPTIONS request first, so the policy names them. No cookies, so no AllowCredentials.
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options => options.AddPolicy(CorsPolicy, policy => policy
    .WithOrigins(allowedOrigins)
    .WithHeaders("Content-Type", "X-User-Id", "Authorization")
    .WithMethods("GET", "POST", "PUT", "DELETE")));

// The OpenAPI description of every endpoint, from which the Angular client's types are generated. Served only where
// OpenApi:Enabled is set (appsettings.Development.json): it is a tool for building the app, not a public map of the API.
builder.Services.AddOpenApi(options => options.AddOperationTransformer<CallerHeaderTransformer>());

var app = builder.Build();

// An unexpected exception becomes a 500 ProblemDetails without its message or stack trace; an empty error response
// (a 404 for an unknown route, say) gets a ProblemDetails body.
app.UseExceptionHandler();
app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    // Fill an empty development database with the docs/sql/seed.sql data. Does nothing once it has data.
    // The database must already be migrated: dotnet ef database update (see DOCKER.md).
    using var scope = app.Services.CreateScope();
    await scope.ServiceProvider.GetRequiredService<DbSeeder>().SeedAsync();
}

// Redirect to HTTPS, and tell browsers to stay on it, outside Development only. Locally the API serves plain
// HTTP, and a redirect there would break the Angular dev server's cross-origin requests.
if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
    app.UseHttpsRedirection();
}
// After the error handlers, so error responses carry the CORS header too and the app can read their ProblemDetails.
app.UseCors(CorsPolicy);
app.UseAuthorization();
app.MapControllers();
if (app.Configuration.GetValue<bool>("OpenApi:Enabled"))
{
    app.MapOpenApi();
}

app.Run();

// Lets the integration tests start the API in memory with WebApplicationFactory<Program>.
public partial class Program
{
    private const string CorsPolicy = "Angular";
}
