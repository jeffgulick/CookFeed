using System.Globalization;
using Npgsql;

namespace Cookfeed.IntegrationTests.Support;

/// <summary>Small helpers for running SQL in tests and reading the results as plain text.</summary>
public static class Sql
{
    public static async Task ExecuteAsync(string connectionString, string sql)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        await ExecuteAsync(connection, sql);
    }

    public static async Task ExecuteAsync(NpgsqlConnection connection, string sql)
    {
        await using var command = new NpgsqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync();
    }

    /// <summary>Runs a query and returns every row as a list of values, each converted to invariant text.</summary>
    public static async Task<List<string?[]>> QueryAsync(string connectionString, string sql)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        return await QueryAsync(connection, sql);
    }

    public static async Task<List<string?[]>> QueryAsync(NpgsqlConnection connection, string sql)
    {
        await using var command = new NpgsqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync();
        var rows = new List<string?[]>();
        while (await reader.ReadAsync())
        {
            var row = new string?[reader.FieldCount];
            for (var i = 0; i < reader.FieldCount; i++)
            {
                row[i] = reader.IsDBNull(i) ? null : Convert.ToString(reader.GetValue(i), CultureInfo.InvariantCulture);
            }
            rows.Add(row);
        }
        return rows;
    }

    /// <summary>Runs a query and returns each row joined into one line, e.g. <c>"users | email | NOT NULL"</c>.</summary>
    public static async Task<List<string>> QueryLinesAsync(string connectionString, string sql) =>
        (await QueryAsync(connectionString, sql)).Select(row => string.Join(" | ", row)).ToList();

    public static async Task<T> ScalarAsync<T>(NpgsqlConnection connection, string sql)
    {
        await using var command = new NpgsqlCommand(sql, connection);
        return (T)(await command.ExecuteScalarAsync())!;
    }
}
