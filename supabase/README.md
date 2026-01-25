# Local Supabase Setup

Local Supabase instance for Prompt Workbench development.

## Quick Start

```bash
# Start all services
cd supabase
docker compose up -d

# Check status
docker compose ps

# Stop services
docker compose down

# Stop and remove all data
docker compose down -v
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| Kong (API Gateway) | 54321 | Main API endpoint |
| PostgreSQL | 54322 | Database (direct connection) |
| Studio | 54323 | Database admin UI |

## URLs

- **Supabase API**: http://localhost:54321
- **Supabase Studio**: http://localhost:54323
- **Direct DB**: postgresql://postgres:postgres@localhost:54322/postgres

## Migrations

Migrations are in `./migrations/` and run automatically on first start.

To run migrations manually:
```bash
# Connect to database
psql postgresql://postgres:postgres@localhost:54322/postgres

# Or run a specific migration
psql postgresql://postgres:postgres@localhost:54322/postgres -f migrations/00000000000000_init.sql
```

## Schema

See `/context/concepts/data-models.md` for schema documentation.

### Tables

- `snippets` - Prompt snippets with Raycast sync support
- `folders` - Hierarchical folder organization
- `snippet_versions` - Version history for auto-save
- `sync_settings` - User preferences for sync behavior

## Environment Variables

Copy `.env.example` to `.env.local` in the project root:

```bash
cp supabase/.env.example .env.local
```

## Reset Database

```bash
docker compose down -v
docker compose up -d
```

This removes all data and re-runs migrations.
