begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(22);

create temporary table issued_invites (invited_email text, token text) on commit drop;
grant select, insert on issued_invites to authenticated;

insert into auth.users (
  id,
  aud,
  role,
  email,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000101',
    'authenticated',
    'authenticated',
    'owner@example.test',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000102',
    'authenticated',
    'authenticated',
    'other@example.test',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000103',
    'authenticated',
    'authenticated',
    'manager@example.test',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000104',
    'authenticated',
    'authenticated',
    'pending@example.test',
    null,
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000105',
    'authenticated',
    'authenticated',
    'cashier@example.test',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000101","email":"owner@example.test","role":"authenticated"}',
  true
);

select lives_ok(
  $$select public.create_business('Owner Company', 'Main branch')$$,
  'authenticated user can create a business'
);
select is(
  (select count(*)::integer from public.tenants where name = 'Owner Company'),
  1,
  'business owner can read the created tenant'
);
select is(
  (select count(*)::integer from public.branches where name = 'Main branch'),
  1,
  'business creation atomically creates its first branch'
);
insert into public.branches (tenant_id, name, timezone)
select id, 'Restricted branch', timezone
from public.tenants
where name = 'Owner Company';
select is(
  (select count(*)::integer from public.branches),
  2,
  'owner can add an additional branch without plan gating'
);
select lives_ok(
  $$insert into pg_temp.issued_invites (invited_email, token)
    values (
      'manager@example.test',
      public.create_tenant_invitation(
        (select id from public.tenants where name = 'Owner Company'),
        'manager@example.test',
        'manager',
        array[(select id from public.branches where name = 'Main branch')]
      )
    )$$,
  'owner can create a branch-scoped manager invitation'
);
select is(
  (
    select count(*)::integer
    from public.tenant_invitations
    where invited_email = 'manager@example.test'
  ),
  1,
  'only invitation metadata is stored for the invitee'
);
select lives_ok(
  $$insert into pg_temp.issued_invites (invited_email, token)
    values (
      'pending@example.test',
      public.create_tenant_invitation(
        (select id from public.tenants where name = 'Owner Company'),
        'pending@example.test',
        'cashier',
        array[(select id from public.branches where name = 'Main branch')]
      )
    )$$,
  'owner can invite a cashier to a selected branch'
);
select lives_ok(
  $$insert into pg_temp.issued_invites (invited_email, token)
    values (
      'cashier@example.test',
      public.create_tenant_invitation(
        (select id from public.tenants where name = 'Owner Company'),
        'cashier@example.test',
        'cashier',
        array[(select id from public.branches where name = 'Main branch')]
      )
    )$$,
  'owner can create a cashier account invitation'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000102","email":"other@example.test","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$select public.accept_tenant_invitation(
    (select token from pg_temp.issued_invites where invited_email = 'manager@example.test')
  )$$,
  '22023',
  'Invitation token is invalid or expired',
  'a different email address cannot accept the manager invitation'
);
select is(
  (select count(*)::integer from public.tenants),
  0,
  'unrelated authenticated user cannot read another tenant'
);
select is(
  (select count(*)::integer from public.branches),
  0,
  'unrelated authenticated user cannot read another tenant branch'
);
select throws_ok(
  $$insert into public.business_members (tenant_id, user_id, role)
    values (gen_random_uuid(), auth.uid(), 'owner')$$,
  '42501',
  null,
  'authenticated user cannot grant themselves membership'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000104', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000104","email":"pending@example.test","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$select public.create_business('Unverified Company', 'Main branch')$$,
  '28000',
  'Verified account email is required',
  'unverified users cannot create a business'
);
select throws_ok(
  $$select public.accept_tenant_invitation(
    (select token from pg_temp.issued_invites where invited_email = 'pending@example.test')
  )$$,
  '28000',
  'Verified account email is required',
  'unverified users cannot accept invitations'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000103', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000103","email":"manager@example.test","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$select public.accept_tenant_invitation(
    (select token from pg_temp.issued_invites where invited_email = 'manager@example.test')
  )$$,
  'verified invited user can accept the invitation'
);
select is(
  (select role::text from public.business_members where tenant_id = (select id from public.tenants where name = 'Owner Company')),
  'manager',
  'accepted invitation grants only the requested role'
);
select is(
  (select count(*)::integer from public.member_branch_access),
  1,
  'manager receives the explicitly selected branch access'
);
select is(
  (select count(*)::integer from public.branches),
  1,
  'manager cannot read branches outside the invitation scope'
);
select throws_ok(
  $$select public.accept_tenant_invitation(
    (select token from pg_temp.issued_invites where invited_email = 'manager@example.test')
  )$$,
  '22023',
  'Invitation token is invalid or expired',
  'an invitation cannot be accepted a second time'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000105', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000105","email":"cashier@example.test","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$select public.accept_tenant_invitation(
    (select token from pg_temp.issued_invites where invited_email = 'cashier@example.test')
  )$$,
  'cashier can accept a verified invitation'
);
select is(
  (
    select role::text || ':' || branch_scope::text
    from public.business_members
    where user_id = auth.uid()
  ),
  'cashier:selected',
  'cashier receives only the requested role and scoped access'
);
select is(
  (select count(*)::integer from public.branches),
  1,
  'cashier cannot read branches outside the invitation scope'
);

select * from finish();
rollback;
