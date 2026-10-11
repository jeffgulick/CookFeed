using System.Text;

namespace Cookfeed.IntegrationTests.Support;

public static class AssertSame
{
    /// <summary>
    /// Fails unless both lists hold the same lines, ignoring order. The failure message lists exactly what
    /// is missing from <paramref name="actual"/> and what it has that <paramref name="expected"/> does not,
    /// which is far easier to act on than "the lists differ".
    /// </summary>
    public static void Lines(IEnumerable<string> expected, IEnumerable<string> actual, string what,
        string expectedSource, string actualSource)
    {
        var expectedList = expected.ToList();
        var actualList = actual.ToList();
        var missing = Subtract(expectedList, actualList);
        var extra = Subtract(actualList, expectedList);
        if (missing.Count == 0 && extra.Count == 0)
        {
            return;
        }

        var message = new StringBuilder($"{what}: the {actualSource} differs from the {expectedSource}.");
        Append(message, $"In the {expectedSource} but not the {actualSource}", missing);
        Append(message, $"In the {actualSource} but not the {expectedSource}", extra);
        Assert.Fail(message.ToString());
    }

    // Multiset difference: a line that appears twice on one side and once on the other is reported once.
    private static List<string> Subtract(List<string> from, List<string> remove)
    {
        var remaining = from.ToList();
        foreach (var line in remove)
        {
            remaining.Remove(line);
        }
        return remaining;
    }

    private static void Append(StringBuilder message, string heading, List<string> lines)
    {
        if (lines.Count == 0)
        {
            return;
        }
        message.AppendLine().AppendLine().Append(heading).Append($" ({lines.Count}):");
        foreach (var line in lines)
        {
            message.AppendLine().Append("  ").Append(line);
        }
    }
}
