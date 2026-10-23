create type public.inventory_movement_type as enum (
  'receipt',
  'sale',
  'adjustment',
  'return',
  'transfer_in',
  'transfer_out'
);

create type public.payment_method as enum (
  'cash',
  'mtn_momo',
  'airtel_money',
  'zamtel_money',
  'bank'
);

create type public.payment_status as enum (
  'pending',
  'recorded',
  'failed',
  'refunded'
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete restrict,
  name text not null,
  sku text,
  unit_cost_estimate numeric(14, 2) not null default 0,
  selling_price numeric(14, 2) not null,
  is_active boolean not null default true,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  constraint products_name_length check (char_length(btrim(name)) between 1 and 160),
  constraint products_sku_length check (sku is null or char_length(btrim(sku)) between 1 and 64),
  constraint products_nonnegative_money check (unit_cost_estimate >= 0 and selling_price >= 0)
);

create unique index products_tenant_sku
  on public.products (tenant_id, lower(sku))
  where sku is not null;

create index products_tenant_name_active
  on public.products (tenant_id, name)
  where is_active;

create table public.branch_inventory (
  tenant_id uuid not null,
  branch_id uuid not null,
  product_id uuid not null,
  quantity_on_hand numeric(14, 3) not null default 0,
  average_unit_cost numeric(14, 2) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, branch_id, product_id),
  foreign key (tenant_id, branch_id)
    references public.branches (tenant_id, id) on delete restrict,
  foreign key (tenant_id, product_id)
    references public.products (tenant_id, id) on delete restrict,
  constraint branch_inventory_quantity_nonnegative check (quantity_on_hand >= 0),
  constraint branch_inventory_cost_nonnegative check (average_unit_cost >= 0)
);

create index branch_inventory_product_branch
  on public.branch_inventory (tenant_id, product_id, branch_id);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  branch_id uuid not null,
  product_id uuid not null,
  movement_type public.inventory_movement_type not null,
  quantity_delta numeric(14, 3) not null,
  unit_cost_snapshot numeric(14, 2) not null,
  idempotency_key text,
  reference_id uuid,
  created_by uuid not null references auth.users (id),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, branch_id)
    references public.branches (tenant_id, id) on delete restrict,
  foreign key (tenant_id, product_id)
    references public.products (tenant_id, id) on delete restrict,
  constraint inventory_movements_nonzero check (quantity_delta <> 0),
  constraint inventory_movements_cost_nonnegative check (unit_cost_snapshot >= 0),
  constraint inventory_movements_idempotency_length check (
    idempotency_key is null or char_length(idempotency_key) between 16 and 160
  )
);

create unique index inventory_movements_tenant_idempotency
  on public.inventory_movements (tenant_id, idempotency_key)
  where idempotency_key is not null;

create index inventory_movements_branch_product_time
  on public.inventory_movements (tenant_id, branch_id, product_id, occurred_at desc);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  branch_id uuid not null,
  transaction_number text not null,
  idempotency_key text not null,
  created_by uuid not null references auth.users (id),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  total_amount numeric(14, 2) not null,
  amount_paid numeric(14, 2) not null default 0,
  payment_state text not null,
  foreign key (tenant_id, branch_id)
    references public.branches (tenant_id, id) on delete restrict,
  unique (tenant_id, id),
  unique (tenant_id, transaction_number),
  unique (tenant_id, idempotency_key),
  constraint sales_idempotency_key_length check (
    char_length(idempotency_key) between 16 and 160
  ),
  constraint sales_amounts_nonnegative check (
    total_amount > 0 and amount_paid >= 0 and amount_paid <= total_amount
  ),
  constraint sales_payment_state check (
    payment_state in ('unpaid', 'partial', 'paid')
  ),
  constraint sales_payment_state_matches_amount check (
    (amount_paid = 0 and payment_state = 'unpaid')
    or (amount_paid > 0 and amount_paid < total_amount and payment_state = 'partial')
    or (amount_paid = total_amount and payment_state = 'paid')
  )
);

