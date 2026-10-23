-- ==============================================================================
-- SmartPDS Migration: 003_fifo_and_stock_rpcs.sql
-- Authoritative Server-Side Strict FIFO Allocation & Stock Transaction RPCs
-- ==============================================================================

-- 1. Ensure RLS allows reference data reads for depot setup
alter policy "commodities_select_authenticated" on public.commodities
  rename to "commodities_select_all";
drop policy if exists "commodities_select_all" on public.commodities;
create policy "commodities_select_all"
  on public.commodities for select
  using (true);

drop policy if exists "fair_price_shops_select_all" on public.fair_price_shops;
create policy "fair_price_shops_select_all"
  on public.fair_price_shops for select
  using (true);

drop policy if exists "depot_settings_select_all" on public.depot_settings;
create policy "depot_settings_select_all"
  on public.depot_settings for select
  using (true);

-- Ensure commodities table has standard NFSA reference rows
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

-- Ensure default depot settings exists
insert into public.depot_settings (id, depot_name, depot_code, district, state, total_capacity_bags, max_moisture_allowed_percent, mandatory_manager_approval_bags_threshold, ageing_warning_days, ageing_critical_days, operating_hours, officer_in_charge)
values
  ('default', 'FCI District Base Depot #4', 'FCI-KA-DWR-004', 'Dharwad', 'Karnataka', 45000, 14.00, 200, 90, 150, '08:00 AM - 06:30 PM (Mon-Sat)', 'Anand Kumar (Area Manager - Operations)')
on conflict (id) do nothing;

-- Ensure initial Fair Price Shops reference catalog exists for allocations
insert into public.fair_price_shops (id, code, name, taluk, district, dealer_name, contact_number, active_cards_count)
values
  ('FPS-KA-29-014', 'FPS-014', 'Hubballi Urban Centre #14', 'Hubballi Urban', 'Dharwad', 'Ramesh V. Patil', '+91 98450 11234', 850),
  ('FPS-KA-29-022', 'FPS-022', 'Navanagar Consumer Coop #22', 'Hubballi City', 'Dharwad', 'Basavaraj Hiremath', '+91 94482 33456', 1120),
  ('FPS-KA-29-031', 'FPS-031', 'Dharwad Rural Seva Sangha #31', 'Dharwad Rural', 'Dharwad', 'Manjunath Angadi', '+91 97410 55678', 640),
  ('FPS-KA-29-045', 'FPS-045', 'Kundgol Agrarian Society #45', 'Kundgol', 'Dharwad', 'Mallikarjun Deshmukh', '+91 99801 77890', 920),
  ('FPS-KA-29-058', 'FPS-058', 'Alnavar Tribal Welfare Depository', 'Alnavar', 'Dharwad', 'Prakash Lamani', '+91 96112 88901', 480)
on conflict (id) do nothing;

