import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!['127.0.0.1', 'localhost', '::1'].includes(new URL(url).hostname)) {
  throw new Error(
    'Test users may only be seeded into a local Supabase instance.',
  );
}
if (!serviceRoleKey) {
  throw new Error(
    'Set SUPABASE_SERVICE_ROLE_KEY from `supabase status -o env` before seeding.',
  );
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function getOrCreateUser(email, displayName, password) {
  const { data: listed, error: listError } =
    await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
  if (listError) throw listError;

  const existing = listed.users.find((user) => user.email === email);
  const result = existing
    ? await supabase.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
        user_metadata: { display_name: displayName },
      })
    : await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: displayName },
      });

  if (result.error) throw result.error;
  return result.data.user;
}

async function ensureRow(query, create) {
  const { data, error } = await query;
  if (error) throw error;
  if (data) return data;
  const { data: inserted, error: insertError } = await create();
  if (insertError) throw insertError;
  return inserted;
}

async function main() {
  const owner = {
    email: 'owner@sunga.test',
    password: randomBytes(24).toString('base64url'),
  };
  const cashier = {
    email: 'cashier@sunga.test',
    password: randomBytes(24).toString('base64url'),
  };

  const ownerUser = await getOrCreateUser(
    owner.email,
    'Test Owner',
    owner.password,
  );
  const cashierUser = await getOrCreateUser(
    cashier.email,
    'Test Cashier',
    cashier.password,
  );

  const tenant = await ensureRow(
    supabase
      .from('tenants')
      .select('id')
      .eq('created_by', ownerUser.id)
      .eq('name', 'Sunga Demo Store')
      .maybeSingle(),
    () =>
      supabase
        .from('tenants')
        .insert({
          name: 'Sunga Demo Store',
          created_by: ownerUser.id,
          currency_code: 'ZMW',
          timezone: 'Africa/Lusaka',
        })
        .select('id')
        .single(),
  );

  const branch = await ensureRow(
    supabase
      .from('branches')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('name', 'Main Branch')
      .maybeSingle(),
    () =>
      supabase
        .from('branches')
        .insert({
          tenant_id: tenant.id,
          name: 'Main Branch',
          timezone: 'Africa/Lusaka',
          is_headquarters: true,
        })
        .select('id')
        .single(),
  );

  const { error: membershipError } = await supabase
    .from('business_members')
    .upsert(
      [
        {
          tenant_id: tenant.id,
          user_id: ownerUser.id,
          role: 'owner',
          branch_scope: 'all',
        },
        {
          tenant_id: tenant.id,
          user_id: cashierUser.id,
          role: 'cashier',
          branch_scope: 'selected',
        },
      ],
      { onConflict: 'tenant_id,user_id' },
    );
  if (membershipError) throw membershipError;

  const { error: branchAccessError } = await supabase
    .from('member_branch_access')
    .upsert(
      {
        tenant_id: tenant.id,
        user_id: cashierUser.id,
        branch_id: branch.id,
      },
      { onConflict: 'tenant_id,user_id,branch_id' },
    );
  if (branchAccessError) throw branchAccessError;

  const credentials = {
    environment: 'local Supabase only',
    business: 'Sunga Demo Store',
    branch: 'Main Branch',
    users: [
      { portal: 'owner', email: owner.email, password: owner.password },
      { portal: 'cashier', email: cashier.email, password: cashier.password },
    ],
  };
  const outputPath = new URL('../.test-users.local.json', import.meta.url);
  await writeFile(outputPath, `${JSON.stringify(credentials, null, 2)}\n`, {
    mode: 0o600,
  });

  console.log(
    `Local test accounts ready. Credentials saved to ${outputPath.pathname}`,
  );
  console.log(
    'Use only with the local Supabase project; passwords are regenerated on each run.',
  );
}

main().catch((error) => {
  console.error(`Could not create local test accounts: ${error.message}`);
  process.exitCode = 1;
});
