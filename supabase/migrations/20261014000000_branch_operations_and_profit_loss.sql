create table public.service_offerings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete restrict,
  name text not null,
  default_price numeric(14, 2) not null default 0,
  is_active boolean not null default true,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  constraint service_offerings_name_length check (char_length(btrim(name)) between 1 and 120),
  constraint service_offerings_price check (default_price >= 0)
);

create table public.branch_service_offerings (
  tenant_id uuid not null,
  branch_id uuid not null,
  service_id uuid not null,
  price numeric(14, 2) not null,
  is_enabled boolean not null default true,
  primary key (tenant_id, branch_id, service_id),
  foreign key (tenant_id, branch_id) references public.branches (tenant_id, id) on delete restrict,
  foreign key (tenant_id, service_id) references public.service_offerings (tenant_id, id) on delete restrict,
  constraint branch_service_offerings_price check (price >= 0)
);

create table public.service_transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  branch_id uuid not null,
  service_id uuid not null,
  service_name_snapshot text not null,
  quantity numeric(14, 3) not null,
  unit_price numeric(14, 2) not null,
  total_amount numeric(14, 2) not null,
  payment_method public.payment_method not null default 'cash',
  created_by uuid not null references auth.users (id),
  occurred_at timestamptz not null default now(),
  foreign key (tenant_id, branch_id) references public.branches (tenant_id, id) on delete restrict,
  foreign key (tenant_id, service_id) references public.service_offerings (tenant_id, id) on delete restrict,
  constraint service_transactions_positive check (quantity > 0 and unit_price >= 0 and total_amount >= 0)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  branch_id uuid not null,
  category text not null,
  description text not null,
  amount numeric(14, 2) not null,
  occurred_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, branch_id) references public.branches (tenant_id, id) on delete restrict,
  constraint expenses_category_length check (char_length(btrim(category)) between 1 and 80),
  constraint expenses_description_length check (char_length(btrim(description)) between 1 and 240),
  constraint expenses_positive_amount check (amount > 0)
);

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  branch_id uuid not null,
  worker_name text not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  hourly_cost numeric(14, 2) not null default 0,
  notes text,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, branch_id) references public.branches (tenant_id, id) on delete restrict,
  constraint time_entries_worker_name_length check (char_length(btrim(worker_name)) between 1 and 120),
  constraint time_entries_valid_range check (ended_at > started_at and ended_at - started_at <= interval '24 hours'),
  constraint time_entries_hourly_cost check (hourly_cost >= 0)
);

create index service_transactions_branch_time on public.service_transactions (tenant_id, branch_id, occurred_at desc);
create index expenses_branch_time on public.expenses (tenant_id, branch_id, occurred_at desc);
create index time_entries_branch_time on public.time_entries (tenant_id, branch_id, started_at desc);

create function public.record_service_transaction(
  target_tenant_id uuid, target_branch_id uuid, target_service_id uuid,
  sold_quantity numeric, paid_unit_price numeric, paid_with public.payment_method default 'cash'
) returns uuid language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := (select auth.uid()); transaction_id uuid; service_name text;
begin
  if caller_id is null then raise exception using errcode = '28000', message = 'Authentication required'; end if;
  if not private.has_tenant_role(target_tenant_id, array['owner','administrator','manager','cashier']::public.business_role[])
    or not private.can_access_branch(target_tenant_id, target_branch_id) then raise exception using errcode = '42501', message = 'Not authorized to record a service sale'; end if;
  if sold_quantity is null or sold_quantity <= 0 or paid_unit_price is null or paid_unit_price < 0 then raise exception using errcode = '22023', message = 'Service quantity and price must be valid'; end if;
  select offering.name into service_name from public.service_offerings offering join public.branch_service_offerings branch_service on branch_service.tenant_id = offering.tenant_id and branch_service.service_id = offering.id
  where offering.tenant_id = target_tenant_id and offering.id = target_service_id and branch_service.branch_id = target_branch_id and offering.is_active and branch_service.is_enabled;
  if not found then raise exception using errcode = '22023', message = 'This service is not enabled at the selected branch'; end if;
  insert into public.service_transactions (tenant_id, branch_id, service_id, service_name_snapshot, quantity, unit_price, total_amount, payment_method, created_by)
  values (target_tenant_id, target_branch_id, target_service_id, service_name, sold_quantity, paid_unit_price, round(sold_quantity * paid_unit_price, 2), paid_with, caller_id) returning id into transaction_id;
  return transaction_id;
end; $$;

create function public.record_expense(target_tenant_id uuid, target_branch_id uuid, expense_category text, expense_description text, expense_amount numeric)
returns uuid language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := (select auth.uid()); expense_id uuid;
begin
  if caller_id is null then raise exception using errcode = '28000', message = 'Authentication required'; end if;
  if not private.has_tenant_role(target_tenant_id, array['owner','administrator','manager']::public.business_role[]) or not private.can_access_branch(target_tenant_id, target_branch_id) then raise exception using errcode = '42501', message = 'Not authorized to record expenses'; end if;
  insert into public.expenses (tenant_id, branch_id, category, description, amount, created_by) values (target_tenant_id, target_branch_id, expense_category, expense_description, expense_amount, caller_id) returning id into expense_id;
  return expense_id;
end; $$;

