import React, { useState, useEffect } from "react";
import {
  ArrowDownToLine,
  Printer,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Gem,
  Hammer,
  Wind,
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
  parseG,
  parsePurity,
  calcFineMg,
} from "../lib/format";

export default function ReceiptEntry() {
  const [karigars, setKarigars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form Fields
  const [karigarId, setKarigarId] = useState("");
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [kind, setKind] = useState("finished"); // "finished" | "scrap" | "filings"
  const [huid, setHuid] = useState("");

  const [grossInput, setGrossInput] = useState("");
  const [purityInput, setPurityInput] = useState("91.60");
  const [entryDate, setEntryDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const [jobSettlement, setJobSettlement] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Receipt Slip Modal
  const [receiptSlip, setReceiptSlip] = useState(null);

  const fetchKarigars = async () => {
    try {
      setLoading(true);
      setError(null);
      const kList = await api.getKarigars();
      setKarigars(kList);
      if (kList.length > 0) {
        setKarigarId(kList[0].id.toString());
      }
    } catch (err) {
      setError(err.message || "Failed to load karigars");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKarigars();
  }, []);

  // When karigar changes, fetch their open jobs
  useEffect(() => {
    if (!karigarId) return;
    const loadJobs = async () => {
      try {
        const jList = await api.getKarigarJobs(karigarId, true);
        setJobs(jList);
        if (jList.length > 0) {
          setSelectedJobId(jList[0].id.toString());
        } else {
          setSelectedJobId("");
          setJobSettlement(null);
        }
      } catch {
        setJobs([]);
      }
    };
    loadJobs();
  }, [karigarId]);

  // When job changes, fetch its live settlement progress
  useEffect(() => {
    if (!selectedJobId) {
      setJobSettlement(null);
      return;
    }
    const loadSettlement = async () => {
      try {
        const s = await api.getJobSettlement(selectedJobId);
        setJobSettlement(s);
      } catch {
        setJobSettlement(null);
      }
    };
    loadSettlement();
  }, [selectedJobId]);

  // Client-side preview
  let previewGrossMg = 0;
  let previewPurityBp = 0;
  let previewFineMg = 0;
  try {
    if (grossInput) previewGrossMg = parseG(grossInput);
    if (purityInput) previewPurityBp = parsePurity(purityInput);
    if (previewGrossMg > 0 && previewPurityBp > 0) {
      previewFineMg = calcFineMg(previewGrossMg, previewPurityBp);
    }
  } catch {
    //
  }

  const handlePhotoConfirmed = ({ valueStr }) => {
    setGrossInput(valueStr);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedJobId) {
      setFormError("Please select an active job for receipt.");
      return;
    }

    let gMg, pBp;
    try {
      gMg = parseG(grossInput);
      pBp = parsePurity(purityInput);
    } catch (err) {
      setFormError(err.message);
      return;
    }

    if (kind === "finished") {
      const cleanHuid = huid.trim().toUpperCase();
      if (!cleanHuid || cleanHuid.length !== 6 || !/^[A-Z0-9]{6}$/.test(cleanHuid)) {
        setFormError("Finished jewellery requires a valid 6-character alphanumeric Hallmarking HUID (e.g. AB1234).");
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        job_id: Number(selectedJobId),
        kind,
        gross_mg: gMg,
        purity_bp: pBp,
        entry_date: entryDate,
        huid: kind === "finished" ? huid.trim().toUpperCase() : undefined,
      };

      const result = await api.createReceipt(payload);

      const selectedKarigar = karigars.find((k) => k.id === Number(karigarId));
      const selectedJob = jobs.find((j) => j.id === Number(selectedJobId));

      setReceiptSlip({
        txn_id: result.txn_id,
        karigar_name: selectedKarigar?.name,
        karigar_code: selectedKarigar?.code,
        job_no: selectedJob?.job_no,
        kind: result.kind,
        gross_mg: result.gross_mg,
        purity_bp: result.purity_bp,
        fine_mg: result.fine_mg,
        huid: result.huid,
        entry_date: result.entry_date,
      });

      // Reset
      setGrossInput("");
      setHuid("");

      // Refresh settlement status
      const updatedS = await api.getJobSettlement(selectedJobId);
      setJobSettlement(updatedS);
    } catch (err) {
      setFormError(err.message || "Failed to record receipt");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell
      title="Gold Receipt Entry"
      subtitle="Receive finished pieces, workshop scrap, or fine bench filings against active jobs"
    >
      {loading ? (
        <LoadingState message="Loading receipt configuration..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchKarigars} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Receipt Form */}
          <div className="lg:col-span-2 space-y-6">
            <div className="card-glass p-6">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2 pb-4 border-b border-slate-800">
                <ArrowDownToLine className="w-5 h-5 text-yellow-400" />
                Record Karigar-to-Vault Receipt
              </h2>

              {formError && (
                <div className="mt-4 p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                {/* Karigar and Job */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Artisan / Karigar
                    </label>
                    <select
                      value={karigarId}
                      onChange={(e) => setKarigarId(e.target.value)}
                      className="input-base"
                    >
                      {karigars.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.code} — {k.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Target Work Order / Job
                    </label>
                    {jobs.length > 0 ? (
                      <select
                        value={selectedJobId}
                        onChange={(e) => setSelectedJobId(e.target.value)}
                        className="input-base"
                      >
                        {jobs.map((j) => (
                          <option key={j.id} value={j.id}>
                            {j.job_no} — {j.description || "Ornament"}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="input-base text-xs text-rose-400 flex items-center">
                        No open jobs found for this artisan
                      </div>
                    )}
                  </div>
                </div>

                {/* Return Kind Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Return Classification
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setKind("finished")}
                      className={`p-3 rounded-lg border text-left flex items-center gap-2.5 transition ${
                        kind === "finished"
                          ? "border-yellow-500 bg-yellow-500/15 text-yellow-300"
                          : "border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <Gem className="w-4 h-4 shrink-0" />
                      <div>
                        <p className="text-xs font-bold leading-tight">Finished Piece</p>
                        <p className="text-[10px] opacity-75">Requires HUID</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setKind("scrap")}
                      className={`p-3 rounded-lg border text-left flex items-center gap-2.5 transition ${
                        kind === "scrap"
                          ? "border-yellow-500 bg-yellow-500/15 text-yellow-300"
                          : "border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <Hammer className="w-4 h-4 shrink-0" />
                      <div>
                        <p className="text-xs font-bold leading-tight">Workshop Scrap</p>
                        <p className="text-[10px] opacity-75">Off-cuts & sprues</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setKind("filings")}
                      className={`p-3 rounded-lg border text-left flex items-center gap-2.5 transition ${
                        kind === "filings"
                          ? "border-yellow-500 bg-yellow-500/15 text-yellow-300"
                          : "border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <Wind className="w-4 h-4 shrink-0" />
                      <div>
                        <p className="text-xs font-bold leading-tight">Bench Filings</p>
                        <p className="text-[10px] opacity-75">Recovered gold dust</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* HUID Field for Finished Piece */}
                {kind === "finished" && (
                  <div className="p-3.5 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                    <label className="block text-xs font-semibold text-yellow-300 mb-1">
                      Hallmark Unique Identification (HUID) — Mandatory
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      placeholder="e.g. AB1234"
                      value={huid}
                      onChange={(e) => setHuid(e.target.value.toUpperCase())}
                      className="input-base font-mono uppercase tracking-widest text-sm"
                    />
                    <span className="text-[10px] text-yellow-400/80 mt-1 block">
                      Strict 6-character alphanumeric statutory BIS hallmark code.
                    </span>
                  </div>
                )}

                {/* Weights and Date */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Net Gross Weight
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder="103.004"
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
                      Tested Purity
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

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Receipt Date
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

                {/* Fine Weight Live Preview */}
                <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-medium text-slate-400 block">
                      Calculated Pure Gold Returned
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Credit applied to karigar running ledger balance
                    </span>
                  </div>
                  <div className="text-right">
                    <GoldNumber
                      value={previewFineMg}
                      size="xl"
                      highlight="gold"
                    />
                    <span className="text-[11px] text-slate-400 block font-mono">
                      {previewFineMg.toLocaleString()} mg
                    </span>
                  </div>
                </div>

                {/* Submit */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting || previewFineMg <= 0 || !selectedJobId}
                    className="w-full btn-gold py-2.5"
                  >
                    {submitting ? "Writing Receipt..." : "Record Receipt to Vault"}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Right Column: Live Job Settlement Progress & Photo Reader */}
          <div className="space-y-6">
            {jobSettlement ? (
              <div className="card-glass p-5 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Live Job Settlement
                  </h3>
                  <span className="badge badge-gold font-mono text-[10px]">
                    {jobSettlement.job_no}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Issued Fine Gold:</span>
                    <GoldNumber value={jobSettlement.settlement.issued_fine_mg} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Finished Returned:</span>
                    <GoldNumber value={jobSettlement.settlement.finished_mg} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Scrap Returned:</span>
                    <GoldNumber value={jobSettlement.settlement.scrap_mg} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Filings Returned:</span>
                    <GoldNumber value={jobSettlement.settlement.filings_mg} />
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex justify-between font-semibold">
                    <span className="text-slate-300">Allowed Wastage ({fmtPurity(jobSettlement.wastage_bp)}%):</span>
                    <GoldNumber value={jobSettlement.settlement.allowed_mg} />
                  </div>

                  <div className="flex justify-between font-bold pt-1">
                    <span className="text-yellow-400">Outstanding Fine Balance:</span>
                    <GoldNumber
                      value={jobSettlement.settlement.outstanding_mg}
                      highlight={
                        jobSettlement.settlement.outstanding_mg > 0
                          ? "warning"
                          : "positive"
                      }
                    />
                  </div>

                  {jobSettlement.settlement.excess_mg > 0 && (
                    <div className="p-2 rounded bg-rose-950/40 border border-rose-800/80 text-rose-300 flex justify-between">
                      <span>Excess Loss:</span>
                      <GoldNumber
                        value={jobSettlement.settlement.excess_mg}
                        highlight="negative"
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="card-glass p-5 border border-slate-800 text-center text-slate-500 text-xs">
                Select an active job to monitor live fine-gold return progress.
              </div>
            )}

            <PhotoReader
              mode="scale"
              currentTypedValue={grossInput}
              onReadingConfirmed={handlePhotoConfirmed}
            />
          </div>
        </div>
      )}

      {/* Receipt Slip Modal */}
      {receiptSlip && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="card-glass w-full max-w-lg p-6 border border-yellow-500/40 relative">
            <div className="slip-box bg-slate-900 border border-slate-700 p-6 rounded-lg text-slate-100">
              <div className="flex justify-between items-start border-b border-slate-700 pb-3">
                <div>
                  <h3 className="font-bold text-base text-yellow-400">
                    GOLD RECEIPT VOUCHER
                  </h3>
                  <p className="text-xs text-slate-400">Coimbatore Workshop Vault</p>
                </div>
                <div className="text-right">
                  <span className="font-mono text-sm font-bold text-yellow-400 block">
                    {receiptSlip.txn_id}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    {receiptSlip.entry_date}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 my-4 text-xs">
                <div>
                  <span className="text-slate-400 block">Artisan:</span>
                  <span className="font-semibold text-slate-200">
                    {receiptSlip.karigar_name} ({receiptSlip.karigar_code})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Work Order:</span>
                  <span className="font-semibold text-slate-200">
                    {receiptSlip.job_no}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded bg-slate-950 border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Classification:</span>
                  <span className="font-semibold capitalize text-slate-200">
                    {receiptSlip.kind}
                  </span>
                </div>
                {receiptSlip.huid && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Hallmark HUID:</span>
                    <span className="font-mono font-bold text-yellow-400">
                      {receiptSlip.huid}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400">Gross Weight:</span>
                  <GoldNumber value={receiptSlip.gross_mg} />
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Tested Purity:</span>
                  <GoldNumber value={receiptSlip.purity_bp} type="purity" />
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-800 font-bold">
                  <span className="text-yellow-400">Fine Gold Credited:</span>
                  <GoldNumber
                    value={receiptSlip.fine_mg}
                    size="lg"
                    highlight="gold"
                  />
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-slate-700 grid grid-cols-2 gap-4 text-center text-xs text-slate-400">
                <div className="border-t border-dashed border-slate-600 pt-1">
                  Vault Custodian
                </div>
                <div className="border-t border-dashed border-slate-600 pt-1">
                  Artisan Signature
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-3 no-print">
              <button
                type="button"
                onClick={() => setReceiptSlip(null)}
                className="btn-secondary text-xs"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-gold text-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Voucher Slip
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
