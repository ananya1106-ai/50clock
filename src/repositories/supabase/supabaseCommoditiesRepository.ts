import { supabase } from '../../lib/supabase';
import { CommodityRecord, CommodityType } from '../../types';


function mapCommodityRowToModel(row: any): CommodityRecord {
  return {
    id: row.id,
    name: row.name as CommodityType,
    category: row.category,
    standardBagWeightKg: Number(row.standard_bag_weight_kg),
    maxPermissibleMoisture: Number(row.max_permissible_moisture),
    bufferNormQtl: Number(row.buffer_norm_qtl),
    mspPerQtl: Number(row.msp_per_qtl),
    subsidizedRatePerKg: Number(row.subsidized_rate_per_kg),
    description: row.description,
  };
}

export const supabaseCommoditiesRepository = {
  async getAll(): Promise<CommodityRecord[]> {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('commodities')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.warn('[SmartPDS Supabase]: Commodities fetch notice:', error.message);
        return [];
      }
      return (data || []).map(mapCommodityRowToModel);
    } catch (err: any) {
      console.warn('[SmartPDS Supabase]: Commodities query error:', err?.message || err);
      return [];
    }
  },

  subscribe(
    onData: (commodities: CommodityRecord[]) => void,
    onError?: (err: Error) => void
  ): () => void {
    const client = supabase;
    if (!client) return () => {};

    const channel = client
      .channel('public:commodities')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'commodities' },
        async () => {
          try {
            const fresh = await supabaseCommoditiesRepository.getAll();
            onData(fresh);
          } catch (err: any) {
            onError?.(err);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          onError?.(new Error('Supabase commodities channel error'));
        }
      });

    return () => {
      client.removeChannel(channel);
    };
  },
};
