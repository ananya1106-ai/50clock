import { supabase } from '../../lib/supabase';
import { FairPriceShop } from '../../types';

function mapFpsRowToModel(row: any): FairPriceShop {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    taluk: row.taluk,
    district: row.district,
    dealerName: row.dealer_name,
    contactNumber: row.contact_number,
    activeCardsCount: Number(row.active_cards_count),
  };
}

function mapFpsModelToRow(fps: FairPriceShop): any {
  return {
    id: fps.id,
    code: fps.code,
    name: fps.name,
    taluk: fps.taluk,
    district: fps.district,
    dealer_name: fps.dealerName,
    contact_number: fps.contactNumber,
    active_cards_count: fps.activeCardsCount,
  };
}

export const supabaseFairPriceShopsRepository = {
  async getAll(): Promise<FairPriceShop[]> {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('fair_price_shops')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.warn('[SmartPDS Supabase]: Fair price shops fetch notice:', error.message);
        return [];
      }
      return (data || []).map(mapFpsRowToModel);
    } catch (err: any) {
      console.warn('[SmartPDS Supabase]: Fair price shops query error:', err?.message || err);
      return [];
    }
  },

  async getById(id: string): Promise<FairPriceShop | null> {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('fair_price_shops')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error || !data) return null;
      return mapFpsRowToModel(data);
    } catch {
      return null;
    }
  },

  async create(fps: FairPriceShop): Promise<FairPriceShop> {
    if (!supabase) throw new Error('Supabase is not configured.');
    const row = mapFpsModelToRow(fps);
    const { data, error } = await supabase
      .from('fair_price_shops')
      .insert(row)
      .select()
      .single();

    if (error) throw new Error(`Supabase Fair Price Shop Insert Error: ${error.message}`);
    return mapFpsRowToModel(data);
  },

  subscribe(
    onData: (shops: FairPriceShop[]) => void,
    onError?: (err: Error) => void
  ): () => void {
    const client = supabase;
    if (!client) return () => {};

    const channel = client
      .channel('public:fair_price_shops')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fair_price_shops' },
        async () => {
          try {
            const fresh = await supabaseFairPriceShopsRepository.getAll();
            onData(fresh);
          } catch (err: any) {
            onError?.(err);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          onError?.(new Error('Supabase fair price shops channel error'));
        }
      });

    return () => {
      client.removeChannel(channel);
    };
  },
};