create function public.record_time_entry(target_tenant_id uuid, target_branch_id uuid, staff_name text, started timestamptz, ended timestamptz, cost_per_hour numeric, entry_notes text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := (select auth.uid()); entry_id uuid;
begin
  if caller_id is null then raise exception using errcode = '28000', message = 'Authentication required'; end if;
  if not private.has_tenant_role(target_tenant_id, array['owner','administrator','manager']::public.business_role[]) or not private.can_access_branch(target_tenant_id, target_branch_id) then raise exception using errcode = '42501', message = 'Not authorized to record time'; end if;
  insert into public.time_entries (tenant_id, branch_id, worker_name, started_at, ended_at, hourly_cost, notes, created_by) values (target_tenant_id, target_branch_id, staff_name, started, ended, cost_per_hour, entry_notes, caller_id) returning id into entry_id;
  return entry_id;
end; $$;

create function public.branch_profit_loss(target_tenant_id uuid, target_branch_id uuid, from_date date default current_date, to_date date default current_date)
returns table (product_revenue numeric, service_revenue numeric, cost_of_goods numeric, operating_expenses numeric, labour_cost numeric, net_profit numeric)
language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := (select auth.uid()); product_income numeric; service_income numeric; goods_cost numeric; expense_total numeric; wages numeric;
begin
  if caller_id is null or not private.is_tenant_member(target_tenant_id) or not private.can_access_branch(target_tenant_id, target_branch_id) then raise exception using errcode = '42501', message = 'Not authorized to view this profit and loss'; end if;
  if from_date > to_date then raise exception using errcode = '22023', message = 'Start date must be before end date'; end if;
  select coalesce(sum(total_amount),0) into product_income from public.sales where tenant_id=target_tenant_id and branch_id=target_branch_id and occurred_at::date between from_date and to_date;
  select coalesce(sum(total_amount),0) into service_income from public.service_transactions where tenant_id=target_tenant_id and branch_id=target_branch_id and occurred_at::date between from_date and to_date;
  select coalesce(sum(i.quantity * i.unit_cost_snapshot),0) into goods_cost from public.sale_items i join public.sales s on s.tenant_id=i.tenant_id and s.id=i.sale_id where i.tenant_id=target_tenant_id and i.branch_id=target_branch_id and s.occurred_at::date between from_date and to_date;
  select coalesce(sum(amount),0) into expense_total from public.expenses where tenant_id=target_tenant_id and branch_id=target_branch_id and occurred_at::date between from_date and to_date;
  select coalesce(sum(extract(epoch from (ended_at-started_at))/3600 * hourly_cost),0) into wages from public.time_entries where tenant_id=target_tenant_id and branch_id=target_branch_id and started_at::date between from_date and to_date;
  return query select product_income, service_income, goods_cost, expense_total, wages, product_income + service_income - goods_cost - expense_total - wages;
end; $$;

revoke all on function public.record_service_transaction(uuid, uuid, uuid, numeric, numeric, public.payment_method) from public, anon;
revoke all on function public.record_expense(uuid, uuid, text, text, numeric) from public, anon;
revoke all on function public.record_time_entry(uuid, uuid, text, timestamptz, timestamptz, numeric, text) from public, anon;
revoke all on function public.branch_profit_loss(uuid, uuid, date, date) from public, anon;
grant execute on function public.record_service_transaction(uuid, uuid, uuid, numeric, numeric, public.payment_method), public.record_expense(uuid, uuid, text, text, numeric), public.record_time_entry(uuid, uuid, text, timestamptz, timestamptz, numeric, text), public.branch_profit_loss(uuid, uuid, date, date) to authenticated;

alter table public.service_offerings enable row level security;
alter table public.branch_service_offerings enable row level security;
alter table public.service_transactions enable row level security;
alter table public.expenses enable row level security;
alter table public.time_entries enable row level security;
grant select, insert, update on public.service_offerings, public.branch_service_offerings to authenticated;
grant select on public.service_transactions, public.expenses, public.time_entries to authenticated;
create policy service_offerings_read_members on public.service_offerings for select to authenticated using (private.is_tenant_member(tenant_id));
create policy service_offerings_manage_managers on public.service_offerings for all to authenticated using (private.has_tenant_role(tenant_id, array['owner','administrator','manager']::public.business_role[])) with check (created_by = (select auth.uid()) and private.has_tenant_role(tenant_id, array['owner','administrator','manager']::public.business_role[]));
create policy branch_services_read_accessible on public.branch_service_offerings for select to authenticated using (private.can_access_branch(tenant_id, branch_id));
create policy branch_services_manage_managers on public.branch_service_offerings for all to authenticated using (private.has_tenant_role(tenant_id, array['owner','administrator','manager']::public.business_role[]) and private.can_access_branch(tenant_id, branch_id)) with check (private.has_tenant_role(tenant_id, array['owner','administrator','manager']::public.business_role[]) and private.can_access_branch(tenant_id, branch_id));
create policy service_transactions_read_accessible on public.service_transactions for select to authenticated using (private.can_access_branch(tenant_id, branch_id));
create policy expenses_read_accessible on public.expenses for select to authenticated using (private.can_access_branch(tenant_id, branch_id));
create policy time_entries_read_accessible on public.time_entries for select to authenticated using (private.can_access_branch(tenant_id, branch_id));