create index sales_tenant_branch_occurred
  on public.sales (tenant_id, branch_id, occurred_at desc);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  sale_id uuid not null,
  branch_id uuid not null,
  product_id uuid not null,
  product_name_snapshot text not null,
  sku_snapshot text,
  quantity numeric(14, 3) not null,
  unit_price numeric(14, 2) not null,
  unit_cost_snapshot numeric(14, 2) not null,
  line_total numeric(14, 2) not null,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, sale_id)
    references public.sales (tenant_id, id) on delete restrict,
  foreign key (tenant_id, branch_id)
    references public.branches (tenant_id, id) on delete restrict,
  foreign key (tenant_id, product_id)
    references public.products (tenant_id, id) on delete restrict,
  constraint sale_items_positive_values check (
    quantity > 0 and unit_price >= 0 and unit_cost_snapshot >= 0 and line_total >= 0
  )
);

create index sale_items_sale on public.sale_items (tenant_id, sale_id);
create index sale_items_product on public.sale_items (tenant_id, product_id, sale_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  sale_id uuid not null,
  branch_id uuid not null,
  method public.payment_method not null,
  amount numeric(14, 2) not null,
  status public.payment_status not null,
  provider_reference text,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, sale_id)
    references public.sales (tenant_id, id) on delete restrict,
  foreign key (tenant_id, branch_id)
    references public.branches (tenant_id, id) on delete restrict,
  constraint payments_positive_amount check (amount > 0)
);

create index payments_sale on public.payments (tenant_id, sale_id);
create index payments_branch_time on public.payments (tenant_id, branch_id, created_at desc);

create function public.receive_inventory(
  target_tenant_id uuid,
  target_branch_id uuid,
  target_product_id uuid,
  received_quantity numeric,
  received_unit_cost numeric,
  request_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  existing_movement_id uuid;
  new_movement_id uuid;
  product_active boolean;
  previous_quantity numeric(14, 3);
  previous_average_cost numeric(14, 2);
  updated_average_cost numeric(14, 2);
begin
  if caller_id is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;

  if not private.has_tenant_role(
    target_tenant_id,
    array['owner', 'administrator', 'manager']::public.business_role[]
  ) or not private.can_access_branch(target_tenant_id, target_branch_id) then
    raise exception using errcode = '42501', message = 'Not authorized to receive inventory at this branch';
  end if;

  if received_quantity is null or received_quantity <= 0 or received_quantity > 100000 then
    raise exception using errcode = '22023', message = 'Received quantity must be greater than zero';
  end if;
  if received_unit_cost is null or received_unit_cost < 0 then
    raise exception using errcode = '22023', message = 'Unit cost cannot be negative';
  end if;
  if char_length(coalesce(request_idempotency_key, '')) not between 16 and 160 then
    raise exception using errcode = '22023', message = 'A valid idempotency key is required';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(target_tenant_id::text || request_idempotency_key, 0)
  );

  select id into existing_movement_id
  from public.inventory_movements
  where tenant_id = target_tenant_id
    and idempotency_key = request_idempotency_key;
  if existing_movement_id is not null then
    return existing_movement_id;
  end if;

  select is_active into product_active
  from public.products
  where tenant_id = target_tenant_id and id = target_product_id
  for share;
  if not found or not product_active then
    raise exception using errcode = '22023', message = 'Product is not available in this business';
  end if;

  select quantity_on_hand, average_unit_cost
  into previous_quantity, previous_average_cost
  from public.branch_inventory
  where tenant_id = target_tenant_id
    and branch_id = target_branch_id
    and product_id = target_product_id
  for update;

  previous_quantity := coalesce(previous_quantity, 0);
  previous_average_cost := coalesce(previous_average_cost, 0);
  updated_average_cost := case
    when previous_quantity + received_quantity = 0 then received_unit_cost
    else round(
      (
        previous_quantity * previous_average_cost
        + received_quantity * received_unit_cost
      ) / (previous_quantity + received_quantity),
      2
    )
  end;

  insert into public.branch_inventory (
    tenant_id,
    branch_id,
    product_id,
    quantity_on_hand,
    average_unit_cost,
    updated_at
  )
  values (
    target_tenant_id,
    target_branch_id,
    target_product_id,
    previous_quantity + received_quantity,
    updated_average_cost,
    now()
  )
  on conflict (tenant_id, branch_id, product_id) do update
  set quantity_on_hand = excluded.quantity_on_hand,
      average_unit_cost = excluded.average_unit_cost,
      updated_at = excluded.updated_at;

  insert into public.inventory_movements (
    tenant_id,
    branch_id,
    product_id,
    movement_type,
    quantity_delta,
    unit_cost_snapshot,
    idempotency_key,
    created_by
  )
  values (
    target_tenant_id,
    target_branch_id,
    target_product_id,
    'receipt',
    received_quantity,
    received_unit_cost,
    request_idempotency_key,
    caller_id
  )
  returning id into new_movement_id;

  return new_movement_id;
