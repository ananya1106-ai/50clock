import { supabase } from '../../lib/supabase';
import { AuditLog, UserRole } from '../../types';

function mapAuditLogRowToModel(row: any): AuditLog {
  return {
    id: row.id,
    timestamp: row.timestamp,
    user: row.user_name,
    role: row.role as UserRole,
    action: row.action as AuditLog['action'],
    entity: row.entity,
    referenceId: row.reference_id,
    result: row.result as AuditLog['result'],
    details: row.details,
  };
}

function mapAuditLogModelToRow(l: AuditLog): any {
  return {
    id: l.id,
    timestamp: l.timestamp,
    user_name: l.user,
    role: l.role,
    action: l.action,
    entity: l.entity,
    reference_id: l.referenceId,
    result: l.result,
    details: l.details,
  };
}

export const supabaseAuditLogsRepository = {
  async getAll(): Promise<AuditLog[]> {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) {
        console.warn('[SmartPDS Supabase]: Audit logs fetch notice:', error.message);
        return [];
      }
      return (data || []).map(mapAuditLogRowToModel);
    } catch (err: any) {
      console.warn('[SmartPDS Supabase]: Audit logs query error:', err?.message || err);
      return [];
    }
  },

  async create(log: AuditLog): Promise<AuditLog> {
    if (!supabase) throw new Error('Supabase is not configured.');
    const row = mapAuditLogModelToRow(log);
    const { data, error } = await supabase
      .from('audit_logs')
      .insert(row)
      .select()
      .single();

    if (error) throw new Error(`Supabase Audit Log Insert Error: ${error.message}`);
    return mapAuditLogRowToModel(data);
  },

  subscribe(
    onData: (logs: AuditLog[]) => void,
    onError?: (err: Error) => void
  ): () => void {
    const client = supabase;
    if (!client) return () => {};

    const channel = client
      .channel('public:audit_logs')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'audit_logs' },
        async () => {
          try {
            const fresh = await supabaseAuditLogsRepository.getAll();
            onData(fresh);
          } catch (err: any) {
            onError?.(err);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          onError?.(new Error('Supabase audit logs channel error'));
        }
      });

    return () => {
      client.removeChannel(channel);
    };
  },
};
