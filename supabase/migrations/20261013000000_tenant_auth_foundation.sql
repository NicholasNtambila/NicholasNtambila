create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create type public.business_role as enum (
  'owner',
  'administrator',
  'manager',
  'cashier',
  'accountant',
  'read_only_viewer'
);

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (char_length(display_name) <= 120)
);

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency_code text not null default 'ZMW',
  timezone text not null default 'Africa/Lusaka',
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenants_name_length check (char_length(btrim(name)) between 1 and 160),
  constraint tenants_currency_code check (currency_code ~ '^[A-Z]{3}$'),
  constraint tenants_timezone_not_empty check (char_length(btrim(timezone)) > 0),
  unique (id, created_by)
);

create function private.validate_business_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_timezone_names as timezone
    where timezone.name = new.timezone
  ) then
    raise exception using errcode = '22023', message = 'Timezone must be a valid IANA timezone';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_business_timezone() from public, anon, authenticated;

create trigger tenants_validate_timezone
  before insert or update on public.tenants
  for each row execute function private.validate_business_timezone();

create table public.business_members (
  tenant_id uuid not null references public.tenants (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete restrict,
  role public.business_role not null,
  branch_scope text not null default 'all',
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id),
  constraint business_members_branch_scope check (
    branch_scope in ('all', 'selected')
    and ((role in ('manager', 'cashier')) = (branch_scope = 'selected'))
  )
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete restrict,
  name text not null,
  timezone text not null default 'Africa/Lusaka',
  phone text,
  address text,
  is_headquarters boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  constraint branches_name_length check (char_length(btrim(name)) between 1 and 120),
  constraint branches_timezone_not_empty check (char_length(btrim(timezone)) > 0)
);

create trigger branches_validate_timezone
  before insert or update on public.branches
  for each row execute function private.validate_business_timezone();

create unique index branches_one_headquarters_per_tenant
  on public.branches (tenant_id)
  where is_headquarters;

create table public.member_branch_access (
  tenant_id uuid not null,
  user_id uuid not null,
  branch_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id, branch_id),
  foreign key (tenant_id, user_id)
    references public.business_members (tenant_id, user_id) on delete cascade,
  foreign key (tenant_id, branch_id)
    references public.branches (tenant_id, id) on delete cascade
);

create table public.tenant_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  invited_email text not null,
  role public.business_role not null,
  token_hash bytea not null unique,
  created_by uuid not null references auth.users (id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  constraint tenant_invitations_no_owner check (role <> 'owner'),
  constraint tenant_invitations_email_normalized check (
    invited_email = lower(btrim(invited_email))
    and position('@' in invited_email) > 1
  )
);

create index tenant_invitations_pending_by_tenant_email
  on public.tenant_invitations (tenant_id, invited_email, expires_at)
  where accepted_at is null;

create table public.tenant_invitation_branches (
  invitation_id uuid not null,
  tenant_id uuid not null,
  branch_id uuid not null,
  primary key (invitation_id, branch_id),
  foreign key (tenant_id, invitation_id)
    references public.tenant_invitations (tenant_id, id) on delete cascade,
  foreign key (tenant_id, branch_id)
    references public.branches (tenant_id, id) on delete cascade
);

create index business_members_user_tenant on public.business_members (user_id, tenant_id);
create index branches_tenant_name on public.branches (tenant_id, name);
create index member_branch_access_user on public.member_branch_access (user_id, tenant_id);

create function private.is_tenant_member(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_members as member
    where member.tenant_id = target_tenant_id
      and member.user_id = (select auth.uid())
  );
$$;

create function private.has_tenant_role(
  target_tenant_id uuid,
  allowed_roles public.business_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_members as member
    where member.tenant_id = target_tenant_id
      and member.user_id = (select auth.uid())
      and member.role = any (allowed_roles)
  );
$$;

create function private.can_access_branch(target_tenant_id uuid, target_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_members as member
    where member.tenant_id = target_tenant_id
      and member.user_id = (select auth.uid())
      and (
        member.branch_scope = 'all'
        or exists (
          select 1
          from public.member_branch_access as access
          where access.tenant_id = member.tenant_id
            and access.user_id = member.user_id
            and access.branch_id = target_branch_id
        )
      )
  );
$$;