end;
$$;

create function public.post_sale(
  target_tenant_id uuid,
  target_branch_id uuid,
  request_idempotency_key text,
  sale_items jsonb,
  sale_payments jsonb default '[]'::jsonb,
  sale_occurred_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  existing_sale_id uuid;
  new_sale_id uuid;
  transaction_ref text;
  line_entry jsonb;
  payment_entry jsonb;
  product_record record;
  stock_record record;
  payment_method_text text;
  requested_quantity numeric;
  payment_amount numeric;
  total_amount numeric(14, 2) := 0;
  amount_paid numeric(14, 2) := 0;
  distinct_product_count integer := 0;
  locked_product_count integer := 0;
begin
  if caller_id is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;

  if not private.has_tenant_role(
    target_tenant_id,
    array['owner', 'administrator', 'manager', 'cashier']::public.business_role[]
  ) or not private.can_access_branch(target_tenant_id, target_branch_id) then
    raise exception using errcode = '42501', message = 'Not authorized to post sales at this branch';
  end if;

  if char_length(coalesce(request_idempotency_key, '')) not between 16 and 160 then
    raise exception using errcode = '22023', message = 'A valid idempotency key is required';
  end if;
  if jsonb_typeof(sale_items) <> 'array'
    or jsonb_array_length(sale_items) < 1
    or jsonb_array_length(sale_items) > 100 then
    raise exception using errcode = '22023', message = 'A sale must contain between 1 and 100 lines';
  end if;
  if jsonb_typeof(sale_payments) <> 'array'
    or jsonb_array_length(sale_payments) > 10 then
    raise exception using errcode = '22023', message = 'Sale payments must be a JSON array with at most 10 entries';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(target_tenant_id::text || request_idempotency_key, 0)
  );

  select id into existing_sale_id
  from public.sales
  where tenant_id = target_tenant_id
    and idempotency_key = request_idempotency_key;
  if existing_sale_id is not null then
    return existing_sale_id;
  end if;

  for line_entry in select value from jsonb_array_elements(sale_items) as item(value)
  loop
    if coalesce(line_entry ->> 'product_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or coalesce(line_entry ->> 'quantity', '') !~ '^[0-9]+(\.[0-9]{1,3})?$' then
      raise exception using errcode = '22023', message = 'Sale line contains an invalid product or quantity';
    end if;

    requested_quantity := (line_entry ->> 'quantity')::numeric;
    if requested_quantity <= 0 or requested_quantity > 100000 then
      raise exception using errcode = '22023', message = 'Sale quantity must be greater than zero';
    end if;

    select id, name, sku, selling_price, is_active
    into product_record
    from public.products
    where tenant_id = target_tenant_id
      and id = (line_entry ->> 'product_id')::uuid
    for share;
    if not found or not product_record.is_active then
      raise exception using errcode = '22023', message = 'Product is not available in this business';
    end if;

    total_amount := total_amount + round(requested_quantity * product_record.selling_price, 2);
  end loop;

  for payment_entry in select value from jsonb_array_elements(sale_payments) as payment(value)
  loop
    payment_method_text := coalesce(payment_entry ->> 'method', '');
    if payment_method_text not in ('cash', 'mtn_momo', 'airtel_money', 'zamtel_money', 'bank')
      or coalesce(payment_entry ->> 'amount', '') !~ '^[0-9]+(\.[0-9]{1,2})?$' then
      raise exception using errcode = '22023', message = 'Sale payment contains an invalid method or amount';
    end if;

    payment_amount := (payment_entry ->> 'amount')::numeric;
    if payment_amount <= 0 then
      raise exception using errcode = '22023', message = 'Payment amount must be greater than zero';
    end if;
    amount_paid := amount_paid + payment_amount;
  end loop;

  if total_amount <= 0 or amount_paid > total_amount then
    raise exception using errcode = '22023', message = 'Payments cannot exceed the sale total';
  end if;

  for stock_record in
    select distinct (item.value ->> 'product_id')::uuid as product_id
    from jsonb_array_elements(sale_items) as item(value)
    order by product_id
  loop
    locked_product_count := locked_product_count + 1;

    select quantity_on_hand
    into stock_record.quantity_on_hand
    from public.branch_inventory
    where tenant_id = target_tenant_id
      and branch_id = target_branch_id
      and product_id = stock_record.product_id
    for update;

    if not found then
      raise exception using errcode = '23514', message = 'Insufficient stock for one or more sale items';
    end if;

    select sum((item.value ->> 'quantity')::numeric)
    into requested_quantity
    from jsonb_array_elements(sale_items) as item(value)
    where (item.value ->> 'product_id')::uuid = stock_record.product_id;

    if stock_record.quantity_on_hand < requested_quantity then
      raise exception using errcode = '23514', message = 'Insufficient stock for one or more sale items';
    end if;
  end loop;

  select count(distinct (item.value ->> 'product_id')::uuid)
  into distinct_product_count
  from jsonb_array_elements(sale_items) as item(value);
  if locked_product_count <> distinct_product_count then
    raise exception using errcode = '23514', message = 'Inventory could not be locked';
  end if;

  transaction_ref := 'S-' || to_char(now() at time zone 'UTC', 'YYYYMMDD')
    || '-' || upper(substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 10));

  insert into public.sales (
    tenant_id,
    branch_id,
    transaction_number,
    idempotency_key,
    created_by,
    occurred_at,
    total_amount,
    amount_paid,
    payment_state
  )
  values (
    target_tenant_id,
    target_branch_id,
    transaction_ref,
    request_idempotency_key,
    caller_id,
    coalesce(sale_occurred_at, now()),
    total_amount,
    amount_paid,
    case
      when amount_paid = 0 then 'unpaid'
      when amount_paid < total_amount then 'partial'
      else 'paid'
    end
  )
  returning id into new_sale_id;

  for line_entry in select value from jsonb_array_elements(sale_items) as item(value)
  loop
    select product.name, product.sku, product.selling_price, stock.average_unit_cost
    into product_record
    from public.products as product
    join public.branch_inventory as stock
      on stock.tenant_id = product.tenant_id
      and stock.product_id = product.id
      and stock.branch_id = target_branch_id
    where product.tenant_id = target_tenant_id
      and product.id = (line_entry ->> 'product_id')::uuid;

    requested_quantity := (line_entry ->> 'quantity')::numeric;
    insert into public.sale_items (
      tenant_id,
      sale_id,
      branch_id,
      product_id,
      product_name_snapshot,
      sku_snapshot,
      quantity,
      unit_price,
      unit_cost_snapshot,
      line_total
    )
    values (
      target_tenant_id,
      new_sale_id,
      target_branch_id,
      (line_entry ->> 'product_id')::uuid,
      product_record.name,
      product_record.sku,
      requested_quantity,
      product_record.selling_price,
      product_record.average_unit_cost,
      round(requested_quantity * product_record.selling_price, 2)
    );
  end loop;

  for stock_record in
    select distinct (item.value ->> 'product_id')::uuid as product_id
    from jsonb_array_elements(sale_items) as item(value)
    order by product_id
  loop
    select sum((item.value ->> 'quantity')::numeric)
    into requested_quantity
    from jsonb_array_elements(sale_items) as item(value)
    where (item.value ->> 'product_id')::uuid = stock_record.product_id;

    update public.branch_inventory
    set quantity_on_hand = quantity_on_hand - requested_quantity,
        updated_at = now()
    where tenant_id = target_tenant_id
      and branch_id = target_branch_id
      and product_id = stock_record.product_id;

    select average_unit_cost into product_record
    from public.branch_inventory
    where tenant_id = target_tenant_id
      and branch_id = target_branch_id
      and product_id = stock_record.product_id;

    insert into public.inventory_movements (
      tenant_id,
      branch_id,
      product_id,
      movement_type,
      quantity_delta,
      unit_cost_snapshot,
      idempotency_key,
      reference_id,
      created_by,
      occurred_at
    )
    values (
      target_tenant_id,
      target_branch_id,
      stock_record.product_id,
      'sale',
      -requested_quantity,
      product_record.average_unit_cost,
      request_idempotency_key || ':' || stock_record.product_id::text,
      new_sale_id,
      caller_id,
      coalesce(sale_occurred_at, now())
    );
  end loop;

  for payment_entry in select value from jsonb_array_elements(sale_payments) as payment(value)
  loop
    payment_method_text := payment_entry ->> 'method';
    insert into public.payments (
      tenant_id,
      sale_id,
      branch_id,
      method,
      amount,
      status,
      created_by
    )
    values (
      target_tenant_id,
      new_sale_id,
      target_branch_id,
      payment_method_text::public.payment_method,
      (payment_entry ->> 'amount')::numeric,
      case when payment_method_text = 'cash' then 'recorded'::public.payment_status
           else 'pending'::public.payment_status end,
      caller_id
    );
  end loop;

  return new_sale_id;
