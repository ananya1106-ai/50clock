import { supabase } from '../../lib/supabase';
import { ReturnDiscrepancyRecord, CommodityType } from '../../types';

function mapReturnRowToModel(row: any): ReturnDiscrepancyRecord {
  return {
    id: row.id,
    challanNumber: row.challan_number,
    fpsName: row.fps_name,
    commodity: row.commodity as CommodityType,
    dispatchedBags: Number(row.dispatched_bags),
    receivedBags: Number(row.received_bags),
    damagedBags: Number(row.damaged_bags),
    missingBags: Number(row.missing_bags),
    shortageWeightKg: Number(row.shortage_weight_kg),
    reportDate: row.report_date,
    discrepancyType: row.discrepancy_type as ReturnDiscrepancyRecord['discrepancyType'],
    status: row.status as ReturnDiscrepancyRecord['status'],
    notes: row.notes || '',
  };
}

function mapReturnModelToRow(r: ReturnDiscrepancyRecord): any {
  return {
    id: r.id,
    challan_number: r.challanNumber,
    fps_name: r.fpsName,
    commodity: r.commodity,
    dispatched_bags: r.dispatchedBags,
    received_bags: r.receivedBags,
    damaged_bags: r.damagedBags,
    missing_bags: r.missingBags,
    shortage_weight_kg: r.shortageWeightKg,
    report_date: r.reportDate,
    discrepancy_type: r.discrepancyType,
    status: r.status,
    notes: r.notes || null,
  };
}

export const supabaseReturnsRepository = {
  async getAll(): Promise<ReturnDiscrepancyRecord[]> {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('returns')
        .select('*')
        .order('report_date', { ascending: false });

      if (error) {
        console.warn('[SmartPDS Supabase]: Returns fetch notice:', error.message);
        return [];
      }
      return (data || []).map(mapReturnRowToModel);
    } catch (err: any) {
      console.warn('[SmartPDS Supabase]: Returns query error:', err?.message || err);
      return [];
    }
  },

  async create(record: ReturnDiscrepancyRecord): Promise<ReturnDiscrepancyRecord> {
    if (!supabase) throw new Error('Supabase is not configured.');
    const row = mapReturnModelToRow(record);
    const { data, error } = await supabase
      .from('returns')
      .insert(row)
      .select()
      .single();

    if (error) throw new Error(`Supabase Returns Insert Error: ${error.message}`);
    return mapReturnRowToModel(data);
  },

  subscribe(
    onData: (records: ReturnDiscrepancyRecord[]) => void,
    onError?: (err: Error) => void
  ): () => void {
    const client = supabase;
    if (!client) return () => {};

    const channel = client
      .channel('public:returns')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'returns' },
        async () => {
          try {
            const fresh = await supabaseReturnsRepository.getAll();
            onData(fresh);
          } catch (err: any) {
            onError?.(err);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          onError?.(new Error('Supabase returns channel error'));
        }
      });

    return () => {
      client.removeChannel(channel);
    };
  },
};