revoke all on function private.is_tenant_member(uuid) from public;
revoke all on function private.has_tenant_role(uuid, public.business_role[]) from public;
revoke all on function private.can_access_branch(uuid, uuid) from public;
grant execute on function private.is_tenant_member(uuid) to authenticated;
grant execute on function private.has_tenant_role(uuid, public.business_role[]) to authenticated;
grant execute on function private.can_access_branch(uuid, uuid) to authenticated;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    left(
      coalesce(
        nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
        nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
        'Business user'
      ),
      120
    )
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.create_business(
  business_name text,
  first_branch_name text default 'Main branch',
  business_currency text default 'ZMW',
  business_timezone text default 'Africa/Lusaka'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  new_tenant_id uuid;
  normalized_timezone text := btrim(coalesce(business_timezone, ''));
begin
  if caller_id is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;

  if char_length(btrim(coalesce(business_name, ''))) not between 1 and 160 then
    raise exception using errcode = '22023', message = 'Business name must be 1 to 160 characters';
  end if;

  if char_length(btrim(coalesce(first_branch_name, ''))) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'Branch name must be 1 to 120 characters';
  end if;

  if coalesce(business_currency, '') !~ '^[A-Z]{3}$' then
    raise exception using errcode = '22023', message = 'Currency must be a three-letter uppercase code';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_timezone_names where name = normalized_timezone
  ) then
    raise exception using errcode = '22023', message = 'Timezone must be a valid IANA timezone';
  end if;

  insert into public.tenants (name, currency_code, timezone, created_by)
  values (btrim(business_name), business_currency, normalized_timezone, caller_id)
  returning id into new_tenant_id;

  insert into public.business_members (tenant_id, user_id, role, branch_scope)
  values (new_tenant_id, caller_id, 'owner', 'all');

  insert into public.branches (tenant_id, name, timezone, is_headquarters)
  values (new_tenant_id, btrim(first_branch_name), normalized_timezone, true);

  return new_tenant_id;
end;
$$;

create function public.create_tenant_invitation(
  target_tenant_id uuid,
  invite_email text,
  invite_role public.business_role,
  allowed_branch_ids uuid[] default '{}'::uuid[]
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := lower(btrim(coalesce(invite_email, '')));
  caller_id uuid := (select auth.uid());
  invitation_token text;
  invitation_id uuid;
  requested_branch_count integer := coalesce(cardinality(allowed_branch_ids), 0);
  matched_branch_count integer;
begin
  if caller_id is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;

  if not private.has_tenant_role(
    target_tenant_id,
    array['owner', 'administrator']::public.business_role[]
  ) then
    raise exception using errcode = '42501', message = 'Not authorized to invite members';
  end if;

  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception using errcode = '22023', message = 'A valid invite email is required';
  end if;

  if invite_role = 'owner' then
    raise exception using errcode = '22023', message = 'Owner role cannot be assigned by invitation';
  end if;

  if invite_role in ('manager', 'cashier') and requested_branch_count = 0 then
    raise exception using errcode = '22023', message = 'Select at least one branch for this role';
  end if;

  if invite_role not in ('manager', 'cashier') and requested_branch_count > 0 then
    raise exception using errcode = '22023', message = 'Branch restrictions apply only to managers and cashiers';
  end if;

  select count(*) into matched_branch_count
  from public.branches as branch
  where branch.tenant_id = target_tenant_id
    and branch.id = any (coalesce(allowed_branch_ids, '{}'::uuid[]));

  if matched_branch_count <> requested_branch_count then
    raise exception using errcode = '22023', message = 'One or more selected branches are invalid';
  end if;

  if exists (
    select 1
    from auth.users as auth_user
    join public.business_members as member on member.user_id = auth_user.id
    where member.tenant_id = target_tenant_id
      and lower(auth_user.email) = normalized_email
  ) then
    raise exception using errcode = '23505', message = 'This user is already a business member';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_tenant_id::text || normalized_email, 0));

  if exists (
    select 1
    from public.tenant_invitations as invitation
    where invitation.tenant_id = target_tenant_id
      and invitation.invited_email = normalized_email
      and invitation.accepted_at is null
      and invitation.expires_at > now()
  ) then
    raise exception using errcode = '23505', message = 'A pending invitation already exists';
  end if;

  invitation_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.tenant_invitations (
    tenant_id,
    invited_email,
    role,
    token_hash,
    created_by,
    expires_at
  )
  values (
    target_tenant_id,
    normalized_email,
    invite_role,
    extensions.digest(convert_to(invitation_token, 'UTF8'), 'sha256'),
    caller_id,
    now() + interval '7 days'
  )
  returning id into invitation_id;

  if requested_branch_count > 0 then
    insert into public.tenant_invitation_branches (invitation_id, tenant_id, branch_id)
    select invitation_id, target_tenant_id, selected_branch.branch_id
    from unnest(allowed_branch_ids) as selected_branch(branch_id);
  end if;

  return invitation_token;
end;
$$;

