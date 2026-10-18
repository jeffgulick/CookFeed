using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Cookfeed.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AdminModeration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "hidden_at",
                table: "reviews",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "suspended_at",
                table: "creator_profiles",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "admin_actions",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    admin_user_id = table.Column<int>(type: "integer", nullable: false),
                    action = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    target_table = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    target_id = table.Column<int>(type: "integer", nullable: false),
                    note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_admin_actions", x => x.id);
                    table.ForeignKey(
                        name: "fk_admin_actions_users_admin_user_id",
                        column: x => x.admin_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_admin_actions_admin_user_id_created_at",
                table: "admin_actions",
                columns: new[] { "admin_user_id", "created_at" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "ix_admin_actions_target_table_target_id",
                table: "admin_actions",
                columns: new[] { "target_table", "target_id" });

            // Copied verbatim from docs/schema.sql; EF Core does not model triggers.
            migrationBuilder.Sql("""
            -- Only an Admin account writes the audit trail (§3.8).
            CREATE FUNCTION trg_admin_actions_admin_only() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
                               WHERE ur.user_id = NEW.admin_user_id AND r.name = 'Admin') THEN
                    RAISE EXCEPTION 'User % is not an admin, so cannot write admin_actions', NEW.admin_user_id
                        USING ERRCODE = 'check_violation', CONSTRAINT = 'ck_admin_actions_admin_only';
                END IF;
                RETURN NEW;
            END $$;
            CREATE TRIGGER admin_actions_admin_only
                BEFORE INSERT OR UPDATE ON admin_actions
                FOR EACH ROW EXECUTE FUNCTION trg_admin_actions_admin_only();
            """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
            DROP TRIGGER admin_actions_admin_only ON admin_actions;
            DROP FUNCTION trg_admin_actions_admin_only();
            """);
            migrationBuilder.DropTable(
                name: "admin_actions");

            migrationBuilder.DropColumn(
                name: "hidden_at",
                table: "reviews");

            migrationBuilder.DropColumn(
                name: "suspended_at",
                table: "creator_profiles");
        }
    }
}
