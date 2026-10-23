import { supabase } from '../../lib/supabase';
import { DepotSettings } from '../../types';

function mapSettingsRowToModel(row: any): DepotSettings {
  return {
    depotName: row.depot_name,
    depotCode: row.depot_code,
    district: row.district,
    state: row.state,
    totalCapacityBags: Number(row.total_capacity_bags),
    maxMoistureAllowedPercent: Number(row.max_moisture_allowed_percent),
    mandatoryManagerApprovalBagsThreshold: Number(row.mandatory_manager_approval_bags_threshold),
    ageingWarningDays: Number(row.ageing_warning_days),
    ageingCriticalDays: Number(row.ageing_critical_days),
    operatingHours: row.operating_hours,
    officerInCharge: row.officer_in_charge,
  };
}

function mapSettingsModelToRow(s: DepotSettings, id = 'default'): any {
  return {
    id,
    depot_name: s.depotName,
    depot_code: s.depotCode,
    district: s.district,
    state: s.state,
    total_capacity_bags: s.totalCapacityBags,
    max_moisture_allowed_percent: s.maxMoistureAllowedPercent,
    mandatory_manager_approval_bags_threshold: s.mandatoryManagerApprovalBagsThreshold,
    ageing_warning_days: s.ageingWarningDays,
    ageing_critical_days: s.ageingCriticalDays,
    operating_hours: s.operatingHours,
    officer_in_charge: s.officerInCharge,
    updated_at: new Date().toISOString(),
  };
}

export const supabaseDepotSettingsRepository = {
  async get(id = 'default'): Promise<DepotSettings | null> {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('depot_settings')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error || !data) return null;
      return mapSettingsRowToModel(data);
    } catch {
      return null;
    }
  },

  async update(settings: DepotSettings, id = 'default'): Promise<void> {
    if (!supabase) throw new Error('Supabase is not configured.');
    const row = mapSettingsModelToRow(settings, id);
    const { error } = await supabase
      .from('depot_settings')
      .upsert(row);

    if (error) throw new Error(`Supabase Depot Settings Update Error: ${error.message}`);
  },

  subscribe(
    onData: (settings: DepotSettings) => void,
    onError?: (err: Error) => void,
    id = 'default'
  ): () => void {
    const client = supabase;
    if (!client) return () => {};

    const channel = client
      .channel('public:depot_settings')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'depot_settings' },
        async () => {
          try {
            const fresh = await supabaseDepotSettingsRepository.get(id);
            if (fresh) onData(fresh);
          } catch (err: any) {
            onError?.(err);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          onError?.(new Error('Supabase depot settings channel error'));
        }
      });

    return () => {
      client.removeChannel(channel);
    };
  },
};
