import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { CommodityType } from '../../types';
import {
  Boxes,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  FileCheck2,
  Info,
  Database,
  Building2,
  PlusCircle,
} from 'lucide-react';

interface FifoDispatchEngineProps {
  onOpenChallansTab: () => void;
  onOpenInwardTab?: () => void;
}

export const FifoDispatchEngine: React.FC<FifoDispatchEngineProps> = ({ onOpenChallansTab, onOpenInwardTab }) => {
  const {
    batches,
    fairPriceShops,
    currentRole,
    calculateFifoPreview,
    executeDispatch,
    addToast,
  } = useApp();

  // Form State
  const [commodity, setCommodity] = useState<CommodityType>('Rice');
  const [variety, setVariety] = useState<string>('Grade A - Boiled');
  const [requestedBags, setRequestedBags] = useState<number>(100);
  const [destinationFpsId, setDestinationFpsId] = useState<string>(
    fairPriceShops[0]?.id || 'FPS-KA-29-014'
  );
  const [vehicleNumber, setVehicleNumber] = useState<string>('KA-25-AA-4921');
  const [driverName, setDriverName] = useState<string>('Ramesh Patil');
  const [driverPhone, setDriverPhone] = useState<string>('+91 98450 12345');
  const [transporterAgency, setTransporterAgency] = useState<string>(
    'Karnataka State Food Transport Corporation (Contract #26/TR)'
  );
  const [remarks, setRemarks] = useState<string>(
    'Regular monthly NFSA ration allotment for BPL cardholders'
  );

  // Confirmation Modal State
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [dispatchError, setDispatchError] = useState<string | null>(null);

  // Variety options for commodity from real registered batches
  const availableVarieties = useMemo(() => {
    const set = new Set<string>();
    batches
      .filter((b) => b.commodity === commodity && b.status === 'Eligible' && b.availableBags > 0)
      .forEach((b) => set.add(b.variety));
    
    // Provide standard grade fallback if no variety found yet in batches
    if (set.size === 0) {
      if (commodity === 'Rice') {
        set.add('Grade A - Boiled');
        set.add('Common - Raw');
      } else {
        set.add('Sharbati Grade I');
        set.add('Kalyan Sona');
      }
    }
    return Array.from(set);
  }, [batches, commodity]);

  // Ensure variety matches available
  React.useEffect(() => {
    if (availableVarieties.length > 0 && !availableVarieties.includes(variety)) {
      setVariety(availableVarieties[0]);
    }
  }, [availableVarieties, variety]);

  // Run Real-Time FIFO Allocation Calculation against loaded Supabase batches
  const fifoResult = useMemo(() => {
    return calculateFifoPreview(commodity, variety, requestedBags);
  }, [calculateFifoPreview, commodity, variety, requestedBags]);

  // Selected Fair Price Shop
  const selectedFps = useMemo(() => {
    return (
      fairPriceShops.find((f) => f.id === destinationFpsId) ||
      fairPriceShops[0] || {
        id: destinationFpsId,
        name: 'Fair Price Shop',
        code: 'FPS-KA-29-014',
        taluk: 'Dharwad',
        activeCardholders: 450,
      }
    );
  }, [fairPriceShops, destinationFpsId]);

  const handleInitiateDispatch = () => {
    if (currentRole === 'Ration Shop Dealer') {
      addToast(
        'error',
        'Recipient Role',
        'Ration Shop Dealers hold recipient privileges and cannot authorize depot dispatches.'
      );
      return;
    }

    if (!fifoResult.success) {
      addToast('error', 'Cannot Proceed', fifoResult.error || 'Invalid requested quantity.');
      return;
    }

    if (!vehicleNumber.trim() || !driverName.trim()) {
      addToast('error', 'Missing Logistics Details', 'Vehicle number and driver name are required.');
      return;
    }

    setShowConfirmModal(true);
  };

  const handleConfirmAndDispatch = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setDispatchError(null);

    const clientRequestId = `REQ-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    try {
      const result = await executeDispatch({
        commodity,
        variety,
        requestedBags,
        destinationFpsId,
        vehicleNumber,
        driverName,
        driverPhone,
        transporterAgency,
        remarks,
        idempotencyKey: clientRequestId,
      });

      if (result.success) {
        setShowConfirmModal(false);
        addToast(
          'success',
          'Dispatch Committed',
          `Gate Pass #${result.challan?.challanNumber || 'Form-12'} successfully registered in Supabase PostgreSQL!`
        );
        onOpenChallansTab();
      } else {
        setDispatchError(result.error || 'Dispatch transaction was rejected by Supabase.');
      }
    } catch (err: any) {
      setDispatchError(err?.message || 'Transaction could not be committed.');
      addToast('error', 'Dispatch Execution Failed', err?.message || 'Transaction could not be committed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const totalDepotEligibleBags = useMemo(() => {
    return batches
      .filter((b) => b.status === 'Eligible')
      .reduce((acc, b) => acc + b.availableBags, 0);
  }, [batches]);

  return (
    <div className="space-y-6">
      {/* Top Engine Banner */}
      <div className="p-5 rounded-2xl bg-[#54212D] dark:bg-[#3B1020] text-white shadow-md border border-[#702D3B] dark:border-[#801B3A] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <h2 className="text-base font-bold tracking-tight text-white">
              Deterministic FIFO Stock Allocation Engine
            </h2>
          </div>
          <p className="text-xs text-stone-200 dark:text-stone-300 mt-1 leading-relaxed max-w-2xl">
            In compliance with Central PDS Godown Manual norms: batches of grain are strictly prioritized by inward receipt date (oldest first).
            Database transactions are executed atomically in Supabase PostgreSQL with row-level locks (<code className="font-mono text-emerald-300">FOR UPDATE</code>).
          </p>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-lg bg-black/25 border border-white/10 text-xs flex items-center gap-2 text-stone-200">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-mono font-medium">PostgreSQL FIFO Engine</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Demand Inputs (Left) and Live FIFO Allocation Breakdown (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Demand & Logistics Configuration (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card 1: Commodity & Quantity Demand */}
          <div className="p-5 bg-white dark:bg-[#151C28] rounded-xl border border-[#E7E2DF] dark:border-[#293445] shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E2DF] dark:border-[#293445]">
              <span className="text-xs font-bold text-[#344054] dark:text-[#F1F5F9] uppercase tracking-wider flex items-center gap-2">
                <Boxes className="w-4 h-4 text-[#702D3B] dark:text-[#C4B5FD]" />
                <span>1. Allotment Demand</span>
              </span>
              <span className="text-[11px] text-[#707887] dark:text-[#A1AAB9] font-mono">
                Eligible Stock: {fifoResult.totalEligibleAvailableBags} bags
              </span>
            </div>

            {/* Commodity Selector */}
            <div>
              <label className="block text-xs font-semibold text-[#344054] dark:text-[#F1F5F9] mb-1">
                Commodity
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['Rice', 'Wheat'] as CommodityType[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCommodity(c)}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-colors ${
                      commodity === c
                        ? 'border-[#702D3B] dark:border-[#801B3A] bg-[#FAF2F4] dark:bg-[#3B1020]/60 text-[#702D3B] dark:text-[#C4B5FD]'
                        : 'border-[#E7E2DF] dark:border-[#293445] bg-white dark:bg-[#111827] hover:bg-[#FAF7F2] dark:hover:bg-[#151C28] text-[#344054] dark:text-[#F1F5F9]'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Variety Selector */}
            <div>
              <label className="block text-xs font-semibold text-[#344054] dark:text-[#F1F5F9] mb-1">
                Variety / Specification
              </label>
              <select
                value={variety}
                onChange={(e) => setVariety(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#FAF7F2] dark:bg-[#111827] border border-[#E7E2DF] dark:border-[#293445] rounded-lg text-[#344054] dark:text-[#F1F5F9] font-medium focus:bg-white dark:focus:bg-[#151C28] focus:border-[#702D3B] dark:focus:border-[#801B3A] outline-none"
              >
                {availableVarieties.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            {/* Requested Quantity */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-[#344054] dark:text-[#F1F5F9]">
                  Requested Quantity (Bags)
                </label>
                <span className="text-xs text-[#707887] dark:text-[#A1AAB9] font-mono tabular-nums">
                  = {(requestedBags * 0.5).toFixed(1)} Quintals
                </span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max={fifoResult.totalEligibleAvailableBags || 1000}
                  value={requestedBags}
                  onChange={(e) => setRequestedBags(parseInt(e.target.value) || 0)}
                  className={`w-full px-3 py-2 text-base font-bold font-mono rounded-lg border outline-none ${
                    requestedBags > fifoResult.totalEligibleAvailableBags
                      ? 'border-rose-300 dark:border-rose-600 bg-rose-50/50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-300 focus:border-rose-500'
                      : 'border-[#E7E2DF] dark:border-[#293445] bg-[#FAF7F2] dark:bg-[#111827] text-[#344054] dark:text-[#F1F5F9] focus:bg-white dark:focus:bg-[#151C28] focus:border-[#702D3B] dark:focus:border-[#801B3A]'
                  }`}
                />
              </div>

              {/* Quick bag chips */}
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-[11px] text-[#707887] dark:text-[#A1AAB9]">Quick:</span>
                {[25, 50, 75, 100, 150].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setRequestedBags(num)}
                    className="px-2 py-0.5 text-[11px] font-mono font-medium rounded border border-[#E7E2DF] dark:border-[#293445] bg-[#FAF7F2] dark:bg-[#111827] text-[#707887] dark:text-[#A1AAB9] hover:bg-white dark:hover:bg-[#151C28] hover:text-[#344054] dark:hover:text-[#F1F5F9]"
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {/* Destination Fair Price Shop */}
            <div>
              <label className="block text-xs font-semibold text-[#344054] dark:text-[#F1F5F9] mb-1">
                Destination Fair Price Shop (FPS)
              </label>
              <select
                value={destinationFpsId}
                onChange={(e) => setDestinationFpsId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#FAF7F2] dark:bg-[#111827] border border-[#E7E2DF] dark:border-[#293445] rounded-lg text-[#344054] dark:text-[#F1F5F9] font-medium focus:bg-white dark:focus:bg-[#151C28] focus:border-[#702D3B] dark:focus:border-[#801B3A] outline-none"
              >
                {fairPriceShops.map((fps) => (
                  <option key={fps.id} value={fps.id}>
                    {fps.code} — {fps.name} ({fps.taluk})
                  </option>
                ))}
              </select>

              {selectedFps && (
                <div className="mt-2 p-2.5 rounded-lg bg-[#FAF7F2] dark:bg-[#111827] border border-[#E7E2DF] dark:border-[#293445] text-[11px] space-y-1">
                  <div className="flex justify-between text-[#707887] dark:text-[#A1AAB9]">
                    <span>License / Code:</span>
                    <span className="font-mono font-semibold text-[#344054] dark:text-[#F1F5F9]">{selectedFps.code}</span>
                  </div>
                  <div className="flex justify-between text-[#707887] dark:text-[#A1AAB9]">
                    <span>Taluk / Region:</span>
                    <span className="text-[#344054] dark:text-[#F1F5F9] font-medium">{selectedFps.taluk}</span>
                  </div>
                  <div className="flex justify-between text-[#707887] dark:text-[#A1AAB9]">
                    <span>NFSA Ration Cardholders:</span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                      {selectedFps.activeCardholders || 450} Families
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Transport & Vehicle Logistics */}
          <div className="p-5 bg-white dark:bg-[#151C28] rounded-xl border border-[#E7E2DF] dark:border-[#293445] shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E2DF] dark:border-[#293445]">
              <span className="text-xs font-bold text-[#344054] dark:text-[#F1F5F9] uppercase tracking-wider flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#702D3B] dark:text-[#C4B5FD]" />
                <span>2. Transport & Gate Pass Details</span>
              </span>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                Form-12 Gate Pass
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#344054] dark:text-[#F1F5F9] mb-1">
                  Vehicle Reg. Number
                </label>
                <input
                  type="text"
                  required
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                  placeholder="KA-25-AA-4921"
                  className="w-full px-3 py-1.5 text-xs bg-[#FAF7F2] dark:bg-[#111827] border border-[#E7E2DF] dark:border-[#293445] rounded-lg text-[#344054] dark:text-[#F1F5F9] font-mono focus:bg-white dark:focus:bg-[#151C28] focus:border-[#702D3B] dark:focus:border-[#801B3A] outline-none uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#344054] dark:text-[#F1F5F9] mb-1">
                  Driver Name
                </label>
                <input
                  type="text"
                  required
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="Ramesh Patil"
                  className="w-full px-3 py-1.5 text-xs bg-[#FAF7F2] dark:bg-[#111827] border border-[#E7E2DF] dark:border-[#293445] rounded-lg text-[#344054] dark:text-[#F1F5F9] focus:bg-white dark:focus:bg-[#151C28] focus:border-[#702D3B] dark:focus:border-[#801B3A] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#344054] dark:text-[#F1F5F9] mb-1">
                  Driver Phone
                </label>
                <input
                  type="tel"
                  required
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  placeholder="+91 98450 12345"
                  className="w-full px-3 py-1.5 text-xs bg-[#FAF7F2] dark:bg-[#111827] border border-[#E7E2DF] dark:border-[#293445] rounded-lg text-[#344054] dark:text-[#F1F5F9] font-mono focus:bg-white dark:focus:bg-[#151C28] focus:border-[#702D3B] dark:focus:border-[#801B3A] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#344054] dark:text-[#F1F5F9] mb-1">
                  Authorized Transporter Agency
                </label>
                <input
                  type="text"
                  value={transporterAgency}
                  onChange={(e) => setTransporterAgency(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-[#FAF7F2] dark:bg-[#111827] border border-[#E7E2DF] dark:border-[#293445] rounded-lg text-[#344054] dark:text-[#F1F5F9] focus:bg-white dark:focus:bg-[#151C28] focus:border-[#702D3B] dark:focus:border-[#801B3A] outline-none"
                />
              </div>
            </div>

            {/* Remarks */}
            <div>
              <label className="block text-xs font-semibold text-[#344054] dark:text-[#F1F5F9] mb-1">
                Dispatch Gate Pass Remarks
              </label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-[#FAF7F2] dark:bg-[#111827] border border-[#E7E2DF] dark:border-[#293445] rounded-lg text-[#344054] dark:text-[#F1F5F9] focus:bg-white dark:focus:bg-[#151C28] focus:border-[#702D3B] dark:focus:border-[#801B3A] outline-none"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Real-Time FIFO Allocation Preview (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-5 bg-white dark:bg-[#151C28] rounded-xl border border-[#E7E2DF] dark:border-[#293445] shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E2DF] dark:border-[#293445]">
              <span className="text-xs font-bold text-[#344054] dark:text-[#F1F5F9] uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>3. Live FIFO Allocation Breakdown</span>
              </span>
              <span className="text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                Oldest Inward First
              </span>
            </div>

            {/* Scenario Demonstration Banner */}
            <div className="p-3 bg-[#FAF2F4] dark:bg-[#3B1020]/30 border border-[#E7E2DF] dark:border-[#801B3A]/40 rounded-lg text-xs text-[#702D3B] dark:text-[#C4B5FD] leading-relaxed">
              <div className="font-semibold flex items-center gap-1.5 mb-1">
                <Info className="w-4 h-4 text-[#702D3B] dark:text-[#C4B5FD] shrink-0" />
                <span>Deterministic FIFO Algorithm</span>
              </div>
              <p className="text-[11px] text-[#702D3B]/90 dark:text-[#C4B5FD]/90">
                Eligible stock batches are drawn in strict chronological order of intake (<code className="font-mono">received_date ASC</code>).
                When the oldest batch is exhausted, the engine moves continuously to the next-oldest batch.
              </p>
            </div>

            {/* Proposed Batch Draw Table */}
            {fifoResult.success && fifoResult.allocations.length > 0 ? (
              <div className="space-y-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF7F2] dark:bg-[#111827] border-b border-[#E7E2DF] dark:border-[#293445] text-[#707887] dark:text-[#A1AAB9] font-semibold">
                      <tr>
                        <th className="py-2.5 px-3">Queue #</th>
                        <th className="py-2.5 px-3">Batch ID & Bay</th>
                        <th className="py-2.5 px-3">Received Date (Age)</th>
                        <th className="py-2.5 px-3 text-right">Available</th>
                        <th className="py-2.5 px-3 text-right font-bold text-[#702D3B] dark:text-[#C4B5FD]">
                          Allocated
                        </th>
                        <th className="py-2.5 px-3 text-right">Remaining</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E7E2DF] dark:divide-[#293445]">
                      {fifoResult.allocations.map((item, index) => (
                        <tr key={item.batchId} className="bg-emerald-50/25 dark:bg-emerald-950/20">
                          {/* Queue Position */}
                          <td className="py-3 px-3">
                            <span className="w-5 h-5 rounded-full bg-[#702D3B] dark:bg-[#801B3A] text-white font-mono font-bold text-[10px] inline-flex items-center justify-center">
                              {index + 1}
                            </span>
                          </td>

                          {/* Batch ID */}
                          <td className="py-3 px-3">
                            <div className="font-mono font-bold text-[#344054] dark:text-[#F1F5F9]">{item.batchId}</div>
                            <div className="text-[10px] text-[#707887] dark:text-[#A1AAB9]">{item.depotLocation}</div>
                          </td>

                          {/* Received Date & Age */}
                          <td className="py-3 px-3">
                            <div className="font-mono text-[#344054] dark:text-[#CBD5E1]">{item.receivedDate}</div>
                            <div className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold">
                              {item.stockAgeDays} days in depot
                            </div>
                          </td>

                          {/* Available Before */}
                          <td className="py-3 px-3 text-right font-mono text-[#707887] dark:text-[#A1AAB9] tabular-nums">
                            {item.availableBags} bags
                          </td>

                          {/* Allocated This Dispatch */}
                          <td className="py-3 px-3 text-right font-mono font-bold text-[#702D3B] dark:text-[#C4B5FD] tabular-nums">
                            {item.allocatedBags} bags
                            <div className="text-[10px] text-[#702D3B]/70 dark:text-[#C4B5FD]/70 font-normal">
                              ({item.allocatedQtl} Qtl)
                            </div>
                          </td>

                          {/* Remaining After */}
                          <td className="py-3 px-3 text-right">
                            <div className="font-mono font-semibold text-[#344054] dark:text-[#F1F5F9] tabular-nums">
                              {item.remainingBagsAfter} bags
                            </div>
                            {item.isFullyExhausted ? (
                              <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                                Fully Depleted
                              </span>
                            ) : (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                                Partial Draw
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}

                      {/* Untouched Eligible Batches in Queue */}
                      {fifoResult.allEligibleBatches
                        .filter(
                          (eb) => !fifoResult.allocations.some((a) => a.batchId === eb.id)
                        )
                        .slice(0, 2)
                        .map((untouched, idx) => (
                          <tr key={untouched.id} className="opacity-50 bg-[#FAF7F2]/40 dark:bg-[#111827]/40">
                            <td className="py-2.5 px-3">
                              <span className="w-5 h-5 rounded-full bg-[#E7E2DF] dark:bg-[#293445] text-[#707887] dark:text-[#A1AAB9] font-mono text-[10px] inline-flex items-center justify-center">
                                {fifoResult.allocations.length + idx + 1}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-mono text-[#707887] dark:text-[#A1AAB9]">{untouched.id}</div>
                              <div className="text-[10px] text-[#707887] dark:text-[#A1AAB9]">{untouched.depotLocation}</div>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[#707887] dark:text-[#A1AAB9]">
                              {untouched.receivedDate} ({untouched.stockAgeDays}d)
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-[#707887] dark:text-[#A1AAB9]">
                              {untouched.availableBags} bags
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-[#707887] dark:text-[#A1AAB9]">
                              0 bags
                            </td>
                            <td className="py-2.5 px-3 text-right text-[10px] text-[#707887] dark:text-[#A1AAB9] italic">
                              Queue Standby
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                {/* Summary Metrics */}
                <div className="p-4 bg-[#FAF7F2] dark:bg-[#111827] rounded-xl border border-[#E7E2DF] dark:border-[#293445] flex flex-wrap items-center justify-between gap-4 text-xs">
                  <div>
                    <span className="text-[#707887] dark:text-[#A1AAB9] block text-[11px]">Total Net Allotted</span>
                    <span className="text-base font-bold font-mono text-[#344054] dark:text-[#F1F5F9] tabular-nums">
                      {requestedBags} Bags ({(requestedBags * 0.5).toFixed(2)} Quintals)
                    </span>
                  </div>
                  <div>
                    <span className="text-[#707887] dark:text-[#A1AAB9] block text-[11px]">Batches Mobilized</span>
                    <span className="text-base font-bold font-mono text-[#702D3B] dark:text-[#C4B5FD]">
                      {fifoResult.allocations.length} {fifoResult.allocations.length === 1 ? 'batch' : 'batches'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#707887] dark:text-[#A1AAB9] block text-[11px]">Destination FPS</span>
                    <span className="font-semibold text-[#344054] dark:text-[#F1F5F9] truncate max-w-[150px] block">
                      {selectedFps.code} · {selectedFps.name}
                    </span>
                  </div>
                </div>

                {/* Dispatch Trigger Button */}
                <div className="pt-2">
                  <button
                    onClick={handleInitiateDispatch}
                    disabled={currentRole === 'Ration Shop Dealer'}
                    className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold text-white shadow-sm transition-all ${
                      currentRole === 'Ration Shop Dealer'
                        ? 'bg-slate-400 dark:bg-slate-600 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 cursor-pointer'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm Allocation & Issue Digital Gate Pass</span>
                  </button>
                  {currentRole === 'Ration Shop Dealer' && (
                    <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 text-center font-medium">
                      Ration Shop Dealer is a recipient role. Warehouse Operator or Administrator authorization required for outward dispatches.
                    </p>
                  )}
                </div>
              </div>
            ) : batches.length === 0 || totalDepotEligibleBags === 0 ? (
              <div className="p-8 text-center bg-[#FAF7F2] dark:bg-[#111827] rounded-xl border border-[#E7E2DF] dark:border-[#293445] space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
                  <Boxes className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-[#344054] dark:text-[#F1F5F9]">
                  No eligible stock batches available in the depot. Record inward consignment first.
                </h4>
                <p className="text-xs text-[#707887] dark:text-[#A1AAB9] max-w-md mx-auto leading-relaxed">
                  The FIFO engine cannot allocate dispatches because the warehouse inventory has 0 eligible bags registered in the database.
                </p>
                {onOpenInwardTab && currentRole !== 'Ration Shop Dealer' && (
                  <button
                    type="button"
                    onClick={onOpenInwardTab}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#702D3B] hover:bg-[#853546] dark:bg-[#801B3A] dark:hover:bg-[#9E2248] rounded-lg transition-colors cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Record Inward Stock (Form PDS-01)</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="p-6 bg-rose-50/50 dark:bg-rose-950/20 rounded-xl border border-rose-200 dark:border-rose-900/40 text-xs space-y-3">
                <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-bold">
                  <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>Insufficient Eligible Stock / Allocation Shortage</span>
                </div>
                <p className="text-rose-700 dark:text-rose-300 text-xs leading-relaxed">
                  {fifoResult.error || 'Requested quantity exceeds eligible depot stock.'}
                </p>
                {fifoResult.shortageBags > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-rose-200 dark:border-rose-900/40 text-[11px] font-mono">
                    <div className="p-2 bg-white dark:bg-[#151C28] rounded border border-rose-200 dark:border-rose-900/60">
                      <span className="text-stone-500 block text-[10px]">Requested</span>
                      <span className="font-bold text-stone-900 dark:text-white">{requestedBags} Bags</span>
                    </div>
                    <div className="p-2 bg-white dark:bg-[#151C28] rounded border border-rose-200 dark:border-rose-900/60">
                      <span className="text-stone-500 block text-[10px]">Eligible in Godown</span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">{fifoResult.totalEligibleAvailableBags} Bags</span>
                    </div>
                    <div className="p-2 bg-white dark:bg-[#151C28] rounded border border-rose-200 dark:border-rose-900/60">
                      <span className="text-stone-500 block text-[10px]">Deficit Shortage</span>
                      <span className="font-bold text-rose-700 dark:text-rose-400">-{fifoResult.shortageBags} Bags</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Card 4: Excluded Batches & FIFO Audit Inspector */}
          {fifoResult.excludedBatches && fifoResult.excludedBatches.length > 0 && (
            <div className="p-5 bg-white dark:bg-[#151C28] rounded-xl border border-[#E7E2DF] dark:border-[#293445] shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-[#E7E2DF] dark:border-[#293445]">
                <span className="text-xs font-bold text-[#344054] dark:text-[#F1F5F9] uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>4. Excluded Batches & Disqualification Reasons</span>
                </span>
                <span className="text-[11px] text-[#707887] dark:text-[#A1AAB9] font-mono">
                  {fifoResult.excludedBatches.length} {fifoResult.excludedBatches.length === 1 ? 'lot bypassed' : 'lots bypassed'}
                </span>
              </div>

              <p className="text-[11px] text-[#707887] dark:text-[#A1AAB9] leading-relaxed">
                To guarantee grain quality and food safety, the FIFO engine disqualifies quarantined, damaged, expired, or non-matching lots from outward dispatch allocations.
              </p>

              <div className="space-y-2">
                {fifoResult.excludedBatches.map((item) => (
                  <div
                    key={item.batch.id}
                    className="p-3 rounded-lg border border-[#E7E2DF] dark:border-[#293445] bg-[#FAF7F2] dark:bg-[#111827] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[#344054] dark:text-[#F1F5F9]">
                          {item.batch.id}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            item.category === 'QUARANTINED'
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                              : item.category === 'DAMAGED'
                              ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                              : item.category === 'EXHAUSTED'
                              ? 'bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                              : 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800'
                          }`}
                        >
                          {item.category}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#707887] dark:text-[#A1AAB9] mt-0.5">
                        {item.batch.depotLocation} · Received: {item.batch.receivedDate} ({item.batch.commodity} - {item.batch.variety})
                      </div>
                    </div>

                    <div className="sm:text-right shrink-0">
                      <span className="text-[11px] font-medium text-amber-800 dark:text-amber-300 block">
                        {item.reason}
                      </span>
                      <span className="text-[10px] text-[#707887] dark:text-[#A1AAB9] font-mono">
                        Available: {item.batch.availableBags} bags
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal Before Stock Deduction */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#151C28] rounded-2xl border border-[#E7E2DF] dark:border-[#293445] shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-[#E7E2DF] dark:border-[#293445] bg-[#FAF7F2] dark:bg-[#111827]">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#344054] dark:text-[#F1F5F9]">
                    Authorize Outward Dispatch Transaction
                  </h3>
                  <p className="text-xs text-[#707887] dark:text-[#A1AAB9]">
                    Atomic FIFO Stock Deduction in Supabase PostgreSQL
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-[#FAF7F2] dark:bg-[#111827] rounded-xl border border-[#E7E2DF] dark:border-[#293445] space-y-2">
                <div className="flex justify-between">
                  <span className="text-[#707887] dark:text-[#A1AAB9]">Commodity:</span>
                  <span className="font-semibold text-[#344054] dark:text-[#F1F5F9]">{commodity} ({variety})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#707887] dark:text-[#A1AAB9]">Destination:</span>
                  <span className="font-semibold text-[#344054] dark:text-[#F1F5F9]">{selectedFps.code} — {selectedFps.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#707887] dark:text-[#A1AAB9]">Total Quantity:</span>
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                    {requestedBags} Bags ({(requestedBags * 0.5).toFixed(2)} Qtl)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#707887] dark:text-[#A1AAB9]">Vehicle & Driver:</span>
                  <span className="font-mono text-[#344054] dark:text-[#F1F5F9]">{vehicleNumber} ({driverName})</span>
                </div>
              </div>

              {/* Batches that will be decremented */}
              <div>
                <label className="block text-[11px] font-bold text-[#707887] dark:text-[#A1AAB9] uppercase tracking-wider mb-2">
                  Batches to be Decremented in Supabase Database:
                </label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {fifoResult.allocations.map((a) => (
                    <div
                      key={a.batchId}
                      className="p-2 rounded bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-mono font-bold text-[#344054] dark:text-[#F1F5F9]">{a.batchId}</span>
                        <span className="text-[11px] text-[#707887] dark:text-[#A1AAB9] ml-2">
                          (Intake: {a.receivedDate})
                        </span>
                      </div>
                      <span className="font-mono font-bold text-[#702D3B] dark:text-[#C4B5FD]">
                        -{a.allocatedBags} bags
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Execution Error Notice */}
              {dispatchError && (
                <div className="p-3 bg-rose-500/10 rounded-lg border border-rose-500/30 text-rose-900 dark:text-rose-200 text-[11px] leading-relaxed">
                  <div className="flex items-center gap-1.5 font-bold text-rose-800 dark:text-rose-300">
                    <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                    <span>Dispatch Authorization Failed</span>
                  </div>
                  <p className="mt-1 font-mono text-[10px] break-all">{dispatchError}</p>
                </div>
              )}

              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-[11px] leading-relaxed">
                <span className="font-bold">Anti-Duplication Protection:</span> Stock will be deducted atomically once. An official digital challan (Form-12) will be generated and logged to the audit ledger.
              </div>
            </div>

            <div className="p-4 bg-[#FAF7F2] dark:bg-[#111827] border-t border-[#E7E2DF] dark:border-[#293445] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowConfirmModal(false);
                  setDispatchError(null);
                }}
                disabled={isProcessing}
                className="px-4 py-2 font-medium text-[#707887] dark:text-[#A1AAB9] hover:bg-[#FAF7F2] dark:hover:bg-[#151C28] rounded-lg transition-colors text-xs cursor-pointer"
              >
                Cancel / Edit Demand
              </button>
              <button
                type="button"
                onClick={handleConfirmAndDispatch}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-5 py-2 font-semibold text-white bg-[#702D3B] hover:bg-[#54212D] dark:bg-[#801B3A] dark:hover:bg-[#9E2248] rounded-lg shadow-xs transition-colors text-xs cursor-pointer"
              >
                <FileCheck2 className="w-4 h-4" />
                <span>
                  {isProcessing ? 'Processing Transaction...' : 'Authorize & Print Challan'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
