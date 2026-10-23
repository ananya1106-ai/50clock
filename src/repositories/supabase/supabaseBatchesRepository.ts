import { supabase } from '../../lib/supabase';
import { Batch, BatchStatus, QualityGrade, CommodityType, StockMovement } from '../../types';
import { calculateAgeDays } from '../../data/mockData';

// Helper to map snake_case SQL row to camelCase TypeScript model
export function mapBatchRowToModel(row: any): Batch {
  return {
    id: row.id,
    commodity: row.commodity as CommodityType,
    variety: row.variety,
    receivedDate: row.received_date,
    expiryDate: row.expiry_date || undefined,
    initialBags: Number(row.initial_bags),
    availableBags: Number(row.available_bags),
    bagWeightKg: Number(row.bag_weight_kg),
    totalReceivedQtl: Number(row.total_received_qtl),
    availableQtl: Number(row.available_qtl),
    depotLocation: row.depot_location,
    warehouseName: row.warehouse_name,
    moisturePercentage: Number(row.moisture_percentage),
    qualityInspectionGrade: row.quality_inspection_grade as QualityGrade,
    status: row.status as BatchStatus,
    statusReason: row.status_reason || undefined,
    supplierSource: row.supplier_source,
    stockAgeDays: calculateAgeDays(row.received_date),
    notes: row.notes || undefined,
    movements: Array.isArray(row.movements) ? row.movements : [],
    isDemo: Boolean(row.is_demo),
    isPersisted: true,
  };
}

// Helper to map camelCase TypeScript model to snake_case SQL insert/update row
export function mapBatchModelToRow(b: Batch): any {
  return {
    id: b.id,
    commodity: b.commodity,
    variety: b.variety,
    received_date: b.receivedDate,
    expiry_date: b.expiryDate || null,
    initial_bags: b.initialBags,
    available_bags: b.availableBags,
    bag_weight_kg: b.bagWeightKg,
    total_received_qtl: b.totalReceivedQtl,
    available_qtl: b.availableQtl,
    depot_location: b.depotLocation,
    warehouse_name: b.warehouseName,
    moisture_percentage: b.moisturePercentage,
    quality_inspection_grade: b.qualityInspectionGrade,
    status: b.status,
    status_reason: b.statusReason || null,
    supplier_source: b.supplierSource,
    stock_age_days: b.stockAgeDays || calculateAgeDays(b.receivedDate),
    notes: b.notes || null,
    movements: b.movements || [],
    is_demo: false,
  };
}

