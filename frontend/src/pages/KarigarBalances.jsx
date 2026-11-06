import React, { useState, useEffect } from "react";
import {
  Calendar,
  Eye,
  RotateCcw,
  X,
  Lock,
  ArrowRight,
  SlidersHorizontal,
} from "lucide-react";
import AppShell from "../components/layout/AppShell";
import GoldNumber from "../components/GoldNumber";
import LoadingState from "../components/LoadingState";
import ErrorState from "../components/ErrorState";
import EmptyState from "../components/EmptyState";
import Button from "../components/ui/Button";
import Field from "../components/ui/Field";
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
import { fmtPurity } from "../lib/format";

export default function KarigarBalances() {
  const [summaryList, setSummaryList] = useState([]);
  const [asOfDate, setAsOfDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Detail Drawer State
  const [selectedKarigar, setSelectedKarigar] = useState(null);
  const [karigarDetail, setKarigarDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Voiding State
  const [voidTarget, setVoidTarget] = useState(null); // { type: 'issue'|'receipt', id: number, txn_id: string }
  const [voidReason, setVoidReason] = useState("");
  const [voidLoading, setVoidLoading] = useState(false);
  const [voidError, setVoidError] = useState(null);

  const fetchBalances = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getKarigarBalancesSummary(asOfDate);
      setSummaryList(data);
    } catch (err) {
      setError(err.message || "Failed to load karigar balances");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalances();
  }, [asOfDate]);

  const handleOpenDetail = async (karigarSummary) => {
    setSelectedKarigar(karigarSummary);
    setDetailLoading(true);
    try {
      const detail = await api.getKarigarDetail(
        karigarSummary.karigar_id,
        asOfDate
      );
      setKarigarDetail(detail);
    } catch (err) {
      alert("Failed to load karigar ledger details: " + err.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseJob = async (jobId) => {
    if (!confirm("Are you sure you want to officially close and settle this job?")) {
      return;
    }
    try {
      await api.closeJob(jobId);
      if (selectedKarigar) {
        const detail = await api.getKarigarDetail(
          selectedKarigar.karigar_id,
          asOfDate
        );
        setKarigarDetail(detail);
      }
      fetchBalances();
    } catch (err) {
      alert("Failed to close job: " + err.message);
    }
  };

  const handleConfirmVoid = async () => {
    if (!voidTarget || voidReason.trim().length < 5) {
      setVoidError("Void reason must be at least 5 characters long.");
      return;
    }
    setVoidLoading(true);
    setVoidError(null);
    try {
      if (voidTarget.type === "issue") {
        await api.voidIssue(voidTarget.id, voidReason.trim());
      } else {
        await api.voidReceipt(voidTarget.id, voidReason.trim());
      }
      setVoidTarget(null);
      setVoidReason("");
      if (selectedKarigar) {
        const detail = await api.getKarigarDetail(
          selectedKarigar.karigar_id,
          asOfDate
        );
        setKarigarDetail(detail);
      }
      fetchBalances();
    } catch (err) {
      setVoidError(err.message || "Failed to void entry");
    } finally {
      setVoidLoading(false);
    }
  };

  // Grand totals
  const totalIssuedMg = summaryList.reduce((acc, row) => acc + (row.total_issued_fine_mg || 0), 0);
  const totalReturnedMg = summaryList.reduce((acc, row) => acc + (row.total_returned_fine_mg || 0), 0);
  const totalOutstandingMg = summaryList.reduce((acc, row) => acc + (row.net_outstanding_fine_mg || 0), 0);

  return (
    <AppShell
      title="Karigar Gold Balances"
      subtitle="Artisan fine-gold account position, running liability, and per-job settlements"
      actions={
        <div className="flex items-center gap-2">
          <label htmlFor="asOfDate" className="text-xs text-muted font-medium select-none">
            As of:
          </label>
          <input
            id="asOfDate"
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            className="h-9 px-3 bg-surface border border-border rounded text-xs font-mono text-ink outline-none focus:border-bronze focus:ring-2 focus:ring-bronze/20"
          />
        </div>
      }
    >
      {/* Top Aggregation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-surface border border-border rounded flex flex-col justify-between">
          <span className="text-xs text-muted font-medium">
            Total Karigar Liability
          </span>
          <div className="my-2">
            <GoldNumber
              value={totalOutstandingMg}
              size="xl"
              isKeyBalance
            />
          </div>
          <span className="text-xs text-muted">
            Pure gold currently in artisan custody
          </span>
        </div>

        <div className="p-4 bg-surface border border-border rounded flex flex-col justify-between">
          <span className="text-xs text-muted font-medium">
            Total Gold Issued
          </span>
          <div className="my-2">
            <GoldNumber value={totalIssuedMg} size="base" />
          </div>
          <span className="text-xs text-muted">
            Accumulated fine gold issued
          </span>
        </div>

        <div className="p-4 bg-surface border border-border rounded flex flex-col justify-between">
          <span className="text-xs text-muted font-medium">
            Total Gold Returned
          </span>
          <div className="my-2">
            <GoldNumber value={totalReturnedMg} size="base" />
          </div>
          <span className="text-xs text-muted">
            Finished ornaments & recovered scrap
          </span>
        </div>

        <div className="p-4 bg-surface border border-border rounded flex flex-col justify-between">
          <span className="text-xs text-muted font-medium">
            Active Artisans
          </span>
          <div className="my-2">
            <span className="font-mono text-xl font-semibold text-ink">
              {summaryList.length}
            </span>
          </div>
          <span className="text-xs text-muted">
            Goldsmiths on record
          </span>
        </div>
      </div>

      {loading ? (
        <LoadingState message="Calculating artisan running balances..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchBalances} />
      ) : summaryList.length === 0 ? (
        <EmptyState
          title="No Karigar Activity"
          description="No issues or receipts recorded as of this date."
        />
      ) : (
        <TableContainer>
          <TableHead>
            <tr>
              <TableHeaderCell>Code</TableHeaderCell>
              <TableHeaderCell>Karigar Name</TableHeaderCell>
              <TableHeaderCell align="right">Total Issued</TableHeaderCell>
              <TableHeaderCell align="right">Total Returned</TableHeaderCell>
              <TableHeaderCell align="right">Net Outstanding Balance</TableHeaderCell>
              <TableHeaderCell align="center">Open Jobs</TableHeaderCell>
              <TableHeaderCell align="right">Action</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {summaryList.map((row) => (
              <TableRow
                key={row.karigar_id}
                onClick={() => handleOpenDetail(row)}
              >
                <TableCell className="font-mono font-medium text-ink">
                  {row.karigar_code}
                </TableCell>
                <TableCell className="font-medium text-ink">
                  {row.karigar_name}
                </TableCell>
                <TableCell align="right">
                  <GoldNumber value={row.total_issued_fine_mg} align="right" />
                </TableCell>
                <TableCell align="right">
                  <GoldNumber value={row.total_returned_fine_mg} align="right" />
                </TableCell>
                <TableCell align="right">
                  <GoldNumber
                    value={row.net_outstanding_fine_mg}
                    size="base"
                    align="right"
                    isNegative={row.net_outstanding_fine_mg < 0}
                    negativeLabel="Artisan surplus"
                  />
                </TableCell>
                <TableCell align="center">
                  <StatusBadge
                    status={row.open_jobs_count > 0 ? "open" : "closed"}
                    label={`${row.open_jobs_count} open`}
                  />
                </TableCell>
                <TableCell align="right">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenDetail(row);
                    }}
                    icon={Eye}
                  >
                    Ledger
                  </Button>
                </TableCell>
              </TableRow>
            ))}

            {/* Total Summary Row */}
            <TableRow isTotal>
              <TableCell colSpan={2} className="font-semibold text-ink">
                Total Workshop Balance
              </TableCell>
              <TableCell align="right">
                <GoldNumber value={totalIssuedMg} align="right" />
              </TableCell>
              <TableCell align="right">
                <GoldNumber value={totalReturnedMg} align="right" />
              </TableCell>
              <TableCell align="right">
                <GoldNumber
                  value={totalOutstandingMg}
                  size="base"
                  align="right"
                  isNegative={totalOutstandingMg < 0}
                />
              </TableCell>
              <TableCell align="center" className="text-xs text-muted font-mono">
                {summaryList.reduce((acc, r) => acc + (r.open_jobs_count || 0), 0)} open
              </TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </TableContainer>
      )}

      {/* Karigar Detailed Ledger Drawer / Modal */}
      {selectedKarigar && (
        <div className="fixed inset-0 bg-ink/40 z-50 flex justify-end">
          <div
            className="fixed inset-0"
            onClick={() => setSelectedKarigar(null)}
          />
          <div className="relative w-full max-w-4xl bg-surface h-full shadow-lg border-l border-border flex flex-col z-10 overflow-hidden">
            {/* Drawer Header */}
            <div className="p-6 border-b border-border flex items-center justify-between shrink-0 bg-surface">
              <div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm px-2 py-0.5 rounded bg-background border border-border text-ink font-semibold">
                    {selectedKarigar.karigar_code}
                  </span>
                  <h2 className="text-xl font-semibold text-ink m-0">
                    {selectedKarigar.karigar_name}
                  </h2>
                </div>
                <p className="text-xs text-muted mt-1 m-0">
                  Detailed ledger & work order audit as of {asOfDate}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedKarigar(null)}
                className="w-9 h-9 rounded flex items-center justify-center text-muted hover:text-ink hover:bg-background transition"
                aria-label="Close drawer"
              >
                <X className="w-5 h-5 stroke-[1.75]" />
              </button>
            </div>

            {/* Drawer Content */}
            {detailLoading || !karigarDetail ? (
              <div className="flex-1 p-6">
                <LoadingState message="Loading work orders and settlement records..." />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* 1. Job Settlements Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-ink m-0">
                      Work Order Settlements ({karigarDetail.jobs.length})
                    </h3>
                  </div>

                  {karigarDetail.jobs.length === 0 ? (
                    <div className="p-4 bg-background border border-border rounded text-xs text-muted text-center">
                      No jobs recorded for this artisan.
                    </div>
                  ) : (
                    <TableContainer>
                      <TableHead>
                        <tr>
                          <TableHeaderCell>Job No</TableHeaderCell>
                          <TableHeaderCell>Category</TableHeaderCell>
                          <TableHeaderCell align="right">Wastage %</TableHeaderCell>
                          <TableHeaderCell align="right">Issued</TableHeaderCell>
                          <TableHeaderCell align="right">Returned</TableHeaderCell>
                          <TableHeaderCell align="right">Allowed</TableHeaderCell>
                          <TableHeaderCell align="right">Excess</TableHeaderCell>
                          <TableHeaderCell align="right">Outstanding</TableHeaderCell>
                          <TableHeaderCell align="center">Status</TableHeaderCell>
                          <TableHeaderCell align="right">Action</TableHeaderCell>
                        </tr>
                      </TableHead>
                      <TableBody>
                        {karigarDetail.jobs.map((job) => {
                          const s = job.settlement;
                          return (
                            <TableRow key={job.job_id}>
                              <TableCell className="font-mono font-medium text-ink">
                                {job.job_no}
                              </TableCell>
                              <TableCell className="text-xs text-ink">
                                {job.category_name}
                              </TableCell>
                              <TableCell align="right" className="font-mono text-xs text-muted">
                                {fmtPurity(job.wastage_bp)}%
                              </TableCell>
                              <TableCell align="right">
                                <GoldNumber value={s.issued_fine_mg} align="right" />
                              </TableCell>
                              <TableCell align="right">
                                <GoldNumber value={s.returned_mg} align="right" />
                              </TableCell>
                              <TableCell align="right">
                                <GoldNumber value={s.allowed_mg} align="right" />
                              </TableCell>
                              <TableCell align="right">
                                <GoldNumber
                                  value={s.excess_mg}
                                  align="right"
                                  isExcess={s.excess_mg > 0}
                                />
                              </TableCell>
                              <TableCell align="right">
                                <GoldNumber
                                  value={s.outstanding_mg}
                                  align="right"
                                  isNegative={s.outstanding_mg < 0}
                                />
                              </TableCell>
                              <TableCell align="center">
                                <StatusBadge
                                  status={job.status}
                                  label={job.status}
                                />
                              </TableCell>
                              <TableCell align="right">
                                {job.status === "open" && (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => handleCloseJob(job.job_id)}
                                  >
                                    Close Job
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </TableContainer>
                  )}
                </div>

                {/* 2. Chronological Transactions Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-ink m-0">
                      Append-Only Transactions ({karigarDetail.transactions.length})
                    </h3>
                  </div>

                  {karigarDetail.transactions.length === 0 ? (
                    <div className="p-4 bg-background border border-border rounded text-xs text-muted text-center">
                      No transactions recorded.
                    </div>
                  ) : (
                    <TableContainer>
                      <TableHead>
                        <tr>
                          <TableHeaderCell>Txn ID</TableHeaderCell>
                          <TableHeaderCell>Date</TableHeaderCell>
                          <TableHeaderCell align="center">Type</TableHeaderCell>
                          <TableHeaderCell align="right">Gross Wt</TableHeaderCell>
                          <TableHeaderCell align="right">Purity</TableHeaderCell>
                          <TableHeaderCell align="right">Fine Gold</TableHeaderCell>
                          <TableHeaderCell>HUID / Note</TableHeaderCell>
                          <TableHeaderCell align="center">Status</TableHeaderCell>
                          <TableHeaderCell align="right">Action</TableHeaderCell>
                        </tr>
                      </TableHead>
                      <TableBody>
                        {karigarDetail.transactions.map((txn) => (
                          <TableRow
                            key={txn.txn_id}
                            className={txn.is_voided ? "opacity-40 line-through" : ""}
                          >
                            <TableCell className="font-mono font-medium text-ink">
                              {txn.txn_id}
                            </TableCell>
                            <TableCell className="text-xs text-muted whitespace-nowrap">
                              {txn.entry_date}
                            </TableCell>
                            <TableCell align="center">
                              <StatusBadge
                                status={txn.type === "issue" ? "review" : "ok"}
                                label={txn.type}
                              />
                            </TableCell>
                            <TableCell align="right">
                              <GoldNumber value={txn.gross_mg} align="right" />
                            </TableCell>
                            <TableCell align="right">
                              <GoldNumber
                                value={txn.purity_bp}
                                type="purity"
                                align="right"
                              />
                            </TableCell>
                            <TableCell align="right" className="font-medium">
                              <GoldNumber value={txn.fine_mg} align="right" />
                            </TableCell>
                            <TableCell className="text-xs font-mono text-muted max-w-xs truncate">
                              {txn.huid || txn.note || "—"}
                            </TableCell>
                            <TableCell align="center">
                              <StatusBadge
                                status={txn.is_voided ? "problem" : "ok"}
                                label={txn.is_voided ? "Voided" : "Valid"}
                              />
                            </TableCell>
                            <TableCell align="right">
                              {!txn.is_voided && (
                                <Button
                                  variant="danger"
                                  size="sm"
                                  onClick={() =>
                                    setVoidTarget({
                                      type: txn.type,
                                      id: txn.id,
                                      txn_id: txn.txn_id,
                                    })
                                  }
                                >
                                  Void
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </TableContainer>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Void Modal Confirmation */}
      {voidTarget && (
        <div className="fixed inset-0 bg-ink/50 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-surface p-6 border border-status-problem/40 rounded shadow-lg">
            <h3 className="text-base font-semibold text-status-problem flex items-center gap-2 m-0">
              <RotateCcw className="w-4 h-4 stroke-[2]" />
              Void Transaction {voidTarget.txn_id}
            </h3>
            <p className="text-xs text-muted mt-2 m-0">
              Ledger transactions are strictly append-only. Voiding this entry will permanently mark it void in the audit trail and neutralize its effect on the karigar balance.
            </p>

            {voidError && (
              <div className="mt-3 p-2.5 rounded bg-status-problem-tint border border-status-problem/20 text-status-problem text-xs">
                {voidError}
              </div>
            )}

            <div className="mt-4">
              <Field
                label="Mandatory Reason for Void (Min 5 chars)"
                id="voidReason"
                type="textarea"
                required
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="e.g. Weigh scale tare error during morning issue"
              />
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setVoidTarget(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleConfirmVoid}
                loading={voidLoading}
                disabled={voidReason.trim().length < 5}
              >
                Confirm Void Entry
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
