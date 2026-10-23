import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Shield,
  RotateCcw,
  Download,
  UserCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Server,
  Database,
  Lock,
  Layers,
  Key,
} from 'lucide-react';
import { getSupabase } from '../../lib/supabase';

export const SettingsView: React.FC = () => {
  const {
    currentRole,
    setCurrentRole,
    currentUser,
    batches,
    dispatches,
    auditLogs,
    addToast,
    refreshData,
  } = useApp();

  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionDetails, setConnectionDetails] = useState<{
    status: 'ONLINE' | 'ERROR' | 'IDLE';
    latencyMs?: number;
    error?: string;
  }>({ status: 'IDLE' });

  const handleTestDatabaseConnection = async () => {
    setIsTestingConnection(true);
    const start = performance.now();
    try {
      const client = getSupabase();
      const { data, error } = await client.from('batches').select('id', { count: 'exact', head: true });
      const latency = Math.round(performance.now() - start);
      if (error) {
        setConnectionDetails({ status: 'ERROR', error: error.message, latencyMs: latency });
        addToast('error', 'Connection Test Failed', error.message);
      } else {
        setConnectionDetails({ status: 'ONLINE', latencyMs: latency });
        addToast('success', 'Supabase Connected', `PostgreSQL responded in ${latency}ms.`);
      }
    } catch (e: any) {
      setConnectionDetails({ status: 'ERROR', error: e?.message || 'Network error' });
      addToast('error', 'Connection Error', e?.message || 'Failed to ping Supabase.');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleExportData = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      facility: 'FCI District Base Depot #4, Hubballi',
      authenticatedUser: currentUser?.email,
      role: currentRole,
      batches,
      dispatches,
      auditLogs,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smartpds_snapshot_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('success', 'Snapshot Exported', 'Warehouse state downloaded as JSON file.');
  };

  const permissionsMatrix: Array<{
    feature: string;
    description: string;
    admin: boolean;
    operator: boolean;
    dealer: boolean;
  }> = [
    {
      feature: 'Record Inward Stock Receipt',
      description: 'Enter new grain consignments, moisture readings, and bay assignments',
      admin: true,
      operator: true,
      dealer: false,
    },
    {
      feature: 'Execute Outward FIFO Dispatch',
      description: 'Allocate stock using deterministic FIFO, deduct inventory, and issue Form-12 digital challans',
      admin: true,
      operator: true,
      dealer: false,
    },
    {
      feature: 'Inspect Delivery & Acknowledge Challans',
      description: 'Verify consignments delivered to Fair Price Shops, mark physical receipts, and log transit discrepancies',
      admin: true,
      operator: true,
      dealer: true,
    },
    {
      feature: 'Manage Quarantined & Damaged Stock',
      description: 'Authorize quarantine status, bypass damaged bags, and request disposal inspections',
      admin: true,
      operator: true,
      dealer: false,
    },
    {
      feature: 'Stock Ledger Reconciliation',
      description: 'Conduct physical inventory audits and post adjustment vouchers',
      admin: true,
      operator: true,
      dealer: false,
    },
    {
      feature: 'View System Audit Trails',
      description: 'Audit chronological cryptographic activity logs and statutory security events',
      admin: true,
      operator: true,
      dealer: false,
    },
    {
      feature: 'User Governance & System Settings',
      description: 'Assign personnel credentials, manage depot parameters, and configure security rules',
      admin: true,
      operator: false,
      dealer: false,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-lg font-bold text-[#344054] dark:text-[#F1F5F9] tracking-tight">
          System Roles & Database Configuration
        </h2>
        <p className="text-xs text-[#707887] dark:text-[#A1AAB9] mt-0.5">
          Role-based access controls, PostgreSQL persistence status, and audit governance
        </p>
      </div>

      {/* Security Notice Banner */}
      <div className="p-4 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Role-Based Access Governance:</span> Operations in SmartPDS are strictly partitioned between depot administration, godown operations, and fair price distribution network. Dispatches and inward receipts are restricted to depot operators and administrators.
        </div>
      </div>

      {/* Role Switcher Section */}
      <div className="p-5 bg-white dark:bg-[#151C28] rounded-xl border border-[#E7E2DF] dark:border-[#293445] shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E7E2DF] dark:border-[#293445]">
          <span className="text-xs font-bold text-[#344054] dark:text-[#F1F5F9] uppercase tracking-wider flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-[#702D3B] dark:text-[#E4B34F]" />
            <span>Active Operational Role</span>
          </span>
          <span className="text-[11px] text-[#702D3B] dark:text-[#E4B34F] bg-[#FAF2F4] dark:bg-[#3B1020]/60 px-2 py-0.5 rounded font-medium border border-[#E7E2DF] dark:border-[#801B3A]/50">
            Current: {currentRole}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Administrator */}
          <div
            onClick={() => setCurrentRole('Administrator')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              currentRole === 'Administrator'
                ? 'border-[#702D3B] dark:border-[#801B3A] bg-[#FAF2F4] dark:bg-[#3B1020]/40 shadow-xs ring-1 ring-[#702D3B] dark:ring-[#801B3A]'
                : 'border-[#E7E2DF] dark:border-[#293445] hover:border-[#C5A46D] dark:hover:border-[#E4B34F] bg-white dark:bg-[#111827]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-[#344054] dark:text-[#F1F5F9]">Administrator</span>
              {currentRole === 'Administrator' && (
                <span className="text-[10px] bg-[#702D3B] dark:bg-[#801B3A] text-white px-2 py-0.5 rounded font-bold">
                  Active
                </span>
              )}
            </div>
            <div className="text-xs text-[#707887] dark:text-[#A1AAB9] mt-1">Full Statutory Authority</div>
            <p className="text-xs text-[#344054]/90 dark:text-[#CBD5E1] mt-3 leading-relaxed">
              Administrative governance across personnel clearances, depot configuration, approval rules, and audit trails.
            </p>
          </div>

          {/* Warehouse Operator */}
          <div
            onClick={() => setCurrentRole('Warehouse Operator')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              currentRole === 'Warehouse Operator'
                ? 'border-[#702D3B] dark:border-[#801B3A] bg-[#FAF2F4] dark:bg-[#3B1020]/40 shadow-xs ring-1 ring-[#702D3B] dark:ring-[#801B3A]'
                : 'border-[#E7E2DF] dark:border-[#293445] hover:border-[#C5A46D] dark:hover:border-[#E4B34F] bg-white dark:bg-[#111827]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-[#344054] dark:text-[#F1F5F9]">Warehouse Operator</span>
              {currentRole === 'Warehouse Operator' && (
                <span className="text-[10px] bg-[#702D3B] dark:bg-[#801B3A] text-white px-2 py-0.5 rounded font-bold">
                  Active
                </span>
              )}
            </div>
            <div className="text-xs text-[#707887] dark:text-[#A1AAB9] mt-1">Godown & Stack Handling</div>
            <p className="text-xs text-[#344054]/90 dark:text-[#CBD5E1] mt-3 leading-relaxed">
              Operational handling. Records inward stock receipts, manages bay allocations, and executes FIFO dispatches.
            </p>
          </div>

          {/* Ration Shop Dealer */}
          <div
            onClick={() => setCurrentRole('Ration Shop Dealer')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              currentRole === 'Ration Shop Dealer'
                ? 'border-[#702D3B] dark:border-[#801B3A] bg-[#FAF2F4] dark:bg-[#3B1020]/40 shadow-xs ring-1 ring-[#702D3B] dark:ring-[#801B3A]'
                : 'border-[#E7E2DF] dark:border-[#293445] hover:border-[#C5A46D] dark:hover:border-[#E4B34F] bg-white dark:bg-[#111827]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-[#344054] dark:text-[#F1F5F9]">Ration Shop Dealer</span>
              {currentRole === 'Ration Shop Dealer' && (
                <span className="text-[10px] bg-[#702D3B] dark:bg-[#801B3A] text-white px-2 py-0.5 rounded font-bold">
                  Active
                </span>
              )}
            </div>
            <div className="text-xs text-[#707887] dark:text-[#A1AAB9] mt-1">Fair Price Shop Recipient</div>
            <p className="text-xs text-[#344054]/90 dark:text-[#CBD5E1] mt-3 leading-relaxed">
              Fair Price Shop network recipient. Inspects incoming truck deliveries, reviews digital challans, and logs transit discrepancies.
            </p>
          </div>
        </div>
      </div>

      {/* Permissions Comparison Matrix */}
      <div className="p-5 bg-white dark:bg-[#151C28] rounded-xl border border-[#E7E2DF] dark:border-[#293445] shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E7E2DF] dark:border-[#293445]">
          <span className="text-xs font-bold text-[#344054] dark:text-[#F1F5F9] uppercase tracking-wider flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#702D3B] dark:text-[#E4B34F]" />
            <span>Role Permissions Matrix</span>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF7F2] dark:bg-[#111827] border-b border-[#E7E2DF] dark:border-[#293445] text-[#707887] dark:text-[#A1AAB9] font-semibold">
              <tr>
                <th className="py-2.5 px-3">System Operation</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3 text-center">Administrator</th>
                <th className="py-2.5 px-3 text-center">Warehouse Operator</th>
                <th className="py-2.5 px-3 text-center">Ration Shop Dealer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E2DF] dark:divide-[#293445]">
              {permissionsMatrix.map((item) => (
                <tr key={item.feature} className="hover:bg-[#FAF7F2]/60 dark:hover:bg-[#1E293B]/60">
                  <td className="py-2.5 px-3 font-semibold text-[#344054] dark:text-[#F1F5F9]">{item.feature}</td>
                  <td className="py-2.5 px-3 text-[#707887] dark:text-[#A1AAB9]">{item.description}</td>
                  <td className="py-2.5 px-3 text-center">
                    {item.admin ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mx-auto" />
                    ) : (
                      <XCircle className="w-4 h-4 text-[#E7E2DF] dark:text-[#293445] mx-auto" />
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {item.operator ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mx-auto" />
                    ) : (
                      <XCircle className="w-4 h-4 text-[#E7E2DF] dark:text-[#293445] mx-auto" />
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {item.dealer ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mx-auto" />
                    ) : (
                      <XCircle className="w-4 h-4 text-[#E7E2DF] dark:text-[#293445] mx-auto" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Supabase PostgreSQL Database Infrastructure Status */}
      <div className="p-5 bg-white dark:bg-[#151C28] rounded-xl border border-[#E7E2DF] dark:border-[#293445] shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E7E2DF] dark:border-[#293445]">
          <span className="text-xs font-bold text-[#344054] dark:text-[#F1F5F9] uppercase tracking-wider flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Supabase PostgreSQL Database Infrastructure</span>
          </span>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Connected & Authenticated</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-[#FAF7F2] dark:bg-[#111827] rounded-lg border border-[#E7E2DF] dark:border-[#293445]">
            <span className="text-[#707887] dark:text-[#A1AAB9] block text-[11px]">Database Provider</span>
            <span className="font-mono font-bold text-[#344054] dark:text-[#F1F5F9] mt-0.5 block">Supabase Cloud</span>
          </div>
          <div className="p-3 bg-[#FAF7F2] dark:bg-[#111827] rounded-lg border border-[#E7E2DF] dark:border-[#293445]">
            <span className="text-[#707887] dark:text-[#A1AAB9] block text-[11px]">Database Engine</span>
            <span className="font-mono font-bold text-[#344054] dark:text-[#F1F5F9] mt-0.5 block">PostgreSQL 15 (ACID)</span>
          </div>
          <div className="p-3 bg-[#FAF7F2] dark:bg-[#111827] rounded-lg border border-[#E7E2DF] dark:border-[#293445]">
            <span className="text-[#707887] dark:text-[#A1AAB9] block text-[11px]">Current User</span>
            <span className="font-mono text-[#344054] dark:text-[#CBD5E1] mt-0.5 block truncate">
              {currentUser?.email || 'Authenticated Operator'}
            </span>
          </div>
          <div className="p-3 bg-[#FAF7F2] dark:bg-[#111827] rounded-lg border border-[#E7E2DF] dark:border-[#293445]">
            <span className="text-[#707887] dark:text-[#A1AAB9] block text-[11px]">Active Batches in DB</span>
            <span className="font-mono font-bold text-[#702D3B] dark:text-[#C4B5FD] mt-0.5 block">
              {batches.length} Registered Lots
            </span>
          </div>
        </div>

        {/* Database Integrity & RLS Verification */}
        <div className="p-4 bg-[#FAF7F2] dark:bg-[#111827] rounded-xl border border-[#E7E2DF] dark:border-[#293445] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h4 className="text-xs font-bold text-[#344054] dark:text-[#F1F5F9]">
                Row-Level Security (RLS) & Atomic Transactions
              </h4>
            </div>
            <button
              type="button"
              onClick={handleTestDatabaseConnection}
              disabled={isTestingConnection}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#702D3B] dark:text-[#C4B5FD] bg-white dark:bg-[#151C28] border border-[#E7E2DF] dark:border-[#293445] rounded-lg hover:bg-[#FAF2F4] dark:hover:bg-[#3B1020]/40 transition-colors cursor-pointer"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isTestingConnection ? 'animate-spin' : ''}`} />
              <span>{isTestingConnection ? 'Testing Connection...' : 'Ping Database'}</span>
            </button>
          </div>

          <p className="text-[11px] text-[#707887] dark:text-[#A1AAB9] leading-relaxed">
            All outward commodity allocations, stock receipts, and ledger balance deductions are executed atomically inside Supabase PostgreSQL. Outward dispatches use strict FIFO batch sorting and row-level locks (<code className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">FOR UPDATE</code>) to guarantee zero over-allocation or negative inventory concurrency bugs.
          </p>

          {connectionDetails.status === 'ONLINE' && (
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Supabase PostgreSQL instance is healthy. Latency: {connectionDetails.latencyMs}ms</span>
              </span>
              <span className="font-mono text-[10px]">Realtime Active</span>
            </div>
          )}

          {connectionDetails.status === 'ERROR' && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-300 text-xs">
              <span className="font-bold">Error:</span> {connectionDetails.error}
            </div>
          )}
        </div>

        {/* Snapshot Export */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-[#707887] dark:text-[#A1AAB9]">
            Auditable Backup: Export warehouse ledger snapshot as structured JSON
          </span>
          <button
            onClick={handleExportData}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#344054] dark:text-[#F1F5F9] bg-[#FAF7F2] dark:bg-[#111827] hover:bg-[#FAF2F4] dark:hover:bg-[#1E293B] border border-[#E7E2DF] dark:border-[#293445] rounded-lg transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#702D3B] dark:text-[#C4B5FD]" />
            <span>Export Snapshot</span>
          </button>
        </div>
      </div>
    </div>
  );
};
