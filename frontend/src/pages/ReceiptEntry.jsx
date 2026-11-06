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
import EmptyState from "../components/EmptyState";
import StatusBadge from "../components/ui/StatusBadge";
import { api } from "../lib/api";
import {
  fmtG,
  fmtPurity,
  fmtDate,
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
  const [note, setNote] = useState("");

  const [jobSettlement, setJobSettlement] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [savedSuccess, setSavedSuccess] = useState(null);

  const fetchKarigars = async () => {
    try {
      setLoading(true);
      setError(null);
      const kList = await api.getKarigars();
      setKarigars(kList);
      if (kList.length > 0) {
        setKarigarId(String(kList[0].id));
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

  // When karigar changes, fetch open jobs
  useEffect(() => {
    if (!karigarId) return;

    const loadJobs = async () => {
      try {
        const jList = await api.getKarigarJobs(karigarId, true);
        setJobs(jList);
        if (jList.length > 0) {
          setSelectedJobId(String(jList[0].id));
        } else {
          setSelectedJobId("");
          setJobSettlement(null);
        }
      } catch {
        setJobs([]);
        setSelectedJobId("");
        setJobSettlement(null);
      }
    };

    loadJobs();
  }, [karigarId]);

  // When job changes, fetch live settlement calculation
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

  // Client-side fine weight calculation
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
    // Zero on incomplete input
  }

  const handlePhotoConfirmed = ({ valueStr }) => {
    setGrossInput(valueStr);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedJobId) {
      setFormError("Please select an active open job order.");
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
        setFormError("Finished jewellery requires a valid 6-character alphanumeric BIS HUID (e.g. AB1234).");
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
        note: note.trim() || undefined,
      };

      const result = await api.createReceipt(payload);

      const selectedKarigar = karigars.find((k) => k.id === Number(karigarId));
      const selectedJob = jobs.find((j) => j.id === Number(selectedJobId));

      setSavedSuccess({
        txn_id: result.txn_id,
        karigar_name: selectedKarigar?.name,
        karigar_code: selectedKarigar?.code,
        job_no: selectedJob?.job_no,
        kind: result.kind,
        fine_mg: result.fine_mg,
        gross_mg: result.gross_mg,
        huid: result.huid,
      });

      // Reset input
      setGrossInput("");
      setHuid("");
      setNote("");

      // Refresh live settlement
      const updatedS = await api.getJobSettlement(selectedJobId);
      setJobSettlement(updatedS);
    } catch (err) {
      setFormError(err.message || "Failed to record receipt");
    } finally {
      setSubmitting(false);
    }
  };

  // Settlement metrics
  const issuedFineMg = jobSettlement?.issued_fine_mg ?? 0;
  const returnedFineMg = jobSettlement?.returned_mg ?? 0;
  const outstandingBeforeMg = jobSettlement?.outstanding_mg ?? 0;
  const outstandingAfterMg = Math.max(0, outstandingBeforeMg - previewFineMg);
  const allowedWastageMg = jobSettlement?.allowed_mg ?? 0;
  const excessLossMg = Math.max(0, outstandingAfterMg - allowedWastageMg);

  let settlementStatusText = "Within allowance";
  if (excessLossMg > 0) {
    settlementStatusText = "Outstanding beyond allowance, job open";
  }

  const activeJob = jobs.find((j) => j.id === Number(selectedJobId));

  return (
    <AppShell>
      <PageHeader
        title="Receive gold"
        description="Receive finished jewellery, melting scrap, or bench filings against active jobs"
      />

      {loading ? (
        <LoadingState count={5} />
      ) : error ? (
        <ErrorState error={error} onRetry={fetchKarigars} />
      ) : (
        <div className="space-y-6">
          {/* Quiet persistent success confirmation */}
          {savedSuccess && (
            <div className="p-4 rounded border border-status-ok/20 bg-status-ok-tint flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-status-ok font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0 stroke-[2]" />
                <span>
                  Receipt {savedSuccess.txn_id} saved for {savedSuccess.karigar_name} ({savedSuccess.karigar_code})
                </span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                icon={Printer}
                onClick={() => window.print()}
              >
                Print slip
              </Button>
            </div>
          )}

          {/* Two-column layout on desktop: Left Form (max 480px), Right Live Settlement */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left: Form */}
            <div className="lg:col-span-7 space-y-6 max-w-[480px]">
              {formError && (
                <ErrorState
                  error={formError}
                  title="Receipt submission blocked"
                  message={formError}
                />
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Karigar & Date */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="karigarSelect" className="block text-sm font-medium text-ink">
                      Karigar <span className="text-status-problem">*</span>
                    </label>
                    <select
                      id="karigarSelect"
                      value={karigarId}
                      onChange={(e) => setKarigarId(e.target.value)}
                      className="w-full h-11 px-3 bg-surface border border-border rounded text-sm text-ink outline-none focus:border-bronze focus:ring-2 focus:ring-bronze/20"
                    >
                      {karigars.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.code} — {k.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="entryDate" className="block text-sm font-medium text-ink">
                      Receipt date
                    </label>
                    <input
                      id="entryDate"
                      type="date"
                      value={entryDate}
                      onChange={(e) => setEntryDate(e.target.value)}
                      className="w-full h-11 px-3 bg-surface border border-border rounded text-sm text-ink outline-none focus:border-bronze focus:ring-2 focus:ring-bronze/20"
                    />
                    <p className="text-xs text-muted mt-1">
                      Recorded date: {fmtDate(entryDate)} (Asia/Kolkata)
                    </p>
                  </div>
                </div>

                {/* Job Selection */}
                <div className="pt-2 border-t border-border space-y-1.5">
                  <label htmlFor="jobSelect" className="block text-sm font-medium text-ink">
                    Active job order <span className="text-status-problem">*</span>
                  </label>
                  {jobs.length > 0 ? (
                    <select
                      id="jobSelect"
                      value={selectedJobId}
                      onChange={(e) => setSelectedJobId(e.target.value)}
                      className="w-full h-11 px-3 bg-surface border border-border rounded text-sm text-ink outline-none focus:border-bronze focus:ring-2 focus:ring-bronze/20"
                    >
                      {jobs.map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.job_no} — {j.description || "Ornament"} (Agreed: {fmtPurity(j.wastage_bp)}%)
                        </option>
                      ))}
                    </select>
                  ) : (
                    <EmptyState
                      title="No open jobs"
                      description="This karigar has no active open job orders to receive against."
                    />
                  )}
                </div>

                {/* Return Kind & HUID */}
                <div className="pt-2 border-t border-border space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="receiptKind" className="block text-sm font-medium text-ink">
                      Return kind <span className="text-status-problem">*</span>
                    </label>
                    <select
                      id="receiptKind"
                      value={kind}
                      onChange={(e) => {
                        setKind(e.target.value);
                        if (e.target.value !== "finished") setHuid("");
                      }}
                      className="w-full h-11 px-3 bg-surface border border-border rounded text-sm text-ink outline-none focus:border-bronze focus:ring-2 focus:ring-bronze/20"
                    >
                      <option value="finished">Finished jewellery (requires BIS HUID)</option>
                      <option value="scrap">Melting scrap</option>
                      <option value="filings">Bench filings</option>
                    </select>
                  </div>

                  {kind === "finished" && (
                    <Field
                      label="Hallmarking HUID"
                      id="huid"
                      required
                      placeholder="e.g. AB1234"
                      value={huid}
                      onChange={(e) => setHuid(e.target.value.toUpperCase())}
                      maxLength={6}
                      helperText="Exact 6-character uppercase alphanumeric Bureau of Indian Standards identifier"
                    />
                  )}
                </div>

                {/* Gross & Purity */}
                <div className="pt-2 border-t border-border space-y-4">
                  <Field
                    label="Gross weight"
                    id="grossWeight"
                    type="text"
                    required
                    placeholder="103.004"
                    value={grossInput}
                    onChange={(e) => setGrossInput(e.target.value)}
                    helperText="Input in grams up to 3 decimals (e.g. 103.004)"
                  />

                  <Field
                    label="Purity"
                    id="purity"
                    type="text"
                    required
                    placeholder="91.60"
                    value={purityInput}
                    onChange={(e) => setPurityInput(e.target.value)}
                    helperText="Standard purity: 91.60% (22K)"
                  />

                  <Field
                    label="Remarks (optional)"
                    id="note"
                    placeholder="e.g. Verified weight on precision analytical scale"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>

                {/* Photo Reader */}
                <div className="pt-2 border-t border-border">
                  <PhotoReader
                    mode="scale"
                    currentTypedValue={grossInput}
                    onReadingConfirmed={handlePhotoConfirmed}
                  />
                </div>

                {/* Submit */}
                <div className="pt-4">
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    loading={submitting}
                    disabled={previewFineMg <= 0 || !selectedJobId}
                    disabledReason={
                      previewFineMg <= 0
                        ? "Enter valid gross weight and purity to receive gold."
                        : !selectedJobId
                        ? "Select an active job order to record return receipt."
                        : ""
                    }
                    className="w-full"
                  >
                    Receive gold into vault
                  </Button>
                </div>
              </form>
            </div>

            {/* Right: Live Settlement Panel */}
            <div className="lg:col-span-5 space-y-4 sticky top-6">
              <div className="bg-surface border border-border rounded p-6 space-y-5">
                <div className="pb-3 border-b border-border flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-ink m-0">
                    Live settlement progress
                  </h3>
                  <span className="text-xs text-muted font-mono">
                    {activeJob ? activeJob.job_no : "—"}
                  </span>
                </div>

                {/* This Receipt - Featured figure */}
                <div className="py-2 text-center border-b border-border space-y-1">
                  <span className="text-xs text-muted block">
                    This receipt fine gold
                  </span>
                  <div className="flex justify-center">
                    <GoldNumber
                      value={previewFineMg}
                      type="weight"
                      size="xl"
                      isKeyBalance
                    />
                  </div>
                  <span className="text-xs text-muted font-mono block">
                    {previewFineMg.toLocaleString()} mg fine gold
                  </span>
                </div>

                {/* Detailed Settlement Ledger Metrics */}
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between items-center py-1">
                    <span className="text-muted">Issued fine weight:</span>
                    <GoldNumber value={issuedFineMg} type="weight" size="sm" align="right" />
                  </div>
                  <div className="flex justify-between items-center py-1 border-t border-border/40">
                    <span className="text-muted">Returned so far:</span>
                    <GoldNumber value={returnedFineMg} type="weight" size="sm" align="right" />
                  </div>
                  <div className="flex justify-between items-center py-1 border-t border-border/40">
                    <span className="text-muted">Outstanding balance:</span>
                    <GoldNumber value={outstandingAfterMg} type="weight" size="sm" align="right" />
                  </div>
                  <div className="flex justify-between items-center py-1 border-t border-border/40">
                    <span className="text-muted">Allowed wastage ({fmtPurity(activeJob?.wastage_bp || 300)}%):</span>
                    <GoldNumber value={allowedWastageMg} type="weight" size="sm" align="right" />
                  </div>
                  <div className="flex justify-between items-center py-1 border-t border-border/40">
                    <span className={excessLossMg > 0 ? "text-status-problem font-medium" : "text-muted"}>
                      Excess loss:
                    </span>
                    <GoldNumber
                      value={excessLossMg}
                      type="weight"
                      size="sm"
                      align="right"
                      isExcess={excessLossMg > 0}
                    />
                  </div>
                </div>

                {/* Status Badge */}
                <div className="pt-3 border-t border-border flex items-center justify-between">
                  <span className="text-xs text-muted">Settlement status:</span>
                  <StatusBadge status={settlementStatusText} label={settlementStatusText} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
