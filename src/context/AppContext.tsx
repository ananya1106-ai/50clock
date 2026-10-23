import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  Batch,
  DispatchRecord,
  AuditLog,
  AllocationItem,
  UserRole,
  FairPriceShop,
  CommodityType,
  BatchStatus,
  ReconciliationRecord,
  FifoException,
  ApprovalRequest,
  DeliveryTrackingRecord,
  ReturnDiscrepancyRecord,
  AnomalyAlert,
  DepotSettings,
  ApprovalRule,
  UserAccount,
  FifoPreviewResult,
  ExcludedBatchItem,
} from '../types';
import {
  DEFAULT_DEPOT_SETTINGS,
  INITIAL_APPROVAL_RULES,
  calculateAgeDays,
} from '../data/mockData';
import {
  batchesRepository,
  dispatchesRepository,
  auditLogsRepository,
  fairPriceShopsRepository,
  reconciliationsRepository,
  fifoExceptionsRepository,
  depotSettingsRepository,
  deliveryTrackingRepository,
  returnsRepository,
  approvalRequestsRepository,
  executeAtomicFifoTransaction,
} from '../repositories';
import {
  supabaseSignIn,
  supabaseSignUp,
  supabaseSignOut,
  supabaseGetSession,
  supabaseSendPasswordReset,
  supabaseResendVerification,
  fetchSupabaseProfile,
  mapSupabaseUserToAccount,
} from '../lib/supabaseAuth';
import { supabase, supabaseStatus, verifySupabaseConfig, SupabaseConfigStatus } from '../lib/supabase';

export type AuthProviderType = 'supabase';

interface ToastNotification {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
  timestamp: number;
}

export interface AppContextType {
  // Data (Real Database Only)
  batches: Batch[];
  dispatches: DispatchRecord[];
  auditLogs: AuditLog[];
  fairPriceShops: FairPriceShop[];
  currentRole: UserRole;
  toasts: ToastNotification[];
  activeChallan: DispatchRecord | null;
  theme: 'light' | 'dark';

  // Authentication & Top-Level Page Navigation
  authProvider: AuthProviderType;
  setAuthProvider: (provider: any) => void;
  supabaseStatus: SupabaseConfigStatus;
  isAuthenticated: boolean;
  currentUser: UserAccount | null;
  activeView: 'landing' | 'auth' | 'app' | 'verify-email' | 'verification-callback';
  setActiveView: (view: 'landing' | 'auth' | 'app' | 'verify-email' | 'verification-callback') => void;
  preselectedAuthRole: UserRole | null;
  setPreselectedAuthRole: (role: UserRole | null) => void;
  navigateToAuthWithRole: (role: UserRole) => void;
  login: (credentials: { role: UserRole; email: string; password?: string }) => Promise<{ success: boolean; error?: string; errorCode?: string; verified?: boolean }>;
  signup: (credentials: { role: UserRole; name: string; email: string; password: string }) => Promise<{ success: boolean; error?: string; errorCode?: string; emailSent?: boolean }>;
  sendPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;

  // Email Verification
  isEmailVerified: boolean;
  resendVerificationEmail: () => Promise<{ success: boolean; error?: string }>;
  checkVerificationStatus: (silent?: boolean) => Promise<{ isVerified: boolean; error?: string }>;
  verificationState: { status: 'verifying' | 'success' | 'error' | null; error?: string } | null;

  // Diagnostics & Status
  isLoadingBatches: boolean;
  batchesError: string | null;
  refreshData: () => Promise<void>;

  // Extended Operational Data
  reconciliations: ReconciliationRecord[];
  fifoExceptions: FifoException[];
  approvalRequests: ApprovalRequest[];
  deliveryTracking: DeliveryTrackingRecord[];
  returnDiscrepancies: ReturnDiscrepancyRecord[];
  anomalies: AnomalyAlert[];
  depotSettings: DepotSettings;
  approvalRules: ApprovalRule[];

  // Theme
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;

  // Role
  setCurrentRole: (role: UserRole) => void;

  // Toast
  addToast: (type: 'success' | 'warning' | 'error' | 'info', title: string, message: string) => void;
  removeToast: (id: string) => void;

  // Challan Preview
  setActiveChallan: (challan: DispatchRecord | null) => void;

  // FIFO Calculation
  calculateFifoPreview: (
    commodity: CommodityType,
    variety: string,
    requestedBags: number
  ) => FifoPreviewResult;

  // Actions
  executeDispatch: (params: {
    commodity: CommodityType;
    variety: string;
    requestedBags: number;
    destinationFpsId: string;
    vehicleNumber: string;
    driverName: string;
    driverPhone: string;
    transporterAgency: string;
    remarks?: string;
    idempotencyKey?: string;
  }) => Promise<{ success: boolean; challan?: DispatchRecord; error?: string }>;

