create type public.sales_target_period as enum ('weekly', 'monthly');

create table public.branch_sales_targets (
  tenant_id uuid not null,
  branch_id uuid not null,
  period public.sales_target_period not null,
  target_amount numeric(14, 2) not null,
  updated_by uuid not null references auth.users (id),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, branch_id, period),
  foreign key (tenant_id, branch_id) references public.branches (tenant_id, id) on delete restrict,
  constraint branch_sales_targets_amount check (target_amount > 0)
);

create function public.set_branch_sales_target(
  target_tenant_id uuid,
  target_branch_id uuid,
  target_period public.sales_target_period,
  target_amount numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;
  if not private.has_tenant_role(target_tenant_id, array['owner']::public.business_role[]) then
    raise exception using errcode = '42501', message = 'Only the business owner can set sales targets';
  end if;
  insert into public.branch_sales_targets (tenant_id, branch_id, period, target_amount, updated_by)
  values (target_tenant_id, target_branch_id, target_period, target_amount, (select auth.uid()))
  on conflict (tenant_id, branch_id, period) do update
    set target_amount = excluded.target_amount, updated_by = excluded.updated_by, updated_at = now();
end;
$$;

create function public.create_cashier_invitation(
  target_tenant_id uuid,
  invite_email text,
  allowed_branch_ids uuid[]
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;
  if not private.has_tenant_role(target_tenant_id, array['owner']::public.business_role[]) then
    raise exception using errcode = '42501', message = 'Only the business owner can invite cashiers';
  end if;
  if coalesce(array_length(allowed_branch_ids, 1), 0) <> 1 then
    raise exception using errcode = '22023', message = 'A cashier must be assigned to exactly one branch';
  end if;
  return public.create_tenant_invitation(target_tenant_id, invite_email, 'cashier'::public.business_role, allowed_branch_ids);
end;
$$;

revoke all on function public.set_branch_sales_target(uuid, uuid, public.sales_target_period, numeric) from public, anon;
revoke all on function public.create_cashier_invitation(uuid, text, uuid[]) from public, anon;
grant execute on function public.set_branch_sales_target(uuid, uuid, public.sales_target_period, numeric) to authenticated;
grant execute on function public.create_cashier_invitation(uuid, text, uuid[]) to authenticated;

alter table public.branch_sales_targets enable row level security;
grant select on public.branch_sales_targets to authenticated;
create policy branch_sales_targets_read_members on public.branch_sales_targets
  for select to authenticated using (private.is_tenant_member(tenant_id));

drop policy products_insert_managers on public.products;
drop policy products_update_managers on public.products;
create policy products_insert_owner on public.products for insert to authenticated
  with check (created_by = (select auth.uid()) and private.has_tenant_role(tenant_id, array['owner']::public.business_role[]));
create policy products_update_owner on public.products for update to authenticated
  using (private.has_tenant_role(tenant_id, array['owner']::public.business_role[]))
  with check (private.has_tenant_role(tenant_id, array['owner']::public.business_role[]));

drop policy service_offerings_manage_managers on public.service_offerings;
drop policy branch_services_manage_managers on public.branch_service_offerings;
create policy service_offerings_manage_owner on public.service_offerings for all to authenticated
  using (private.has_tenant_role(tenant_id, array['owner']::public.business_role[]))
  with check (created_by = (select auth.uid()) and private.has_tenant_role(tenant_id, array['owner']::public.business_role[]));
create policy branch_services_manage_owner on public.branch_service_offerings for all to authenticated
  using (private.has_tenant_role(tenant_id, array['owner']::public.business_role[]) and private.can_access_branch(tenant_id, branch_id))
  with check (private.has_tenant_role(tenant_id, array['owner']::public.business_role[]) and private.can_access_branch(tenant_id, branch_id));

create or replace function public.record_service_transaction(
  target_tenant_id uuid, target_branch_id uuid, target_service_id uuid,
  sold_quantity numeric, paid_unit_price numeric, paid_with public.payment_method default 'cash'
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := (select auth.uid()); transaction_id uuid; service_name text; configured_price numeric;
begin
  if caller_id is null then raise exception using errcode = '28000', message = 'Authentication required'; end if;
  if not private.has_tenant_role(target_tenant_id, array['owner','administrator','manager','cashier']::public.business_role[]) or not private.can_access_branch(target_tenant_id, target_branch_id) then raise exception using errcode = '42501', message = 'Not authorized to record a service sale'; end if;
  if sold_quantity is null or sold_quantity <= 0 then raise exception using errcode = '22023', message = 'Service quantity must be valid'; end if;
  select offering.name, branch_service.price into service_name, configured_price from public.service_offerings offering join public.branch_service_offerings branch_service on branch_service.tenant_id = offering.tenant_id and branch_service.service_id = offering.id where offering.tenant_id = target_tenant_id and offering.id = target_service_id and branch_service.branch_id = target_branch_id and offering.is_active and branch_service.is_enabled;
  if not found then raise exception using errcode = '22023', message = 'This service is not enabled at the selected branch'; end if;
  if not private.has_tenant_role(target_tenant_id, array['owner','administrator','manager']::public.business_role[]) then paid_unit_price := configured_price; end if;
  if paid_unit_price is null or paid_unit_price < 0 then raise exception using errcode = '22023', message = 'Service price must be valid'; end if;
  insert into public.service_transactions (tenant_id, branch_id, service_id, service_name_snapshot, quantity, unit_price, total_amount, payment_method, created_by) values (target_tenant_id, target_branch_id, target_service_id, service_name, sold_quantity, paid_unit_price, round(sold_quantity * paid_unit_price, 2), paid_with, caller_id) returning id into transaction_id;
  return transaction_id;
end; $$;

comment on function public.record_service_transaction is 'Cashiers always receive the owner-configured branch price; managers may explicitly apply a different price.';
