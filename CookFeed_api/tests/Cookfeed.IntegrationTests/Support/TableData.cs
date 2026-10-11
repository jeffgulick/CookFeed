namespace Cookfeed.IntegrationTests.Support;

/// <summary>Reads every row of a database as text, so two databases' contents can be compared.</summary>
public static class TableData
{
    /// <summary>One line per row, prefixed with its table: <c>roles | {"id": 1, "name": "HomeCook"}</c>.</summary>
    public static async Task<List<string>> RowsAsync(string connectionString)
    {
        var lines = new List<string>();
        foreach (var table in await SchemaCatalog.TablesAsync(connectionString))
        {
            // Every column is compared, timestamps included: the seed sets every value explicitly, so nothing
            // depends on the moment a database was seeded.
            var rows = await Sql.QueryAsync(connectionString,
                $"SELECT to_jsonb(t)::text FROM \"{table}\" t ORDER BY 1");
            lines.AddRange(rows.Select(row => $"{table} | {row[0]}"));
        }
        return lines;
    }

    /// <summary>
    /// Where each id sequence stands. <c>seed.sql</c> inserts explicit ids and then moves every sequence past
    /// them, so the next row the API inserts gets a fresh id instead of colliding with a seeded one.
    /// </summary>
    public static Task<List<string>> SequencesAsync(string connectionString) => Sql.QueryLinesAsync(connectionString, """
        SELECT sequencename, last_value
        FROM pg_sequences
        WHERE schemaname = 'public'
        ORDER BY 1
        """);
}
