import React, { useState, useEffect } from "react";
import {
  SendHorizontal,
  Printer,
  FileCheck2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ChevronDown,
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

export default function IssueEntry() {
  const [karigars, setKarigars] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form Fields
  const [karigarId, setKarigarId] = useState("");
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [newJobMode, setNewJobMode] = useState(false);
  const [newJobNo, setNewJobNo] = useState("");
  const [newJobCategory, setNewJobCategory] = useState("");
  const [newJobDesc, setNewJobDesc] = useState("");

  const [grossInput, setGrossInput] = useState("");
  const [purityInput, setPurityInput] = useState("91.60");
  const [entryDate, setEntryDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [note, setNote] = useState("");
  const [confirmedReadingId, setConfirmedReadingId] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Success Slip Modal
  const [issuedSlip, setIssuedSlip] = useState(null);

  // Void modal state
  const [voidIssueId, setVoidIssueId] = useState(null);
  const [voidReason, setVoidReason] = useState("");
  const [voiding, setVoiding] = useState(false);
  const [voidError, setVoidError] = useState(null);

  // Fetch initial master data
  const fetchMasters = async () => {
    try {
      setLoading(true);
      setError(null);
      const [kList, cList] = await Promise.all([
        api.getKarigars(),
        api.getCategories(),
      ]);
      setKarigars(kList);
      setCategories(cList);
      if (kList.length > 0) {
        setKarigarId(kList[0].id.toString());
      }
    } catch (err) {
      setError(err.message || "Failed to load form data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMasters();
  }, []);

  // When karigar changes, fetch their jobs
  useEffect(() => {
    if (!karigarId) return;
    const loadJobs = async () => {
      try {
        const jList = await api.getKarigarJobs(karigarId, true);
        setJobs(jList);
        if (jList.length > 0) {
          setSelectedJobId(jList[0].id.toString());
          setNewJobMode(false);
        } else {
          setNewJobMode(true);
          setSelectedJobId("");
        }
      } catch {
        setJobs([]);
      }
    };
    loadJobs();
  }, [karigarId]);

  // Client-side fine weight preview
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
    // Keep 0 for preview on invalid syntax
  }

  const handlePhotoConfirmed = ({ readingId, valueStr }) => {
    setGrossInput(valueStr);
    setConfirmedReadingId(readingId);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    let gMg, pBp;
    try {
      gMg = parseG(grossInput);
      pBp = parsePurity(purityInput);
    } catch (err) {
      setFormError(err.message);
      return;
    }

    setSubmitting(true);
    try {
      let targetJobId = selectedJobId;

      // If creating new job inline
      if (newJobMode) {
        if (!newJobNo.trim()) throw new Error("Job number is required");
        if (!newJobCategory) throw new Error("Please select an item category");

        // Fetch agreed wastage for this category or default
        const wastages = await api.getKarigarWastages(karigarId);
        const match = wastages.find((w) => w.category_id === Number(newJobCategory));
        const agreedBp = match ? match.wastage_bp : 300; // default 3.00%

        const createdJob = await api.createJob({
          karigar_id: Number(karigarId),
          job_no: newJobNo.trim(),
          category_id: Number(newJobCategory),
          description: newJobDesc.trim() || undefined,
          wastage_bp: agreedBp,
          opened_on: entryDate,
        });
        targetJobId = createdJob.id;
      }

      const issuePayload = {
        job_id: Number(targetJobId),
        gross_mg: gMg,
        purity_bp: pBp,
        entry_date: entryDate,
        note: note.trim() || undefined,
        ai_reading_id: confirmedReadingId || undefined,
      };

      const result = await api.createIssue(issuePayload);

      // Selected karigar info
      const selectedKarigar = karigars.find((k) => k.id === Number(karigarId));

      setIssuedSlip({
        txn_id: result.txn_id,
        karigar_name: selectedKarigar?.name,
        karigar_code: selectedKarigar?.code,
        job_no: newJobMode ? newJobNo : jobs.find((j) => j.id === Number(targetJobId))?.job_no,
        gross_mg: result.gross_mg,
        purity_bp: result.purity_bp,
        fine_mg: result.fine_mg,
        entry_date: result.entry_date,
        note: result.note,
      });

      // Reset form
      setGrossInput("");
      setNote("");
      if (newJobMode) {
        setNewJobNo("");
        setNewJobDesc("");
      }
    } catch (err) {
      setFormError(err.message || "Failed to record issue");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrintSlip = () => {
    window.print();
  };

  return (
    <AppShell
      title="Gold Issue Entry"
      subtitle="Issue bullion or alloyed gold bar stock to an artisan workbench"
    >
      {loading ? (
        <LoadingState message="Loading issue entry configuration..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchMasters} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Issue Form */}
          <div className="lg:col-span-2 space-y-6">
            <div className="card-glass p-6">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2 pb-4 border-b border-slate-800">
                <SendHorizontal className="w-5 h-5 text-yellow-400" />
                Record Vault-to-Karigar Issue
              </h2>

              {formError && (
                <div className="mt-4 p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                {/* 1. Karigar Selector */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Assigned Karigar
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

                  {/* Date Input */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Issue Date
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

                {/* 2. Job Selection / Creation */}
                <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200">
                      Work Order / Job
                    </span>
                    <button
                      type="button"
                      onClick={() => setNewJobMode(!newJobMode)}
                      className="text-xs text-yellow-400 hover:underline flex items-center gap-1"
                    >
                      {newJobMode ? "Select Existing Job" : "+ Create New Job"}
                    </button>
                  </div>

                  {!newJobMode ? (
                    <div>
                      {jobs.length > 0 ? (
                        <select
                          value={selectedJobId}
                          onChange={(e) => setSelectedJobId(e.target.value)}
                          className="input-base text-xs"
                        >
                          {jobs.map((j) => (
                            <option key={j.id} value={j.id}>
                              {j.job_no} — {j.description || "Ornament"} (Wastage: {fmtPurity(j.wastage_bp)}%)
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-xs text-amber-400/90 italic">
                          No active open jobs for this artisan. Please create a new job below.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                      <div>
                        <input
                          type="text"
                          required={newJobMode}
                          placeholder="Job No (e.g. JOB-801)"
                          value={newJobNo}
                          onChange={(e) => setNewJobNo(e.target.value)}
                          className="input-base text-xs font-mono"
                        />
                      </div>
                      <div>
                        <select
                          required={newJobMode}
                          value={newJobCategory}
                          onChange={(e) => setNewJobCategory(e.target.value)}
                          className="input-base text-xs"
                        >
                          <option value="">Select Category</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="Description (e.g. 22K Bangle)"
                          value={newJobDesc}
                          onChange={(e) => setNewJobDesc(e.target.value)}
                          className="input-base text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Weight and Purity Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Gross Weight (Grams)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder="112.450"
                        value={grossInput}
                        onChange={(e) => setGrossInput(e.target.value)}
                        className="input-base font-mono text-base pr-8"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-mono">
                        g
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      Exactly up to 3 decimal places (integer milligrams)
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Purity (% Gold)
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
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      Standard: 91.60% (22K) or 99.90% (24K bullion)
                    </span>
                  </div>
                </div>

                {/* Live Mathematical Settlement Calculation Card */}
                <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-medium text-slate-400 block">
                      Calculated Fine Weight (Pure Gold)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Half-up integer formula: (gross_mg × purity_bp + 5000) // 10000
                    </span>
                  </div>
                  <div className="text-right">
                    <GoldNumber
                      value={previewFineMg}
                      size="xl"
                      highlight="gold"
                    />
                    <span className="text-[11px] text-slate-400 block font-mono">
                      {previewFineMg.toLocaleString()} mg pure
                    </span>
                  </div>
                </div>

                {/* Note */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Internal Note / Slip Remarks (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 24K casting grain from vault box #2"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="input-base text-xs"
                  />
                </div>

                {/* Submit */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting || previewFineMg <= 0}
                    className="w-full btn-gold py-2.5"
                  >
                    {submitting ? "Writing to Ledger..." : "Authorize & Issue Gold"}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Scale Photo Reader Sidecar */}
          <div className="space-y-6">
            <PhotoReader
              mode="scale"
              currentTypedValue={grossInput}
              onReadingConfirmed={handlePhotoConfirmed}
            />

            <div className="card-glass p-5 border border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Workshop Standard Practice
              </h3>
              <ul className="text-xs text-slate-400 space-y-2 list-disc list-inside">
                <li>All issues increment the karigar's running fine-gold liability.</li>
                <li>Digital scale reads can be auto-verified via camera above.</li>
                <li>Printed voucher TX-XXXXX must be counter-signed by the artisan.</li>
                <li>Ledger entries are append-only and cannot be edited.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Slip Modal / Printable Voucher */}
      {issuedSlip && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="card-glass w-full max-w-lg p-6 border border-yellow-500/40 relative">
            <div className="slip-box bg-slate-900 border border-slate-700 p-6 rounded-lg text-slate-100">
              <div className="flex justify-between items-start border-b border-slate-700 pb-3">
                <div>
                  <h3 className="font-bold text-base text-yellow-400">
                    GOLD ISSUE VOUCHER
                  </h3>
                  <p className="text-xs text-slate-400">Coimbatore Workshop</p>
                </div>
                <div className="text-right">
                  <span className="font-mono text-sm font-bold text-yellow-400 block">
                    {issuedSlip.txn_id}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    {issuedSlip.entry_date}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 my-4 text-xs">
                <div>
                  <span className="text-slate-400 block">Artisan:</span>
                  <span className="font-semibold text-slate-200">
                    {issuedSlip.karigar_name} ({issuedSlip.karigar_code})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Job Reference:</span>
                  <span className="font-semibold text-slate-200">
                    {issuedSlip.job_no || "General Workshop"}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded bg-slate-950 border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Gross Weight:</span>
                  <GoldNumber value={issuedSlip.gross_mg} />
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Tested Purity:</span>
                  <GoldNumber value={issuedSlip.purity_bp} type="purity" />
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-800 font-bold">
                  <span className="text-yellow-400">Fine Gold Issued:</span>
                  <GoldNumber
                    value={issuedSlip.fine_mg}
                    size="lg"
                    highlight="gold"
                  />
                </div>
              </div>

              {issuedSlip.note && (
                <p className="text-[11px] text-slate-400 mt-3 italic">
                  Note: {issuedSlip.note}
                </p>
              )}

              <div className="mt-8 pt-4 border-t border-slate-700 grid grid-cols-2 gap-4 text-center text-xs text-slate-400">
                <div className="border-t border-dashed border-slate-600 pt-1">
                  Issue Clerk Signature
                </div>
                <div className="border-t border-dashed border-slate-600 pt-1">
                  Karigar Signature
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-3 no-print">
              <button
                type="button"
                onClick={() => setIssuedSlip(null)}
                className="btn-secondary text-xs"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handlePrintSlip}
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
