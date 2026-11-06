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
  fmtDate,
  parseG,
  parsePurity,
  calcFineMg,
} from "../lib/format";

export default function IssueEntry() {
  const [karigars, setKarigars] = useState([]);
  const [categories, setCategories] = useState([]);
  const [recentIssues, setRecentIssues] = useState([]);
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
  const [showPhotoReader, setShowPhotoReader] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [savedSuccess, setSavedSuccess] = useState(null);

  const fetchRecent = async () => {
    try {
      const data = await api.getIssues();
      setRecentIssues(Array.isArray(data) ? data.slice(0, 8) : []);
    } catch {
      setRecentIssues([]);
    }
  };

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
      await fetchRecent();
    } catch (err) {
      setError(err.message || "Failed to load master records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMasters();
  }, []);

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
    setShowPhotoReader(false);
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
          category_id: Number(newJobCategory),
          job_no: newJobNo.trim(),
          wastage_bp: agreedBp,
          description: newJobDesc.trim() || undefined,
        });
        targetJobId = createdJob.id;

        const updatedJobs = await api.getKarigarJobs(karigarId, true);
        setJobs(updatedJobs);
        setSelectedJobId(String(targetJobId));
      }

      const activeJobNo = newJobMode
        ? newJobNo.trim()
        : jobs.find((j) => j.id === Number(targetJobId))?.job_no;

      const payload = {
        karigar_id: Number(karigarId),
        job_id: Number(targetJobId),
        gross_mg: gMg,
        purity_bp: pBp,
        fine_mg: previewFineMg,
        entry_date: entryDate,
        note: note.trim() || undefined,
        ai_reading_id: confirmedReadingId || undefined,
      };

      const result = await api.createIssue(payload);
      const selectedKarigar = karigars.find((k) => k.id === Number(karigarId));

      setSavedSuccess({
        txn_id: result.txn_id,
        karigar_name: selectedKarigar?.name,
        karigar_code: selectedKarigar?.code,
        job_no: activeJobNo,
        fine_mg: result.fine_mg,
        gross_mg: result.gross_mg,
        purity_bp: result.purity_bp,
      });

      setCurrentBalanceMg((prev) => prev + result.fine_mg);
      setGrossInput("");
      setNote("");
      setConfirmedReadingId(null);
      if (newJobMode) {
        setNewJobMode(false);
        setNewJobNo("");
        setNewJobDesc("");
      }

      fetchRecent();
    } catch (err) {
      setFormError(err.message || "Failed to record issue");
    } finally {
      setSubmitting(false);
    }
  };

  const activeJob = jobs.find((j) => j.id === Number(selectedJobId));
  const activeJobNumber = newJobMode
    ? newJobNo.trim() || "New job order"
    : activeJob
    ? activeJob.job_no
    : "—";

  const hasJobSelected = Boolean(selectedJobId || newJobMode);
  const hasTypedValues = previewFineMg > 0;

  const disabledReason = isMismatchBlocked
    ? "Save blocked: entered weight must match confirmed photo reading."
    : previewFineMg <= 0
    ? "Enter weight and purity to calculate fine gold."
    : !selectedJobId && !newJobMode
    ? "Select or create an open job order."
    : "";

  // Result Panel Content
  const renderSlipBody = () => (
    <div className="space-y-4">
      {!hasTypedValues ? (
        <div className="py-8 text-center text-xs text-muted">
          Enter weight and purity to see the result
        </div>
      ) : (
        <>
          {/* Fine Weight - 32px mono hero metric */}
          <div className="py-3 text-center border-b border-[#E2D3A4]">
            <span className="text-xs text-muted block mb-1">
              Fine pure weight
            </span>
            <div className="text-[32px] font-semibold font-mono tracking-tight text-ink leading-tight">
              {fmtG(previewFineMg)} <span className="text-sm font-sans text-muted font-normal">g</span>
            </div>
            <span className="text-xs text-muted font-mono block mt-1">
              {previewFineMg.toLocaleString()} mg pure
            </span>
          </div>

          {/* Details: Gross & Purity */}
          <div className="grid grid-cols-2 gap-3 text-xs py-2 border-b border-[#E2D3A4]">
            <div>
              <span className="text-muted block mb-0.5">Gross weight:</span>
              <span className="font-mono text-sm text-ink">{fmtG(previewGrossMg)} <span className="text-muted text-xs">g</span></span>
            </div>
            <div>
              <span className="text-muted block mb-0.5">Purity:</span>
              <span className="font-mono text-sm text-ink">{fmtPurity(previewPurityBp)} <span className="text-muted text-xs">%</span></span>
            </div>
          </div>

          {/* Running Balances */}
          {hasJobSelected && (
            <div className="space-y-1.5 pt-1 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-muted">Balance before:</span>
                <span className="font-mono text-ink">{fmtG(currentBalanceMg)} <span className="text-muted text-xs">g</span></span>
              </div>
              <div className="flex justify-between items-center font-medium pt-1 border-t border-[#E2D3A4]/60">
                <span className="text-ink">Balance after:</span>
                <span className="font-mono font-semibold text-ink">{fmtG(currentBalanceMg + previewFineMg)} <span className="text-muted text-xs">g</span></span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <AppShell
      title="Issue gold"
      subtitle="Issue raw bullion or bar stock to a karigar workbench"
    >
      {loading ? (
        <LoadingState count={4} />
      ) : error ? (
        <ErrorState error={error} onRetry={fetchMasters} />
      ) : (
        <div className="space-y-6">
          {/* Success confirmation */}
          {savedSuccess && (
            <div className="p-3.5 px-4 rounded border border-status-ok/20 bg-status-ok-tint flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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

          {/* 2-Zone Grid: Left zone 1fr (form), Right zone 400px (sticky result panel), gap 24px */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 items-start">
            {/* Left Zone: Form */}
            <div className="bg-surface border border-border rounded p-6">
              {formError && (
                <ErrorState
                  error={formError}
                  title="Issue submission blocked"
                  message={formError}
                  className="mb-4"
                />
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* 12-column Inner Grid */}
                <div className="grid grid-cols-12 gap-x-4 gap-y-4">
                  {/* Row 1: [Karigar | Issue date] */}
                  <div className="col-span-12 sm:col-span-6 space-y-1.5">
                    <label htmlFor="karigar" className="block text-sm font-medium text-ink">
                      Karigar <span className="text-muted text-xs select-none">*</span>
                    </label>
                    <select
                      id="karigar"
                      value={karigarId}
                      onChange={(e) => setKarigarId(e.target.value)}
                      className="w-full h-11 sm:h-10 px-3 bg-white border border-[#D9D1BF] rounded text-sm text-ink outline-none focus:border-bronze focus:ring-2 focus:ring-bronze"
                    >
                      {karigars.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.code} — {k.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-12 sm:col-span-6">
                    <DateInput
                      label="Issue date"
                      id="entryDate"
                      value={entryDate}
                      onChange={(val) => setEntryDate(val)}
                    />
                  </div>

                  {/* Row 2: [Job order] */}
                  <div className="col-span-12 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="jobSelect" className="block text-sm font-medium text-ink">
                        Job order <span className="text-muted text-xs select-none">*</span>
                      </label>
                      {jobs.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setNewJobMode(!newJobMode)}
                          className="text-xs text-bronze hover:underline p-0 m-0 bg-transparent border-none cursor-pointer font-medium"
                        >
                          {newJobMode ? "Select existing job" : "+ Create new job"}
                        </button>
                      )}
                    </div>

                    {!newJobMode ? (
                      jobs.length > 0 ? (
                        <select
                          id="jobSelect"
                          value={selectedJobId}
                          onChange={(e) => setSelectedJobId(e.target.value)}
                          className="w-full h-11 sm:h-10 px-3 bg-white border border-[#D9D1BF] rounded text-sm text-ink outline-none focus:border-bronze focus:ring-2 focus:ring-bronze"
                        >
                          {jobs.map((j) => (
                            <option key={j.id} value={j.id}>
                              {j.job_no} — {j.description || "Ornament"} (Agreed wastage: {fmtPurity(j.wastage_bp)}%)
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="p-2.5 px-3 rounded bg-background border border-border flex items-center justify-between text-xs text-muted">
                          <span>No open jobs for this karigar.</span>
                          <button
                            type="button"
                            onClick={() => setNewJobMode(true)}
                            className="text-bronze font-medium hover:underline p-0 m-0 bg-transparent border-none cursor-pointer"
                          >
                            Create job order
                          </button>
                        </div>
                      )
                    ) : (
                      /* Inline job order creation */
                      <div className="p-3.5 border border-border rounded bg-background space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-ink">
                            New job order details
                          </span>
                          {jobs.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setNewJobMode(false)}
                              className="text-xs text-muted hover:text-ink cursor-pointer bg-transparent border-none p-0"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                              Category <span className="text-muted text-xs select-none">*</span>
                            </label>
                            <select
                              id="newJobCategory"
                              value={newJobCategory}
                              onChange={(e) => setNewJobCategory(e.target.value)}
                              className="w-full h-11 sm:h-10 px-3 bg-white border border-[#D9D1BF] rounded text-sm text-ink outline-none focus:border-bronze focus:ring-2 focus:ring-bronze"
                            >
                              <option value="">Select category</option>
                              {categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <Field
                          label="Description"
                          id="newJobDesc"
                          placeholder="e.g. Traditional Bridal Haar"
                          value={newJobDesc}
                          onChange={(e) => setNewJobDesc(e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  {/* Row 3: [Gross weight | Purity] */}
                  <div className="col-span-12 sm:col-span-6">
                    <Field
                      label="Gross weight"
                      id="grossWeight"
                      required
                      placeholder="0.000"
                      value={grossInput}
                      onChange={(e) => setGrossInput(e.target.value)}
                      unit="g"
                      action={
                        <button
                          type="button"
                          onClick={() => setShowPhotoReader(!showPhotoReader)}
                          className="text-xs text-bronze hover:underline font-medium p-0 bg-transparent border-none cursor-pointer flex items-center gap-1"
                        >
                          <Camera className="w-3.5 h-3.5 stroke-[1.75]" />
                          <span>{showPhotoReader ? "Hide photo" : "Read from photo"}</span>
                        </button>
                      }
                    />
                  </div>

                  <div className="col-span-12 sm:col-span-6">
                    <Field
                      label="Purity (% gold)"
                      id="purity"
                      required
                      placeholder="91.60"
                      value={purityInput}
                      onChange={(e) => setPurityInput(e.target.value)}
                      unit="%"
                    />
                  </div>

                  {/* Row 4: Photo Reader (expanded inline) */}
                  {(showPhotoReader || isMismatchBlocked) && (
                    <div className="col-span-12">
                      <PhotoReader
                        mode="scale"
                        isOpen={true}
                        onClose={() => setShowPhotoReader(false)}
                        currentTypedValue={grossInput}
                        onReadingConfirmed={handlePhotoConfirmed}
                        onMismatchStateChange={setIsMismatchBlocked}
                      />
                    </div>
                  )}

                  {/* Remarks */}
                  <div className="col-span-12">
                    <Field
                      label="Remarks (optional)"
                      id="note"
                      placeholder="e.g. Casting grain from vault lot #3"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </div>
                </div>

                {/* Actions Row: one divider above, primary button left-aligned, disabled reason beside it in one line */}
                <div className="pt-4 border-t border-border flex flex-wrap items-center gap-3">
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    loading={submitting}
                    disabled={previewFineMg <= 0 || (!selectedJobId && !newJobMode) || isMismatchBlocked}
                  >
                    Authorize and issue gold
                  </Button>
                  {disabledReason && (
                    <span className="text-xs text-muted">
                      {disabledReason}
                    </span>
                  )}
                </div>
              </form>
            </div>

            {/* Right Zone: Sticky Result Panel (400px) */}
            <div className="hidden lg:block sticky top-6">
              <div className="bg-result-bg border border-result-border rounded p-5 space-y-4">
                <div className="pb-3 border-b border-result-border flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-ink m-0">
                    Slip preview
                  </h3>
                  <span className="text-xs text-muted font-mono">
                    {activeJobNumber}
                  </span>
                </div>
                {renderSlipBody()}
              </div>
            </div>
          </div>

          {/* Collapsible Mobile Slip Preview (<1024px) */}
          <div className="lg:hidden">
            <details className="bg-result-bg border border-result-border rounded p-4 group" open={hasTypedValues}>
              <summary className="text-sm font-semibold text-ink cursor-pointer list-none flex items-center justify-between select-none">
                <div className="flex items-center gap-2">
                  <span>Slip preview</span>
                  {hasTypedValues && (
                    <span className="text-xs font-mono text-bronze font-medium">
                      {fmtG(previewFineMg)} g
                    </span>
                  )}
                </div>
                <ChevronDown className="w-4 h-4 text-muted transition-transform group-open:rotate-180" />
              </summary>
              <div className="pt-4 mt-3 border-t border-result-border">
                {renderSlipBody()}
              </div>
            </details>
          </div>

          {/* Recent Entries Compact Table */}
          <div className="pt-2 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink m-0">
                Recent gold issues
              </h3>
              <span className="text-xs text-muted font-mono">
                Latest {recentIssues.length} entries
              </span>
            </div>

            {recentIssues.length === 0 ? (
              <TableContainer>
                <EmptyState description="No issues recorded yet" />
              </TableContainer>
            ) : (
              <TableContainer>
                <TableHead>
                  <tr>
                    <TableHeaderCell>Voucher / Txn ID</TableHeaderCell>
                    <TableHeaderCell>Date</TableHeaderCell>
                    <TableHeaderCell>Karigar</TableHeaderCell>
                    <TableHeaderCell>Job order</TableHeaderCell>
                    <TableHeaderCell align="right">Gross (g)</TableHeaderCell>
                    <TableHeaderCell align="right">Purity (%)</TableHeaderCell>
                    <TableHeaderCell align="right">Fine gold (g)</TableHeaderCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {recentIssues.map((iss) => (
                    <TableRow key={iss.id}>
                      <TableCell className="font-mono font-medium">{iss.txn_id}</TableCell>
                      <TableCell className="text-muted">{fmtDate(iss.entry_date)}</TableCell>
                      <TableCell className="font-medium text-ink">{iss.karigar_name || "—"}</TableCell>
                      <TableCell className="font-mono">{iss.job_no || "—"}</TableCell>
                      <TableCell align="right"><GoldNumber value={iss.gross_mg} type="weight" size="xs" align="right" /></TableCell>
                      <TableCell align="right"><GoldNumber value={iss.purity_bp} type="purity" size="xs" align="right" /></TableCell>
                      <TableCell align="right"><GoldNumber value={iss.fine_mg} type="weight" size="xs" align="right" /></TableCell>
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
