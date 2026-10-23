# Development Setup

The repository uses npm workspaces. The Expo application lives in `apps/mobile`; shared, cross-platform code belongs in `packages/shared`. The local Supabase stack is configured separately and does not connect to or modify a hosted project.

## Local setup

1. Install Node.js 22.13 or newer in the 22.x line, npm, and Docker Desktop.
2. Run `npm ci` from the repository root.
3. Run `npm run db:start` to start the local Supabase stack and `npm run db:reset` to apply local migrations.
4. Copy `apps/mobile/.env.example` to `apps/mobile/.env` and provide the local Supabase URL and publishable key from `npx supabase status`. Never put service-role, payment-provider, or webhook secrets in a client environment file.
5. Run `npm run start` from the repository root.
6. Run `npm run verify`, `npm run db:test`, and `npm run db:lint` before submitting changes.

## Local owner and cashier test accounts

Start and reset the local Supabase project first. In PowerShell, load the local
service key into the current terminal without printing it, then seed the demo
business and accounts:

```powershell
$localSupabaseEnv = npx supabase status -o env | ConvertFrom-StringData
$env:SUPABASE_URL = $localSupabaseEnv.API_URL.Trim('"')
$env:SUPABASE_SERVICE_ROLE_KEY = $localSupabaseEnv.SERVICE_ROLE_KEY.Trim('"')
npm run db:seed-test-users
Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY
Remove-Item Env:SUPABASE_URL
```

The command creates locally confirmed `owner@sunga.test` and
`cashier@sunga.test` accounts, assigns the owner and cashier roles in
`Sunga Demo Store`, and scopes the cashier to `Main Branch`. It generates new
passwords each time and saves them to the ignored `.test-users.local.json` file.
Use those credentials with the local app only. The script refuses non-local
Supabase URLs and does not alter hosted projects.

Email confirmation and password recovery messages in local development are captured by Supabase's local email inbox service. Redirect URLs are declared in `supabase/config.toml`; hosted projects require their own reviewed Auth redirect allowlist. The development, staging, and production Supabase projects must be separate. Do not run `db push` against a hosted project until the migration has passed local authorization tests and received review.
