import { supabase } from '../../lib/supabase';
import { ReconciliationRecord, CommodityType } from '../../types';

function mapReconciliationRowToModel(row: any): ReconciliationRecord {
  return {
    id: row.id,
    batchId: row.batch_id,
    commodity: row.commodity as CommodityType,
    variety: row.variety,
    bay: row.bay,
    systemBags: Number(row.system_bags),
    physicalCountedBags: Number(row.physical_counted_bags),
    varianceBags: Number(row.variance_bags),
    varianceQtl: Number(row.variance_qtl),
    reconciledDate: row.reconciled_date,
    auditorName: row.auditor_name,
    status: row.status as ReconciliationRecord['status'],
    varianceReason: row.variance_reason || undefined,
  };
}

function mapReconciliationModelToRow(r: ReconciliationRecord): any {
  return {
    id: r.id,
    batch_id: r.batchId,
    commodity: r.commodity,
    variety: r.variety,
    bay: r.bay,
    system_bags: r.systemBags,
    physical_counted_bags: r.physicalCountedBags,
    variance_bags: r.varianceBags,
    variance_qtl: r.varianceQtl,
    reconciled_date: r.reconciledDate,
    auditor_name: r.auditorName,
    status: r.status,
    variance_reason: r.varianceReason || null,
  };
}

export const supabaseReconciliationsRepository = {
  async getAll(): Promise<ReconciliationRecord[]> {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('reconciliations')
        .select('*')
        .order('reconciled_date', { ascending: false });

      if (error) {
        console.warn('[SmartPDS Supabase]: Reconciliations fetch notice:', error.message);
        return [];
      }
      return (data || []).map(mapReconciliationRowToModel);
    } catch (err: any) {
      console.warn('[SmartPDS Supabase]: Reconciliations query error:', err?.message || err);
      return [];
    }
  },

  async create(record: ReconciliationRecord): Promise<ReconciliationRecord> {
    if (!supabase) throw new Error('Supabase is not configured.');
    const row = mapReconciliationModelToRow(record);
    const { data, error } = await supabase
      .from('reconciliations')
      .insert(row)
      .select()
      .single();

    if (error) throw new Error(`Supabase Reconciliation Insert Error: ${error.message}`);
    return mapReconciliationRowToModel(data);
  },

  async updateStatus(id: string, status: ReconciliationRecord['status']): Promise<void> {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { error } = await supabase
      .from('reconciliations')
      .update({ status } as never)
      .eq('id', id);

    if (error) throw new Error(`Supabase Reconciliation Update Error: ${error.message}`);
  },

  subscribe(
    onData: (records: ReconciliationRecord[]) => void,
    onError?: (err: Error) => void
  ): () => void {
    const client = supabase;
    if (!client) return () => {};

    const channel = client
      .channel('public:reconciliations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reconciliations' },
        async () => {
          try {
            const fresh = await supabaseReconciliationsRepository.getAll();
            onData(fresh);
          } catch (err: any) {
            onError?.(err);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          onError?.(new Error('Supabase reconciliations channel error'));
        }
      });

    return () => {
      client.removeChannel(channel);
    };
  },
};