end;
$$;

revoke all on function public.receive_inventory(uuid, uuid, uuid, numeric, numeric, text) from public, anon;
revoke all on function public.post_sale(uuid, uuid, text, jsonb, jsonb, timestamptz) from public, anon;
grant execute on function public.receive_inventory(uuid, uuid, uuid, numeric, numeric, text) to authenticated;
grant execute on function public.post_sale(uuid, uuid, text, jsonb, jsonb, timestamptz) to authenticated;

alter table public.products enable row level security;
alter table public.branch_inventory enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.payments enable row level security;

revoke all on public.products, public.branch_inventory, public.inventory_movements,
  public.sales, public.sale_items, public.payments from anon, authenticated;

grant select on public.products to authenticated;
grant insert (tenant_id, name, sku, unit_cost_estimate, selling_price, created_by)
  on public.products to authenticated;
grant update (name, sku, unit_cost_estimate, selling_price, is_active)
  on public.products to authenticated;
grant select on public.branch_inventory, public.inventory_movements,
  public.sales, public.sale_items, public.payments to authenticated;

create policy products_read_members
  on public.products for select to authenticated
  using (private.is_tenant_member(tenant_id));

create policy products_insert_managers
  on public.products for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and private.has_tenant_role(
      tenant_id,
      array['owner', 'administrator', 'manager']::public.business_role[]
    )
  );

