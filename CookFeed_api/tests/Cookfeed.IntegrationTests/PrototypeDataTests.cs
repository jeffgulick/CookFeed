using System.Text.Json.Nodes;
using Cookfeed.IntegrationTests.Support;
using Npgsql;

namespace Cookfeed.IntegrationTests;

/// <summary>
/// The prototype's data (<c>CookFeed_frontend/prototype/js/seed-data.js</c>) is generated from the seeded
/// database by <c>CookFeed_frontend/tools/export-seed-data.sh</c>. This test runs the same export query against a
/// database seeded by <c>DbSeeder</c> and fails if the committed file no longer matches it, so the website and
/// the database cannot drift apart: a seed change without a re-export, or a hand edit to the file, turns CI red.
/// </summary>
public class PrototypeDataTests(DatabaseFixture databases)
{
    [Fact]
    public async Task Seed_data_js_matches_the_seeded_database()
    {
        var frontend = Path.Combine(RepositoryRoot(), "CookFeed_frontend");
        var exportSql = await File.ReadAllTextAsync(Path.Combine(frontend, "tools", "export-seed-data.sql"),
            TestContext.Current.CancellationToken);
        var committed = await File.ReadAllTextAsync(Path.Combine(frontend, "prototype", "js", "seed-data.js"),
            TestContext.Current.CancellationToken);

        // The export script runs with PGTZ=UTC, so timestamps are compared in UTC here too.
        var connectionString = new NpgsqlConnectionStringBuilder(await databases.EfWithDbSeederAsync()) { Timezone = "UTC" };
        await using var connection = new NpgsqlConnection(connectionString.ConnectionString);
        await connection.OpenAsync(TestContext.Current.CancellationToken);
        var exported = await Sql.ScalarAsync<string>(connection, exportSql);

        var expected = JsonNode.Parse(exported)!.AsObject();
        var actual = JsonNode.Parse(ObjectLiteral(committed))!.AsObject();

        var stale = expected.Select(t => t.Key)
            .Union(actual.Select(t => t.Key))
            .Where(table => !JsonNode.DeepEquals(expected[table], actual[table]))
            .Order()
            .ToList();
        Assert.True(stale.Count == 0,
            $"prototype/js/seed-data.js is out of date for: {string.Join(", ", stale)}. " +
            "Re-seed the development database and run CookFeed_frontend/tools/export-seed-data.sh.");
    }

    // The file is "window.COOKFEED_SEED = { ... };" after a comment that contains no braces.
    private static string ObjectLiteral(string script) =>
        script[script.IndexOf('{', script.IndexOf("COOKFEED_SEED", StringComparison.Ordinal))..(script.LastIndexOf('}') + 1)];

    // The repository root is the first folder above the test binaries that holds CookFeed_frontend.
    private static string RepositoryRoot()
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            if (Directory.Exists(Path.Combine(dir.FullName, "CookFeed_frontend")))
            {
                return dir.FullName;
            }
        }
        throw new DirectoryNotFoundException("No CookFeed_frontend folder above " + AppContext.BaseDirectory);
    }
}
