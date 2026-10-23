-- ==============================================================================
-- SmartPDS (Intelligent Commodity Stock Allocation & Strict FIFO Engine)
-- Migration: 001_initial_schema.sql
-- Database: PostgreSQL 15+ (Supabase)
-- ==============================================================================

-- 1. EXTENSIONS
create extension if not exists "uuid-ossp";

-- ==============================================================================
-- 2. ENUMS & DOMAINS
-- ==============================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'pds_user_role') then
    create type pds_user_role as enum ('Administrator', 'Warehouse Operator', 'Ration Shop Dealer');
  end if;
  if not exists (select 1 from pg_type where typname = 'pds_batch_status') then
    create type pds_batch_status as enum ('Eligible', 'Quarantined', 'Damaged', 'Exhausted');
  end if;
  if not exists (select 1 from pg_type where typname = 'pds_quality_grade') then
    create type pds_quality_grade as enum ('Grade-I (FAQ)', 'Grade-II', 'Sub-Standard');
  end if;
  if not exists (select 1 from pg_type where typname = 'pds_dispatch_status') then
    create type pds_dispatch_status as enum ('Dispatched', 'In Transit', 'Delivered');
  end if;
end $$;

-- ==============================================================================
-- 3. TABLES DEFINITION (14 Core SmartPDS Tables)
-- ==============================================================================

-- Table 1: user_profiles (Linked to Supabase auth.users)
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null,
  role text not null check (role in ('Administrator', 'Warehouse Operator', 'Ration Shop Dealer')),
  designation text not null default 'Civil Supplies Personnel',
  department text not null default 'Food, Civil Supplies & Consumer Affairs',
  is_active boolean not null default true,
  last_login timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Table 2: commodities
create table if not exists public.commodities (
  id text primary key, -- e.g. 'Rice', 'Wheat', 'Sugar', 'Coarse Grains', 'Pulses'
  name text not null,
  category text not null check (category in ('Foodgrain', 'Sugar', 'Pulse', 'Nutri-Cereal')),
  standard_bag_weight_kg numeric(6,2) not null default 50.00 check (standard_bag_weight_kg > 0),
  max_permissible_moisture numeric(4,2) not null check (max_permissible_moisture >= 0),
  buffer_norm_qtl numeric(12,2) not null default 0.00 check (buffer_norm_qtl >= 0),
  msp_per_qtl numeric(10,2) not null default 0.00 check (msp_per_qtl >= 0),
  subsidized_rate_per_kg numeric(6,2) not null default 0.00 check (subsidized_rate_per_kg >= 0),
  description text not null,
  created_at timestamptz not null default now()
);

-- Table 3: fair_price_shops
create table if not exists public.fair_price_shops (
  id text primary key, -- e.g. 'FPS-KA-29-014'
  code text not null unique,
  name text not null,
  taluk text not null,
  district text not null,
  dealer_name text not null,
  contact_number text not null,
  active_cards_count integer not null default 0 check (active_cards_count >= 0),
  created_at timestamptz not null default now()
);

-- Table 4: depot_settings
create table if not exists public.depot_settings (
  id text primary key, -- 'default' or depot code
  depot_name text not null,
  depot_code text not null,
  district text not null,
  state text not null default 'Karnataka',
  total_capacity_bags integer not null check (total_capacity_bags > 0),
  max_moisture_allowed_percent numeric(4,2) not null check (max_moisture_allowed_percent > 0),
  mandatory_manager_approval_bags_threshold integer not null check (mandatory_manager_approval_bags_threshold >= 0),
  ageing_warning_days integer not null default 90,
  ageing_critical_days integer not null default 150,
  operating_hours text not null default '08:00 AM - 06:30 PM (Mon-Sat)',
  officer_in_charge text not null,
  updated_at timestamptz not null default now()
);

