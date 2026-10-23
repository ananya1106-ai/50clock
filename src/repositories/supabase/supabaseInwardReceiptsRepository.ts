import { supabase } from '../../lib/supabase';
import { CommodityType, QualityGrade } from '../../types';

export interface InwardReceiptRecord {
  id: string;
  batchId?: string;
  commodity: CommodityType;
  variety: string;
  receivedDate: string;
  bags: number;
  bagWeightKg: number;
  totalQtl: number;
  moisturePercentage: number;
  qualityGrade: QualityGrade;
  supplierSource: string;
  vehicleNumber: string;
  gatePassNo: string;
  depotLocation: string;
  driverName?: string;
  driverPhone?: string;
  weighbridgeSlipNo?: string;
  grossWeightKg?: number;
  tareWeightKg?: number;
  netWeightKg?: number;
  inspectedBy?: string;
  status: 'Accepted' | 'Quarantined' | 'Rejected';
  notes?: string;
  createdAt?: string;
}

function mapInwardRowToModel(row: any): InwardReceiptRecord {
  return {
    id: row.id,
    batchId: row.batch_id || undefined,
    commodity: row.commodity as CommodityType,
    variety: row.variety,
    receivedDate: row.received_date,
    bags: Number(row.bags),
    bagWeightKg: Number(row.bag_weight_kg),
    totalQtl: Number(row.total_qtl),
    moisturePercentage: Number(row.moisture_percentage),
    qualityGrade: row.quality_grade as QualityGrade,
    supplierSource: row.supplier_source,
    vehicleNumber: row.vehicle_number,
    gatePassNo: row.gate_pass_no,
    depotLocation: row.depot_location,
    driverName: row.driver_name || undefined,
    driverPhone: row.driver_phone || undefined,
    weighbridgeSlipNo: row.weighbridge_slip_no || undefined,
    grossWeightKg: row.gross_weight_kg != null ? Number(row.gross_weight_kg) : undefined,
    tareWeightKg: row.tare_weight_kg != null ? Number(row.tare_weight_kg) : undefined,
    netWeightKg: row.net_weight_kg != null ? Number(row.net_weight_kg) : undefined,
    inspectedBy: row.inspected_by || undefined,
    status: row.status as InwardReceiptRecord['status'],
    notes: row.notes || undefined,
    createdAt: row.created_at,
  };
}

function mapInwardModelToRow(r: InwardReceiptRecord): any {
  return {
    id: r.id,
    batch_id: r.batchId || null,
    commodity: r.commodity,
    variety: r.variety,
    received_date: r.receivedDate,
    bags: r.bags,
    bag_weight_kg: r.bagWeightKg,
    total_qtl: r.totalQtl,
    moisture_percentage: r.moisturePercentage,
    quality_grade: r.qualityGrade,
    supplier_source: r.supplierSource,
    vehicle_number: r.vehicleNumber,
    gate_pass_no: r.gatePassNo,
    depot_location: r.depotLocation,
    driver_name: r.driverName || null,
    driver_phone: r.driverPhone || null,
    weighbridge_slip_no: r.weighbridgeSlipNo || null,
    gross_weight_kg: r.grossWeightKg ?? null,
    tare_weight_kg: r.tareWeightKg ?? null,
    net_weight_kg: r.netWeightKg ?? null,
    inspected_by: r.inspectedBy || null,
    status: r.status,
    notes: r.notes || null,
  };
}

export const supabaseInwardReceiptsRepository = {
  async getAll(): Promise<InwardReceiptRecord[]> {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('inward_receipts')
        .select('*')
        .order('received_date', { ascending: false });

      if (error) {
        console.warn('[SmartPDS Supabase]: Inward receipts fetch notice:', error.message);
        return [];
      }
      return (data || []).map(mapInwardRowToModel);
    } catch (err: any) {
      console.warn('[SmartPDS Supabase]: Inward receipts query error:', err?.message || err);
      return [];
    }
  },

  async create(receipt: InwardReceiptRecord): Promise<InwardReceiptRecord> {
    if (!supabase) throw new Error('Supabase is not configured.');
    const row = mapInwardModelToRow(receipt);
    const { data, error } = await supabase
      .from('inward_receipts')
      .insert(row)
      .select()
      .single();

    if (error) throw new Error(`Supabase Inward Receipt Insert Error: ${error.message}`);
    return mapInwardRowToModel(data);
  },

  subscribe(
    onData: (receipts: InwardReceiptRecord[]) => void,
    onError?: (err: Error) => void
  ): () => void {
    const client = supabase;
    if (!client) return () => {};

    const channel = client
      .channel('public:inward_receipts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inward_receipts' },
        async () => {
          try {
            const fresh = await supabaseInwardReceiptsRepository.getAll();
            onData(fresh);
          } catch (err: any) {
            onError?.(err);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          onError?.(new Error('Supabase inward receipts channel error'));
        }
      });

    return () => {
      client.removeChannel(channel);
    };
  },
};
