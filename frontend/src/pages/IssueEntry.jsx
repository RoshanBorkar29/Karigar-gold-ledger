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
import { api } from "../lib/api";
import {
  fmtG,
  fmtPurity,
  fmtDate,
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
  const [currentBalanceMg, setCurrentBalanceMg] = useState(0);

  // Inline Job Creation State
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
  const [isMismatchBlocked, setIsMismatchBlocked] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Quiet persistent success confirmation
  const [savedSuccess, setSavedSuccess] = useState(null);

  // Load karigars and categories
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
        setKarigarId(String(kList[0].id));
      }
    } catch (err) {
      setError(err.message || "Failed to load master records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMasters();
  }, []);

  // When karigar changes, fetch their open jobs and current running balance
  useEffect(() => {
    if (!karigarId) return;

    const loadKarigarContext = async () => {
      try {
        const [jList, balResult] = await Promise.all([
          api.getKarigarJobs(karigarId, true),
          api.getKarigarBalance(karigarId),
        ]);

        setJobs(jList);
        setCurrentBalanceMg(balResult.total_fine_balance_mg ?? 0);

        if (jList.length > 0) {
          setSelectedJobId(String(jList[0].id));
          setNewJobMode(false);
        } else {
          setSelectedJobId("");
          setNewJobMode(false);
        }
      } catch {
        setJobs([]);
        setCurrentBalanceMg(0);
      }
    };

    loadKarigarContext();
  }, [karigarId]);

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

  const handlePhotoConfirmed = ({ readingId, valueStr }) => {
    setGrossInput(valueStr);
    setConfirmedReadingId(readingId);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (isMismatchBlocked) {
      setFormError("Cannot submit while entered weight differs from confirmed instrument photo reading.");
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

    setSubmitting(true);
    try {
      let targetJobId = selectedJobId;

      if (newJobMode) {
        if (!newJobNo.trim()) throw new Error("Job number is required");
        if (!newJobCategory) throw new Error("Item category is required");

        const wastages = await api.getKarigarWastages(karigarId);
        const match = wastages.find((w) => w.category_id === Number(newJobCategory));
        const agreedBp = match ? match.wastage_bp : 300;

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

      if (!targetJobId) {
        throw new Error("An open job must be selected or created to issue gold.");
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

      const selectedKarigar = karigars.find((k) => k.id === Number(karigarId));
      const activeJobNo = newJobMode
        ? newJobNo.trim()
        : jobs.find((j) => j.id === Number(targetJobId))?.job_no || `JOB-${targetJobId}`;

      setSavedSuccess({
        txn_id: result.txn_id,
        karigar_name: selectedKarigar?.name,
        karigar_code: selectedKarigar?.code,
        job_no: activeJobNo,
        fine_mg: result.fine_mg,
        gross_mg: result.gross_mg,
        purity_bp: result.purity_bp,
      });

      // Update balance
      setCurrentBalanceMg((prev) => prev + result.fine_mg);

      // Reset form fields
      setGrossInput("");
      setNote("");
      setConfirmedReadingId(null);
      if (newJobMode) {
        setNewJobMode(false);
        setNewJobNo("");
        setNewJobDesc("");
      }
    } catch (err) {
      setFormError(err.message || "Failed to record issue");
    } finally {
      setSubmitting(false);
    }
  };

  const activeJob = jobs.find((j) => j.id === Number(selectedJobId));
  const activeJobNumber = newJobMode
    ? newJobNo.trim() || "New Job Order"
    : activeJob
    ? activeJob.job_no
    : "—";

  return (
    <AppShell>
      <PageHeader
        title="Issue gold"
        description="Issue raw bullion or alloyed bar stock to an artisan workbench"
      />

      {loading ? (
        <LoadingState count={5} />
      ) : error ? (
        <ErrorState error={error} onRetry={fetchMasters} />
      ) : (
        <div className="space-y-6">
          {/* Quiet persistent success confirmation */}
          {savedSuccess && (
            <div className="p-4 rounded border border-status-ok/20 bg-status-ok-tint flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-status-ok font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0 stroke-[2]" />
                <span>
                  Issue {savedSuccess.txn_id} saved for {savedSuccess.karigar_name} ({savedSuccess.karigar_code})
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

          {/* Two-column layout on desktop: Left Form (max 480px), Right Slip Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left: Form */}
            <div className="lg:col-span-7 space-y-6 max-w-[480px]">
              {formError && (
                <ErrorState
                  error={formError}
                  title="Issue submission blocked"
                  message={formError}
                />
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Karigar & Date */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="karigar" className="block text-sm font-medium text-ink">
                      Karigar <span className="text-status-problem">*</span>
                    </label>
                    <select
                      id="karigar"
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
                      Issue date
                    </label>
                    <input
                      id="entryDate"
                      type="date"
                      value={entryDate}
                      onChange={(e) => setEntryDate(e.target.value)}
                      className="w-full h-11 px-3 bg-surface border border-border rounded text-sm text-ink outline-none focus:border-bronze focus:ring-2 focus:ring-bronze/20"
                    />
                    <p className="text-xs text-muted mt-1">
                      Scheduled date: {fmtDate(entryDate)} (Asia/Kolkata)
                    </p>
                  </div>
                </div>

                {/* Job Selection / Inline creation */}
                <div className="pt-2 border-t border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-ink">
                      Job order
                    </span>
                    <button
                      type="button"
                      onClick={() => setNewJobMode(!newJobMode)}
                      className="text-xs text-bronze hover:underline p-0 m-0 bg-transparent border-none cursor-pointer font-medium"
                    >
                      {newJobMode ? "Select existing job" : "+ Create new job"}
                    </button>
                  </div>

                  {!newJobMode ? (
                    jobs.length > 0 ? (
                      <div className="space-y-1.5">
                        <select
                          id="jobSelect"
                          value={selectedJobId}
                          onChange={(e) => setSelectedJobId(e.target.value)}
                          className="w-full h-11 px-3 bg-surface border border-border rounded text-sm text-ink outline-none focus:border-bronze focus:ring-2 focus:ring-bronze/20"
                        >
                          {jobs.map((j) => (
                            <option key={j.id} value={j.id}>
                              {j.job_no} — {j.description || "Ornament"} (Agreed wastage: {fmtPurity(j.wastage_bp)}%)
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-muted">
                          Showing open production runs for this artisan
                        </p>
                      </div>
                    ) : (
                      <EmptyState
                        title="No active open jobs"
                        description="This karigar has no open job orders. Create a job order to issue gold."
                        actionText="Create job order"
                        onAction={() => setNewJobMode(true)}
                      />
                    )
                  ) : (
                    <div className="p-4 border border-border rounded bg-surface space-y-3">
                      <div className="text-xs font-semibold text-ink">
                        New job order details
                      </div>
                      <Field
                        label="Job number"
                        id="newJobNo"
                        placeholder="e.g. JOB-2026-002"
                        required
                        value={newJobNo}
                        onChange={(e) => setNewJobNo(e.target.value)}
                      />
                      <div className="space-y-1.5">
                        <label htmlFor="newJobCategory" className="block text-sm font-medium text-ink">
                          Category <span className="text-status-problem">*</span>
                        </label>
                        <select
                          id="newJobCategory"
                          value={newJobCategory}
                          onChange={(e) => setNewJobCategory(e.target.value)}
                          className="w-full h-11 px-3 bg-surface border border-border rounded text-sm text-ink outline-none focus:border-bronze focus:ring-2 focus:ring-bronze/20"
                        >
                          <option value="">Select category</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Field
                        label="Description"
                        id="newJobDesc"
                        placeholder="e.g. 22K Traditional Bridal Necklace"
                        value={newJobDesc}
                        onChange={(e) => setNewJobDesc(e.target.value)}
                      />
                    </div>
                  )}
                </div>

                {/* Weight & Purity */}
                <div className="pt-2 border-t border-border space-y-4">
                  <Field
                    label="Gross weight"
                    id="grossWeight"
                    type="text"
                    required
                    placeholder="112.450"
                    value={grossInput}
                    onChange={(e) => setGrossInput(e.target.value)}
                    helperText="Input in grams up to 3 decimals (e.g. 112.450)"
                  />

                  <Field
                    label="Purity"
                    id="purity"
                    type="text"
                    required
                    placeholder="91.60"
                    value={purityInput}
                    onChange={(e) => setPurityInput(e.target.value)}
                    helperText="Standard purity: 91.60% (22K) or 99.90% (24K)"
                  />

                  <Field
                    label="Remarks (optional)"
                    id="note"
                    placeholder="e.g. Casting grain from vault bar #4"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>

                {/* Photo Reader assist */}
                <div className="pt-2 border-t border-border">
                  <PhotoReader
                    mode="scale"
                    currentTypedValue={grossInput}
                    onReadingConfirmed={handlePhotoConfirmed}
                    onMismatchStateChange={setIsMismatchBlocked}
                  />
                </div>

                {/* Submit button */}
                <div className="pt-4">
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    loading={submitting}
                    disabled={previewFineMg <= 0 || (!selectedJobId && !newJobMode) || isMismatchBlocked}
                    disabledReason={
                      isMismatchBlocked
                        ? "Save blocked: entered weight must match confirmed photo reading."
                        : previewFineMg <= 0
                        ? "Enter valid gross weight and purity to calculate fine gold."
                        : !selectedJobId && !newJobMode
                        ? "Please select or create an open job order."
                        : ""
                    }
                    className="w-full"
                  >
                    Authorize and issue gold
                  </Button>
                </div>
              </form>
            </div>

            {/* Right: Live Slip Preview Panel */}
            <div className="lg:col-span-5 space-y-4 sticky top-6">
              <div className="bg-surface border border-border rounded p-6 space-y-5">
                <div className="pb-3 border-b border-border flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-ink m-0">
                    Slip preview
                  </h3>
                  <span className="text-xs text-muted font-mono">
                    {activeJobNumber}
                  </span>
                </div>

                {/* Fine Weight - Largest figure */}
                <div className="py-2 text-center border-b border-border space-y-1">
                  <span className="text-xs text-muted block">
                    Calculated fine weight
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
                    {previewFineMg.toLocaleString()} mg pure gold
                  </span>
                </div>

                {/* Weight and Purity details */}
                <div className="grid grid-cols-2 gap-4 text-xs py-1 border-b border-border">
                  <div>
                    <span className="text-muted block">Gross weight:</span>
                    <GoldNumber value={previewGrossMg} type="weight" size="sm" />
                  </div>
                  <div>
                    <span className="text-muted block">Purity:</span>
                    <GoldNumber value={previewPurityBp} type="purity" size="sm" />
                  </div>
                </div>

                {/* Karigar Running Balance Before and After */}
                <div className="space-y-2 pt-1 text-xs">
                  <div className="flex justify-between items-center py-1">
                    <span className="text-muted">Karigar balance before:</span>
                    <GoldNumber
                      value={currentBalanceMg}
                      type="weight"
                      size="sm"
                      align="right"
                    />
                  </div>
                  <div className="flex justify-between items-center py-1 border-t border-border/60">
                    <span className="text-ink font-medium">Balance after this issue:</span>
                    <GoldNumber
                      value={currentBalanceMg + previewFineMg}
                      type="weight"
                      size="sm"
                      align="right"
                      className="font-semibold"
                    />
                  </div>
                </div>

                <div className="pt-2 text-[11px] text-muted border-t border-border leading-relaxed">
                  Formula: (gross_mg × purity_bp + 5000) // 10000. All entries are immutable in the ledger.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
