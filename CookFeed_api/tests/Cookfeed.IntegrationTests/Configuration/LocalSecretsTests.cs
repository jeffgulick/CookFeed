using System.Text.RegularExpressions;
using Cookfeed.Api.Configuration;

namespace Cookfeed.IntegrationTests.Configuration;

/// <summary>
/// Secrets stay out of the repository. The database password lives in <c>CookFeed_api/.env</c>, which git ignores;
/// <see cref="DotEnvFile"/> reads it into the process's environment, and Npgsql takes the password from
/// <c>PGPASSWORD</c> there. These tests cover the reader, and check that no committed file carries a password.
/// </summary>
public sealed partial class LocalSecretsTests : IDisposable
{
    private readonly string _folder = Directory.CreateTempSubdirectory("cookfeed-dotenv-").FullName;
    private readonly string _name = $"COOKFEED_TEST_{Guid.NewGuid():N}";

    [Fact]
    public void Parse_reads_name_value_lines_and_skips_blank_lines_and_comments()
    {
        var values = DotEnvFile.Parse(["# the database", "", "PGPASSWORD=secret", "  PGUSER = postgres  "]);

        Assert.Equal(2, values.Count);
        Assert.Equal("secret", values["PGPASSWORD"]);
        Assert.Equal("postgres", values["PGUSER"]);
    }

    [Fact]
    public void Parse_keeps_an_equals_sign_inside_the_value()
    {
        var values = DotEnvFile.Parse(["CONNECTION=Host=localhost;Port=5432"]);

        Assert.Equal("Host=localhost;Port=5432", values["CONNECTION"]);
    }

    [Theory]
    [InlineData("KEY=\"two words\"")]
    [InlineData("KEY='two words'")]
    public void Parse_takes_the_quotes_off_a_quoted_value(string line)
    {
        Assert.Equal("two words", DotEnvFile.Parse([line])["KEY"]);
    }

    [Fact]
    public void Parse_skips_a_line_with_no_name_or_no_equals_sign()
    {
        Assert.Empty(DotEnvFile.Parse(["=value", "just words"]));
    }

    [Fact]
    public void Load_finds_the_file_in_a_folder_above_and_sets_the_variable()
    {
        File.WriteAllText(Path.Combine(_folder, ".env"), $"{_name}=from-file\n");
        var below = Directory.CreateDirectory(Path.Combine(_folder, "src", "Api")).FullName;

        DotEnvFile.Load(below);

        Assert.Equal("from-file", Environment.GetEnvironmentVariable(_name));
    }

    [Fact]
    public void Load_leaves_a_variable_that_is_already_set()
    {
        // The real environment wins, so CI or a shell can override the file.
        Environment.SetEnvironmentVariable(_name, "from-shell");
        File.WriteAllText(Path.Combine(_folder, ".env"), $"{_name}=from-file\n");

        DotEnvFile.Load(_folder);

        Assert.Equal("from-shell", Environment.GetEnvironmentVariable(_name));
    }

    [Fact]
    public void Load_does_nothing_when_there_is_no_file()
    {
        DotEnvFile.Load(_folder);

        Assert.Null(Environment.GetEnvironmentVariable(_name));
    }

    [Fact]
    public void No_committed_file_carries_a_database_password()
    {
        var api = ApiFolder();
        var files = Directory.EnumerateFiles(api, "*", SearchOption.AllDirectories)
            .Concat(Directory.EnumerateFiles(Path.Combine(api, "..", ".github"), "*", SearchOption.AllDirectories))
            .Concat(Directory.EnumerateFiles(Path.Combine(api, "..", "CookFeed_frontend", "tools")))
            .Where(IsCommittedText);

        var found = new List<string>();
        foreach (var file in files)
        {
            var lineNumber = 0;
            foreach (var line in File.ReadLines(file))
            {
                lineNumber++;
                if (PasswordWithAValue().IsMatch(line))
                {
                    found.Add($"{Path.GetRelativePath(api, file)}:{lineNumber}: {line.Trim()}");
                }
            }
        }

        Assert.True(found.Count == 0, "A password is written in:\n  " + string.Join("\n  ", found));
    }

    // Source, settings, scripts and docs; not build output, packages, or this file (which spells the patterns out).
    private static bool IsCommittedText(string path)
    {
        var parts = path.Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        if (parts.Any(p => p is "bin" or "obj" or "node_modules" or "TestResults") || Path.GetFileName(path) == $"{nameof(LocalSecretsTests)}.cs")
        {
            return false;
        }
        return Path.GetExtension(path) is ".cs" or ".json" or ".yml" or ".yaml" or ".md" or ".sh" or ".sql";
    }

    // CookFeed_api: the folder holding the solution file, found by walking up from the test binaries.
    private static string ApiFolder()
    {
        for (var folder = new DirectoryInfo(AppContext.BaseDirectory); folder is not null; folder = folder.Parent)
        {
            if (File.Exists(Path.Combine(folder.FullName, "Cookfeed.slnx")))
            {
                return folder.FullName;
            }
        }
        throw new InvalidOperationException("Cookfeed.slnx was not found above the test binaries.");
    }

    // "Password=x" in a connection string, "POSTGRES_PASSWORD: x" in YAML, or "PGPASSWORD=x" / "${PGPASSWORD:-x}" in a
    // script, where x is a written-out value: not empty, and not a ${VARIABLE} or a $(command) to be filled in.
    [GeneratedRegex(@"(Password\s*=\s*[^;""'\s$<{]|POSTGRES_PASSWORD\s*:\s*[^\s$]|PGPASSWORD(=|:-)""?[^\s$""}])", RegexOptions.IgnoreCase)]
    private static partial Regex PasswordWithAValue();

    public void Dispose()
    {
        Environment.SetEnvironmentVariable(_name, null);
        Directory.Delete(_folder, recursive: true);
    }
}
