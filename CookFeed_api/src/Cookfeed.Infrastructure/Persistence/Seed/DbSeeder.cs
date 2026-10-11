namespace Cookfeed.Infrastructure.Persistence.Seed;

/// <summary>
/// Loads the same rows as <c>docs/sql/seed.sql</c> into an empty, migrated database.
/// </summary>
public class DbSeeder(CookfeedDbContext db)
{
    private readonly CookfeedDbContext _db = db;

    public Task SeedAsync(CancellationToken cancellationToken = default) =>
        throw new NotImplementedException($"Seeding {_db.GetType().Name} is not written yet.");
}
