using Cookfeed.IntegrationTests.Support;

namespace Cookfeed.IntegrationTests;

/// <summary>
/// <c>DbSeeder</c> is the C# version of <c>docs/sql/seed.sql</c> (DesignDocument.md §1). These tests hold
/// it to that: a database seeded by <c>DbSeeder</c> must contain exactly what one seeded by <c>seed.sql</c>
/// contains, row for row and id for id, and running it again must change nothing.
/// </summary>
public class SeederTests(DatabaseFixture databases)
{
    [Fact]
    public async Task Seeder_inserts_exactly_the_rows_seed_sql_inserts()
    {
        var fromScript = await TableData.RowsAsync(await databases.EfWithSeedScriptAsync());
        var fromSeeder = await TableData.RowsAsync(await databases.EfWithDbSeederAsync());

        AssertSame.Lines(fromScript, fromSeeder, "Seeded rows", expectedSource: "seed.sql database", actualSource: "DbSeeder database");
    }

    [Fact]
    public async Task Seeder_leaves_every_id_sequence_where_seed_sql_does()
    {
        var fromScript = await TableData.SequencesAsync(await databases.EfWithSeedScriptAsync());
        var fromSeeder = await TableData.SequencesAsync(await databases.EfWithDbSeederAsync());

        AssertSame.Lines(fromScript, fromSeeder, "Id sequences", expectedSource: "seed.sql database", actualSource: "DbSeeder database");
    }

    [Fact]
    public async Task Running_the_seeder_twice_changes_nothing()
    {
        // The API seeds on every startup in Development, so a second run must leave the data alone.
        var connectionString = await databases.CreateMigratedDatabaseAsync("seed_twice");
        await DatabaseFixture.SeedWithDbSeederAsync(connectionString);
        var afterFirstRun = await TableData.RowsAsync(connectionString);

        await DatabaseFixture.SeedWithDbSeederAsync(connectionString);

        AssertSame.Lines(afterFirstRun, await TableData.RowsAsync(connectionString), "Seeded rows",
            expectedSource: "first seeding", actualSource: "second seeding");
    }
}
