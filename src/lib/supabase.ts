import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { UserRole } from '../types';

export interface UserProfileRow {
  id: string; // matches auth.users(id)
  email: string;
  name: string;
  role: UserRole;
  designation: string;
  department: string;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommodityRow {
  id: string;
  name: string;
  category: string;
  standard_bag_weight_kg: number;
  max_permissible_moisture: number;
  buffer_norm_qtl: number;
  msp_per_qtl: number;
  subsidized_rate_per_kg: number;
  description: string;
  created_at: string;
}

export interface FairPriceShopRow {
  id: string;
  code: string;
  name: string;
  taluk: string;
  district: string;
  dealer_name: string;
  contact_number: string;
  active_cards_count: number;
  created_at: string;
}

export interface DepotSettingsRow {
  id: string;
  depot_name: string;
  depot_code: string;
  district: string;
  state: string;
  total_capacity_bags: number;
  max_moisture_allowed_percent: number;
  mandatory_manager_approval_bags_threshold: number;
  ageing_warning_days: number;
  ageing_critical_days: number;
  operating_hours: string;
  officer_in_charge: string;
  updated_at: string;
}

export interface BatchRow {
  id: string;
  commodity: string;
  variety: string;
  received_date: string;
  expiry_date: string | null;
  initial_bags: number;
  available_bags: number;
  bag_weight_kg: number;
  total_received_qtl: number;
  available_qtl: number;
  depot_location: string;
  warehouse_name: string;
  moisture_percentage: number;
  quality_inspection_grade: string;
  status: string;
  status_reason: string | null;
  supplier_source: string;
  stock_age_days: number;
  notes: string | null;
  movements: any[];
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export interface InwardReceiptRow {
  id: string;
  batch_id: string | null;
  commodity: string;
  variety: string;
  received_date: string;
  bags: number;
  bag_weight_kg: number;
  total_qtl: number;
  moisture_percentage: number;
  quality_grade: string;
  supplier_source: string;
  vehicle_number: string;
  gate_pass_no: string;
  depot_location: string;
  driver_name: string | null;
  driver_phone: string | null;
  weighbridge_slip_no: string | null;
  gross_weight_kg: number | null;
  tare_weight_kg: number | null;
  net_weight_kg: number | null;
  inspected_by: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

export interface DispatchRow {
  challan_number: string;
  idempotency_key: string | null;
  issuer_uid: string | null;
  depot_id: string | null;
  depot_name: string | null;
  timestamp: string;
  commodity: string;
  variety: string;
  total_bags: number;
  total_qtl: number;
  destination_fps_id: string;
  destination_name: string;
  destination_district: string;
  destination_address: string;
  vehicle_number: string;
  driver_name: string;
  driver_phone: string;
  transporter_agency: string;
  gate_pass_no: string;
  allocated_batches: any[];
  status: string;
  dispatched_by: string;
  authorized_by: string;
  remarks: string | null;
  is_demo: boolean;
  created_at: string;
}

export interface StockTransactionRow {
  id: string;
  timestamp: string;
  date: string;
  action: string;
  batch_id: string;
  commodity: string;
  variety: string;
  quantity_bags: number;
  quantity_qtl: number;
  reference_id: string;
  user_name: string;
  user_role: string | null;
  depot_location: string | null;
  notes: string | null;
  created_at: string;
}

export interface AuditLogRow {
  id: string;
  timestamp: string;
  user_name: string;
  role: string;
  action: string;
  entity: string;
  reference_id: string;
  result: string;
  details: string;
  created_at: string;
}

export interface DeliveryTrackingRow {
  id: string;
  challan_number: string;
  vehicle_number: string;
  transporter: string;
  driver_name: string;
  driver_phone: string;
  destination_fps: string;
  commodity: string;
  bags: number;
  dispatched_at: string;
  estimated_delivery_at: string;
  current_milestone: string;
  status: string;
  gps_location: string;
  otp_verified: boolean;
  transit_updates: any[];
  created_at: string;
  updated_at: string;
}

export interface ReturnRow {
  id: string;
  challan_number: string;
  fps_name: string;
  commodity: string;
  dispatched_bags: number;
  received_bags: number;
  damaged_bags: number;
  missing_bags: number;
  shortage_weight_kg: number;
  report_date: string;
  discrepancy_type: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReconciliationRow {
  id: string;
  batch_id: string;
  commodity: string;
  variety: string;
  bay: string;
  system_bags: number;
  physical_counted_bags: number;
  variance_bags: number;
  variance_qtl: number;
  reconciled_date: string;
  auditor_name: string;
  status: string;
  variance_reason: string | null;
  created_at: string;
}

export interface ApprovalRequestRow {
  id: string;
  type: string;
  title: string;
  requested_by: string;
  requested_role: string;
  requested_date: string;
  status: string;
  details: string;
  impact: string;
  reference_id: string;
  reviewed_by: string | null;
  reviewed_date: string | null;
  remarks: string | null;
  created_at: string;
}

export interface FifoExceptionRow {
  id: string;
  timestamp: string;
  requested_commodity: string;
  requested_variety: string;
  requested_bags: number;
  skipped_batch_id: string;
  skipped_batch_age_days: number;
  allocated_batch_id: string;
  allocated_batch_age_days: number;
  justification_reason: string;
  requested_by: string;
  status: string;
  approved_by: string | null;
  approval_remarks: string | null;
  created_at: string;
}

/**
 * Supabase PostgreSQL Database Schema Definitions for SmartPDS
 */
export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: UserProfileRow;
        Insert: Partial<UserProfileRow> & { id: string; email: string; name: string; role: UserRole };
        Update: Partial<UserProfileRow>;
      };
      commodities: {
        Row: CommodityRow;
        Insert: Partial<CommodityRow> & { id: string; name: string; category: string; description: string };
        Update: Partial<CommodityRow>;
      };
      fair_price_shops: {
        Row: FairPriceShopRow;
        Insert: Partial<FairPriceShopRow> & { id: string; code: string; name: string; taluk: string; district: string; dealer_name: string; contact_number: string };
        Update: Partial<FairPriceShopRow>;
      };
      depot_settings: {
        Row: DepotSettingsRow;
        Insert: Partial<DepotSettingsRow> & { id: string; depot_name: string; depot_code: string; district: string; officer_in_charge: string };
        Update: Partial<DepotSettingsRow>;
      };
      batches: {
        Row: BatchRow;
        Insert: Partial<BatchRow> & { id: string; commodity: string; variety: string; received_date: string; initial_bags: number; available_bags: number; depot_location: string; warehouse_name: string; supplier_source: string };
        Update: Partial<BatchRow>;
      };
      inward_receipts: {
        Row: InwardReceiptRow;
        Insert: Partial<InwardReceiptRow> & { id: string; commodity: string; variety: string; received_date: string; bags: number; vehicle_number: string; gate_pass_no: string; depot_location: string; supplier_source: string };
        Update: Partial<InwardReceiptRow>;
      };
      dispatches: {
        Row: DispatchRow;
        Insert: Partial<DispatchRow> & { challan_number: string; commodity: string; variety: string; total_bags: number; total_qtl: number; destination_fps_id: string; destination_name: string; destination_district: string; destination_address: string; vehicle_number: string; driver_name: string; driver_phone: string; transporter_agency: string; gate_pass_no: string; dispatched_by: string; authorized_by: string };
        Update: Partial<DispatchRow>;
      };
      stock_transactions: {
        Row: StockTransactionRow;
        Insert: Partial<StockTransactionRow> & { id: string; date: string; action: string; batch_id: string; commodity: string; variety: string; quantity_bags: number; quantity_qtl: number; reference_id: string; user_name: string };
        Update: Partial<StockTransactionRow>;
      };
      audit_logs: {
        Row: AuditLogRow;
        Insert: Partial<AuditLogRow> & { id: string; user_name: string; role: string; action: string; entity: string; reference_id: string; result: string; details: string };
        Update: Partial<AuditLogRow>;
      };
      delivery_tracking: {
        Row: DeliveryTrackingRow;
        Insert: Partial<DeliveryTrackingRow> & { id: string; challan_number: string; vehicle_number: string; transporter: string; driver_name: string; driver_phone: string; destination_fps: string; commodity: string; bags: number; dispatched_at: string; estimated_delivery_at: string; current_milestone: string; status: string; gps_location: string };
        Update: Partial<DeliveryTrackingRow>;
      };
      returns: {
        Row: ReturnRow;
        Insert: Partial<ReturnRow> & { id: string; challan_number: string; fps_name: string; commodity: string; dispatched_bags: number; received_bags: number; report_date: string; discrepancy_type: string; status: string };
        Update: Partial<ReturnRow>;
      };
      reconciliations: {
        Row: ReconciliationRow;
        Insert: Partial<ReconciliationRow> & { id: string; batch_id: string; commodity: string; variety: string; bay: string; system_bags: number; physical_counted_bags: number; variance_bags: number; variance_qtl: number; reconciled_date: string; auditor_name: string; status: string };
        Update: Partial<ReconciliationRow>;
      };
      approval_requests: {
        Row: ApprovalRequestRow;
        Insert: Partial<ApprovalRequestRow> & { id: string; type: string; title: string; requested_by: string; requested_role: string; status: string; details: string; impact: string; reference_id: string };
        Update: Partial<ApprovalRequestRow>;
      };
      fifo_exceptions: {
        Row: FifoExceptionRow;
        Insert: Partial<FifoExceptionRow> & { id: string; requested_commodity: string; requested_variety: string; requested_bags: number; skipped_batch_id: string; allocated_batch_id: string; justification_reason: string; requested_by: string };
        Update: Partial<FifoExceptionRow>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      record_stock_receipt: {
        Args: { p_payload: any };
        Returns: any;
      };
      execute_fifo_dispatch: {
        Args: { p_payload: any };
        Returns: any;
      };
      [key: string]: {
        Args: Record<string, any>;
        Returns: any;
      };
    };
  };
}

export interface SupabaseConfigStatus {
  isConfigured: boolean;
  hasValidUrl: boolean;
  hasPublishableKey: boolean;
  hostname: string | null;
  errorMessage?: string;
}

// Safely resolve client environment variables without exposing sensitive secrets
function resolveEnvVar(key: string): string {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    return String(import.meta.env[key]).trim();
  }
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return String(process.env[key]).trim();
  }
  return '';
}

