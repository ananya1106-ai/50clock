import { supabase } from '../../lib/supabase';
import { DispatchRecord, CommodityType } from '../../types';

export function mapDispatchRowToModel(row: any): DispatchRecord {
  return {
    challanNumber: row.challan_number,
    idempotencyKey: row.idempotency_key || undefined,
    issuerUid: row.issuer_uid || undefined,
    depotId: row.depot_id || undefined,
    depotName: row.depot_name || undefined,
    timestamp: row.timestamp,
    commodity: row.commodity as CommodityType,
    variety: row.variety,
    totalBags: Number(row.total_bags),
    totalQtl: Number(row.total_qtl),
    destinationFpsId: row.destination_fps_id,
    destinationName: row.destination_name,
    destinationDistrict: row.destination_district,
    destinationAddress: row.destination_address,
    vehicleNumber: row.vehicle_number,
    driverName: row.driver_name,
    driverPhone: row.driver_phone,
    transporterAgency: row.transporter_agency,
    gatePassNo: row.gate_pass_no,
    allocatedBatches: Array.isArray(row.allocated_batches) ? row.allocated_batches : [],
    status: row.status as 'Dispatched' | 'In Transit' | 'Delivered',
    dispatchedBy: row.dispatched_by,
    authorizedBy: row.authorized_by,
    remarks: row.remarks || undefined,
    isDemo: Boolean(row.is_demo),
  };
}

function mapDispatchModelToRow(d: DispatchRecord): any {
  return {
    challan_number: d.challanNumber,
    idempotency_key: d.idempotencyKey || null,
    issuer_uid: d.issuerUid || null,
    depot_id: d.depotId || null,
    depot_name: d.depotName || null,
    timestamp: d.timestamp,
    commodity: d.commodity,
    variety: d.variety,
    total_bags: d.totalBags,
    total_qtl: d.totalQtl,
    destination_fps_id: d.destinationFpsId,
    destination_name: d.destinationName,
    destination_district: d.destinationDistrict,
    destination_address: d.destinationAddress,
    vehicle_number: d.vehicleNumber,
    driver_name: d.driverName,
    driver_phone: d.driverPhone,
    transporter_agency: d.transporterAgency,
    gate_pass_no: d.gatePassNo,
    allocated_batches: d.allocatedBatches || [],
    status: d.status,
    dispatched_by: d.dispatchedBy,
    authorized_by: d.authorizedBy,
    remarks: d.remarks || null,
    is_demo: Boolean(d.isDemo),
  };
}

export const supabaseDispatchesRepository = {
  async getAll(): Promise<DispatchRecord[]> {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('dispatches')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) {
        console.warn('[SmartPDS Supabase]: Dispatches fetch notice:', error.message);
        return [];
      }
      return (data || []).map(mapDispatchRowToModel);
    } catch (err: any) {
      console.warn('[SmartPDS Supabase]: Dispatches query error:', err?.message || err);
      return [];
    }
  },

  async create(dispatch: DispatchRecord): Promise<DispatchRecord> {
    if (!supabase) throw new Error('Supabase is not configured.');
    const row = mapDispatchModelToRow(dispatch);
    const { data, error } = await supabase
      .from('dispatches')
      .insert(row)
      .select()
      .single();

    if (error) throw new Error(`Supabase Dispatch Insert Error: ${error.message}`);
    return mapDispatchRowToModel(data);
  },

  subscribe(
    onData: (dispatches: DispatchRecord[]) => void,
    onError?: (err: Error) => void
  ): () => void {
    const client = supabase;
    if (!client) return () => {};

    const channel = client
      .channel('public:dispatches')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dispatches' },
        async () => {
          try {
            const fresh = await supabaseDispatchesRepository.getAll();
            onData(fresh);
          } catch (err: any) {
            onError?.(err);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          onError?.(new Error('Supabase dispatches channel error'));
        }
      });

    return () => {
      client.removeChannel(channel);
    };
  },
};
