namespace Cookfeed.Api.Configuration;

/// <summary>
/// Reads <c>.env</c>, the git-ignored file that holds this machine's secrets (the database password), into the
/// process's environment. Docker Compose reads the same file for the container, so the password is written in one
/// place and never in a committed file. <c>.env.example</c> shows what the file holds.
/// </summary>
public static class DotEnvFile
{
    private const string FileName = ".env";

    /// <summary>
    /// Finds <c>.env</c> in <paramref name="startFolder"/> or the nearest folder above it and sets each variable it
    /// names, unless the variable is already set: the real environment (a shell, or CI) wins over the file.
    /// With no file, nothing happens.
    /// </summary>
    public static void Load(string startFolder)
    {
        var file = Find(startFolder);
        if (file is null)
        {
            return;
        }

        foreach (var (name, value) in Parse(File.ReadLines(file)))
        {
            if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable(name)))
            {
                Environment.SetEnvironmentVariable(name, value);
            }
        }
    }

    /// <summary>
    /// The <c>NAME=value</c> lines. Blank lines and <c>#</c> comments are skipped, spaces around the name and the value
    /// are trimmed, and one pair of quotes around a value is removed. Only the first <c>=</c> splits a line, so a
    /// value may contain one.
    /// </summary>
    public static IReadOnlyDictionary<string, string> Parse(IEnumerable<string> lines)
    {
        var values = new Dictionary<string, string>();
        foreach (var raw in lines)
        {
            var line = raw.Trim();
            var split = line.IndexOf('=');
            if (line.StartsWith('#') || split <= 0)
            {
                continue;
            }

            values[line[..split].Trim()] = Unquote(line[(split + 1)..].Trim());
        }
        return values;
    }

    private static string? Find(string startFolder)
    {
        for (var folder = new DirectoryInfo(startFolder); folder is not null; folder = folder.Parent)
        {
            var candidate = Path.Combine(folder.FullName, FileName);
            if (File.Exists(candidate))
            {
                return candidate;
            }
        }
        return null;
    }

    private static string Unquote(string value) =>
        value.Length >= 2 && value[0] is '"' or '\'' && value[^1] == value[0] ? value[1..^1] : value;
}