create policy products_update_managers
  on public.products for update to authenticated
  using (
    private.has_tenant_role(
      tenant_id,
      array['owner', 'administrator', 'manager']::public.business_role[]
    )
  )
  with check (
    private.has_tenant_role(
      tenant_id,
      array['owner', 'administrator', 'manager']::public.business_role[]
    )
  );

create policy branch_inventory_read_accessible
  on public.branch_inventory for select to authenticated
  using (private.can_access_branch(tenant_id, branch_id));

create policy inventory_movements_read_accessible
  on public.inventory_movements for select to authenticated
  using (private.can_access_branch(tenant_id, branch_id));

create policy sales_read_accessible
  on public.sales for select to authenticated
  using (private.can_access_branch(tenant_id, branch_id));

create policy sale_items_read_accessible
  on public.sale_items for select to authenticated
  using (private.can_access_branch(tenant_id, branch_id));

create policy payments_read_accessible
  on public.payments for select to authenticated
  using (private.can_access_branch(tenant_id, branch_id));

comment on table public.products is 'Tenant-wide product catalogue with NUMERIC prices and cost estimates.';
comment on table public.branch_inventory is 'Branch stock and weighted-average unit cost; writes are only allowed through server RPCs.';
comment on table public.inventory_movements is 'Immutable stock movement history. All stock changes are made through audited server operations.';
comment on table public.sales is 'Server-posted sales with snapshots and a tenant-scoped idempotency key.';
comment on table public.payments is 'Recorded cash payments and pending external payment methods; no live mobile-money integration is implied.';