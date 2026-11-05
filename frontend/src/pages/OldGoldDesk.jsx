import React, { useState, useEffect } from "react";
import {
  BadgePercent,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  CreditCard,
  Building,
  Banknote,
} from "lucide-react";
import AppShell from "../components/layout/AppShell";
import GoldNumber from "../components/GoldNumber";
import PhotoReader from "../components/PhotoReader";
import LoadingState from "../components/LoadingState";
import ErrorState from "../components/ErrorState";
import { api } from "../lib/api";
import {
  fmtG,
  fmtPurity,
  fmtPaise,
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
  const [ratePerGramRupees, setRatePerGramRupees] = useState("7200");
  const [paymentMode, setPaymentMode] = useState("bank_transfer");
  const [panNumber, setPanNumber] = useState("");
  const [linkedBillNo, setLinkedBillNo] = useState("");
  const [entryDate, setEntryDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [confirmedReadingId, setConfirmedReadingId] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

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

  // Client-side calculations
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
    // (fine_mg * rate_in_rupees * 100) // 1000
    if (rate > 0 && fineMg > 0) {
      totalAmountPaise = Math.floor((fineMg * rate * 100) / 1000);
    }
  } catch {
    //
  }

  // Client policy threshold: Rs 2,00,000 = 20,000,000 paise (to be confirmed with client accountant)
  const isHighValue = totalAmountPaise >= 20000000;
  const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMsg(null);

    if (grossMg <= 0) {
      setFormError("Gross intake weight is required.");
      return;
    }
    if (deductionsMg >= grossMg) {
      setFormError("Deductions cannot exceed or equal gross weight.");
      return;
    }
    if (purityBp <= 0) {
      setFormError("Purity must be greater than zero.");
      return;
    }

    if (isHighValue) {
      const cleanPan = panNumber.trim().toUpperCase();
      if (!cleanPan || !PAN_REGEX.test(cleanPan)) {
        setFormError(
          "Valid 10-character PAN required (e.g. ABCDE1234F) under client policy threshold, to be confirmed with their accountant."
        );
        return;
      }
      if (paymentMode === "cash") {
        setFormError(
          "Cash payment restricted for transactions of ₹2,00,000 or more under client policy threshold, to be confirmed with their accountant. Select Bank Transfer or Cheque."
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const billNo = linkedBillNo.trim() || `OG-${Date.now().toString().slice(-6)}`;
      const ratePaisePerG = Math.round(Number(ratePerGramRupees) * 100);

      const payload = {
        bill_no: billNo,
        gross_mg: grossMg,
        tested_purity_bp: purityBp,
        deduction_mg: deductionsMg,
        rate_paise_per_g: ratePaisePerG,
        payment_mode: paymentMode,
        pan: panNumber.trim().toUpperCase() || undefined,
        entry_date: entryDate,
        ai_reading_id: confirmedReadingId || undefined,
      };

      await api.createOldGoldPurchase(payload);
      setSuccessMsg("Old-gold purchase voucher recorded and pure gold credited to vault.");

      // Reset
      setCustomerName("");
      setCustomerPhone("");
      setGrossInput("");
      setDeductionsInput("0.000");
      setPanNumber("");
      setLinkedBillNo("");

      fetchPurchases();
    } catch (err) {
      setFormError(err.message || "Failed to record purchase");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell
      title="Old-Gold Desk & Policy Compliance"
      subtitle="Customer intake appraisal, purity testing, and client policy threshold compliance"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card-glass p-6">
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2 pb-4 border-b border-slate-800">
              <BadgePercent className="w-5 h-5 text-yellow-400" />
              Customer Old-Gold Intake Voucher
            </h2>

            {formError && (
              <div className="mt-4 p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {successMsg && (
              <div className="mt-4 p-3 rounded-lg bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {/* Customer Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Customer Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Krishnan"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="input-base"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Phone Number (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 9876543210"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="input-base"
                  />
                </div>
              </div>

              {/* Weights and Deductions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Gross Weight (Grams)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="35.500"
                      value={grossInput}
                      onChange={(e) => setGrossInput(e.target.value)}
                      className="input-base font-mono text-base pr-8"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-mono">
                      g
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Stone / Dirt Deductions
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="0.000"
                      value={deductionsInput}
                      onChange={(e) => setDeductionsInput(e.target.value)}
                      className="input-base font-mono text-base pr-8"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-mono">
                      g
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Tested Purity (% Gold)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="91.60"
                      value={purityInput}
                      onChange={(e) => setPurityInput(e.target.value)}
                      className="input-base font-mono text-base pr-8"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-mono">
                      %
                    </span>
                  </div>
                </div>
              </div>

              {/* Rate and Valuation */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Market Rate / Gram (Pure 24K)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      placeholder="7200"
                      value={ratePerGramRupees}
                      onChange={(e) => setRatePerGramRupees(e.target.value)}
                      className="input-base font-mono"
                    />
                    <span className="absolute right-3 top-2 text-xs text-slate-500">
                      ₹/g
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Payment Mode
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="input-base"
                  >
                    <option value="bank_transfer">Bank Transfer (NEFT/RTGS)</option>
                    <option value="cheque">Account Payee Cheque</option>
                    <option value="cash" disabled={isHighValue}>
                      Cash {isHighValue ? "(Restricted ≥ ₹2L)" : ""}
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Intake Date
                  </label>
                  <input
                    type="date"
                    required
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="input-base"
                  />
                </div>
              </div>

              {/* High-Value Client Policy Banner & PAN Input */}
              {isHighValue && (
                <div className="p-4 rounded-lg bg-amber-950/40 border border-amber-600/70 text-amber-200 space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                        Client Policy Threshold Triggered
                      </h4>
                      <p className="text-[11px] text-amber-200/90 mt-0.5">
                        Purchase amount reaches or exceeds ₹2,00,000. Customer PAN is required and cash payment is restricted under client policy threshold, to be confirmed with their accountant.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-xs font-semibold text-amber-300 mb-1">
                        Customer PAN Card Number (Mandatory)
                      </label>
                      <input
                        type="text"
                        required={isHighValue}
                        maxLength={10}
                        placeholder="ABCDE1234F"
                        value={panNumber}
                        onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                        className="input-base font-mono uppercase tracking-widest text-xs border-amber-500/60"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-amber-300 mb-1">
                        Linked Jewellery Invoice No (If exchange)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. INV-2026-902"
                        value={linkedBillNo}
                        onChange={(e) => setLinkedBillNo(e.target.value)}
                        className="input-base text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Calculated Summary Card */}
              <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30 grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-slate-400 block">
                    Calculated Pure Gold (Fine Wt)
                  </span>
                  <GoldNumber value={fineMg} size="lg" highlight="gold" />
                  <span className="text-[11px] text-slate-500 font-mono block">
                    Net: {fmtG(netMg)} g
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-xs text-slate-400 block">
                    Total Valuation Payable
                  </span>
                  <div className="text-lg font-bold font-mono text-emerald-400">
                    {fmtPaise(totalAmountPaise)}
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono block">
                    {totalAmountPaise.toLocaleString()} paise
                  </span>
                </div>
              </div>

              {/* Submit */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting || fineMg <= 0}
                  className="w-full btn-gold py-2.5"
                >
                  {submitting ? "Writing to Vault..." : "Record Old-Gold Purchase"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Karatmeter Vision Reader & Regulations */}
        <div className="space-y-6">
          <PhotoReader
            mode="karat"
            currentTypedValue={purityInput}
            onReadingConfirmed={({ readingId, valueStr }) => {
              setPurityInput(valueStr);
              setConfirmedReadingId(readingId);
            }}
          />

          <div className="card-glass p-5 border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Gold Desk Policy Controls
            </h3>
            <ul className="text-xs text-slate-400 space-y-2 list-disc list-inside">
              <li>Purity confirmed via XRF Karatmeter photo capture.</li>
              <li>Pure fine gold instantly credits workshop raw bullion position.</li>
              <li>Transactions ≥ ₹2,00,000 require verified PAN under client policy threshold, to be confirmed with their accountant.</li>
              <li>Cash payment restricted for receipts ≥ ₹2 Lakh under client policy threshold, to be confirmed with their accountant.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Recent Purchases Table */}
      <div className="mt-8 card-glass overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <h3 className="text-sm font-semibold text-slate-100">
            Recent Old-Gold Purchases ({purchases.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Customer</th>
                <th>Gross Wt</th>
                <th>Net Wt</th>
                <th>Purity</th>
                <th>Pure Gold</th>
                <th>Payment Mode</th>
                <th>PAN</th>
                <th className="text-right">Total Paid</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id}>
                  <td className="text-xs text-slate-400">{p.entry_date}</td>
                  <td className="font-semibold text-slate-200">
                    {p.customer_name}
                  </td>
                  <td>
                    <GoldNumber value={p.gross_mg} />
                  </td>
                  <td>
                    <GoldNumber value={p.net_mg} />
                  </td>
                  <td>
                    <GoldNumber value={p.purity_bp} type="purity" />
                  </td>
                  <td className="font-bold">
                    <GoldNumber value={p.fine_mg} highlight="gold" />
                  </td>
                  <td>
                    <span className="badge badge-neutral capitalize">
                      {p.payment_mode.replace("_", " ")}
                    </span>
                  </td>
                  <td className="font-mono text-xs text-slate-400">
                    {p.pan_number || "—"}
                  </td>
                  <td className="text-right font-mono font-bold text-emerald-400">
                    {fmtPaise(p.total_amount_paise)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
