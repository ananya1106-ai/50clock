import { supabase } from '../../lib/supabase';
import { DeliveryTrackingRecord } from '../../types';

function mapTrackingRowToModel(row: any): DeliveryTrackingRecord {
  return {
    id: row.id,
    challanNumber: row.challan_number,
    vehicleNumber: row.vehicle_number,
    transporter: row.transporter,
    driverName: row.driver_name,
    driverPhone: row.driver_phone,
    destinationFps: row.destination_fps,
    commodity: row.commodity,
    bags: Number(row.bags),
    dispatchedAt: row.dispatched_at,
    estimatedDeliveryAt: row.estimated_delivery_at,
    currentMilestone: row.current_milestone as DeliveryTrackingRecord['currentMilestone'],
    status: row.status as DeliveryTrackingRecord['status'],
    gpsLocation: row.gps_location,
    otpVerified: Boolean(row.otp_verified),
    transitUpdates: Array.isArray(row.transit_updates) ? row.transit_updates : [],
  };
}

function mapTrackingModelToRow(t: DeliveryTrackingRecord): any {
  return {
    id: t.id,
    challan_number: t.challanNumber,
    vehicle_number: t.vehicleNumber,
    transporter: t.transporter,
    driver_name: t.driverName,
    driver_phone: t.driverPhone,
    destination_fps: t.destinationFps,
    commodity: t.commodity,
    bags: t.bags,
    dispatched_at: t.dispatchedAt,
    estimated_delivery_at: t.estimatedDeliveryAt,
    current_milestone: t.currentMilestone,
    status: t.status,
    gps_location: t.gpsLocation,
    otp_verified: Boolean(t.otpVerified),
    transit_updates: t.transitUpdates || [],
  };
}

export const supabaseDeliveryTrackingRepository = {
  async getAll(): Promise<DeliveryTrackingRecord[]> {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('delivery_tracking')
        .select('*')
        .order('dispatched_at', { ascending: false });

      if (error) {
        console.warn('[SmartPDS Supabase]: Delivery tracking fetch notice:', error.message);
        return [];
      }
      return (data || []).map(mapTrackingRowToModel);
    } catch (err: any) {
      console.warn('[SmartPDS Supabase]: Delivery tracking query error:', err?.message || err);
      return [];
    }
  },

  async create(record: DeliveryTrackingRecord): Promise<DeliveryTrackingRecord> {
    if (!supabase) throw new Error('Supabase is not configured.');
    const row = mapTrackingModelToRow(record);
    const { data, error } = await supabase
      .from('delivery_tracking')
      .insert(row)
      .select()
      .single();

    if (error) throw new Error(`Supabase Delivery Tracking Insert Error: ${error.message}`);
    return mapTrackingRowToModel(data);
  },

  async updateMilestone(
    id: string,
    milestone: DeliveryTrackingRecord['currentMilestone'],
    statusNote: string,
    location?: string
  ): Promise<void> {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { data: current } = await supabase
      .from('delivery_tracking')
      .select('*')
      .eq('id', id)
      .single();

    const existingUpdates = Array.isArray((current as any)?.transit_updates) ? (current as any).transit_updates : [];
    const newUpdate = {
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      location: location || 'Transit Checkpoint',
      statusNote,
    };

    const isDelivered = milestone === 'Delivered Verified';

    const patch: Record<string, any> = {
      current_milestone: milestone,
      status: isDelivered ? 'Delivered' : 'In Transit',
      otp_verified: isDelivered ? true : undefined,
      transit_updates: [...existingUpdates, newUpdate],
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('delivery_tracking')
      .update(patch as never)
      .eq('id', id);

    if (error) throw new Error(`Supabase Tracking Milestone Update Error: ${error.message}`);
  },

  subscribe(
    onData: (records: DeliveryTrackingRecord[]) => void,
    onError?: (err: Error) => void
  ): () => void {
    const client = supabase;
    if (!client) return () => {};

    const channel = client
      .channel('public:delivery_tracking')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'delivery_tracking' },
        async () => {
          try {
            const fresh = await supabaseDeliveryTrackingRepository.getAll();
            onData(fresh);
          } catch (err: any) {
            onError?.(err);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          onError?.(new Error('Supabase delivery tracking channel error'));
        }
      });

    return () => {
      client.removeChannel(channel);
    };
  },
};
