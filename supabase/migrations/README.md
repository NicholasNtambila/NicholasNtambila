# Database Migrations

Store production schema changes as ordered SQL files named `YYYYMMDDHHMMSS_description.sql`. Keep development seed data outside migrations. Enable row-level security on every customer-facing table and include authorization tests with each exposed schema change.

Supabase migrations are forward-only in shared environments. For rollback, document a reviewed compensating migration; do not edit an applied migration or rely on restoring a developer database. Apply changes locally with `npm run db:reset`, and run `npm run db:test` plus `npm run db:lint`. The tenant/auth migration is not applied to any hosted project.
