import { supabase } from '../../lib/supabase';
import { StockTransactionRecord, CommodityType } from '../../types';


function mapTxRowToModel(row: any): StockTransactionRecord {
  return {
    id: row.id,
    timestamp: row.timestamp,
    date: row.date,
    action: row.action,
    batchId: row.batch_id,
    commodity: row.commodity as CommodityType,
    variety: row.variety,
    quantityBags: Number(row.quantity_bags),
    quantityQtl: Number(row.quantity_qtl),
    referenceId: row.reference_id,
    user: row.user_name,
    role: row.user_role || undefined,
    depotLocation: row.depot_location || undefined,
    notes: row.notes || undefined,
  };
}

function mapTxModelToRow(tx: StockTransactionRecord): any {
  return {
    id: tx.id,
    timestamp: tx.timestamp,
    date: tx.date,
    action: tx.action,
    batch_id: tx.batchId,
    commodity: tx.commodity,
    variety: tx.variety,
    quantity_bags: tx.quantityBags,
    quantity_qtl: tx.quantityQtl,
    reference_id: tx.referenceId,
    user_name: tx.user,
    user_role: tx.role || null,
    depot_location: tx.depotLocation || null,
    notes: tx.notes || null,
  };
}

export const supabaseStockTransactionsRepository = {
  async getAll(): Promise<StockTransactionRecord[]> {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('stock_transactions')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) {
        console.warn('[SmartPDS Supabase]: Stock txs fetch notice:', error.message);
        return [];
      }
      return (data || []).map(mapTxRowToModel);
    } catch (err: any) {
      console.warn('[SmartPDS Supabase]: Stock txs query error:', err?.message || err);
      return [];
    }
  },

  async create(tx: StockTransactionRecord): Promise<StockTransactionRecord> {
    if (!supabase) throw new Error('Supabase is not configured.');
    const row = mapTxModelToRow(tx);
    const { data, error } = await supabase
      .from('stock_transactions')
      .insert(row)
      .select()
      .single();

    if (error) throw new Error(`Supabase Stock Transaction Insert Error: ${error.message}`);
    return mapTxRowToModel(data);
  },

  subscribe(
    onData: (txs: StockTransactionRecord[]) => void,
    onError?: (err: Error) => void
  ): () => void {
    const client = supabase;
    if (!client) return () => {};

    const channel = client
      .channel('public:stock_transactions')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'stock_transactions' },
        async () => {
          try {
            const fresh = await supabaseStockTransactionsRepository.getAll();
            onData(fresh);
          } catch (err: any) {
            onError?.(err);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          onError?.(new Error('Supabase stock transactions channel error'));
        }
      });

    return () => {
      client.removeChannel(channel);
    };
  },
};
