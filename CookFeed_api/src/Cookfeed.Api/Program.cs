using Cookfeed.Infrastructure;
using Cookfeed.Infrastructure.Persistence.Seed;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("Cookfeed")
    ?? throw new InvalidOperationException("Connection string 'Cookfeed' is not configured.");

builder.Services.AddInfrastructure(connectionString);
builder.Services.AddControllers();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    // Fill an empty development database with the docs/sql/seed.sql data. Does nothing once it has data.
    // The database must already be migrated: dotnet ef database update (see DOCKER.md).
    using var scope = app.Services.CreateScope();
    await scope.ServiceProvider.GetRequiredService<DbSeeder>().SeedAsync();
}

app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

app.Run();

// Lets the integration tests start the API in memory with WebApplicationFactory<Program>.
public partial class Program;
