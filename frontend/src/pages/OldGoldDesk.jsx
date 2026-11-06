import React, { useState, useEffect } from "react";
import { Printer, CheckCircle2, ChevronDown, Camera } from "lucide-react";
import AppShell from "../components/layout/AppShell";
import Field from "../components/ui/Field";
import Button from "../components/ui/Button";
import DateInput from "../components/ui/DateInput";
import GoldNumber from "../components/GoldNumber";
import PhotoReader from "../components/PhotoReader";
import LoadingState from "../components/LoadingState";
import ErrorState from "../components/ErrorState";
import EmptyState from "../components/EmptyState";
import StatusBadge from "../components/ui/StatusBadge";
import {
  TableContainer,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableHeaderCell,
} from "../components/ui/Table";
import { api } from "../lib/api";
import {
  fmtG,
  fmtPurity,
  fmtMoney,
  fmtDate,
  parseG,
  parsePurity,
  calcFineMg,
} from "../lib/format";

export default function OldGoldDesk() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form Fields
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [grossInput, setGrossInput] = useState("");
  const [deductionsInput, setDeductionsInput] = useState("");
  const [purityInput, setPurityInput] = useState("91.60");
  const [ratePerGramRupees, setRatePerGramRupees] = useState("");
  const [paymentMode, setPaymentMode] = useState("bank_transfer");
  const [panNumber, setPanNumber] = useState("");
  const [linkedBillNo, setLinkedBillNo] = useState("");
  const [entryDate, setEntryDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [confirmedReadingId, setConfirmedReadingId] = useState(null);
  const [showPhotoReader, setShowPhotoReader] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [savedSuccess, setSavedSuccess] = useState(null);

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getOldGoldPurchases();
      setPurchases(data);
    } catch (err) {
      setError(err.message || "Failed to load old gold records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, []);

  // Client-side valuation calculations
  let grossMg = 0;
  let deductionsMg = 0;
  let netMg = 0;
  let purityBp = 0;
  let fineMg = 0;
  let totalAmountPaise = 0;

  try {
    if (grossInput) grossMg = parseG(grossInput);
    if (deductionsInput) deductionsMg = parseG(deductionsInput);
    netMg = Math.max(0, grossMg - deductionsMg);
    if (purityInput) purityBp = parsePurity(purityInput);
    fineMg = calcFineMg(netMg, purityBp);

    const rate = Number(ratePerGramRupees) || 0;
    if (rate > 0 && fineMg > 0) {
      totalAmountPaise = Math.floor((fineMg * rate * 100) / 1000);
    }
  } catch {
    // Zero on incomplete input
  }

  // Client policy compliance
  const isPanRequired = totalAmountPaise >= 5_000_000;
  const isCashProhibited = totalAmountPaise >= 20_000_000;
  const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

  const handlePhotoConfirmed = ({ readingId, valueStr }) => {
    if (valueStr.includes(".")) {
      setPurityInput(valueStr);
    } else {
      setGrossInput(valueStr);
    }
    setConfirmedReadingId(readingId);
    setShowPhotoReader(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    let gMg, dMg, pBp;
    try {
      gMg = parseG(grossInput);
      dMg = parseG(deductionsInput || "0");
      pBp = parsePurity(purityInput);
    } catch (err) {
      setFormError(err.message);
      return;
    }

    if (gMg <= dMg) {
      setFormError("Gross weight must be strictly greater than stone deductions.");
      return;
    }

    if (isPanRequired) {
      const cleanPan = panNumber.trim().toUpperCase();
      if (!cleanPan || !PAN_REGEX.test(cleanPan)) {
        setFormError("A valid 10-character PAN (e.g. ABCDE1234F) is required for valuations of Rs 50,000 or more.");
        return;
      }
    }

    if (isCashProhibited && paymentMode === "cash") {
      setFormError("Cash payment is prohibited for valuations of Rs 2,00,000 or more. Please select Bank Transfer or Cheque.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        bill_no: linkedBillNo.trim() || `OG-${Date.now().toString().slice(-6)}`,
        gross_mg: gMg,
        tested_purity_bp: pBp,
        deduction_mg: dMg,
        rate_paise_per_g: Math.round(Number(ratePerGramRupees) * 100),
        payment_mode: paymentMode,
        pan: panNumber.trim().toUpperCase() || undefined,
        entry_date: entryDate,
        ai_reading_id: confirmedReadingId || undefined,
      };

      const result = await api.createOldGoldPurchase(payload);

      setSavedSuccess({
        purchase_no: result.bill_no,
        customer_name: customerName.trim() || "Customer",
        fine_mg: result.fine_mg,
        total_amount_paise: result.value_paise,
      });

      setCustomerName("");
      setCustomerPhone("");
      setGrossInput("");
      setDeductionsInput("");
      setPanNumber("");
      setLinkedBillNo("");
      setRatePerGramRupees("");
      setConfirmedReadingId(null);

      fetchPurchases();
    } catch (err) {
      setFormError(err.message || "Failed to record purchase");
    } finally {
      setSubmitting(false);
    }
  };

  const hasValuation = totalAmountPaise > 0;

  const disabledReason = !customerName.trim()
    ? "Customer name is required."
    : grossMg <= 0
    ? "Enter gross weight."
    : !ratePerGramRupees || Number(ratePerGramRupees) <= 0
    ? "Enter rate per gram."
    : fineMg <= 0
    ? "Enter valid weight and purity to calculate valuation."
    : "";

  const renderValuationBody = () => (
    <div className="space-y-4">
      {!hasValuation ? (
        <div className="py-8 text-center text-xs text-muted">
          Enter weight, purity and rate to see the valuation
        </div>
      ) : (
        <>
          {/* Total Value - 32px mono hero figure */}
          <div className="py-3 text-center border-b border-[#E2D3A4]">
            <span className="text-xs text-muted block mb-1">
              Calculated net customer payout
            </span>
            <div className="text-[32px] font-semibold font-mono tracking-tight text-ink leading-tight">
              {fmtMoney(totalAmountPaise)}
            </div>
            <span className="text-xs text-muted block mt-1">
              Net value payout
            </span>
          </div>

          {/* Breakdown Details */}
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center py-0.5">
              <span className="text-muted">Net gold weight:</span>
              <span className="font-mono text-ink">{fmtG(netMg)} <span className="text-muted text-xs">g</span></span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span className="text-muted">Deductions applied:</span>
              <span className="font-mono text-ink">{fmtG(deductionsMg)} <span className="text-muted text-xs">g</span></span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span className="text-muted">Fine pure gold:</span>
              <span className="font-mono font-medium text-ink">{fmtG(fineMg)} <span className="text-muted text-xs">g pure</span></span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span className="text-muted">Rate applied:</span>
              <span className="font-mono text-ink">Rs {Number(ratePerGramRupees || 0).toLocaleString()} / g</span>
            </div>

            {/* Policy compliance */}
            <div className="pt-2 border-t border-[#E2D3A4]/60 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-muted">PAN status:</span>
                <StatusBadge
                  status={isPanRequired ? "review" : "ok"}
                  label={isPanRequired ? "PAN required (>= Rs 50k)" : "Standard intake"}
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted">Payment mode:</span>
                <StatusBadge
                  status={isCashProhibited ? "problem" : "ok"}
                  label={isCashProhibited ? "Cash prohibited (>= Rs 2L)" : "Permitted"}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <AppShell
      title="Old gold intake"
      subtitle="Customer scrap intake valuation, stone deductions, and policy compliance"
    >
      {loading ? (
        <LoadingState count={4} />
      ) : error ? (
        <ErrorState error={error} onRetry={fetchPurchases} />
      ) : (
        <div className="space-y-6">
          {/* Success confirmation */}
          {savedSuccess && (
            <div className="p-3.5 px-4 rounded border border-status-ok/20 bg-status-ok-tint flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-status-ok font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0 stroke-[2]" />
                <span>
                  Old-gold voucher {savedSuccess.purchase_no} recorded for {savedSuccess.customer_name} ({fmtMoney(savedSuccess.total_amount_paise)})
                </span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                icon={Printer}
                onClick={() => window.print()}
              >
                Print voucher
              </Button>
            </div>
          )}

          {/* 2-Zone Grid: Left zone 1fr (form), Right zone 400px (sticky valuation panel), gap 24px */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 items-start">
            {/* Left Zone: Form */}
            <div className="bg-surface border border-border rounded p-6">
              {formError && (
                <ErrorState
                  error={formError}
                  title="Intake submission blocked"
                  message={formError}
                  className="mb-4"
                />
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-12 gap-x-4 gap-y-4">
                  {/* Row 1: [Customer name | Contact phone] */}
                  <div className="col-span-12 sm:col-span-6">
                    <Field
                      label="Customer name"
                      id="customerName"
                      required
                      placeholder="e.g. S. Meenakshi"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                    />
                  </div>

                  <div className="col-span-12 sm:col-span-6">
                    <Field
                      label="Contact phone"
                      id="customerPhone"
                      placeholder="e.g. 9842100000"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                    />
                  </div>

                  {/* Row 2: [Transaction date | Payment mode] */}
                  <div className="col-span-12 sm:col-span-6">
                    <DateInput
                      label="Transaction date"
                      id="entryDate"
                      value={entryDate}
                      onChange={(val) => setEntryDate(val)}
                    />
                  </div>

                  <div className="col-span-12 sm:col-span-6 space-y-1.5">
                    <label htmlFor="paymentMode" className="block text-sm font-medium text-ink">
                      Payment mode <span className="text-muted text-xs select-none">*</span>
                    </label>
                    <select
                      id="paymentMode"
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value)}
                      className="w-full h-11 sm:h-10 px-3 bg-white border border-[#D9D1BF] rounded text-sm text-ink outline-none focus:border-bronze focus:ring-2 focus:ring-bronze"
                    >
                      <option value="bank_transfer">Bank transfer (NEFT / RTGS)</option>
                      <option value="cheque">Account payee cheque</option>
                      <option value="cash" disabled={isCashProhibited}>
                        {isCashProhibited ? "Cash (Prohibited for Rs 2L+)" : "Cash"}
                      </option>
                    </select>
                  </div>

                  {/* Row 3: [Gross weight | Stone deductions | Purity] ON ONE ROW */}
                  <div className="col-span-12 sm:col-span-4">
                    <Field
                      label="Gross weight"
                      id="grossWeight"
                      required
                      placeholder="0.000"
                      value={grossInput}
                      onChange={(e) => setGrossInput(e.target.value)}
                      unit="g"
                    />
                  </div>

                  <div className="col-span-12 sm:col-span-4">
                    <Field
                      label="Stone deductions"
                      id="stoneDeductions"
                      placeholder="0.000"
                      value={deductionsInput}
                      onChange={(e) => setDeductionsInput(e.target.value)}
                      unit="g"
                    />
                  </div>

                  <div className="col-span-12 sm:col-span-4">
                    <Field
                      label="Purity (% gold)"
                      id="purity"
                      required
                      placeholder="91.60"
                      value={purityInput}
                      onChange={(e) => setPurityInput(e.target.value)}
                      unit="%"
                      action={
                        <button
                          type="button"
                          onClick={() => setShowPhotoReader(!showPhotoReader)}
                          className="text-xs text-bronze hover:underline font-medium p-0 bg-transparent border-none cursor-pointer flex items-center gap-1"
                        >
                          <Camera className="w-3.5 h-3.5 stroke-[1.75]" />
                          <span>{showPhotoReader ? "Hide" : "Read photo"}</span>
                        </button>
                      }
                    />
                  </div>

                  {/* Row 4: [Rate per gram | Voucher reference] ON NEXT ROW */}
                  <div className="col-span-12 sm:col-span-6 space-y-1">
                    <Field
                      label="Rate per gram"
                      id="goldRate"
                      required
                      placeholder="Enter rate"
                      value={ratePerGramRupees}
                      onChange={(e) => setRatePerGramRupees(e.target.value)}
                      unit="Rs"
                    />
                    {!ratePerGramRupees && (
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <button
                          type="button"
                          onClick={() => setRatePerGramRupees("12500")}
                          className="text-xs text-bronze hover:underline font-medium p-0 bg-transparent border-none cursor-pointer"
                        >
                          Use standard rate (Rs 12,500/g)
                        </button>
                        <span className="text-xs text-muted">(assumed rate)</span>
                      </div>
                    )}
                  </div>

                  <div className="col-span-12 sm:col-span-6">
                    <Field
                      label="Voucher reference (optional)"
                      id="linkedBillNo"
                      placeholder="e.g. OG-2026-081"
                      value={linkedBillNo}
                      onChange={(e) => setLinkedBillNo(e.target.value)}
                    />
                  </div>

                  {/* Row 5: Conditional PAN */}
                  {isPanRequired && (
                    <div className="col-span-12 sm:col-span-6">
                      <Field
                        label="Customer PAN"
                        id="panNumber"
                        required
                        placeholder="ABCDE1234F"
                        value={panNumber}
                        onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                        maxLength={10}
                        helperText="Mandated for Rs 50,000+ under policy"
                      />
                    </div>
                  )}

                  {/* Photo Reader */}
                  {showPhotoReader && (
                    <div className="col-span-12">
                      <PhotoReader
                        mode="karat"
                        isOpen={true}
                        onClose={() => setShowPhotoReader(false)}
                        currentTypedValue={purityInput}
                        onReadingConfirmed={handlePhotoConfirmed}
                      />
                    </div>
                  )}
                </div>

                {/* Actions Row: single divider above, primary button left-aligned, disabled reason beside it */}
                <div className="pt-4 border-t border-border flex flex-wrap items-center gap-3">
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    loading={submitting}
                    disabled={fineMg <= 0 || !customerName.trim() || !ratePerGramRupees || Number(ratePerGramRupees) <= 0}
                  >
                    Confirm purchase and intake gold
                  </Button>
                  {disabledReason && (
                    <span className="text-xs text-muted">
                      {disabledReason}
                    </span>
                  )}
                </div>
              </form>
            </div>

            {/* Right: Sticky Valuation Summary Panel (400px) */}
            <div className="hidden lg:block sticky top-6">
              <div className="bg-result-bg border border-result-border rounded p-5 space-y-4">
                <div className="pb-3 border-b border-result-border">
                  <h3 className="text-sm font-semibold text-ink m-0">
                    Valuation summary
                  </h3>
                  <span className="text-xs text-muted">
                    Net gold weight and monetary payout
                  </span>
                </div>
                {renderValuationBody()}
              </div>
            </div>
          </div>

          {/* Collapsible Mobile Valuation Preview (<1024px) */}
          <div className="lg:hidden">
            <details className="bg-result-bg border border-result-border rounded p-4 group" open={hasValuation}>
              <summary className="text-sm font-semibold text-ink cursor-pointer list-none flex items-center justify-between select-none">
                <div className="flex items-center gap-2">
                  <span>Valuation summary</span>
                  {hasValuation && (
                    <span className="text-xs font-mono text-bronze font-medium">
                      {fmtMoney(totalAmountPaise)}
                    </span>
                  )}
                </div>
                <ChevronDown className="w-4 h-4 text-muted transition-transform group-open:rotate-180" />
              </summary>
              <div className="pt-4 mt-3 border-t border-result-border">
                {renderValuationBody()}
              </div>
            </details>
          </div>

          {/* Recent Customer Intake Records Table */}
          <div className="pt-2 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink m-0">
                Recent customer intake records
              </h3>
              <span className="text-xs text-muted font-mono">
                Latest {Math.min(8, purchases.length)} entries
              </span>
            </div>

            {purchases.length === 0 ? (
              <TableContainer>
                <EmptyState description="No purchases recorded yet" />
              </TableContainer>
            ) : (
              <TableContainer>
                <TableHead>
                  <tr>
                    <TableHeaderCell>Voucher</TableHeaderCell>
                    <TableHeaderCell>Date</TableHeaderCell>
                    <TableHeaderCell>Customer</TableHeaderCell>
                    <TableHeaderCell align="right">Gross (g)</TableHeaderCell>
                    <TableHeaderCell align="right">Deduction (g)</TableHeaderCell>
                    <TableHeaderCell align="right">Purity (%)</TableHeaderCell>
                    <TableHeaderCell align="right">Fine gold (g)</TableHeaderCell>
                    <TableHeaderCell align="right">Total value</TableHeaderCell>
                    <TableHeaderCell>Payment</TableHeaderCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {purchases.slice(0, 8).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono font-medium">{p.bill_no}</TableCell>
                      <TableCell className="text-muted">{fmtDate(p.entry_date)}</TableCell>
                      <TableCell className="font-medium text-ink">{customerName || "Customer"}</TableCell>
                      <TableCell align="right"><GoldNumber value={p.gross_mg} type="weight" size="xs" align="right" /></TableCell>
                      <TableCell align="right"><GoldNumber value={p.deduction_mg} type="weight" size="xs" align="right" /></TableCell>
                      <TableCell align="right"><GoldNumber value={p.tested_purity_bp} type="purity" size="xs" align="right" /></TableCell>
                      <TableCell align="right"><GoldNumber value={p.fine_mg} type="weight" size="xs" align="right" /></TableCell>
                      <TableCell align="right" className="font-mono font-medium">{fmtMoney(p.value_paise)}</TableCell>
                      <TableCell className="text-xs text-muted capitalize">{p.payment_mode?.replace("_", " ")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </TableContainer>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