  addStockReceipt: (newBatch: {
    commodity: CommodityType;
    variety: string;
    receivedDate: string;
    expiryDate?: string;
    initialBags: number;
    bagWeightKg: number;
    depotLocation: string;
    warehouseName: string;
    supplierSource: string;
    moisturePercentage: number;
    qualityInspectionGrade: any;
    status: BatchStatus;
    statusReason?: string;
    notes?: string;
    vehicleNumber?: string;
    gatePassNo?: string;
    driverName?: string;
    driverPhone?: string;
    weighbridgeSlipNo?: string;
    grossWeightKg?: number;
    tareWeightKg?: number;
    netWeightKg?: number;
    inspectedBy?: string;
  }) => Promise<{
    success: boolean;
    batchId?: string;
    error?: string;
  }>;

  updateBatchStatus: (
    batchId: string,
    newStatus: BatchStatus,
    reason: string
  ) => Promise<{ success: boolean; error?: string }>;

  editBatchMetadata: (
    batchId: string,
    updates: { depotLocation?: string; notes?: string; moisturePercentage?: number }
  ) => Promise<{ success: boolean; error?: string }>;

  // Operational Workflow Actions
  addReconciliation: (rec: Omit<ReconciliationRecord, 'id' | 'reconciledDate' | 'status'> & { varianceReason?: string }) => Promise<void>;
  reviewReconciliation: (id: string, action: 'Approve' | 'Reject', notes: string) => Promise<void>;
  requestFifoException: (params: {
    requestedCommodity: CommodityType;
    requestedVariety: string;
    requestedBags: number;
    skippedBatchId: string;
    allocatedBatchId: string;
    justificationReason: string;
  }) => Promise<{ success: boolean; exceptionId?: string; error?: string }>;
  reviewFifoException: (id: string, decision: 'Approved' | 'Rejected', remarks: string) => Promise<void>;
  reviewApprovalRequest: (id: string, decision: 'Approved' | 'Rejected', remarks: string) => Promise<void>;
  updateDeliveryMilestone: (id: string, milestone: DeliveryTrackingRecord['currentMilestone'], note: string) => Promise<void>;
  addReturnDiscrepancy: (item: Omit<ReturnDiscrepancyRecord, 'id' | 'reportDate' | 'status'> & { status?: ReturnDiscrepancyRecord['status'] }) => Promise<void>;
  resolveAnomaly: (id: string, note: string) => void;
  updateDepotSettings: (newSettings: Partial<DepotSettings>) => Promise<void>;
  toggleApprovalRule: (id: string) => void;
}

/**
 * Detects if the current URL contains an email verification callback
 */