export const supabaseBatchesRepository = {
  async getAll(): Promise<Batch[]> {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('batches')
        .select('*')
        .order('received_date', { ascending: true });

      if (error) {
        console.warn('[SmartPDS Supabase]: Batches fetch notice:', error.message);
        throw new Error(error.message);
      }
      return (data || []).map(mapBatchRowToModel);
    } catch (err: any) {
      console.warn('[SmartPDS Supabase]: Batches query error:', err?.message || err);
      throw err;
    }
  },

  async getById(id: string): Promise<Batch | null> {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('batches')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error || !data) return null;
      return mapBatchRowToModel(data);
    } catch {
      return null;
    }
  },

  async create(batch: Batch): Promise<Batch> {
    if (!supabase) throw new Error('Supabase is not configured.');
    const row = mapBatchModelToRow(batch);
    const { data, error } = await supabase
      .from('batches')
      .insert(row)
      .select()
      .single();

    if (error) throw new Error(`Supabase Batch Insert Error: ${error.message}`);
    return mapBatchRowToModel(data);
  },

  async addBatch(batch: Batch): Promise<void> {
    await this.create(batch);
  },

  /**
   * Atomic Stock Receipt Intake:
   * First attempts to execute the PostgreSQL RPC record_stock_receipt.
   * If RPC is not available in schema cache, performs an authoritative multi-table insert
   * into batches, inward_receipts, stock_transactions, and audit_logs in Supabase.
   */
  async recordReceipt(payload: {
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
    qualityInspectionGrade: QualityGrade;
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
    userName?: string;
    userRole?: string;
  }): Promise<{ success: boolean; batchId: string; batch: Batch; error?: string }> {
    if (!supabase) throw new Error('Supabase is not configured.');

    // 1. Validation
    if (!payload.commodity) throw new Error('Commodity is required.');
    if (payload.initialBags <= 0) throw new Error('Bag quantity must be greater than zero.');
    if (payload.bagWeightKg <= 0) throw new Error('Bag weight must be greater than zero.');

    const totalQtl = Number(((payload.initialBags * payload.bagWeightKg) / 100).toFixed(2));
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const prefix = payload.commodity === 'Rice' ? 'RC' : payload.commodity === 'Wheat' ? 'WT' : 'CM';
    const batchId = `BATCH-${prefix}-2026-${randomNum}`;
    const receiptId = `INW-2026-${randomNum}`;
    const gatePassNo = payload.gatePassNo || `GP-2026-${randomNum}`;
    const vehicleNumber = (payload.vehicleNumber || 'KA-25-TR-1001').toUpperCase().trim();
    const userName = payload.userName || 'Civil Supplies Officer';
    const userRole = payload.userRole || 'Warehouse Operator';

    // 2. Try Supabase RPC first
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('record_stock_receipt', {
        p_payload: {
          id: batchId,
          commodity: payload.commodity,
          variety: payload.variety,
          receivedDate: payload.receivedDate,
          expiryDate: payload.expiryDate,
          bags: payload.initialBags,
          bagWeightKg: payload.bagWeightKg,
          depotLocation: payload.depotLocation,
          warehouseName: payload.warehouseName,
          supplierSource: payload.supplierSource,
          moisturePercentage: payload.moisturePercentage,
          qualityInspectionGrade: payload.qualityInspectionGrade,
          notes: payload.notes,
          vehicleNumber,
          gatePassNo,
          driverName: payload.driverName,
          driverPhone: payload.driverPhone,
          weighbridgeSlipNo: payload.weighbridgeSlipNo,
          grossWeightKg: payload.grossWeightKg,
          tareWeightKg: payload.tareWeightKg,
          netWeightKg: payload.netWeightKg,
          inspectedBy: payload.inspectedBy || userName,
          dispatchedBy: userName,
        },
      });

      if (!rpcError && rpcData?.success) {
        return {
          success: true,
          batchId: rpcData.batchId,
          batch: mapBatchRowToModel(rpcData.batch),
        };
      }
    } catch (rpcCatch: any) {
      console.warn('[SmartPDS]: record_stock_receipt RPC call notice:', rpcCatch?.message || rpcCatch);
    }

    // 3. Authoritative Multi-table Supabase Fallback
    const initialMovement: StockMovement = {
      id: `MOV-INW-${Date.now()}`,
      date: payload.receivedDate,
      action: 'RECEIPT',
      quantityBags: payload.initialBags,
      quantityQtl: totalQtl,
      referenceId: receiptId,
      user: userName,
      notes: payload.notes || `Consignment received from ${payload.supplierSource}`,
    };

    const newBatch: Batch = {
      id: batchId,
      commodity: payload.commodity,
      variety: payload.variety,
      receivedDate: payload.receivedDate,
      expiryDate: payload.expiryDate,
      initialBags: payload.initialBags,
      availableBags: payload.initialBags,
      bagWeightKg: payload.bagWeightKg,
      totalReceivedQtl: totalQtl,
      availableQtl: totalQtl,
      depotLocation: payload.depotLocation,
      warehouseName: payload.warehouseName,
      moisturePercentage: payload.moisturePercentage,
      qualityInspectionGrade: payload.qualityInspectionGrade,
      status: payload.status,
      statusReason: payload.statusReason,
      supplierSource: payload.supplierSource,
      stockAgeDays: calculateAgeDays(payload.receivedDate),
      notes: payload.notes,
      movements: [initialMovement],
      isDemo: false,
      isPersisted: true,
    };

    // A. Insert Batch
    const row = mapBatchModelToRow(newBatch);
    const { error: batchErr } = await supabase.from('batches').insert(row);
    if (batchErr) {
      throw new Error(`Failed to commit batch to Supabase: ${batchErr.message}`);
    }

    // B. Insert Inward Receipt
    const { error: receiptErr } = await supabase.from('inward_receipts').insert({
      id: receiptId,
      batch_id: batchId,
      commodity: payload.commodity,
      variety: payload.variety,
      received_date: payload.receivedDate,
      bags: payload.initialBags,
      bag_weight_kg: payload.bagWeightKg,
      total_qtl: totalQtl,
      moisture_percentage: payload.moisturePercentage,
      quality_grade: payload.qualityInspectionGrade,
      supplier_source: payload.supplierSource,
      vehicle_number: vehicleNumber,
      gate_pass_no: gatePassNo,
      depot_location: payload.depotLocation,
      driver_name: payload.driverName || null,
      driver_phone: payload.driverPhone || null,
      weighbridge_slip_no: payload.weighbridgeSlipNo || null,
      gross_weight_kg: payload.grossWeightKg || null,
      tare_weight_kg: payload.tareWeightKg || null,
      net_weight_kg: payload.netWeightKg || null,
      inspected_by: payload.inspectedBy || userName,
      status: payload.status === 'Quarantined' ? 'Quarantined' : 'Accepted',
      notes: payload.notes || null,
    });
    if (receiptErr) {
      console.warn('[SmartPDS]: Inward receipt log notice:', receiptErr.message);
    }

    // C. Insert Stock Transaction
    const { error: txErr } = await supabase.from('stock_transactions').insert({
      id: `TX-REC-${batchId}`,
      timestamp: new Date().toISOString(),
      date: payload.receivedDate,
      action: 'RECEIPT',
      batch_id: batchId,
      commodity: payload.commodity,
      variety: payload.variety,
      quantity_bags: payload.initialBags,
      quantity_qtl: totalQtl,
      reference_id: receiptId,
      user_name: userName,
      user_role: userRole,
      depot_location: payload.depotLocation,
      notes: `Inward receipt from ${payload.supplierSource}. Vehicle: ${vehicleNumber}`,
    });
    if (txErr) {
      console.warn('[SmartPDS]: Stock transaction log notice:', txErr.message);
    }

    // D. Insert Immutable Audit Log
    const { error: auditErr } = await supabase.from('audit_logs').insert({
      id: `AUD-REC-${batchId}`,
      timestamp: new Date().toISOString(),
      user_name: userName,
      role: userRole as any,
      action: 'STOCK_RECEIPT',
      entity: 'BATCH',
      reference_id: batchId,
      result: 'SUCCESS',
      details: `Received ${payload.initialBags} bags (${totalQtl} Qtl) of ${payload.commodity} (${payload.variety}). Status: ${payload.status}. Bay: ${payload.depotLocation}`,
    });
    if (auditErr) {
      console.warn('[SmartPDS]: Audit log notice:', auditErr.message);
    }

    return {
      success: true,
      batchId,
      batch: newBatch,
    };
  },

  async update(id: string, updates: Partial<Batch>): Promise<void> {
    if (!supabase) throw new Error('Supabase is not configured.');
    const patch: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.availableBags !== undefined) patch.available_bags = updates.availableBags;
    if (updates.availableQtl !== undefined) patch.available_qtl = updates.availableQtl;
    if (updates.status !== undefined) patch.status = updates.status;
    if (updates.statusReason !== undefined) patch.status_reason = updates.statusReason;
    if (updates.depotLocation !== undefined) patch.depot_location = updates.depotLocation;
    if (updates.moisturePercentage !== undefined) patch.moisture_percentage = updates.moisturePercentage;
    if (updates.qualityInspectionGrade !== undefined) patch.quality_inspection_grade = updates.qualityInspectionGrade;
    if (updates.notes !== undefined) patch.notes = updates.notes;
    if (updates.movements !== undefined) patch.movements = updates.movements;

    const { error } = await supabase
      .from('batches')
      .update(patch as never)
      .eq('id', id);

    if (error) throw new Error(`Supabase Batch Update Error: ${error.message}`);
  },

  async updateStatus(
    batchId: string,
    newStatus: BatchStatus,
    reason: string,
    userName = 'Warehouse Operator'
  ): Promise<void> {
    if (!supabase) throw new Error('Supabase is not configured.');

    // Fetch current batch to preserve movements
    const existing = await this.getById(batchId);
    if (!existing) throw new Error(`Batch ${batchId} not found.`);

    const newMovement: StockMovement = {
      id: `MOV-STAT-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      action: 'STATUS_CHANGE',
      quantityBags: existing.availableBags,
      quantityQtl: existing.availableQtl,
      referenceId: `STAT-${batchId}`,
      user: userName,
      notes: `Status changed to ${newStatus}. Reason: ${reason}`,
    };

    const updatedMovements = [newMovement, ...(existing.movements || [])];

    // Update batch in Supabase
    await this.update(batchId, {
      status: newStatus,
      statusReason: reason,
      movements: updatedMovements,
    });

    // Write audit log
    await supabase.from('audit_logs').insert({
      id: `AUD-STAT-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user_name: userName,
      role: 'Warehouse Operator',
      action: 'STATUS_CHANGE',
      entity: 'BATCH',
      reference_id: batchId,
      result: 'SUCCESS',
      details: `Batch ${batchId} status changed from ${existing.status} to ${newStatus}. Reason: ${reason}`,
    });
  },

  async updateBatchMetadata(
    batchId: string,
    updates: { depotLocation?: string; notes?: string; moisturePercentage?: number }
  ): Promise<void> {
    await this.update(batchId, updates);
  },

  async deleteBatch(batchId: string): Promise<void> {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { error } = await supabase.from('batches').delete().eq('id', batchId);
    if (error) throw new Error(`Supabase Batch Delete Error: ${error.message}`);
  },

  subscribe(
    onData: (batches: Batch[]) => void,
    onError?: (err: Error) => void
  ): () => void {
    const client = supabase;
    if (!client) {
      return () => {};
    }

    const channel = client
      .channel('public:batches')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'batches' },
        async () => {
          try {
            const fresh = await supabaseBatchesRepository.getAll();
            onData(fresh);
          } catch (err: any) {
            onError?.(err);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          onError?.(new Error('Supabase batches subscription channel error'));
        }
      });

    return () => {
      client.removeChannel(channel);
    };
  },
};
