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
  fmtDate,
  parseG,
  parsePurity,
  calcFineMg,
} from "../lib/format";

export default function ReceiptEntry() {
  const [karigars, setKarigars] = useState([]);
  const [recentReceipts, setRecentReceipts] = useState([]);
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
  const [showPhotoReader, setShowPhotoReader] = useState(false);

  const [jobSettlement, setJobSettlement] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [savedSuccess, setSavedSuccess] = useState(null);

  const fetchRecent = async () => {
    try {
      const data = await api.getReceipts();
      setRecentReceipts(Array.isArray(data) ? data.slice(0, 8) : []);
    } catch {
      setRecentReceipts([]);
    }
  };

  const fetchKarigars = async () => {
    try {
      setLoading(true);
      setError(null);
      const kList = await api.getKarigars();
      setKarigars(kList);
      if (kList.length > 0) {
        setKarigarId(String(kList[0].id));
      }
      await fetchRecent();
    } catch (err) {
      setError(err.message || "Failed to load karigars");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKarigars();
  }, []);

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
    setShowPhotoReader(false);
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

      setGrossInput("");
      setHuid("");
      setNote("");

      const updatedS = await api.getJobSettlement(selectedJobId);
      setJobSettlement(updatedS);
      fetchRecent();
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
    settlementStatusText = "Outstanding beyond allowance";
  }

  const activeJob = jobs.find((j) => j.id === Number(selectedJobId));
  const hasTypedValues = previewFineMg > 0;
  const hasJob = Boolean(selectedJobId);

  const disabledReason = previewFineMg <= 0
    ? "Enter weight and purity to calculate returned gold."
    : !selectedJobId
    ? "Select an active open job order."
    : "";

  const renderSettlementBody = () => (
    <div className="space-y-4">
      {!hasTypedValues ? (
        <div className="py-8 text-center text-xs text-muted">
          Enter weight and purity to see the result
        </div>
      ) : (
        <>
          {/* Fine Weight - 32px mono hero figure */}
          <div className="py-3 text-center border-b border-[#E2D3A4]">
            <span className="text-xs text-muted block mb-1">
              Fine gold returned this receipt
            </span>
            <div className="text-[32px] font-semibold font-mono tracking-tight text-ink leading-tight">
              {fmtG(previewFineMg)} <span className="text-sm font-sans text-muted font-normal">g</span>
            </div>
            <span className="text-xs text-muted font-mono block mt-1">
              {previewFineMg.toLocaleString()} mg fine pure gold
            </span>
          </div>

          {/* Live Settlement Breakdown */}
          {hasJob && (
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center py-0.5">
                <span className="text-muted">Issued fine gold:</span>
                <span className="font-mono text-ink">{fmtG(issuedFineMg)} <span className="text-muted text-xs">g</span></span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-muted">Returned so far:</span>
                <span className="font-mono text-ink">{fmtG(returnedFineMg)} <span className="text-muted text-xs">g</span></span>
              </div>
              <div className="flex justify-between items-center py-1 border-t border-[#E2D3A4]/60 font-medium">
                <span className="text-ink">Outstanding after this:</span>
                <span className="font-mono font-semibold text-ink">{fmtG(outstandingAfterMg)} <span className="text-muted text-xs">g</span></span>
              </div>
              <div className="flex justify-between items-center py-0.5 text-muted">
                <span>Allowed agreed wastage:</span>
                <span className="font-mono text-muted">{fmtG(allowedWastageMg)} g</span>
              </div>
              {excessLossMg > 0 && (
                <div className="flex justify-between items-center py-0.5 text-status-problem">
                  <span>Excess unrecovered loss:</span>
                  <GoldNumber
                    value={excessLossMg}
                    type="weight"
                    size="sm"
                    align="right"
                    isExcess
                  />
                </div>
              )}
              <div className="pt-2 border-t border-[#E2D3A4]/60 flex justify-between items-center">
                <span className="text-muted">Settlement condition:</span>
                <StatusBadge
                  status={excessLossMg > 0 ? "problem" : "ok"}
                  label={settlementStatusText}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <AppShell
      title="Receive gold"
      subtitle="Receive finished jewellery, melting scrap, or bench filings against active jobs"
    >
      {loading ? (
        <LoadingState count={4} />
      ) : error ? (
        <ErrorState error={error} onRetry={fetchKarigars} />
      ) : (
        <div className="space-y-6">
          {/* Success confirmation */}
          {savedSuccess && (
            <div className="p-3.5 px-4 rounded border border-status-ok/20 bg-status-ok-tint flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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

          {/* 2-Zone Grid: Left zone 1fr (form), Right zone 400px (sticky result panel), gap 24px */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 items-start">
            {/* Left: Form */}
            <div className="bg-surface border border-border rounded p-6">
              {formError && (
                <ErrorState
                  error={formError}
                  title="Receipt submission blocked"
                  message={formError}
                  className="mb-4"
                />
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-12 gap-x-4 gap-y-4">
                  {/* Row 1: [Karigar | Receipt date] */}
                  <div className="col-span-12 sm:col-span-6 space-y-1.5">
                    <label htmlFor="karigarSelect" className="block text-sm font-medium text-ink">
                      Karigar <span className="text-muted text-xs select-none">*</span>
                    </label>
                    <select
                      id="karigarSelect"
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
                      label="Receipt date"
                      id="entryDate"
                      value={entryDate}
                      onChange={(val) => setEntryDate(val)}
                    />
                  </div>

                  {/* Row 2: [Job order] */}
                  <div className="col-span-12 space-y-1.5">
                    <label htmlFor="jobSelect" className="block text-sm font-medium text-ink">
                      Active job order <span className="text-muted text-xs select-none">*</span>
                    </label>
                    {jobs.length > 0 ? (
                      <select
                        id="jobSelect"
                        value={selectedJobId}
                        onChange={(e) => setSelectedJobId(e.target.value)}
                        className="w-full h-11 sm:h-10 px-3 bg-white border border-[#D9D1BF] rounded text-sm text-ink outline-none focus:border-bronze focus:ring-2 focus:ring-bronze"
                      >
                        {jobs.map((j) => (
                          <option key={j.id} value={j.id}>
                            {j.job_no} — {j.description || "Ornament"} (Agreed: {fmtPurity(j.wastage_bp)}%)
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="p-2.5 px-3 rounded bg-background border border-border text-xs text-muted">
                        No open jobs for this karigar.
                      </div>
                    )}
                  </div>

                  {/* Row 3: [Kind | HUID when finished] */}
                  <div className={`col-span-12 ${kind === "finished" ? "sm:col-span-6" : ""} space-y-1.5`}>
                    <label htmlFor="receiptKind" className="block text-sm font-medium text-ink">
                      Return kind <span className="text-muted text-xs select-none">*</span>
                    </label>
                    <select
                      id="receiptKind"
                      value={kind}
                      onChange={(e) => {
                        setKind(e.target.value);
                        if (e.target.value !== "finished") setHuid("");
                      }}
                      className="w-full h-11 sm:h-10 px-3 bg-white border border-[#D9D1BF] rounded text-sm text-ink outline-none focus:border-bronze focus:ring-2 focus:ring-bronze"
                    >
                      <option value="finished">Finished jewellery (BIS HUID)</option>
                      <option value="scrap">Melting scrap</option>
                      <option value="filings">Bench filings</option>
                    </select>
                  </div>

                  {kind === "finished" && (
                    <div className="col-span-12 sm:col-span-6">
                      <Field
                        label="BIS Hallmarking HUID"
                        id="huid"
                        required
                        placeholder="e.g. AB1234"
                        value={huid}
                        onChange={(e) => setHuid(e.target.value.toUpperCase())}
                        maxLength={6}
                        helperText="6-character alphanumeric identifier"
                      />
                    </div>
                  )}

                  {/* Row 4: [Gross weight | Purity] */}
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

                  {/* Photo Reader */}
                  {showPhotoReader && (
                    <div className="col-span-12">
                      <PhotoReader
                        mode="scale"
                        isOpen={true}
                        onClose={() => setShowPhotoReader(false)}
                        currentTypedValue={grossInput}
                        onReadingConfirmed={handlePhotoConfirmed}
                      />
                    </div>
                  )}

                  {/* Remarks */}
                  <div className="col-span-12">
                    <Field
                      label="Remarks (optional)"
                      id="note"
                      placeholder="e.g. Verified on analytical balance"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </div>
                </div>

                {/* Actions Row: single divider above, primary button left-aligned, disabled reason beside it */}
                <div className="pt-4 border-t border-border flex flex-wrap items-center gap-3">
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    loading={submitting}
                    disabled={previewFineMg <= 0 || !selectedJobId}
                  >
                    Confirm receipt and credit karigar
                  </Button>
                  {disabledReason && (
                    <span className="text-xs text-muted">
                      {disabledReason}
                    </span>
                  )}
                </div>
              </form>
            </div>

            {/* Right: Sticky Settlement Summary Panel (400px) */}
            <div className="hidden lg:block sticky top-6">
              <div className="bg-result-bg border border-result-border rounded p-5 space-y-4">
                <div className="pb-3 border-b border-result-border flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-ink m-0">
                    Settlement summary
                  </h3>
                  <span className="text-xs text-muted font-mono">
                    {activeJob ? activeJob.job_no : "—"}
                  </span>
                </div>
                {renderSettlementBody()}
              </div>
            </div>
          </div>

          {/* Collapsible Mobile Settlement Preview (<1024px) */}
          <div className="lg:hidden">
            <details className="bg-result-bg border border-result-border rounded p-4 group" open={hasTypedValues}>
              <summary className="text-sm font-semibold text-ink cursor-pointer list-none flex items-center justify-between select-none">
                <div className="flex items-center gap-2">
                  <span>Settlement preview</span>
                  {hasTypedValues && (
                    <span className="text-xs font-mono text-bronze font-medium">
                      {fmtG(previewFineMg)} g
                    </span>
                  )}
                </div>
                <ChevronDown className="w-4 h-4 text-muted transition-transform group-open:rotate-180" />
              </summary>
              <div className="pt-4 mt-3 border-t border-result-border">
                {renderSettlementBody()}
              </div>
            </details>
          </div>

          {/* Recent Entries Compact Table */}
          <div className="pt-2 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink m-0">
                Recent gold receipts
              </h3>
              <span className="text-xs text-muted font-mono">
                Latest {recentReceipts.length} entries
              </span>
            </div>

            {recentReceipts.length === 0 ? (
              <TableContainer>
                <EmptyState description="No receipts recorded yet" />
              </TableContainer>
            ) : (
              <TableContainer>
                <TableHead>
                  <tr>
                    <TableHeaderCell>Voucher / Txn ID</TableHeaderCell>
                    <TableHeaderCell>Date</TableHeaderCell>
                    <TableHeaderCell>Karigar</TableHeaderCell>
                    <TableHeaderCell>Job order</TableHeaderCell>
                    <TableHeaderCell>Kind</TableHeaderCell>
                    <TableHeaderCell align="right">Gross (g)</TableHeaderCell>
                    <TableHeaderCell align="right">Purity (%)</TableHeaderCell>
                    <TableHeaderCell align="right">Fine gold (g)</TableHeaderCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {recentReceipts.map((rcpt) => (
                    <TableRow key={rcpt.id}>
                      <TableCell className="font-mono font-medium">{rcpt.txn_id}</TableCell>
                      <TableCell className="text-muted">{fmtDate(rcpt.entry_date)}</TableCell>
                      <TableCell className="font-medium text-ink">{rcpt.karigar_name || "—"}</TableCell>
                      <TableCell className="font-mono">{rcpt.job_no || "—"}</TableCell>
                      <TableCell className="capitalize text-xs">{rcpt.kind}</TableCell>
                      <TableCell align="right"><GoldNumber value={rcpt.gross_mg} type="weight" size="xs" align="right" /></TableCell>
                      <TableCell align="right"><GoldNumber value={rcpt.purity_bp} type="purity" size="xs" align="right" /></TableCell>
                      <TableCell align="right"><GoldNumber value={rcpt.fine_mg} type="weight" size="xs" align="right" /></TableCell>
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
