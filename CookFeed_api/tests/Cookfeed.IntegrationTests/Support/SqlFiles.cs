using System.Text.RegularExpressions;

namespace Cookfeed.IntegrationTests.Support;

/// <summary>
/// The reference SQL from <c>docs/</c>: <c>schema.sql</c>, <c>sql/seed.sql</c> and <c>sql/queries.sql</c>,
/// read from the copies placed next to the test binaries.
/// </summary>
public static partial class SqlFiles
{
    public static string Schema => Read("schema.sql");

    public static string Seed => Read("seed.sql");

    /// <summary>
    /// One query from <c>queries.sql</c>, by its number: <c>Query(8)</c> is the block headed <c>-- Q8.</c>,
    /// up to the next <c>-- Q</c> heading. Q17 is a set of statements that are meant to fail, so tests
    /// write those out explicitly instead of reading them from here.
    /// </summary>
    public static string Query(int number) =>
        Queries.TryGetValue(number, out var sql)
            ? sql
            : throw new ArgumentOutOfRangeException(nameof(number), $"queries.sql has no Q{number}.");

    /// <summary>The numbers of the read-only queries, Q1 through Q16.</summary>
    public static IEnumerable<int> ReadOnlyQueryNumbers => Queries.Keys.Where(n => n <= 16).Order();

    private static readonly Lazy<Dictionary<int, string>> LazyQueries = new(SplitQueries);

    private static Dictionary<int, string> Queries => LazyQueries.Value;

    private static Dictionary<int, string> SplitQueries()
    {
        var text = Read("queries.sql");
        var headings = QueryHeading().Matches(text);
        var queries = new Dictionary<int, string>();
        for (var i = 0; i < headings.Count; i++)
        {
            var start = headings[i].Index;
            var end = i + 1 < headings.Count ? headings[i + 1].Index : text.Length;
            queries[int.Parse(headings[i].Groups[1].Value)] = text[start..end];
        }
        return queries;
    }

    private static string Read(string fileName) =>
        File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Sql", fileName));

    [GeneratedRegex(@"^-- Q(\d+)\.", RegexOptions.Multiline)]
    private static partial Regex QueryHeading();
}
