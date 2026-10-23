import { supabase } from '../../lib/supabase';
import { FifoException, CommodityType } from '../../types';

function mapExceptionRowToModel(row: any): FifoException {
  return {
    id: row.id,
    timestamp: row.timestamp,
    requestedCommodity: row.requested_commodity as CommodityType,
    requestedVariety: row.requested_variety,
    requestedBags: Number(row.requested_bags),
    skippedBatchId: row.skipped_batch_id,
    skippedBatchAgeDays: Number(row.skipped_batch_age_days),
    allocatedBatchId: row.allocated_batch_id,
    allocatedBatchAgeDays: Number(row.allocated_batch_age_days),
    justificationReason: row.justification_reason,
    requestedBy: row.requested_by,
    status: row.status as FifoException['status'],
    approvedBy: row.approved_by || undefined,
    approvalRemarks: row.approval_remarks || undefined,
  };
}

function mapExceptionModelToRow(e: FifoException): any {
  return {
    id: e.id,
    timestamp: e.timestamp,
    requested_commodity: e.requestedCommodity,
    requested_variety: e.requestedVariety,
    requested_bags: e.requestedBags,
    skipped_batch_id: e.skippedBatchId,
    skipped_batch_age_days: e.skippedBatchAgeDays,
    allocated_batch_id: e.allocatedBatchId,
    allocated_batch_age_days: e.allocatedBatchAgeDays,
    justification_reason: e.justificationReason,
    requested_by: e.requestedBy,
    status: e.status,
    approved_by: e.approvedBy || null,
    approval_remarks: e.approvalRemarks || null,
  };
}

export const supabaseFifoExceptionsRepository = {
  async getAll(): Promise<FifoException[]> {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('fifo_exceptions')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) {
        console.warn('[SmartPDS Supabase]: FIFO exceptions fetch notice:', error.message);
        return [];
      }
      return (data || []).map(mapExceptionRowToModel);
    } catch (err: any) {
      console.warn('[SmartPDS Supabase]: FIFO exceptions query error:', err?.message || err);
      return [];
    }
  },

  async create(exception: FifoException): Promise<FifoException> {
    if (!supabase) throw new Error('Supabase is not configured.');
    const row = mapExceptionModelToRow(exception);
    const { data, error } = await supabase
      .from('fifo_exceptions')
      .insert(row)
      .select()
      .single();

    if (error) throw new Error(`Supabase FIFO Exception Insert Error: ${error.message}`);
    return mapExceptionRowToModel(data);
  },

  async updateStatus(
    id: string,
    status: FifoException['status'],
    approvedBy?: string,
    remarks?: string
  ): Promise<void> {
    if (!supabase) throw new Error('Supabase is not configured.');
    const patch: Record<string, any> = { status };
    if (approvedBy !== undefined) patch.approved_by = approvedBy;
    if (remarks !== undefined) patch.approval_remarks = remarks;

    const { error } = await supabase
      .from('fifo_exceptions')
      .update(patch as never)
      .eq('id', id);

    if (error) throw new Error(`Supabase FIFO Exception Update Error: ${error.message}`);
  },

  subscribe(
    onData: (exceptions: FifoException[]) => void,
    onError?: (err: Error) => void
  ): () => void {
    const client = supabase;
    if (!client) return () => {};

    const channel = client
      .channel('public:fifo_exceptions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fifo_exceptions' },
        async () => {
          try {
            const fresh = await supabaseFifoExceptionsRepository.getAll();
            onData(fresh);
          } catch (err: any) {
            onError?.(err);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          onError?.(new Error('Supabase fifo exceptions channel error'));
        }
      });

    return () => {
      client.removeChannel(channel);
    };
  },
};
