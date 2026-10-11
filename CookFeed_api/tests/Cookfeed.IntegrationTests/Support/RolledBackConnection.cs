using Npgsql;

namespace Cookfeed.IntegrationTests.Support;

/// <summary>
/// A connection with an open transaction that is always rolled back. A test can insert, update and delete
/// freely, and the shared database is unchanged afterwards, so tests cannot affect one another.
/// </summary>
public sealed class RolledBackConnection : IAsyncDisposable
{
    private readonly NpgsqlTransaction _transaction;

    private RolledBackConnection(NpgsqlConnection connection, NpgsqlTransaction transaction)
    {
        Connection = connection;
        _transaction = transaction;
    }

    public NpgsqlConnection Connection { get; }

    public static async Task<RolledBackConnection> OpenAsync(string connectionString)
    {
        var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        return new RolledBackConnection(connection, await connection.BeginTransactionAsync());
    }

    public Task ExecuteAsync(string sql) => Sql.ExecuteAsync(Connection, sql);

    public Task<List<string?[]>> QueryAsync(string sql) => Sql.QueryAsync(Connection, sql);

    public Task<T> ScalarAsync<T>(string sql) => Sql.ScalarAsync<T>(Connection, sql);

    /// <summary>Runs a statement that must be refused, and returns PostgreSQL's error for the test to inspect.</summary>
    public Task<PostgresException> RefusedAsync(string sql) =>
        Assert.ThrowsAsync<PostgresException>(() => ExecuteAsync(sql));

    public async ValueTask DisposeAsync()
    {
        await _transaction.RollbackAsync();
        await Connection.DisposeAsync();
    }
}