-- Table 5: batches
create table if not exists public.batches (
  id text primary key, -- e.g. 'BATCH-RC-2026-001'
  commodity text not null references public.commodities(id) on update cascade,
  variety text not null,
  received_date date not null,
  expiry_date date,
  initial_bags integer not null check (initial_bags >= 0),
  available_bags integer not null check (available_bags >= 0),
  bag_weight_kg numeric(6,2) not null default 50.00 check (bag_weight_kg > 0),
  total_received_qtl numeric(12,2) not null check (total_received_qtl >= 0),
  available_qtl numeric(12,2) not null check (available_qtl >= 0),
  depot_location text not null,
  warehouse_name text not null,
  moisture_percentage numeric(5,2) not null check (moisture_percentage >= 0),
  quality_inspection_grade text not null check (quality_inspection_grade in ('Grade-I (FAQ)', 'Grade-II', 'Sub-Standard')),
  status text not null check (status in ('Eligible', 'Quarantined', 'Damaged', 'Exhausted')),
  status_reason text,
  supplier_source text not null,
  stock_age_days integer not null default 0 check (stock_age_days >= 0),
  notes text,
  movements jsonb not null default '[]'::jsonb,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Table 6: inward_receipts
create table if not exists public.inward_receipts (
  id text primary key, -- e.g. 'INW-2026-059'
  batch_id text references public.batches(id) on delete set null,
  commodity text not null references public.commodities(id) on update cascade,
  variety text not null,
  received_date date not null,
  bags integer not null check (bags > 0),
  bag_weight_kg numeric(6,2) not null default 50.00 check (bag_weight_kg > 0),
  total_qtl numeric(12,2) not null check (total_qtl > 0),
  moisture_percentage numeric(5,2) not null check (moisture_percentage >= 0),
  quality_grade text not null,
  supplier_source text not null,
  vehicle_number text not null,
  gate_pass_no text not null,
  depot_location text not null,
  driver_name text,
  driver_phone text,
  weighbridge_slip_no text,
  gross_weight_kg numeric(12,2),
  tare_weight_kg numeric(12,2),
  net_weight_kg numeric(12,2),
  inspected_by text,
  status text not null default 'Accepted' check (status in ('Accepted', 'Quarantined', 'Rejected')),
  notes text,
  created_at timestamptz not null default now()
);

-- Table 7: dispatches
create table if not exists public.dispatches (
  challan_number text primary key, -- e.g. 'PDS-CH-2026-0814'
  idempotency_key text unique,
  issuer_uid uuid references auth.users(id) on delete set null,
  depot_id text,
  depot_name text,
  timestamp timestamptz not null default now(),
  commodity text not null references public.commodities(id) on update cascade,
  variety text not null,
  total_bags integer not null check (total_bags > 0),
  total_qtl numeric(12,2) not null check (total_qtl > 0),
  destination_fps_id text not null references public.fair_price_shops(id) on update cascade,
  destination_name text not null,
  destination_district text not null,
  destination_address text not null,
  vehicle_number text not null,
  driver_name text not null,
  driver_phone text not null,
  transporter_agency text not null,
  gate_pass_no text not null,
  allocated_batches jsonb not null default '[]'::jsonb,
  status text not null default 'Dispatched' check (status in ('Dispatched', 'In Transit', 'Delivered')),
  dispatched_by text not null,
  authorized_by text not null,
  remarks text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

-- Table 8: stock_transactions
create table if not exists public.stock_transactions (
  id text primary key, -- e.g. 'TX-2026-10293'
  timestamp timestamptz not null default now(),
  date date not null,
  action text not null check (action in ('RECEIPT', 'DISPATCH', 'STATUS_CHANGE', 'ADJUSTMENT')),
  batch_id text not null references public.batches(id) on delete cascade,
  commodity text not null references public.commodities(id) on update cascade,
  variety text not null,
  quantity_bags integer not null,
  quantity_qtl numeric(12,2) not null,
  reference_id text not null,
  user_name text not null,
  user_role text,
  depot_location text,
  notes text,
  created_at timestamptz not null default now()
);

-- Table 9: audit_logs (Strict Append-Only Immutable System Ledger)
create table if not exists public.audit_logs (
  id text primary key, -- e.g. 'AUD-2026-1001'
  timestamp timestamptz not null default now(),
  user_name text not null,
  role text not null check (role in ('Administrator', 'Warehouse Operator', 'Ration Shop Dealer')),
  action text not null check (action in ('STOCK_RECEIPT', 'FIFO_DISPATCH', 'STATUS_CHANGE', 'BATCH_UPDATE', 'DEMO_RESET', 'RECONCILIATION', 'FIFO_EXCEPTION', 'APPROVAL', 'RETURN_LOGGED')),
  entity text not null,
  reference_id text not null,
  result text not null check (result in ('SUCCESS', 'WARNING', 'REJECTED')),
  details text not null,
  created_at timestamptz not null default now()
);

-- Table 10: delivery_tracking
create table if not exists public.delivery_tracking (
  id text primary key, -- e.g. 'TRK-2026-091'
  challan_number text not null references public.dispatches(challan_number) on delete cascade,
  vehicle_number text not null,
  transporter text not null,
  driver_name text not null,
  driver_phone text not null,
  destination_fps text not null,
  commodity text not null,
  bags integer not null check (bags > 0),
  dispatched_at timestamptz not null,
  estimated_delivery_at timestamptz not null,
  current_milestone text not null check (current_milestone in ('Gate Pass Issued', 'Weighbridge Exit', 'In Transit', 'Arrived at FPS', 'Inspected & Unloaded', 'Delivered Verified')),
  status text not null check (status in ('In Transit', 'Delivered', 'Delayed', 'Exception')),
  gps_location text not null,
  otp_verified boolean not null default false,
  transit_updates jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Table 11: returns
create table if not exists public.returns (
  id text primary key, -- e.g. 'RET-2026-003'
  challan_number text not null references public.dispatches(challan_number) on delete cascade,
  fps_name text not null,
  commodity text not null,
  dispatched_bags integer not null check (dispatched_bags >= 0),
  received_bags integer not null check (received_bags >= 0),
  damaged_bags integer not null default 0 check (damaged_bags >= 0),
  missing_bags integer not null default 0 check (missing_bags >= 0),
  shortage_weight_kg numeric(8,2) not null default 0.00 check (shortage_weight_kg >= 0),
  report_date date not null,
  discrepancy_type text not null check (discrepancy_type in ('Transit Moisture Loss', 'Bag Tear / Spillage', 'Damaged by Water', 'Count Shortage')),
  status text not null check (status in ('Logged', 'Under Investigation', 'Restocked / Reconciled', 'Claim Filed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Table 12: reconciliations
create table if not exists public.reconciliations (
  id text primary key, -- e.g. 'REC-2026-0881'
  batch_id text not null references public.batches(id) on delete cascade,
  commodity text not null,
  variety text not null,
  bay text not null,
  system_bags integer not null check (system_bags >= 0),
  physical_counted_bags integer not null check (physical_counted_bags >= 0),
  variance_bags integer not null,
  variance_qtl numeric(8,2) not null,
  reconciled_date date not null,
  auditor_name text not null,
  status text not null check (status in ('Reconciled', 'Discrepancy', 'Pending Approval', 'Adjusted')),
  variance_reason text,
  created_at timestamptz not null default now()
);

-- Table 13: approval_requests
create table if not exists public.approval_requests (
  id text primary key, -- e.g. 'APR-2026-044'
  type text not null check (type in ('FIFO_EXCEPTION', 'STOCK_ADJUSTMENT', 'QUARANTINE_RELEASE', 'OVERSIZE_DISPATCH')),
  title text not null,
  requested_by text not null,
  requested_role text not null check (requested_role in ('Administrator', 'Warehouse Operator', 'Ration Shop Dealer')),
  requested_date timestamptz not null default now(),
  status text not null default 'Pending' check (status in ('Pending', 'Approved', 'Rejected')),
  details text not null,
  impact text not null,
  reference_id text not null,
  reviewed_by text,
  reviewed_date timestamptz,
  remarks text,
  created_at timestamptz not null default now()
);

-- Table 14: fifo_exceptions
create table if not exists public.fifo_exceptions (
  id text primary key, -- e.g. 'EXC-2026-012'
  timestamp timestamptz not null default now(),
  requested_commodity text not null,
  requested_variety text not null,
  requested_bags integer not null check (requested_bags > 0),
  skipped_batch_id text not null references public.batches(id) on delete cascade,
  skipped_batch_age_days integer not null default 0,
  allocated_batch_id text not null references public.batches(id) on delete cascade,
  allocated_batch_age_days integer not null default 0,
  justification_reason text not null,
  requested_by text not null,
  status text not null default 'Pending Approval' check (status in ('Pending Approval', 'Approved', 'Rejected')),
  approved_by text,
  approval_remarks text,
  created_at timestamptz not null default now()
);

-- ==============================================================================
-- 4. PERFORMANCE & LOOKUP INDEXES
-- ==============================================================================
create index if not exists idx_batches_fifo on public.batches (commodity, status, received_date asc, available_bags desc);
create index if not exists idx_batches_status on public.batches (status);
create index if not exists idx_batches_commodity on public.batches (commodity);
create index if not exists idx_dispatches_timestamp on public.dispatches (timestamp desc);
create index if not exists idx_dispatches_fps on public.dispatches (destination_fps_id);
create index if not exists idx_stock_tx_batch on public.stock_transactions (batch_id, timestamp desc);
create index if not exists idx_audit_timestamp on public.audit_logs (timestamp desc);
create index if not exists idx_delivery_challan on public.delivery_tracking (challan_number);
create index if not exists idx_returns_challan on public.returns (challan_number);
create index if not exists idx_approvals_status on public.approval_requests (status, requested_date desc);
create index if not exists idx_fifo_exc_status on public.fifo_exceptions (status);

-- ==============================================================================
-- 5. ROW LEVEL SECURITY (RLS) HELPER FUNCTIONS
-- ==============================================================================
-- Never trust client-supplied claims: dynamically resolve user role from authoritative user_profiles table.
create or replace function public.current_user_role()
returns text language sql stable security definer
set search_path = public
as $$
  select coalesce((select role from public.user_profiles where id = auth.uid() and is_active = true), 'Ration Shop Dealer');
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'Administrator' and is_active = true
  );
$$;

create or replace function public.is_operator_or_admin()
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role in ('Administrator', 'Warehouse Operator') and is_active = true
  );
$$;

-- Trigger to prevent non-admins from self-elevating their role
create or replace function public.enforce_user_profile_security()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  -- Prevent privilege escalation on INSERT
  if tg_op = 'INSERT' then
    if new.role in ('Administrator', 'Warehouse Operator') and not public.is_admin() then
      -- If inserting own profile upon signup, force safe default unless an admin is executing
      if (select count(*) from public.user_profiles) > 0 then
        new.role := 'Ration Shop Dealer';
      end if;
    end if;
  end if;

  -- Prevent privilege escalation on UPDATE
  if tg_op = 'UPDATE' then
    if new.role is distinct from old.role and not public.is_admin() then
      raise exception 'Unauthorized: Only an Administrator can modify user roles or security privileges.';
    end if;
    new.updated_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_user_profile_security on public.user_profiles;
create trigger trg_user_profile_security
  before insert or update on public.user_profiles
  for each row execute function public.enforce_user_profile_security();

-- ==============================================================================
-- 6. ENABLE ROW LEVEL SECURITY ON ALL 14 TABLES
-- ==============================================================================
alter table public.user_profiles enable row level security;
alter table public.commodities enable row level security;
alter table public.fair_price_shops enable row level security;
alter table public.depot_settings enable row level security;
alter table public.batches enable row level security;
alter table public.inward_receipts enable row level security;
alter table public.dispatches enable row level security;
alter table public.stock_transactions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.delivery_tracking enable row level security;
alter table public.returns enable row level security;
alter table public.reconciliations enable row level security;
alter table public.approval_requests enable row level security;
alter table public.fifo_exceptions enable row level security;

-- ==============================================================================
-- 7. LEAST-PRIVILEGE RLS POLICIES
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- Table 1: user_profiles
-- ------------------------------------------------------------------------------
create policy "user_profiles_select_self_or_admin"
  on public.user_profiles for select
  using (auth.uid() = id or public.is_admin());

create policy "user_profiles_insert_own_or_admin"
  on public.user_profiles for insert
  with check (auth.uid() = id or public.is_admin());

create policy "user_profiles_update_own_or_admin"
  on public.user_profiles for update
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

-- ------------------------------------------------------------------------------
-- Table 2: commodities
-- ------------------------------------------------------------------------------
create policy "commodities_select_authenticated"
  on public.commodities for select
  to authenticated
  using (true);

create policy "commodities_write_admin"
  on public.commodities for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------------------------------------------------------
-- Table 3: fair_price_shops
-- ------------------------------------------------------------------------------
create policy "fair_price_shops_select_authenticated"
  on public.fair_price_shops for select
  to authenticated
  using (true);

create policy "fair_price_shops_write_admin"
  on public.fair_price_shops for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------------------------------------------------------
-- Table 4: depot_settings
-- ------------------------------------------------------------------------------
create policy "depot_settings_select_authenticated"
  on public.depot_settings for select
  to authenticated
  using (true);

create policy "depot_settings_write_operator_admin"
  on public.depot_settings for all
  to authenticated
  using (public.is_operator_or_admin())
  with check (public.is_operator_or_admin());

-- ------------------------------------------------------------------------------
-- Table 5: batches
-- ------------------------------------------------------------------------------
create policy "batches_select_authenticated"
  on public.batches for select
  to authenticated
  using (true);

create policy "batches_write_operator_admin"
  on public.batches for all
  to authenticated
  using (public.is_operator_or_admin())
  with check (public.is_operator_or_admin());

-- ------------------------------------------------------------------------------
-- Table 6: inward_receipts
-- ------------------------------------------------------------------------------
create policy "inward_receipts_select_authenticated"
  on public.inward_receipts for select
  to authenticated
  using (true);

create policy "inward_receipts_write_operator_admin"
  on public.inward_receipts for all
  to authenticated
  using (public.is_operator_or_admin())
  with check (public.is_operator_or_admin());

-- ------------------------------------------------------------------------------
-- Table 7: dispatches
-- ------------------------------------------------------------------------------
create policy "dispatches_select_authenticated"
  on public.dispatches for select
  to authenticated
  using (true);

create policy "dispatches_insert_operator_admin"
  on public.dispatches for insert
  to authenticated
  with check (public.is_operator_or_admin());

create policy "dispatches_update_authorized"
  on public.dispatches for update
  to authenticated
  using (public.is_operator_or_admin())
  with check (public.is_operator_or_admin());

-- ------------------------------------------------------------------------------
-- Table 8: stock_transactions
-- ------------------------------------------------------------------------------
create policy "stock_transactions_select_authenticated"
  on public.stock_transactions for select
  to authenticated
  using (true);

create policy "stock_transactions_insert_operator_admin"
  on public.stock_transactions for insert
  to authenticated
  with check (public.is_operator_or_admin());

-- ------------------------------------------------------------------------------
-- Table 9: audit_logs (Append-Only: Strictly no UPDATE or DELETE)
-- ------------------------------------------------------------------------------
create policy "audit_logs_select_authenticated"
  on public.audit_logs for select
  to authenticated
  using (true);

create policy "audit_logs_insert_authenticated"
  on public.audit_logs for insert
  to authenticated
  with check (true);

-- ------------------------------------------------------------------------------
-- Table 10: delivery_tracking
-- ------------------------------------------------------------------------------
create policy "delivery_tracking_select_authenticated"
  on public.delivery_tracking for select
  to authenticated
  using (true);

create policy "delivery_tracking_insert_operator_admin"
  on public.delivery_tracking for insert
  to authenticated
  with check (public.is_operator_or_admin());

create policy "delivery_tracking_update_authorized"
  on public.delivery_tracking for update
  to authenticated
  using (true)
  with check (true);

-- ------------------------------------------------------------------------------
-- Table 11: returns
-- ------------------------------------------------------------------------------
create policy "returns_select_authenticated"
  on public.returns for select
  to authenticated
  using (true);

create policy "returns_insert_authenticated"
  on public.returns for insert
  to authenticated
  with check (true);

create policy "returns_update_operator_admin"
  on public.returns for update
  to authenticated
  using (public.is_operator_or_admin())
  with check (public.is_operator_or_admin());

-- ------------------------------------------------------------------------------
-- Table 12: reconciliations
-- ------------------------------------------------------------------------------
create policy "reconciliations_select_authenticated"
  on public.reconciliations for select
  to authenticated
  using (true);

create policy "reconciliations_insert_operator_admin"
  on public.reconciliations for insert
  to authenticated
  with check (public.is_operator_or_admin());

create policy "reconciliations_update_admin"
  on public.reconciliations for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------------------------------------------------------
-- Table 13: approval_requests
-- ------------------------------------------------------------------------------
create policy "approval_requests_select_authenticated"
  on public.approval_requests for select
  to authenticated
  using (true);

create policy "approval_requests_insert_operator_admin"
  on public.approval_requests for insert
  to authenticated
  with check (public.is_operator_or_admin());

create policy "approval_requests_update_admin"
  on public.approval_requests for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------------------------------------------------------
-- Table 14: fifo_exceptions
-- ------------------------------------------------------------------------------
create policy "fifo_exceptions_select_authenticated"
  on public.fifo_exceptions for select
  to authenticated
  using (true);

create policy "fifo_exceptions_insert_operator_admin"
  on public.fifo_exceptions for insert
  to authenticated
  with check (public.is_operator_or_admin());

create policy "fifo_exceptions_update_admin"
  on public.fifo_exceptions for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ==============================================================================
-- 8. INITIAL SEED DATA (Non-Destructive Reference Data: Commodities & Settings)
-- ==============================================================================
insert into public.commodities (id, name, category, standard_bag_weight_kg, max_permissible_moisture, buffer_norm_qtl, msp_per_qtl, subsidized_rate_per_kg, description)
values
  ('Rice', 'Rice', 'Foodgrain', 50.00, 14.00, 12000.00, 2300.00, 3.00, 'Fair Average Quality (FAQ) milled parboiled & raw rice for NFSA distribution.'),
  ('Wheat', 'Wheat', 'Foodgrain', 50.00, 12.00, 8000.00, 2275.00, 2.00, 'High-protein whole milling wheat stock under FCI central pool allocation.'),
  ('Sugar', 'Sugar', 'Sugar', 50.00, 0.50, 1500.00, 3800.00, 13.50, 'Refined crystal sugar allocated under Antyodaya Anna Yojana (AAY).'),
  ('Coarse Grains', 'Coarse Grains', 'Nutri-Cereal', 50.00, 13.00, 3000.00, 2150.00, 1.00, 'Kharif sorghum, jowar, ragi and millets procured under decentralised scheme.'),
  ('Pulses', 'Pulses', 'Pulse', 50.00, 11.00, 2500.00, 6600.00, 15.00, 'Processed split pulses (tur/chana) distributed via state social welfare quotas.')
on conflict (id) do update set
  description = excluded.description,
  msp_per_qtl = excluded.msp_per_qtl;

insert into public.depot_settings (id, depot_name, depot_code, district, state, total_capacity_bags, max_moisture_allowed_percent, mandatory_manager_approval_bags_threshold, ageing_warning_days, ageing_critical_days, operating_hours, officer_in_charge)
values
  ('default', 'FCI District Base Depot #4', 'FCI-KA-DWR-004', 'Dharwad', 'Karnataka', 45000, 14.00, 200, 90, 150, '08:00 AM - 06:30 PM (Mon-Sat)', 'Anand Kumar (Area Manager - Operations)')
on conflict (id) do nothing;
