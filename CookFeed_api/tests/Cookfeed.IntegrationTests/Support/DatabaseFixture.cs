using System.Collections.Concurrent;
using Cookfeed.Infrastructure;
using Cookfeed.Infrastructure.Persistence;
using Cookfeed.Infrastructure.Persistence.Seed;
using Microsoft.EntityFrameworkCore;

[assembly: AssemblyFixture(typeof(Cookfeed.IntegrationTests.Support.DatabaseFixture))]

namespace Cookfeed.IntegrationTests.Support;

/// <summary>
/// Builds the databases the tests compare, once per test run, and drops them all at the end.
/// Each one is built the first time a test asks for it, so a test only fails because of the database
/// it actually uses.
/// <list type="bullet">
/// <item><see cref="EfMigratedAsync"/>: the EF Core migration, no rows.</item>
/// <item><see cref="ReferenceSchemaAsync"/>: <c>docs/schema.sql</c>, no rows.</item>
/// <item><see cref="EfWithSeedScriptAsync"/>: the EF Core migration, then <c>docs/sql/seed.sql</c>.</item>
/// <item><see cref="ReferenceWithSeedScriptAsync"/>: <c>docs/schema.sql</c>, then <c>docs/sql/seed.sql</c>.</item>
/// <item><see cref="EfWithDbSeederAsync"/>: the EF Core migration, then <c>DbSeeder</c>.</item>
/// </list>
/// Tests that change rows do so inside a transaction they roll back, so these databases keep the rows they
/// were built with. Only the EF Core + seed.sql database is written to that way; the reference databases are
/// only ever read, so their id sequences also stay exactly as built.
/// </summary>
public sealed class DatabaseFixture : IAsyncLifetime
{
    private readonly ConcurrentBag<string> _created = [];
    private readonly Lazy<Task<string>> _efMigrated;
    private readonly Lazy<Task<string>> _referenceSchema;
    private readonly Lazy<Task<string>> _efWithSeedScript;
    private readonly Lazy<Task<string>> _referenceWithSeedScript;
    private readonly Lazy<Task<string>> _efWithDbSeeder;

    public DatabaseFixture()
    {
        _efMigrated = new(() => CreateMigratedDatabaseAsync("ef"));
        _referenceSchema = new(() => CreateReferenceDatabaseAsync("ref"));
        _efWithSeedScript = new(async () =>
        {
            var connectionString = await CreateMigratedDatabaseAsync("ef_seedsql");
            await Sql.ExecuteAsync(connectionString, SqlFiles.Seed);
            return connectionString;
        });
        _referenceWithSeedScript = new(async () =>
        {
            var connectionString = await CreateReferenceDatabaseAsync("ref_seedsql");
            await Sql.ExecuteAsync(connectionString, SqlFiles.Seed);
            return connectionString;
        });
        _efWithDbSeeder = new(async () =>
        {
            var connectionString = await CreateMigratedDatabaseAsync("ef_seeder");
            await SeedWithDbSeederAsync(connectionString);
            return connectionString;
        });
    }

    public Task<string> EfMigratedAsync() => _efMigrated.Value;

    public Task<string> ReferenceSchemaAsync() => _referenceSchema.Value;

    public Task<string> EfWithSeedScriptAsync() => _efWithSeedScript.Value;

    public Task<string> ReferenceWithSeedScriptAsync() => _referenceWithSeedScript.Value;

    public Task<string> EfWithDbSeederAsync() => _efWithDbSeeder.Value;

    /// <summary>A new, empty database built by the EF Core migration, for a test that needs its own.</summary>
    public async Task<string> CreateMigratedDatabaseAsync(string purpose)
    {
        var connectionString = await TestDatabaseServer.CreateDatabaseAsync(purpose);
        _created.Add(connectionString);
        await using var db = CreateDbContext(connectionString);
        await db.Database.MigrateAsync();
        return connectionString;
    }

    public static CookfeedDbContext CreateDbContext(string connectionString)
    {
        var options = new DbContextOptionsBuilder<CookfeedDbContext>();
        options.UseCookfeedDatabase(connectionString);
        return new CookfeedDbContext(options.Options);
    }

    public static async Task SeedWithDbSeederAsync(string connectionString)
    {
        await using var db = CreateDbContext(connectionString);
        await new DbSeeder(db).SeedAsync();
    }

    private async Task<string> CreateReferenceDatabaseAsync(string purpose)
    {
        var connectionString = await TestDatabaseServer.CreateDatabaseAsync(purpose);
        _created.Add(connectionString);
        await Sql.ExecuteAsync(connectionString, SqlFiles.Schema);
        return connectionString;
    }

    public ValueTask InitializeAsync() => ValueTask.CompletedTask;

    public async ValueTask DisposeAsync()
    {
        foreach (var connectionString in _created)
        {
            await TestDatabaseServer.DropDatabaseAsync(connectionString);
        }
    }
}