const supabaseUrl = resolveEnvVar('VITE_SUPABASE_URL');
const supabasePublishableKey = resolveEnvVar('VITE_SUPABASE_PUBLISHABLE_KEY');

/**
 * Validates and checks Supabase client configuration status.
 * Strictly guarantees that secret or publishable key values are never output to logs.
 */
export function verifySupabaseConfig(): SupabaseConfigStatus {
  const hasUrl = !!supabaseUrl && supabaseUrl.length > 0;
  const hasKey = !!supabasePublishableKey && supabasePublishableKey.length > 0;

  let isValidUrl = false;
  let parsedHost: string | null = null;

  if (hasUrl) {
    try {
      const parsed = new URL(supabaseUrl);
      isValidUrl = parsed.protocol === 'http:' || parsed.protocol === 'https:';
      parsedHost = parsed.hostname;
    } catch {
      isValidUrl = false;
    }
  }

  const isConfigured = isValidUrl && hasKey;

  return {
    isConfigured,
    hasValidUrl: isValidUrl,
    hasPublishableKey: hasKey,
    hostname: parsedHost,
    errorMessage: !isConfigured
      ? !hasUrl
        ? 'Missing VITE_SUPABASE_URL'
        : !isValidUrl
        ? 'Malformed VITE_SUPABASE_URL'
        : 'Missing VITE_SUPABASE_PUBLISHABLE_KEY'
      : undefined,
  };
}

export const supabaseStatus = verifySupabaseConfig();

/**
 * Instantiates the typed Supabase client.
 * If credentials are not yet configured, returns null to avoid crashing on boot.
 */
export const supabase: SupabaseClient<Database> | null = supabaseStatus.isConfigured
  ? createClient<Database>(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/**
 * Safe accessor that throws a descriptive error if accessed without valid configuration.
 */
export function getSupabase(): SupabaseClient<Database> {
  if (!supabase) {
    throw new Error(
      `Supabase is not yet configured. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are defined. Status: ${JSON.stringify(
        verifySupabaseConfig()
      )}`
    );
  }
  return supabase;
}
