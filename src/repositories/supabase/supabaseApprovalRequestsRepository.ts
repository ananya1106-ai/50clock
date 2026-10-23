import { supabase } from '../../lib/supabase';
import { ApprovalRequest, UserRole } from '../../types';

function mapApprovalRowToModel(row: any): ApprovalRequest {
  return {
    id: row.id,
    type: row.type as ApprovalRequest['type'],
    title: row.title,
    requestedBy: row.requested_by,
    requestedRole: row.requested_role as UserRole,
    requestedDate: row.requested_date,
    status: row.status as ApprovalRequest['status'],
    details: row.details,
    impact: row.impact,
    referenceId: row.reference_id,
    reviewedBy: row.reviewed_by || undefined,
    reviewedDate: row.reviewed_date || undefined,
    remarks: row.remarks || undefined,
  };
}

function mapApprovalModelToRow(a: ApprovalRequest): any {
  return {
    id: a.id,
    type: a.type,
    title: a.title,
    requested_by: a.requestedBy,
    requested_role: a.requestedRole,
    requested_date: a.requestedDate,
    status: a.status,
    details: a.details,
    impact: a.impact,
    reference_id: a.referenceId,
    reviewed_by: a.reviewedBy || null,
    reviewed_date: a.reviewedDate || null,
    remarks: a.remarks || null,
  };
}

export const supabaseApprovalRequestsRepository = {
  async getAll(): Promise<ApprovalRequest[]> {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('approval_requests')
        .select('*')
        .order('requested_date', { ascending: false });

      if (error) {
        console.warn('[SmartPDS Supabase]: Approval requests fetch notice:', error.message);
        return [];
      }
      return (data || []).map(mapApprovalRowToModel);
    } catch (err: any) {
      console.warn('[SmartPDS Supabase]: Approval requests query error:', err?.message || err);
      return [];
    }
  },

  async create(req: ApprovalRequest): Promise<ApprovalRequest> {
    if (!supabase) throw new Error('Supabase is not configured.');
    const row = mapApprovalModelToRow(req);
    const { data, error } = await supabase
      .from('approval_requests')
      .insert(row)
      .select()
      .single();

    if (error) throw new Error(`Supabase Approval Request Insert Error: ${error.message}`);
    return mapApprovalRowToModel(data);
  },

  async updateStatus(
    id: string,
    status: ApprovalRequest['status'],
    reviewedBy?: string,
    remarks?: string
  ): Promise<void> {
    if (!supabase) throw new Error('Supabase is not configured.');
    const patch: Record<string, any> = {
      status,
      reviewed_by: reviewedBy || null,
      reviewed_date: new Date().toISOString(),
    };
    if (remarks !== undefined) patch.remarks = remarks;

    const { error } = await supabase
      .from('approval_requests')
      .update(patch as never)
      .eq('id', id);

    if (error) throw new Error(`Supabase Approval Request Update Error: ${error.message}`);
  },

  subscribe(
    onData: (requests: ApprovalRequest[]) => void,
    onError?: (err: Error) => void
  ): () => void {
    const client = supabase;
    if (!client) return () => {};

    const channel = client
      .channel('public:approval_requests')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'approval_requests' },
        async () => {
          try {
            const fresh = await supabaseApprovalRequestsRepository.getAll();
            onData(fresh);
          } catch (err: any) {
            onError?.(err);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          onError?.(new Error('Supabase approval requests channel error'));
        }
      });

    return () => {
      client.removeChannel(channel);
    };
  },
};