-- ==============================================================================
-- 2. ATOMIC STOCK INWARD RECEIPT RPC (record_stock_receipt)
-- ==============================================================================
create or replace function public.record_stock_receipt(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_id text;
  v_commodity text;
  v_variety text;
  v_received_date date;
  v_expiry_date date;
  v_bags integer;
  v_bag_weight_kg numeric(6,2);
  v_total_qtl numeric(12,2);
  v_moisture numeric(5,2);
  v_quality_grade text;
  v_supplier text;
  v_vehicle text;
  v_gate_pass text;
  v_depot_loc text;
  v_warehouse text;
  v_driver_name text;
  v_driver_phone text;
  v_slip_no text;
  v_gross_wt numeric(12,2);
  v_tare_wt numeric(12,2);
  v_net_wt numeric(12,2);
  v_inspected_by text;
  v_notes text;
  v_caller_role text;
  v_caller_name text;
  v_initial_status text;
  v_status_reason text;
  v_max_moisture numeric(4,2);
  v_receipt_id text;
  v_movement jsonb;
  v_batch_record public.batches%rowtype;
  v_receipt_record public.inward_receipts%rowtype;
begin
  -- 1. Authorization check
  v_caller_role := public.current_user_role();
  if v_caller_role not in ('Administrator', 'Warehouse Operator') then
    -- Also allow if caller is bootstrap admin
    if not public.is_admin() then
      raise exception 'Unauthorized: Only Administrators and Warehouse Operators can register inward stock intake.';
    end if;
  end if;

  select coalesce(name, 'Civil Supplies Officer') into v_caller_name
  from public.user_profiles
  where id = auth.uid();

  if v_caller_name is null then
    v_caller_name := coalesce(p_payload->>'dispatchedBy', 'Warehouse Intake Officer');
  end if;

  -- 2. Extract and validate parameters
  v_commodity := trim(p_payload->>'commodity');
  v_variety := coalesce(nullif(trim(p_payload->>'variety'), ''), 'Standard FAQ');
  v_received_date := coalesce((p_payload->>'receivedDate')::date, current_date);
  v_expiry_date := (p_payload->>'expiryDate')::date;
  v_bags := (p_payload->>'bags')::integer;
  v_bag_weight_kg := coalesce((p_payload->>'bagWeightKg')::numeric, 50.00);
  v_moisture := coalesce((p_payload->>'moisturePercentage')::numeric, 11.50);
  v_quality_grade := coalesce(nullif(trim(p_payload->>'qualityInspectionGrade'), ''), 'Grade-I (FAQ)');
  v_supplier := coalesce(nullif(trim(p_payload->>'supplierSource'), ''), 'Central Pool Intake (FCI)');
  v_vehicle := upper(coalesce(nullif(trim(p_payload->>'vehicleNumber'), ''), 'KA-25-TR-1001'));
  v_gate_pass := upper(coalesce(nullif(trim(p_payload->>'gatePassNo'), ''), 'GP-' || to_char(now(), 'YYYYMMDD-HH24MISS')));
  v_depot_loc := coalesce(nullif(trim(p_payload->>'depotLocation'), ''), 'Bay-A1');
  v_warehouse := coalesce(nullif(trim(p_payload->>'warehouseName'), ''), 'FCI District Base Depot #4');
  v_driver_name := p_payload->>'driverName';
  v_driver_phone := p_payload->>'driverPhone';
  v_slip_no := p_payload->>'weighbridgeSlipNo';
  v_gross_wt := (p_payload->>'grossWeightKg')::numeric;
  v_tare_wt := (p_payload->>'tareWeightKg')::numeric;
  v_net_wt := (p_payload->>'netWeightKg')::numeric;
  v_inspected_by := coalesce(p_payload->>'inspectedBy', v_caller_name);
  v_notes := p_payload->>'notes';

  -- Quantity and weight validations
  if v_commodity is null or v_commodity = '' then
    raise exception 'Validation Error: Commodity name is required.';
  end if;

  if not exists (select 1 from public.commodities where id = v_commodity) then
    raise exception 'Validation Error: Unknown commodity "%". Must be configured in commodities catalog.', v_commodity;
  end if;

  if v_bags is null or v_bags <= 0 then
    raise exception 'Validation Error: Bag quantity must be a strictly positive integer (> 0). Received: %', v_bags;
  end if;

  if v_bag_weight_kg <= 0 then
    raise exception 'Validation Error: Bag weight must be greater than zero kg.';
  end if;

  if v_moisture < 0 or v_moisture > 40 then
    raise exception 'Validation Error: Moisture percentage must be between 0.00% and 40.00%. Received: %', v_moisture;
  end if;

  -- Calculate total quintals (1 Quintal = 100 kg)
  v_total_qtl := round((v_bags * v_bag_weight_kg) / 100.0, 2);

  -- Determine initial quality gate status based on commodity max moisture limits
  select max_permissible_moisture into v_max_moisture from public.commodities where id = v_commodity;
  if v_max_moisture is null then
    v_max_moisture := 14.00;
  end if;

  if v_moisture > v_max_moisture then
    v_initial_status := 'Quarantined';
    v_status_reason := 'Moisture level (' || v_moisture || '%) exceeds statutory limit (' || v_max_moisture || '%).';
  elsif v_quality_grade = 'Sub-Standard' then
    v_initial_status := 'Quarantined';
    v_status_reason := 'Visual and lab inspection determined Sub-Standard grade.';
  else
    v_initial_status := 'Eligible';
    v_status_reason := null;
  end if;

  -- 3. Generate unique Batch ID
  v_batch_id := coalesce(nullif(trim(p_payload->>'id'), ''), nullif(trim(p_payload->>'batchId'), ''));
  if v_batch_id is null or v_batch_id = '' then
    v_batch_id := 'BATCH-' || upper(substr(v_commodity, 1, 2)) || '-' || to_char(current_date, 'YYYY') || '-' || lpad(floor(random() * 9000 + 1000)::text, 4, '0');
  end if;

  -- Idempotency check: prevent duplicate batch ID
  if exists (select 1 from public.batches where id = v_batch_id) then
    raise exception 'Duplicate Record: A batch with identifier "%" already exists.', v_batch_id;
  end if;

  v_receipt_id := 'INW-' || to_char(current_date, 'YYYY') || '-' || lpad(floor(random() * 9000 + 1000)::text, 4, '0');

  -- Create initial movement record
  v_movement := jsonb_build_object(
    'id', 'MOV-REC-' || to_char(now(), 'YYYYMMDD-HH24MISS'),
    'date', v_received_date::text,
    'action', 'RECEIPT',
    'quantityBags', v_bags,
    'quantityQtl', v_total_qtl,
    'referenceId', v_receipt_id,
    'user', v_caller_name,
    'notes', coalesce(v_notes, 'Authoritative inward stock receipt intake')
  );

  -- 4. INSERT into public.batches
  insert into public.batches (
    id, commodity, variety, received_date, expiry_date,
    initial_bags, available_bags, bag_weight_kg, total_received_qtl, available_qtl,
    depot_location, warehouse_name, moisture_percentage, quality_inspection_grade,
    status, status_reason, supplier_source, stock_age_days,
    notes, movements, is_demo, created_at, updated_at
  )
  values (
    v_batch_id, v_commodity, v_variety, v_received_date, v_expiry_date,
    v_bags, v_bags, v_bag_weight_kg, v_total_qtl, v_total_qtl,
    v_depot_loc, v_warehouse, v_moisture, v_quality_grade,
    v_initial_status, v_status_reason, v_supplier, (current_date - v_received_date),
    v_notes, jsonb_build_array(v_movement), false, now(), now()
  )
  returning * into v_batch_record;

  -- 5. INSERT into public.inward_receipts
  insert into public.inward_receipts (
    id, batch_id, commodity, variety, received_date,
    bags, bag_weight_kg, total_qtl, moisture_percentage, quality_grade,
    supplier_source, vehicle_number, gate_pass_no, depot_location,
    driver_name, driver_phone, weighbridge_slip_no, gross_weight_kg, tare_weight_kg, net_weight_kg,
    inspected_by, status, notes, created_at
  )
  values (
    v_receipt_id, v_batch_id, v_commodity, v_variety, v_received_date,
    v_bags, v_bag_weight_kg, v_total_qtl, v_moisture, v_quality_grade,
    v_supplier, v_vehicle, v_gate_pass, v_depot_loc,
    v_driver_name, v_driver_phone, v_slip_no, v_gross_wt, v_tare_wt, v_net_wt,
    v_inspected_by, case when v_initial_status = 'Quarantined' then 'Quarantined' else 'Accepted' end, v_notes, now()
  )
  returning * into v_receipt_record;

  -- 6. INSERT into public.stock_transactions
  insert into public.stock_transactions (
    id, timestamp, date, action, batch_id, commodity, variety,
    quantity_bags, quantity_qtl, reference_id, user_name, user_role,
    depot_location, notes, created_at
  )
  values (
    'TX-REC-' || v_batch_id, now(), v_received_date, 'RECEIPT', v_batch_id, v_commodity, v_variety,
    v_bags, v_total_qtl, v_receipt_id, v_caller_name, v_caller_role,
    v_depot_loc, 'Inward stock receipt intake. Vehicle: ' || v_vehicle || ', Gate Pass: ' || v_gate_pass, now()
  );

  -- 7. INSERT into public.audit_logs
  insert into public.audit_logs (
    id, timestamp, user_name, role, action, entity, reference_id, result, details, created_at
  )
  values (
    'AUD-REC-' || v_batch_id, now(), v_caller_name, v_caller_role, 'STOCK_RECEIPT', 'BATCH', v_batch_id, 'SUCCESS',
    'Received ' || v_bags || ' bags (' || v_total_qtl || ' Qtl) of ' || v_commodity || ' (' || v_variety || '). Status: ' || v_initial_status || '. Bay: ' || v_depot_loc,
    now()
  );

  return jsonb_build_object(
    'success', true,
    'batchId', v_batch_id,
    'receiptId', v_receipt_id,
    'status', v_initial_status,
    'totalBags', v_bags,
    'totalQtl', v_total_qtl,
    'batch', row_to_json(v_batch_record),
    'receipt', row_to_json(v_receipt_record)
  );
end;
$$;

-- ==============================================================================
-- 3. ATOMIC STRICT FIFO DISPATCH RPC (execute_fifo_dispatch)
-- ==============================================================================
create or replace function public.execute_fifo_dispatch(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_commodity text;
  v_variety text;
  v_requested_bags integer;
  v_fps_id text;
  v_fps_name text;
  v_fps_district text;
  v_fps_address text;
  v_vehicle text;
  v_driver_name text;
  v_driver_phone text;
  v_transporter text;
  v_remarks text;
  v_idempotency_key text;
  v_caller_role text;
  v_caller_name text;
  v_caller_uid uuid;

  v_total_eligible_available integer := 0;
  v_remaining_to_allocate integer;
  v_challan_number text;
  v_gate_pass_no text;
  v_now timestamptz := now();
  v_today date := current_date;

  v_batch_cursor record;
  v_take_bags integer;
  v_take_qtl numeric(12,2);
  v_remaining_bags_after integer;
  v_new_qtl numeric(12,2);
  v_new_status text;
  v_total_qtl numeric(12,2) := 0.00;

  v_allocations jsonb := '[]'::jsonb;
  v_updated_batches jsonb := '[]'::jsonb;
  v_new_movement jsonb;
  v_dispatch_record public.dispatches%rowtype;
begin
  -- 1. Authorization check
  v_caller_role := public.current_user_role();
  if v_caller_role not in ('Administrator', 'Warehouse Operator') then
    if not public.is_admin() then
      raise exception 'Forbidden: Only Administrator and Warehouse Operator roles can authorize warehouse FIFO dispatches.';
    end if;
  end if;

  v_caller_uid := auth.uid();
  select coalesce(name, 'Civil Supplies Officer') into v_caller_name
  from public.user_profiles
  where id = v_caller_uid;

  if v_caller_name is null then
    v_caller_name := coalesce(p_payload->>'dispatchedBy', 'Warehouse Dispatch Officer');
  end if;

  -- 2. Extract and sanitize inputs
  v_commodity := trim(p_payload->>'commodity');
  v_variety := coalesce(nullif(trim(p_payload->>'variety'), ''), 'ALL');
  v_requested_bags := (p_payload->>'requestedBags')::integer;
  v_fps_id := trim(p_payload->>'destinationFpsId');
  v_vehicle := upper(coalesce(nullif(trim(p_payload->>'vehicleNumber'), ''), 'KA-25-EA-8840'));
  v_driver_name := coalesce(nullif(trim(p_payload->>'driverName'), ''), 'Shivanna Gowda');
  v_driver_phone := coalesce(nullif(trim(p_payload->>'driverPhone'), ''), '+91 94481 22910');
  v_transporter := coalesce(nullif(trim(p_payload->>'transporterAgency'), ''), 'Karnataka Food Civil Supplies Transport Corp');
  v_remarks := coalesce(p_payload->>'remarks', 'Server-verified deterministic FIFO dispatch allocation.');
  v_idempotency_key := p_payload->>'idempotencyKey';

  -- Validations
  if v_commodity is null or v_commodity = '' then
    raise exception 'Validation Error: Commodity is required for dispatch allocation.';
  end if;

  if v_requested_bags is null or v_requested_bags <= 0 then
    raise exception 'Validation Error: Requested dispatch bags must be a strictly positive integer (> 0). Received: %', v_requested_bags;
  end if;

  if v_fps_id is null or v_fps_id = '' then
    raise exception 'Validation Error: Destination Fair Price Shop (FPS ID) is required.';
  end if;

  -- Look up FPS destination details
  select name, district, taluk || ', ' || district into v_fps_name, v_fps_district, v_fps_address
  from public.fair_price_shops
  where id = v_fps_id;

  if v_fps_name is null then
    v_fps_name := coalesce(p_payload->>'destinationName', 'Fair Price Shop ' || v_fps_id);
    v_fps_district := coalesce(p_payload->>'destinationDistrict', 'Dharwad');
    v_fps_address := coalesce(p_payload->>'destinationAddress', 'Karnataka State PDS Network');
  end if;

  -- 3. Idempotency Check: if idempotency key was supplied and already dispatched, return existing
  if v_idempotency_key is not null and v_idempotency_key != '' then
    select * into v_dispatch_record from public.dispatches where idempotency_key = v_idempotency_key limit 1;
    if v_dispatch_record.challan_number is not null then
      return jsonb_build_object(
        'success', true,
        'isDuplicate', true,
        'message', 'Idempotent dispatch: returning previously confirmed record.',
        'challan', row_to_json(v_dispatch_record)
      );
    end if;
  end if;

  -- 4. ROW-LEVEL LOCKING & REAL-TIME STOCK REVALIDATION
  -- Select and lock strictly eligible candidate batches ordered by received_date ASC, created_at ASC, id ASC
  -- FOR UPDATE ensures no concurrent dispatches can race or oversell stock.
  select coalesce(sum(available_bags), 0) into v_total_eligible_available
  from public.batches
  where commodity = v_commodity
    and (v_variety = 'ALL' or variety = v_variety)
    and status = 'Eligible'
    and available_bags > 0
    and (expiry_date is null or expiry_date > v_today);

  if v_total_eligible_available < v_requested_bags then
    raise exception 'Insufficient Stock: Requested % bags of %, but only % eligible bags are available under FIFO rules.',
      v_requested_bags, v_commodity, v_total_eligible_available;
  end if;

  -- 5. Prepare Identifiers
  v_challan_number := 'PDS-CH-' || to_char(v_now, 'YYYY') || '-' || lpad(floor(random() * 9000 + 1000)::text, 4, '0');
  v_gate_pass_no := 'GP-' || to_char(v_now, 'YYYY') || '-HUB-' || lpad(floor(random() * 9000 + 1000)::text, 4, '0');
  v_remaining_to_allocate := v_requested_bags;

  -- 6. FIFO Allocation Execution Loop across locked batches
  for v_batch_cursor in
    select id, commodity, variety, received_date, available_bags, bag_weight_kg, depot_location, stock_age_days, status, movements
    from public.batches
    where commodity = v_commodity
      and (v_variety = 'ALL' or variety = v_variety)
      and status = 'Eligible'
      and available_bags > 0
      and (expiry_date is null or expiry_date > v_today)
    order by received_date asc, created_at asc, id asc
    for update
  loop
    exit when v_remaining_to_allocate <= 0;

    v_take_bags := least(v_batch_cursor.available_bags, v_remaining_to_allocate);
    v_take_qtl := round((v_take_bags * v_batch_cursor.bag_weight_kg) / 100.0, 2);
    v_remaining_bags_after := v_batch_cursor.available_bags - v_take_bags;
    v_new_qtl := round((v_remaining_bags_after * v_batch_cursor.bag_weight_kg) / 100.0, 2);
    v_new_status := case when v_remaining_bags_after = 0 then 'Exhausted' else v_batch_cursor.status end;

    v_total_qtl := v_total_qtl + v_take_qtl;

    -- Create batch movement
    v_new_movement := jsonb_build_object(
      'id', 'MOV-DISP-' || to_char(now(), 'YYYYMMDD-HH24MISS') || '-' || v_batch_cursor.id,
      'date', v_today::text,
      'action', 'DISPATCH',
      'quantityBags', v_take_bags,
      'quantityQtl', v_take_qtl,
      'referenceId', v_challan_number,
      'user', v_caller_name,
      'notes', 'Dispatched ' || v_take_bags || ' bags to ' || v_fps_name || ' via Gate Pass ' || v_gate_pass_no
    );

    -- UPDATE the batch row atomically in PostgreSQL
    update public.batches
    set
      available_bags = v_remaining_bags_after,
      available_qtl = v_new_qtl,
      status = v_new_status,
      movements = coalesce(movements, '[]'::jsonb) || jsonb_build_array(v_new_movement),
      updated_at = now()
    where id = v_batch_cursor.id;

    -- Record in stock_transactions ledger
    insert into public.stock_transactions (
      id, timestamp, date, action, batch_id, commodity, variety,
      quantity_bags, quantity_qtl, reference_id, user_name, user_role,
      depot_location, notes, created_at
    )
    values (
      'TX-DISP-' || v_challan_number || '-' || v_batch_cursor.id,
      now(), v_today, 'DISPATCH', v_batch_cursor.id, v_commodity, v_batch_cursor.variety,
      -v_take_bags, -v_take_qtl, v_challan_number, v_caller_name, v_caller_role,
      v_batch_cursor.depot_location, 'FIFO allocation for ' || v_fps_name, now()
    );

    -- Append to allocations report
    v_allocations := v_allocations || jsonb_build_array(
      jsonb_build_object(
        'batchId', v_batch_cursor.id,
        'commodity', v_batch_cursor.commodity,
        'variety', v_batch_cursor.variety,
        'receivedDate', v_batch_cursor.received_date::text,
        'availableBags', v_batch_cursor.available_bags,
        'allocatedBags', v_take_bags,
        'allocatedQtl', v_take_qtl,
        'remainingBagsAfter', v_remaining_bags_after,
        'depotLocation', v_batch_cursor.depot_location,
        'stockAgeDays', (v_today - v_batch_cursor.received_date),
        'isFullyExhausted', (v_remaining_bags_after = 0)
      )
    );

    v_updated_batches := v_updated_batches || jsonb_build_array(
      jsonb_build_object(
        'batchId', v_batch_cursor.id,
        'allocatedBags', v_take_bags,
        'remainingBags', v_remaining_bags_after,
        'newStatus', v_new_status
      )
    );

    v_remaining_to_allocate := v_remaining_to_allocate - v_take_bags;
  end loop;

  -- 7. INSERT into public.dispatches
  insert into public.dispatches (
    challan_number, idempotency_key, issuer_uid, depot_id, depot_name,
    timestamp, commodity, variety, total_bags, total_qtl,
    destination_fps_id, destination_name, destination_district, destination_address,
    vehicle_number, driver_name, driver_phone, transporter_agency, gate_pass_no,
    allocated_batches, status, dispatched_by, authorized_by, remarks, is_demo, created_at
  )
  values (
    v_challan_number, v_idempotency_key, v_caller_uid, 'FCI-KA-DWR-004', 'FCI District Base Depot #4',
    v_now, v_commodity, v_variety, v_requested_bags, v_total_qtl,
    v_fps_id, v_fps_name, v_fps_district, v_fps_address,
    v_vehicle, v_driver_name, v_driver_phone, v_transporter, v_gate_pass_no,
    v_allocations, 'Dispatched', v_caller_name, coalesce(p_payload->>'authorizedBy', 'Depot Area Manager'),
    v_remarks, false, now()
  )
  returning * into v_dispatch_record;

  -- 8. INSERT into public.delivery_tracking
  insert into public.delivery_tracking (
    id, challan_number, vehicle_number, transporter, driver_name, driver_phone,
    destination_fps, commodity, bags, dispatched_at, estimated_delivery_at,
    current_milestone, status, gps_location, otp_verified, transit_updates, created_at, updated_at
  )
  values (
    'TRK-' || v_challan_number, v_challan_number, v_vehicle, v_transporter, v_driver_name, v_driver_phone,
    v_fps_name, v_commodity, v_requested_bags, v_now, v_now + interval '4 hours',
    'Gate Pass Issued', 'In Transit', '15.3647° N, 75.1240° E (Depot Exit)', false,
    jsonb_build_array(
      jsonb_build_object(
        'time', to_char(v_now, 'HH24:MI'),
        'location', 'FCI Depot #4 Bay Gate',
        'status', 'Dispatched with Electronic Gate Pass ' || v_gate_pass_no
      )
    ),
    now(), now()
  );

  -- 9. INSERT into public.audit_logs
  insert into public.audit_logs (
    id, timestamp, user_name, role, action, entity, reference_id, result, details, created_at
  )
  values (
    'AUD-DISP-' || v_challan_number, now(), v_caller_name, v_caller_role, 'FIFO_DISPATCH', 'DISPATCH',
    v_challan_number, 'SUCCESS',
    'Dispatched ' || v_requested_bags || ' bags (' || v_total_qtl || ' Qtl) of ' || v_commodity || ' to ' || v_fps_name || '. Strict FIFO allocation across ' || jsonb_array_length(v_allocations) || ' batches.',
    now()
  );

  return jsonb_build_object(
    'success', true,
    'challanNumber', v_challan_number,
    'gatePassNo', v_gate_pass_no,
    'totalBags', v_requested_bags,
    'totalQtl', v_total_qtl,
    'challan', row_to_json(v_dispatch_record),
    'allocations', v_allocations,
    'updatedBatchesSummary', v_updated_batches,
    'message', 'Successfully validated and allocated ' || v_requested_bags || ' bags under strict FIFO ordering.'
  );
end;
$$;

-- Grant execution to authenticated users
grant execute on function public.record_stock_receipt(jsonb) to authenticated;
grant execute on function public.execute_fifo_dispatch(jsonb) to authenticated;
