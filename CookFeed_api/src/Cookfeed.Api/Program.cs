using Cookfeed.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("Cookfeed")
    ?? throw new InvalidOperationException("Connection string 'Cookfeed' is not configured.");

builder.Services.AddInfrastructure(connectionString);
builder.Services.AddControllers();

var app = builder.Build();

app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

app.Run();

// Lets the integration tests start the API in memory with WebApplicationFactory<Program>.
public partial class Program;
