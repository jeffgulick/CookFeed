using Microsoft.EntityFrameworkCore;

namespace Cookfeed.Infrastructure.Persistence;

/// <summary>
/// The EF Core session with the Cookfeed database. Each table is mapped by its own
/// <c>IEntityTypeConfiguration</c> class in <c>Persistence/Configurations</c>.
/// </summary>
public class CookfeedDbContext(DbContextOptions<CookfeedDbContext> options) : DbContext(options)
{
}
