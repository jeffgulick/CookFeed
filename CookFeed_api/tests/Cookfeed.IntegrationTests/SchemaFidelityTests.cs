using Cookfeed.IntegrationTests.Support;

namespace Cookfeed.IntegrationTests;

/// <summary>
/// The EF Core migration must build exactly the database <c>docs/schema.sql</c> describes
/// (DOCKER.md, fidelity test step 3). Each test compares one kind of object between a database built by
/// the migration and one built by <c>schema.sql</c>, and on failure lists precisely what differs.
/// </summary>
public class SchemaFidelityTests(DatabaseFixture databases)
{
    [Fact]
    public Task Tables_match_schema_sql() => CompareAsync("Tables", SchemaCatalog.TablesAsync);

    [Fact]
    public Task Columns_match_schema_sql() => CompareAsync("Columns", SchemaCatalog.ColumnsAsync);

    [Fact]
    public Task Indexes_match_schema_sql() => CompareAsync("Indexes", SchemaCatalog.IndexesAsync);

    [Fact]
    public Task Check_constraints_match_schema_sql() => CompareAsync("Check constraints", SchemaCatalog.CheckConstraintsAsync);

    [Fact]
    public Task Primary_and_foreign_keys_match_schema_sql() => CompareAsync("Primary and foreign keys", SchemaCatalog.KeysAsync);

    [Fact]
    public Task Trigger_functions_match_schema_sql() => CompareAsync("Trigger functions", SchemaCatalog.FunctionsAsync);

    [Fact]
    public Task Triggers_match_schema_sql() => CompareAsync("Triggers", SchemaCatalog.TriggersAsync);

    private async Task CompareAsync(string what, Func<string, Task<List<string>>> describe)
    {
        var reference = await describe(await databases.ReferenceSchemaAsync());
        var migrated = await describe(await databases.EfMigratedAsync());

        AssertSame.Lines(reference, migrated, what, expectedSource: "schema.sql database", actualSource: "EF Core migration");
    }
}
