import {
  supabaseBatchesRepository,
  supabaseDispatchesRepository,
  supabaseStockTransactionsRepository,
  supabaseAuditLogsRepository,
  supabaseFairPriceShopsRepository,
  supabaseCommoditiesRepository,
  supabaseReconciliationsRepository,
  supabaseFifoExceptionsRepository,
  supabaseDepotSettingsRepository,
  supabaseDeliveryTrackingRepository,
  supabaseReturnsRepository,
  supabaseApprovalRequestsRepository,
  supabaseInwardReceiptsRepository,
  executeAtomicFifoTransaction,
} from './supabase';

export * from './supabase';

export const batchesRepository = supabaseBatchesRepository;
export const dispatchesRepository = supabaseDispatchesRepository;
export const stockTransactionsRepository = supabaseStockTransactionsRepository;
export const auditLogsRepository = supabaseAuditLogsRepository;
export const fairPriceShopsRepository = supabaseFairPriceShopsRepository;
export const commoditiesRepository = supabaseCommoditiesRepository;
export const reconciliationsRepository = supabaseReconciliationsRepository;
export const fifoExceptionsRepository = supabaseFifoExceptionsRepository;
export const depotSettingsRepository = supabaseDepotSettingsRepository;
export const deliveryTrackingRepository = supabaseDeliveryTrackingRepository;
export const returnsRepository = supabaseReturnsRepository;
export const approvalRequestsRepository = supabaseApprovalRequestsRepository;
export const inwardReceiptsRepository = supabaseInwardReceiptsRepository;
export { executeAtomicFifoTransaction };
