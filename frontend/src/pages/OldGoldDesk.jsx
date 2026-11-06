import React, { useState, useEffect } from "react";
import { Printer, CheckCircle2 } from "lucide-react";
import AppShell from "../components/layout/AppShell";
import PageHeader from "../components/ui/PageHeader";
import Field from "../components/ui/Field";
import Button from "../components/ui/Button";
import GoldNumber from "../components/GoldNumber";
import PhotoReader from "../components/PhotoReader";
import LoadingState from "../components/LoadingState";
import ErrorState from "../components/ErrorState";
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
  const [deductionsInput, setDeductionsInput] = useState("0.000");
  const [purityInput, setPurityInput] = useState("91.60");
  const [ratePerGramRupees, setRatePerGramRupees] = useState("12500");
  const [paymentMode, setPaymentMode] = useState("bank_transfer");
  const [panNumber, setPanNumber] = useState("");
  const [linkedBillNo, setLinkedBillNo] = useState("");
  const [entryDate, setEntryDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [confirmedReadingId, setConfirmedReadingId] = useState(null);

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

  // Client policy thresholds:
  // PAN required >= Rs 50,000 (5,000,000 paise)
  // Cash prohibited >= Rs 2,00,000 (20,000,000 paise)
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

    // Policy check: PAN format
    if (isPanRequired) {
      const cleanPan = panNumber.trim().toUpperCase();
      if (!cleanPan || !PAN_REGEX.test(cleanPan)) {
        setFormError("A valid 10-character PAN (e.g. ABCDE1234F) is required for valuations of Rs 50,000 or more.");
        return;
      }
    }

    // Policy check: Cash prohibited
    if (isCashProhibited && paymentMode === "cash") {
      setFormError("Cash payment is prohibited for valuations of Rs 2,00,000 or more. Please select Bank Transfer or Cheque.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim() || undefined,
        gross_mg: gMg,
        deductions_mg: dMg,
        net_mg: gMg - dMg,
        purity_bp: pBp,
        fine_mg: fineMg,
        rate_per_gram_paise: Math.round(Number(ratePerGramRupees) * 100),
        total_amount_paise: totalAmountPaise,
        payment_mode: paymentMode,
        pan_number: panNumber.trim().toUpperCase() || undefined,
        linked_bill_no: linkedBillNo.trim() || undefined,
        entry_date: entryDate,
        ai_reading_id: confirmedReadingId || undefined,
      };

      const result = await api.createOldGoldPurchase(payload);

      setSavedSuccess({
        purchase_no: result.purchase_no,
        customer_name: result.customer_name,
        fine_mg: result.fine_mg,
        total_amount_paise: result.total_amount_paise,
      });

      // Reset
      setCustomerName("");
      setCustomerPhone("");
      setGrossInput("");
      setDeductionsInput("0.000");
      setPanNumber("");
      setLinkedBillNo("");
      setConfirmedReadingId(null);

      // Refresh list
      fetchPurchases();
    } catch (err) {
      setFormError(err.message || "Failed to record purchase");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Old gold intake"
        description="Customer scrap intake valuation, stone deductions, and policy compliance"
      />

      {loading ? (
        <LoadingState count={5} />
      ) : error ? (
        <ErrorState error={error} onRetry={fetchPurchases} />
      ) : (
        <div className="space-y-8">
          {/* Quiet persistent success confirmation */}
          {savedSuccess && (
            <div className="p-4 rounded border border-status-ok/20 bg-status-ok-tint flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-status-ok font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0 stroke-[2]" />
                <span>
                  Old-gold receipt {savedSuccess.purchase_no} recorded for {savedSuccess.customer_name} ({fmtMoney(savedSuccess.total_amount_paise)})
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

          {/* Two-column layout on desktop: Left Form (max 480px), Right Valuation Result */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left: Form */}
            <div className="lg:col-span-7 space-y-6 max-w-[480px]">
              {formError && (
                <ErrorState
                  error={formError}
                  title="Intake submission blocked"
                  message={formError}
                />
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Customer Details */}
                <div className="space-y-4">
                  <Field
                    label="Customer name"
                    id="customerName"
                    required
                    placeholder="e.g. Meenakshi S"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field
                      label="Contact phone"
                      id="customerPhone"
                      placeholder="e.g. 9842100000"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                    />
                    <div className="space-y-1.5">
                      <label htmlFor="entryDate" className="block text-sm font-medium text-ink">
                        Transaction date
                      </label>
                      <input
                        id="entryDate"
                        type="date"
                        value={entryDate}
                        onChange={(e) => setEntryDate(e.target.value)}
                        className="w-full h-11 px-3 bg-surface border border-border rounded text-sm text-ink outline-none focus:border-bronze focus:ring-2 focus:ring-bronze/20"
                      />
                    </div>
                  </div>
                </div>

                {/* Weights and Valuation Inputs */}
                <div className="pt-2 border-t border-border space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field
                      label="Gross weight"
                      id="grossWeight"
                      required
                      placeholder="50.000"
                      value={grossInput}
                      onChange={(e) => setGrossInput(e.target.value)}
                      helperText="Grams (up to 3 decimals)"
                    />
                    <Field
                      label="Stone deductions"
                      id="stoneDeductions"
                      placeholder="0.000"
                      value={deductionsInput}
                      onChange={(e) => setDeductionsInput(e.target.value)}
                      helperText="Enamel/stone weight"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field
                      label="Purity (% gold)"
                      id="purity"
                      required
                      placeholder="91.60"
                      value={purityInput}
                      onChange={(e) => setPurityInput(e.target.value)}
                      helperText="e.g. 91.60% (22K) or 75.00% (18K)"
                    />
                    <Field
                      label="Rate per gram (Rs)"
                      id="goldRate"
                      required
                      placeholder="12500"
                      value={ratePerGramRupees}
                      onChange={(e) => setRatePerGramRupees(e.target.value)}
                      helperText="Agreed purchase rate per pure gram"
                    />
                  </div>
                </div>

                {/* Conditional Client Policy Fields */}
                {(isPanRequired || isCashProhibited) && (
                  <div className="pt-2 border-t border-border space-y-4">
                    <div className="p-3 bg-background border border-border rounded space-y-1">
                      <div className="text-xs font-semibold text-ink">
                        Client policy compliance thresholds
                      </div>
                      <p className="text-[11px] text-muted m-0">
                        Based on policy assumptions to be confirmed with client accountant.
                      </p>
                    </div>

                    {isPanRequired && (
                      <Field
                        label="Customer PAN"
                        id="panNumber"
                        required
                        placeholder="ABCDE1234F"
                        value={panNumber}
                        onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                        maxLength={10}
                        helperText="Mandated for purchases >= Rs 50,000 under client policy"
                      />
                    )}

                    <div className="space-y-1.5">
                      <label htmlFor="paymentMode" className="block text-sm font-medium text-ink">
                        Payment mode <span className="text-status-problem">*</span>
                      </label>
                      <select
                        id="paymentMode"
                        value={paymentMode}
                        onChange={(e) => setPaymentMode(e.target.value)}
                        className="w-full h-11 px-3 bg-surface border border-border rounded text-sm text-ink outline-none focus:border-bronze focus:ring-2 focus:ring-bronze/20"
                      >
                        <option value="bank_transfer">Bank transfer (NEFT / RTGS / IMPS)</option>
                        <option value="cheque">Account payee cheque</option>
                        <option value="cash" disabled={isCashProhibited}>
                          {isCashProhibited ? "Cash (Prohibited for Rs 2,00,000+ policy)" : "Cash"}
                        </option>
                      </select>
                      {isCashProhibited && (
                        <p className="text-xs text-status-problem mt-1 font-medium">
                          Cash mode disabled: purchases of Rs 2,00,000 or more mandate non-cash settlement.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Photo Reader */}
                <div className="pt-2 border-t border-border">
                  <PhotoReader
                    mode="karat"
                    currentTypedValue={purityInput}
                    onReadingConfirmed={handlePhotoConfirmed}
                  />
                </div>

                {/* Submit button */}
                <div className="pt-4">
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    loading={submitting}
                    disabled={fineMg <= 0 || !customerName.trim()}
                    disabledReason={
                      fineMg <= 0
                        ? "Enter valid gross weight and purity to calculate valuation."
                        : !customerName.trim()
                        ? "Customer name is required."
                        : ""
                    }
                    className="w-full"
                  >
                    Confirm purchase and intake gold
                  </Button>
                </div>
              </form>
            </div>

            {/* Right: Live Valuation Panel */}
            <div className="lg:col-span-5 space-y-4 sticky top-6">
              <div className="bg-surface border border-border rounded p-6 space-y-5">
                <div className="pb-3 border-b border-border">
                  <h3 className="text-sm font-semibold text-ink m-0">
                    Valuation summary
                  </h3>
                  <span className="text-xs text-muted">
                    Net gold weight and monetary payout
                  </span>
                </div>

                {/* Total Value - Featured figure */}
                <div className="py-2 text-center border-b border-border space-y-1">
                  <span className="text-xs text-muted block">
                    Calculated net value
                  </span>
                  <div className="text-xl font-semibold text-ink font-mono tracking-tight">
                    {fmtMoney(totalAmountPaise)}
                  </div>
                  <span className="text-xs text-muted block">
                    Payout to customer
                  </span>
                </div>

                {/* Fine Weight & Net Weight breakdown */}
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between items-center py-1">
                    <span className="text-muted">Net gold weight:</span>
                    <GoldNumber value={netMg} type="weight" size="sm" align="right" />
                  </div>
                  <div className="flex justify-between items-center py-1 border-t border-border/40">
                    <span className="text-muted">Calculated fine pure gold:</span>
                    <GoldNumber value={fineMg} type="weight" size="sm" align="right" />
                  </div>
                  <div className="flex justify-between items-center py-1 border-t border-border/40">
                    <span className="text-muted">Rate applied:</span>
                    <span className="font-mono text-ink">Rs {Number(ratePerGramRupees || 0).toLocaleString()} / g</span>
                  </div>
                </div>

                {/* Policy flags */}
                <div className="pt-3 border-t border-border space-y-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-muted">PAN requirement:</span>
                    <StatusBadge
                      status={isPanRequired ? "review" : "ok"}
                      label={isPanRequired ? "PAN required (>= Rs 50k)" : "Standard intake"}
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted">Cash settlement:</span>
                    <StatusBadge
                      status={isCashProhibited ? "problem" : "ok"}
                      label={isCashProhibited ? "Cash prohibited" : "Cash permitted"}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Purchases Table */}
          <div className="pt-6 border-t border-border space-y-4">
            <h3 className="text-sm font-semibold text-ink m-0">
              Recent customer intake records
            </h3>
            {purchases.length === 0 ? (
              <EmptyState
                title="No purchases recorded"
                description="Old-gold purchase vouchers will appear here once recorded."
              />
            ) : (
              <TableContainer>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Voucher</TableHeaderCell>
                    <TableHeaderCell>Date</TableHeaderCell>
                    <TableHeaderCell>Customer</TableHeaderCell>
                    <TableHeaderCell align="right">Net weight</TableHeaderCell>
                    <TableHeaderCell align="right">Purity</TableHeaderCell>
                    <TableHeaderCell align="right">Fine gold</TableHeaderCell>
                    <TableHeaderCell align="right">Total value</TableHeaderCell>
                    <TableHeaderCell>Payment</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {purchases.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono font-medium">{p.purchase_no}</TableCell>
                      <TableCell className="text-muted">{fmtDate(p.entry_date)}</TableCell>
                      <TableCell className="font-medium text-ink">{p.customer_name}</TableCell>
                      <TableCell align="right"><GoldNumber value={p.net_mg} type="weight" size="xs" align="right" /></TableCell>
                      <TableCell align="right"><GoldNumber value={p.purity_bp} type="purity" size="xs" align="right" /></TableCell>
                      <TableCell align="right"><GoldNumber value={p.fine_mg} type="weight" size="xs" align="right" /></TableCell>
                      <TableCell align="right" className="font-mono font-medium">{fmtMoney(p.total_amount_paise)}</TableCell>
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
