using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cookfeed.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class WeekShopped : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "shopped_at",
                table: "meal_plans",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "shopped_at",
                table: "meal_plans");
        }
    }
}