create function public.accept_tenant_invitation(invitation_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_email text := lower(coalesce((select auth.jwt()) ->> 'email', ''));
  invitation public.tenant_invitations%rowtype;
begin
  if caller_id is null or caller_email = '' then
    raise exception using errcode = '28000', message = 'Authenticated email is required';
  end if;

  if not exists (
    select 1
    from auth.users as auth_user
    where auth_user.id = caller_id
      and auth_user.email_confirmed_at is not null
      and lower(auth_user.email) = caller_email
  ) then
    raise exception using errcode = '28000', message = 'Verified account email is required';
  end if;

  if char_length(coalesce(invitation_token, '')) < 32 then
    raise exception using errcode = '22023', message = 'Invitation token is invalid or expired';
  end if;

  select * into invitation
  from public.tenant_invitations as stored_invitation
  where stored_invitation.token_hash = extensions.digest(
    convert_to(invitation_token, 'UTF8'),
    'sha256'
  )
  for update;

  if not found
    or invitation.accepted_at is not null
    or invitation.expires_at <= now()
    or invitation.invited_email <> caller_email then
    raise exception using errcode = '22023', message = 'Invitation token is invalid or expired';
  end if;

  insert into public.business_members (tenant_id, user_id, role, branch_scope)
  values (
    invitation.tenant_id,
    caller_id,
    invitation.role,
    case when invitation.role in ('manager', 'cashier') then 'selected' else 'all' end
  );

  insert into public.member_branch_access (tenant_id, user_id, branch_id)
  select invitation.tenant_id, caller_id, invitation_branch.branch_id
  from public.tenant_invitation_branches as invitation_branch
  where invitation_branch.invitation_id = invitation.id;

  update public.tenant_invitations
  set accepted_at = now()
  where id = invitation.id;

  return invitation.tenant_id;
end;
$$;

revoke all on function public.create_business(text, text, text, text) from public, anon;
revoke all on function public.create_tenant_invitation(uuid, text, public.business_role, uuid[]) from public, anon;
revoke all on function public.accept_tenant_invitation(text) from public, anon;
grant execute on function public.create_business(text, text, text, text) to authenticated;
grant execute on function public.create_tenant_invitation(uuid, text, public.business_role, uuid[]) to authenticated;
grant execute on function public.accept_tenant_invitation(text) to authenticated;

alter table public.profiles enable row level security;
alter table public.tenants enable row level security;
alter table public.business_members enable row level security;
alter table public.branches enable row level security;
alter table public.member_branch_access enable row level security;
alter table public.tenant_invitations enable row level security;
alter table public.tenant_invitation_branches enable row level security;

revoke all on public.profiles, public.tenants, public.business_members, public.branches,
  public.member_branch_access, public.tenant_invitations, public.tenant_invitation_branches
from anon, authenticated;

grant select, update (display_name) on public.profiles to authenticated;
grant select, update (name, currency_code, timezone) on public.tenants to authenticated;
grant select on public.business_members to authenticated;
grant select, insert on public.branches to authenticated;
grant update (name, timezone, phone, address, is_headquarters) on public.branches to authenticated;
grant select, insert, delete on public.member_branch_access to authenticated;
grant select on public.tenant_invitations, public.tenant_invitation_branches to authenticated;

create policy profiles_read_self
  on public.profiles for select to authenticated
  using (user_id = (select auth.uid()));

create policy profiles_update_self
  on public.profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy tenants_read_members
  on public.tenants for select to authenticated
  using (private.is_tenant_member(id));

create policy tenants_update_owner_admin
  on public.tenants for update to authenticated
  using (private.has_tenant_role(id, array['owner', 'administrator']::public.business_role[]))
  with check (private.has_tenant_role(id, array['owner', 'administrator']::public.business_role[]));

create policy business_members_read_members
  on public.business_members for select to authenticated
  using (private.is_tenant_member(tenant_id));

create policy branches_read_members
  on public.branches for select to authenticated
  using (private.can_access_branch(tenant_id, id));

create policy branches_insert_owner_admin
  on public.branches for insert to authenticated
  with check (private.has_tenant_role(tenant_id, array['owner', 'administrator']::public.business_role[]));

create policy branches_update_owner_admin
  on public.branches for update to authenticated
  using (private.has_tenant_role(tenant_id, array['owner', 'administrator']::public.business_role[]))
  with check (private.has_tenant_role(tenant_id, array['owner', 'administrator']::public.business_role[]));

create policy member_branch_access_read_self_or_admin
  on public.member_branch_access for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.has_tenant_role(tenant_id, array['owner', 'administrator']::public.business_role[])
  );

create policy member_branch_access_manage_admin
  on public.member_branch_access for insert to authenticated
  with check (
    private.has_tenant_role(tenant_id, array['owner', 'administrator']::public.business_role[])
    and exists (
      select 1 from public.business_members as member
      where member.tenant_id = public.member_branch_access.tenant_id
        and member.user_id = public.member_branch_access.user_id
        and member.branch_scope = 'selected'
    )
  );

create policy member_branch_access_delete_admin
  on public.member_branch_access for delete to authenticated
  using (private.has_tenant_role(tenant_id, array['owner', 'administrator']::public.business_role[]));

create policy tenant_invitations_read_admin
  on public.tenant_invitations for select to authenticated
  using (private.has_tenant_role(tenant_id, array['owner', 'administrator']::public.business_role[]));

create policy tenant_invitation_branches_read_admin
  on public.tenant_invitation_branches for select to authenticated
  using (private.has_tenant_role(tenant_id, array['owner', 'administrator']::public.business_role[]));

comment on table public.tenants is 'A tenant is a company. Tenant membership and row access are enforced by PostgreSQL RLS.';
comment on table public.member_branch_access is 'Explicit branch grants for managers and cashiers; these roles have no access without a grant.';
comment on table public.tenant_invitations is 'Stores only a SHA-256 hash of the one-time invitation token.';