export function checkIsCallbackUrl(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const path = window.location.pathname;
    const search = window.location.search;
    const hash = window.location.hash;
    const params = new URLSearchParams(search);

    return (
      path.includes('/verify-email') ||
      path.includes('/auth/callback') ||
      params.has('code') ||
      params.has('token_hash') ||
      params.get('mode') === 'verifyEmail' ||
      hash.includes('access_token=') ||
      hash.includes('type=signup') ||
      hash.includes('type=email_change') ||
      hash.includes('error=') ||
      params.has('error') ||
      params.has('error_description')
    );
  } catch {
    return false;
  }
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Core Inventory & Operational State: Real database records only (empty on init)
  const [batches, setBatches] = useState<Batch[]>([]);
  const [dispatches, setDispatches] = useState<DispatchRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [fairPriceShops, setFairPriceShops] = useState<FairPriceShop[]>([]);
  const [reconciliations, setReconciliations] = useState<ReconciliationRecord[]>([]);
  const [fifoExceptions, setFifoExceptions] = useState<FifoException[]>([]);
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([]);
  const [deliveryTracking, setDeliveryTracking] = useState<DeliveryTrackingRecord[]>([]);
  const [returnDiscrepancies, setReturnDiscrepancies] = useState<ReturnDiscrepancyRecord[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyAlert[]>([]);
  const [depotSettings, setDepotSettings] = useState<DepotSettings>(DEFAULT_DEPOT_SETTINGS);
  const [approvalRules, setApprovalRules] = useState<ApprovalRule[]>(INITIAL_APPROVAL_RULES);

  const [isLoadingBatches, setIsLoadingBatches] = useState<boolean>(true);
  const [batchesError, setBatchesError] = useState<string | null>(null);

  // 2. Authentication & User Profile
  const [activeView, setActiveView] = useState<
    'landing' | 'auth' | 'app' | 'verify-email' | 'verification-callback'
  >(() => {
    if (checkIsCallbackUrl()) {
      return 'verification-callback';
    }
    return 'landing';
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole>('Warehouse Operator');
  const [preselectedAuthRole, setPreselectedAuthRole] = useState<UserRole | null>(null);

  const [verificationState, setVerificationState] = useState<{
    status: 'verifying' | 'success' | 'error' | null;
    error?: string;
  } | null>(null);

  // 3. UI State: Toasts & Modal Preview
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [activeChallan, setActiveChallan] = useState<DispatchRecord | null>(null);

  // 4. Theme State
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('smartpds_theme');
      if (saved === 'light' || saved === 'dark') return saved;
      return 'dark';
    } catch {
      return 'dark';
    }
  });

  const addToast = useCallback(
    (type: 'success' | 'warning' | 'error' | 'info', title: string, message: string) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      setToasts((prev) => [{ id, type, title, message, timestamp: Date.now() }, ...prev]);
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const setTheme = useCallback((newTheme: 'light' | 'dark') => {
    setThemeState(newTheme);
    try {
      localStorage.setItem('smartpds_theme', newTheme);
    } catch (e) {
      console.error('Failed to save theme to localStorage', e);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      try {
        localStorage.setItem('smartpds_theme', next);
      } catch (e) {
        console.error('Failed to save theme to localStorage', e);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Navigate to login with role pre-set
  const navigateToAuthWithRole = useCallback((role: UserRole) => {
    setPreselectedAuthRole(role);
    setActiveView('auth');
  }, []);

  // 5. Authoritative Data Loading from Supabase
  const loadAuthoritativeData = useCallback(async () => {
    if (!supabase) {
      setIsLoadingBatches(false);
      return;
    }

    setIsLoadingBatches(true);
    setBatchesError(null);

    try {
      // Parallel fetch of real database entities
      const [
        batchesRes,
        dispatchesRes,
        auditRes,
        shopsRes,
        recsRes,
        excsRes,
        approvalsRes,
        trackingRes,
        returnsRes,
        settingsRes,
      ] = await Promise.allSettled([
        batchesRepository.getAll(),
        dispatchesRepository.getAll(),
        auditLogsRepository.getAll(),
        fairPriceShopsRepository.getAll(),
        reconciliationsRepository.getAll(),
        fifoExceptionsRepository.getAll(),
        approvalRequestsRepository.getAll(),
        deliveryTrackingRepository.getAll(),
        returnsRepository.getAll(),
        depotSettingsRepository.get(),
      ]);

      if (batchesRes.status === 'fulfilled') {
        setBatches(batchesRes.value);
      } else {
        console.warn('[SmartPDS]: Batches query notice:', batchesRes.reason);
        setBatchesError(batchesRes.reason?.message || 'Failed to query stock batches from database.');
      }

      if (dispatchesRes.status === 'fulfilled') {
        setDispatches(dispatchesRes.value);
      }
      if (auditRes.status === 'fulfilled') {
        setAuditLogs(auditRes.value);
      }
      if (shopsRes.status === 'fulfilled' && shopsRes.value.length > 0) {
        setFairPriceShops(shopsRes.value);
      }
      if (recsRes.status === 'fulfilled') {
        setReconciliations(recsRes.value);
      }
      if (excsRes.status === 'fulfilled') {
        setFifoExceptions(excsRes.value);
      }
      if (approvalsRes.status === 'fulfilled') {
        setApprovalRequests(approvalsRes.value);
      }
      if (trackingRes.status === 'fulfilled') {
        setDeliveryTracking(trackingRes.value);
      }
      if (returnsRes.status === 'fulfilled') {
        setReturnDiscrepancies(returnsRes.value);
      }
      if (settingsRes.status === 'fulfilled' && settingsRes.value) {
        setDepotSettings(settingsRes.value);
      }
    } catch (err: any) {
      console.warn('[SmartPDS]: Authoritative data load error:', err?.message || err);
      setBatchesError(err?.message || 'Error communicating with database.');
    } finally {
      setIsLoadingBatches(false);
    }
  }, []);

  // 6. Supabase Real-Time Subscriptions
  useEffect(() => {
    if (!supabase) return;

    // Load initial database records
    loadAuthoritativeData();

    // Setup Realtime subscriptions
    const unsubBatches = batchesRepository.subscribe(
      (freshBatches) => {
        setBatches(freshBatches || []);
        setIsLoadingBatches(false);
      },
      (err) => console.warn('[SmartPDS]: Batches subscription note:', err.message)
    );

    const unsubDispatches = dispatchesRepository.subscribe(
      (freshDispatches) => setDispatches(freshDispatches || []),
      (err) => console.warn('[SmartPDS]: Dispatches subscription note:', err.message)
    );

    const unsubAudit = auditLogsRepository.subscribe(
      (freshLogs) => setAuditLogs(freshLogs || []),
      (err) => console.warn('[SmartPDS]: Audit logs subscription note:', err.message)
    );

    const unsubShops = fairPriceShopsRepository.subscribe(
      (freshShops) => {
        if (freshShops && freshShops.length > 0) setFairPriceShops(freshShops);
      },
      (err) => console.warn('[SmartPDS]: Fair price shops subscription note:', err.message)
    );

    const unsubRecs = reconciliationsRepository.subscribe(
      (freshRecs) => setReconciliations(freshRecs || []),
      (err) => console.warn('[SmartPDS]: Reconciliations subscription note:', err.message)
    );

    const unsubExcs = fifoExceptionsRepository.subscribe(
      (freshExcs) => setFifoExceptions(freshExcs || []),
      (err) => console.warn('[SmartPDS]: Exceptions subscription note:', err.message)
    );

    const unsubApprovals = approvalRequestsRepository.subscribe(
      (freshReqs) => setApprovalRequests(freshReqs || []),
      (err) => console.warn('[SmartPDS]: Approvals subscription note:', err.message)
    );

    const unsubTracking = deliveryTrackingRepository.subscribe(
      (freshTrk) => setDeliveryTracking(freshTrk || []),
      (err) => console.warn('[SmartPDS]: Delivery tracking subscription note:', err.message)
    );

    const unsubReturns = returnsRepository.subscribe(
      (freshRet) => setReturnDiscrepancies(freshRet || []),
      (err) => console.warn('[SmartPDS]: Returns subscription note:', err.message)
    );

    const unsubSettings = depotSettingsRepository.subscribe(
      (freshSettings) => {
        if (freshSettings) setDepotSettings(freshSettings);
      },
      (err) => console.warn('[SmartPDS]: Depot settings subscription note:', err.message)
    );

    return () => {
      unsubBatches();
      unsubDispatches();
      unsubAudit();
      unsubShops();
      unsubRecs();
      unsubExcs();
      unsubApprovals();
      unsubTracking();
      unsubReturns();
      unsubSettings();
    };
  }, [loadAuthoritativeData]);

  // 7. Supabase Authentication Session Listener
  useEffect(() => {
    if (!supabase) return;

    // Check active session on initial boot
    supabaseGetSession().then((res) => {
      if (res.user) {
        setCurrentUser(res.user);
        setCurrentRole(res.user.role);
        setIsAuthenticated(true);
        if (!res.user.emailVerified) {
          setActiveView((prev) => (prev === 'verification-callback' ? prev : 'verify-email'));
        } else {
          setActiveView((prev) => {
            if (prev === 'verification-callback' || checkIsCallbackUrl()) {
              return 'verification-callback';
            }
            return prev === 'landing' || prev === 'auth' || prev === 'verify-email' ? 'app' : prev;
          });
        }
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const profile = await fetchSupabaseProfile(session.user.id);
          const userAccount = mapSupabaseUserToAccount(session.user, profile);
          setCurrentUser(userAccount);
          setCurrentRole(userAccount.role);
          setIsAuthenticated(true);

          if (event === 'SIGNED_IN') {
            setActiveView((prev) => {
              if (prev === 'verification-callback' || checkIsCallbackUrl()) {
                return 'verification-callback';
              }
              if (!userAccount.emailVerified) {
                return 'verify-email';
              }
              return 'app';
            });
          }
        } else if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
          setIsAuthenticated(false);
          setActiveView('landing');
        }
      }
    );

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  // 8. Auth Methods (Supabase Auth Only)
  const login = useCallback(
    async (credentials: { role: UserRole; email: string; password?: string }) => {
      const res = await supabaseSignIn(credentials);
      if (res.success && res.user) {
        setCurrentUser(res.user);
        setCurrentRole(res.user.role);
        setIsAuthenticated(true);

        if (!res.user.emailVerified) {
          setActiveView('verify-email');
        } else {
          setActiveView('app');
        }
        addToast('success', 'Authentication Successful', `Welcome back, ${res.user.name}. Clearance verified as ${res.user.role}.`);
      }
      return res;
    },
    [addToast]
  );

  const signup = useCallback(
    async (credentials: { role: UserRole; name: string; email: string; password: string }) => {
      const res = await supabaseSignUp(credentials);
      if (res.success && res.user) {
        setCurrentUser(res.user);
        setCurrentRole(res.user.role);
        setIsAuthenticated(true);

        if (res.emailSent) {
          setActiveView('verify-email');
          addToast('info', 'Verification Email Sent', `A statutory confirmation link has been sent to ${credentials.email}. Please verify to unlock the terminal.`);
        } else {
          setActiveView('app');
          addToast('success', 'Account Registered', `Welcome, ${credentials.name}! Your account is now active as ${res.user.role}.`);
        }
      }
      return res;
    },
    [addToast]
  );

  const sendPasswordReset = useCallback(
    async (email: string) => {
      const res = await supabaseSendPasswordReset(email);
      if (res.success) {
        addToast('success', 'Password Reset Email Sent', `Official recovery link dispatched to ${email}.`);
      } else {
        addToast('error', 'Reset Failed', res.error || 'Unable to send password reset email.');
      }
      return res;
    },
    [addToast]
  );

  const resendVerificationEmail = useCallback(async () => {
    if (!currentUser?.email) {
      return { success: false, error: 'No authenticated user email found.' };
    }
    const res = await supabaseResendVerification(currentUser.email);
    if (res.success) {
      addToast('success', 'Verification Link Resent', `A fresh confirmation link has been dispatched to ${currentUser.email}.`);
    } else {
      addToast('error', 'Dispatch Notice', res.error || 'Failed to dispatch email.');
    }
    return res;
  }, [currentUser, addToast]);

  const checkVerificationStatus = useCallback(
    async (silent = false) => {
      if (!supabase) return { isVerified: false };
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data?.user) {
          return { isVerified: false, error: error?.message || 'No active user session found.' };
        }
        const verified = Boolean(data.user.email_confirmed_at || data.user.confirmed_at);
        if (verified) {
          setCurrentUser((prev) => (prev ? { ...prev, emailVerified: true } : null));
          setActiveView((prev) => (prev === 'verification-callback' || checkIsCallbackUrl() ? prev : 'app'));
          if (!silent) {
            addToast('success', 'Credential Confirmed', 'Email verified successfully in Supabase! Full operational terminal unlocked.');
          }
        }
        return { isVerified: verified };
      } catch (err: any) {
        return { isVerified: false, error: err?.message };
      }
    },
    [addToast]
  );

  const logout = useCallback(async () => {
    await supabaseSignOut();
    setCurrentUser(null);
    setIsAuthenticated(false);
    setActiveView('landing');
    addToast('info', 'Signed Out', 'You have been securely signed out of SmartPDS.');
  }, [addToast]);

  // 9. In-Memory FIFO Allocation Preview Sandbox (Pre-Dispatch Verification)
  const calculateFifoPreview = useCallback(
    (
      commodity: CommodityType,
      variety: string,
      requestedBags: number
    ): FifoPreviewResult => {
      const matchingBatches = batches.filter((b) => b.commodity === commodity);
      const excludedBatches: ExcludedBatchItem[] = [];

      const eligibleBatches: Batch[] = [];

      for (const batch of matchingBatches) {
        // Variety match check
        if (variety !== 'ALL' && batch.variety !== variety) {
          excludedBatches.push({
            batch,
            reason: `Variety Mismatch: Requested "${variety}", batch is "${batch.variety}"`,
            category: 'DIFF_VARIETY',
          });
          continue;
        }

        // Status check
        if (batch.status === 'Quarantined') {
          excludedBatches.push({
            batch,
            reason: `Quarantine Lock: ${batch.statusReason || 'Pending laboratory moisture clearance'}`,
            category: 'QUARANTINED',
          });
          continue;
        }

        if (batch.status === 'Damaged') {
          excludedBatches.push({
            batch,
            reason: `Damaged Lot: ${batch.statusReason || 'Water or pest infestation damage'}`,
            category: 'DAMAGED',
          });
          continue;
        }

        if (batch.status === 'Exhausted' || batch.availableBags <= 0) {
          excludedBatches.push({
            batch,
            reason: 'Zero Stock: Batch is fully exhausted',
            category: 'EXHAUSTED',
          });
          continue;
        }

        // Expiry check
        if (batch.expiryDate && new Date(batch.expiryDate).getTime() < Date.now()) {
          excludedBatches.push({
            batch,
            reason: `Expired Lot: Expiry date was ${batch.expiryDate}`,
            category: 'EXPIRED',
          });
          continue;
        }

        eligibleBatches.push(batch);
      }

      // Sort candidate eligible batches strictly Oldest First (Received Date ASC, then ID ASC)
      const sortedBatches = [...eligibleBatches].sort((a, b) => {
        const dateA = new Date(a.receivedDate).getTime();
        const dateB = new Date(b.receivedDate).getTime();
        if (dateA !== dateB) return dateA - dateB;
        return a.id.localeCompare(b.id);
      });

      const totalEligibleAvailableBags = sortedBatches.reduce(
        (sum, b) => sum + b.availableBags,
        0
      );

      if (totalEligibleAvailableBags < requestedBags) {
        return {
          success: false,
          error: `Insufficient eligible stock. Requested ${requestedBags} bags, but only ${totalEligibleAvailableBags} eligible bags of ${commodity} available.`,
          commodity,
          variety,
          requestedBags,
          totalEligibleAvailableBags,
          shortageBags: requestedBags - totalEligibleAvailableBags,
          allocations: [],
          allEligibleBatches: sortedBatches,
          excludedBatches,
        };
      }

      let remainingToAllocate = requestedBags;
      const allocations: AllocationItem[] = [];

      for (const batch of sortedBatches) {
        if (remainingToAllocate <= 0) break;

        const takeBags = Math.min(batch.availableBags, remainingToAllocate);
        const allocatedQtl = Number(((takeBags * batch.bagWeightKg) / 100).toFixed(2));
        const remainingBagsAfter = batch.availableBags - takeBags;

        allocations.push({
          batchId: batch.id,
          commodity: batch.commodity,
          variety: batch.variety,
          receivedDate: batch.receivedDate,
          availableBags: batch.availableBags,
          allocatedBags: takeBags,
          allocatedQtl,
          remainingBagsAfter,
          depotLocation: batch.depotLocation,
          stockAgeDays: batch.stockAgeDays || calculateAgeDays(batch.receivedDate),
          isFullyExhausted: remainingBagsAfter === 0,
        });

        remainingToAllocate -= takeBags;
      }

      return {
        success: true,
        commodity,
        variety,
        requestedBags,
        totalEligibleAvailableBags,
        shortageBags: 0,
        allocations,
        allEligibleBatches: sortedBatches,
        excludedBatches,
      };
    },
    [batches]
  );

  // 10. Authoritative FIFO Dispatch Execution
  const executeDispatch = useCallback(
    async (params: {
      commodity: CommodityType;
      variety: string;
      requestedBags: number;
      destinationFpsId: string;
      vehicleNumber: string;
      driverName: string;
      driverPhone: string;
      transporterAgency: string;
      remarks?: string;
      idempotencyKey?: string;
    }): Promise<{ success: boolean; challan?: DispatchRecord; error?: string }> => {
      if (currentRole === 'Ration Shop Dealer') {
        addToast(
          'error',
          'Permission Denied',
          'Ration Shop Dealers hold recipient privileges and cannot authorize depot dispatches.'
        );
        return { success: false, error: 'Permission denied: Ration Shop Dealers hold recipient privileges only.' };
      }

      const fps = fairPriceShops.find((f) => f.id === params.destinationFpsId);
      const destinationName = fps?.name || `Fair Price Shop ${params.destinationFpsId}`;
      const destinationDistrict = fps?.district || 'Dharwad';
      const destinationAddress = fps ? `${fps.taluk}, ${fps.district} District, Karnataka` : 'Karnataka State PDS Network';

      const dispatchedBy = currentUser ? `${currentUser.name} (${currentUser.role})` : `Civil Supplies Officer (${currentRole})`;
      const authorizedBy = currentUser ? `${currentUser.name} (${currentUser.role})` : 'Depot Area Manager';

      // Execute Atomic Database Transaction in Supabase
      const transactionResult = await executeAtomicFifoTransaction({
        commodity: params.commodity,
        variety: params.variety,
        requestedBags: params.requestedBags,
        destinationFpsId: params.destinationFpsId,
        destinationName,
        destinationDistrict,
        destinationAddress,
        vehicleNumber: params.vehicleNumber,
        driverName: params.driverName,
        driverPhone: params.driverPhone,
        transporterAgency: params.transporterAgency,
        dispatchedBy,
        authorizedBy,
        role: currentRole,
        issuerUid: currentUser?.id,
        depotId: depotSettings?.depotCode || 'DEP-HUB-04',
        depotName: depotSettings?.depotName || 'FCI District Base Depot #4, Hubballi',
        idempotencyKey: params.idempotencyKey,
        remarks: params.remarks,
      });

      if (!transactionResult.success || !transactionResult.challan) {
        addToast('error', 'FIFO Transaction Failed', transactionResult.error || 'Stock deduction transaction failed in database.');
        return { success: false, error: transactionResult.error };
      }

      const committedChallan = transactionResult.challan;

      // Refresh authoritative database state
      await loadAuthoritativeData();

      setActiveChallan(committedChallan);
      addToast(
        'success',
        'Dispatch Authorized & Confirmed',
        `Challan ${committedChallan.challanNumber} issued. ${params.requestedBags} bags deducted atomically under strict FIFO rules.`
      );

      return {
        success: true,
        challan: committedChallan,
      };
    },
    [currentRole, currentUser, fairPriceShops, depotSettings, addToast, loadAuthoritativeData]
  );

  // 11. Authoritative Stock Inward Receipt Registration
  const addStockReceipt = useCallback(
    async (newBatchData: {
      commodity: CommodityType;
      variety: string;
      receivedDate: string;
      expiryDate?: string;
      initialBags: number;
      bagWeightKg: number;
      depotLocation: string;
      warehouseName: string;
      supplierSource: string;
      moisturePercentage: number;
      qualityInspectionGrade: any;
      status: BatchStatus;
      statusReason?: string;
      notes?: string;
      vehicleNumber?: string;
      gatePassNo?: string;
      driverName?: string;
      driverPhone?: string;
      weighbridgeSlipNo?: string;
      grossWeightKg?: number;
      tareWeightKg?: number;
      netWeightKg?: number;
      inspectedBy?: string;
    }): Promise<{
      success: boolean;
      batchId?: string;
      error?: string;
    }> => {
      if (currentRole === 'Ration Shop Dealer') {
        addToast('error', 'Action Restricted', 'Ration Shop Dealers hold recipient privileges and cannot record inward stock receipts.');
        return { success: false, error: 'Recipient role cannot log depot receipts.' };
      }

      try {
        const userName = currentUser ? `${currentUser.name}` : 'Civil Supplies Officer';
        const userRole = currentRole;

        const result = await batchesRepository.recordReceipt({
          ...newBatchData,
          userName,
          userRole,
        });

        if (!result.success) {
          addToast('error', 'Receipt Registration Failed', result.error || 'Database rejected stock intake.');
          return { success: false, error: result.error };
        }

        // Refresh database state
        await loadAuthoritativeData();

        addToast(
          'success',
          'Inward Stock Consignment Registered',
          `Batch ${result.batchId} created and committed to database. Initial status: ${newBatchData.status}.`
        );

        return {
          success: true,
          batchId: result.batchId,
        };
      } catch (err: any) {
        const errorMsg = err?.message || 'Database error occurred while recording stock receipt.';
        addToast('error', 'Stock Receipt Failed', errorMsg);
        return { success: false, error: errorMsg };
      }
    },
    [currentRole, currentUser, addToast, loadAuthoritativeData]
  );

  // 12. Update Batch Status in Supabase
  const updateBatchStatus = useCallback(
    async (batchId: string, newStatus: BatchStatus, reason: string): Promise<{ success: boolean; error?: string }> => {
      if (currentRole === 'Ration Shop Dealer') {
        addToast('error', 'Permission Denied', 'Ration Shop Dealers cannot alter warehouse batch status.');
        return { success: false, error: 'Unauthorized.' };
      }

      try {
        const userName = currentUser ? currentUser.name : 'Warehouse Operator';
        await batchesRepository.updateStatus(batchId, newStatus, reason, userName);
        await loadAuthoritativeData();
        addToast('success', 'Batch Status Updated', `Batch ${batchId} status updated to ${newStatus}.`);
        return { success: true };
      } catch (err: any) {
        addToast('error', 'Status Update Failed', err?.message || 'Failed to update batch status.');
        return { success: false, error: err?.message };
      }
    },
    [currentRole, currentUser, addToast, loadAuthoritativeData]
  );

  // 13. Edit Batch Metadata in Supabase
  const editBatchMetadata = useCallback(
    async (
      batchId: string,
      updates: { depotLocation?: string; notes?: string; moisturePercentage?: number }
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        await batchesRepository.updateBatchMetadata(batchId, updates);
        await loadAuthoritativeData();
        addToast('success', 'Batch Updated', `Batch ${batchId} details updated in database.`);
        return { success: true };
      } catch (err: any) {
        addToast('error', 'Update Failed', err?.message || 'Failed to update metadata.');
        return { success: false, error: err?.message };
      }
    },
    [addToast, loadAuthoritativeData]
  );

  // 14. Operational Workflow Actions (Committed to Supabase)
  const addReconciliation = useCallback(
    async (recData: Omit<ReconciliationRecord, 'id' | 'reconciledDate' | 'status'> & { varianceReason?: string }) => {
      const id = `REC-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const newRec: ReconciliationRecord = {
        ...recData,
        id,
        reconciledDate: new Date().toISOString().split('T')[0],
        status: recData.varianceBags === 0 ? 'Reconciled' : 'Discrepancy',
      };
      try {
        await reconciliationsRepository.create(newRec);
        await loadAuthoritativeData();
        addToast('success', 'Reconciliation Logged', `Audit entry ${id} saved to database.`);
      } catch (e: any) {
        addToast('error', 'Reconciliation Failed', e?.message || 'Failed to save audit.');
      }
    },
    [addToast, loadAuthoritativeData]
  );

  const reviewReconciliation = useCallback(
    async (id: string, action: 'Approve' | 'Reject', notes: string) => {
      const newStatus = action === 'Approve' ? 'Adjusted' : 'Discrepancy';
      try {
        await reconciliationsRepository.updateStatus(id, newStatus);
        await loadAuthoritativeData();
        addToast('info', 'Reconciliation Reviewed', `Audit ${id} updated to ${newStatus}.`);
      } catch (e: any) {
        addToast('error', 'Review Failed', e?.message || 'Failed to review reconciliation.');
      }
    },
    [addToast, loadAuthoritativeData]
  );

  const requestFifoException = useCallback(
    async (params: {
      requestedCommodity: CommodityType;
      requestedVariety: string;
      requestedBags: number;
      skippedBatchId: string;
      allocatedBatchId: string;
      justificationReason: string;
    }) => {
      const id = `EXC-2026-${Math.floor(100 + Math.random() * 900)}`;
      const skippedBatch = batches.find((b) => b.id === params.skippedBatchId);
      const allocatedBatch = batches.find((b) => b.id === params.allocatedBatchId);

      const newException: FifoException = {
        id,
        timestamp: new Date().toISOString(),
        requestedCommodity: params.requestedCommodity,
        requestedVariety: params.requestedVariety,
        requestedBags: params.requestedBags,
        skippedBatchId: params.skippedBatchId,
        skippedBatchAgeDays: skippedBatch?.stockAgeDays || 0,
        allocatedBatchId: params.allocatedBatchId,
        allocatedBatchAgeDays: allocatedBatch?.stockAgeDays || 0,
        justificationReason: params.justificationReason,
        requestedBy: currentUser ? currentUser.name : 'Warehouse Operator',
        status: 'Pending Approval',
      };

      try {
        await fifoExceptionsRepository.create(newException);
        await loadAuthoritativeData();
        addToast('warning', 'FIFO Exception Registered', `Request ${id} logged for managerial review.`);
        return { success: true, exceptionId: id };
      } catch (e: any) {
        addToast('error', 'Exception Request Failed', e?.message || 'Failed to log exception.');
        return { success: false, error: e?.message };
      }
    },
    [batches, currentUser, addToast, loadAuthoritativeData]
  );

  const reviewFifoException = useCallback(
    async (id: string, decision: 'Approved' | 'Rejected', remarks: string) => {
      try {
        await fifoExceptionsRepository.updateStatus(
          id,
          decision,
          currentUser ? currentUser.name : 'Area Manager',
          remarks
        );
        await loadAuthoritativeData();
        addToast(
          decision === 'Approved' ? 'success' : 'info',
          `Exception ${decision}`,
          `Exception ${id} marked as ${decision}.`
        );
      } catch (e: any) {
        addToast('error', 'Review Failed', e?.message || 'Failed to review exception.');
      }
    },
    [currentUser, addToast, loadAuthoritativeData]
  );

  const reviewApprovalRequest = useCallback(
    async (id: string, decision: 'Approved' | 'Rejected', remarks: string) => {
      try {
        await approvalRequestsRepository.updateStatus(
          id,
          decision,
          currentUser ? currentUser.name : 'Depot Area Manager',
          remarks
        );
        await loadAuthoritativeData();
        addToast('info', 'Approval Reviewed', `Request ${id} marked as ${decision}.`);
      } catch (e: any) {
        addToast('error', 'Review Failed', e?.message || 'Failed to review request.');
      }
    },
    [currentUser, addToast, loadAuthoritativeData]
  );

  const updateDeliveryMilestone = useCallback(
    async (id: string, milestone: DeliveryTrackingRecord['currentMilestone'], note: string) => {
      try {
        await deliveryTrackingRepository.updateMilestone(id, milestone, note);
        await loadAuthoritativeData();
        addToast('success', 'Transit Milestone Updated', `Transit ${id} updated to "${milestone}".`);
      } catch (e: any) {
        addToast('error', 'Milestone Update Failed', e?.message || 'Failed to update milestone.');
      }
    },
    [addToast, loadAuthoritativeData]
  );

  const addReturnDiscrepancy = useCallback(
    async (item: Omit<ReturnDiscrepancyRecord, 'id' | 'reportDate' | 'status'> & { status?: ReturnDiscrepancyRecord['status'] }) => {
      const id = `RET-2026-${Math.floor(100 + Math.random() * 900)}`;
      const newRet: ReturnDiscrepancyRecord = {
        ...item,
        id,
        reportDate: new Date().toISOString().split('T')[0],
        status: item.status || 'Logged',
      };
      try {
        await returnsRepository.create(newRet);
        await loadAuthoritativeData();
        addToast('warning', 'Discrepancy Logged', `Report ${id} recorded in database.`);
      } catch (e: any) {
        addToast('error', 'Report Failed', e?.message || 'Failed to record discrepancy.');
      }
    },
    [addToast, loadAuthoritativeData]
  );

  const resolveAnomaly = useCallback((id: string, note: string) => {
    setAnomalies((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'Resolved' as const, resolutionNote: note } : a))
    );
    addToast('success', 'Anomaly Resolved', `Audit alert marked resolved: ${note}`);
  }, [addToast]);

  const updateDepotSettings = useCallback(
    async (newSettings: Partial<DepotSettings>) => {
      const merged: DepotSettings = { ...depotSettings, ...newSettings };
      setDepotSettings(merged);
      try {
        await depotSettingsRepository.update(merged);
        addToast('success', 'Depot Settings Saved', 'Depot configuration committed to Supabase.');
      } catch (e: any) {
        addToast('error', 'Settings Save Failed', e?.message || 'Failed to commit settings.');
      }
    },
    [depotSettings, addToast]
  );

  const toggleApprovalRule = useCallback((id: string) => {
    setApprovalRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, isActive: !r.isActive } : r))
    );
    addToast('info', 'Rule Toggled', 'Approval escalation policy state updated.');
  }, [addToast]);

  return (
    <AppContext.Provider
      value={{
        batches,
        dispatches,
        auditLogs,
        fairPriceShops,
        currentRole,
        toasts,
        activeChallan,
        theme,
        authProvider: 'supabase',
        setAuthProvider: () => {},
        supabaseStatus,
        isAuthenticated,
        currentUser,
        activeView,
        setActiveView,
        preselectedAuthRole,
        setPreselectedAuthRole,
        navigateToAuthWithRole,
        login,
        signup,
        sendPasswordReset,
        logout,
        isEmailVerified: Boolean(currentUser?.emailVerified),
        resendVerificationEmail,
        checkVerificationStatus,
        verificationState,
        isLoadingBatches,
        batchesError,
        refreshData: loadAuthoritativeData,
        reconciliations,
        fifoExceptions,
        approvalRequests,
        deliveryTracking,
        returnDiscrepancies,
        anomalies,
        depotSettings,
        approvalRules,
        toggleTheme,
        setTheme,
        setCurrentRole,
        addToast,
        removeToast,
        setActiveChallan,
        calculateFifoPreview,
        executeDispatch,
        addStockReceipt,
        updateBatchStatus,
        editBatchMetadata,
        addReconciliation,
        reviewReconciliation,
        requestFifoException,
        reviewFifoException,
        reviewApprovalRequest,
        updateDeliveryMilestone,
        addReturnDiscrepancy,
        resolveAnomaly,
        updateDepotSettings,
        toggleApprovalRule,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
