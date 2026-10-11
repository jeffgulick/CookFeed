using Npgsql;

namespace Cookfeed.IntegrationTests.Support;

/// <summary>
/// The PostgreSQL server the integration tests run against. By default it is the Docker container from
/// <c>docker-compose.yml</c>; set <c>COOKFEED_TEST_CONNECTION</c> to use a different server.
/// Every test database is created fresh with a unique name and dropped afterwards, so tests never touch
/// the development database or each other's data.
/// </summary>
public static class TestDatabaseServer
{
    private const string DefaultConnection =
        "Host=localhost;Port=5432;Database=cookfeed_test;Username=postgres;Password=postgres";

    private static string ServerConnection =>
        Environment.GetEnvironmentVariable("COOKFEED_TEST_CONNECTION") is { Length: > 0 } fromEnvironment
            ? fromEnvironment
            : DefaultConnection;

    /// <summary>Creates an empty database and returns the connection string for it.</summary>
    public static async Task<string> CreateDatabaseAsync(string purpose)
    {
        var name = $"cookfeed_test_{purpose}_{Guid.NewGuid().ToString("N")[..12]}";
        await ExecuteOnServerAsync($"CREATE DATABASE \"{name}\"");
        return new NpgsqlConnectionStringBuilder(ServerConnection) { Database = name }.ConnectionString;
    }

    /// <summary>Drops a database created by <see cref="CreateDatabaseAsync"/>, disconnecting anything still attached.</summary>
    public static async Task DropDatabaseAsync(string connectionString)
    {
        NpgsqlConnection.ClearAllPools();
        var name = new NpgsqlConnectionStringBuilder(connectionString).Database;
        await ExecuteOnServerAsync($"DROP DATABASE IF EXISTS \"{name}\" WITH (FORCE)");
    }

    private static async Task ExecuteOnServerAsync(string sql)
    {
        // CREATE and DROP DATABASE cannot run inside the database they act on, so connect to "postgres".
        var builder = new NpgsqlConnectionStringBuilder(ServerConnection) { Database = "postgres", Pooling = false };
        await using var connection = new NpgsqlConnection(builder.ConnectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync();
    }
}
