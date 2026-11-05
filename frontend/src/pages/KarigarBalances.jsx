import React, { useState, useEffect } from "react";
import {
  Scale,
  Calendar,
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  ChevronRight,
  X,
  Lock,
} from "lucide-react";
import AppShell from "../components/layout/AppShell";
import GoldNumber from "../components/GoldNumber";
import LoadingState from "../components/LoadingState";
import ErrorState from "../components/ErrorState";
import EmptyState from "../components/EmptyState";
import { api } from "../lib/api";
import { fmtG, fmtPurity } from "../lib/format";

export default function KarigarBalances() {
  const [summaryList, setSummaryList] = useState([]);
  const [asOfDate, setAsOfDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Detail Modal State
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
      // Refresh
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
      // Refresh
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
      title="Karigar Running Gold Balances"
      subtitle="Artisan fine-gold account position, running liability, and per-job settlements"
      actions={
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <input
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            className="input-base text-xs font-mono py-1.5"
          />
        </div>
      }
    >
      {/* Top Aggregation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="card-glass p-4 border border-yellow-500/30 bg-slate-900/60">
          <span className="text-xs font-semibold text-slate-400 block">
            Total Karigar Liability
          </span>
          <div className="mt-1">
            <GoldNumber
              value={totalOutstandingMg}
              size="xl"
              highlight="gold"
            />
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            {totalOutstandingMg.toLocaleString()} mg pure gold with karigars
          </span>
        </div>

        <div className="card-glass p-4 border border-slate-800">
          <span className="text-xs font-semibold text-slate-400 block">
            Total Gold Issued
          </span>
          <div className="mt-1">
            <GoldNumber value={totalIssuedMg} size="lg" />
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            Accumulated issued bullion
          </span>
        </div>

        <div className="card-glass p-4 border border-slate-800">
          <span className="text-xs font-semibold text-slate-400 block">
            Total Gold Returned
          </span>
          <div className="mt-1">
            <GoldNumber value={totalReturnedMg} size="lg" highlight="positive" />
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            Jewellery + scrap + filings
          </span>
        </div>

        <div className="card-glass p-4 border border-slate-800">
          <span className="text-xs font-semibold text-slate-400 block">
            Active Artisans
          </span>
          <div className="mt-1 text-xl font-bold font-mono text-slate-200">
            {summaryList.length}
          </div>
          <span className="text-[11px] text-slate-500">
            Registered goldsmiths
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
        <div className="card-glass overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Karigar Name</th>
                  <th>Total Issued</th>
                  <th>Total Returned</th>
                  <th>Net Outstanding Liability</th>
                  <th>Open Jobs</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {summaryList.map((row) => (
                  <tr key={row.karigar_id}>
                    <td className="font-mono font-bold text-yellow-400">
                      {row.karigar_code}
                    </td>
                    <td className="font-medium text-slate-200">
                      {row.karigar_name}
                    </td>
                    <td>
                      <GoldNumber value={row.total_issued_fine_mg} />
                    </td>
                    <td>
                      <GoldNumber
                        value={row.total_returned_fine_mg}
                        highlight="positive"
                      />
                    </td>
                    <td>
                      <GoldNumber
                        value={row.net_outstanding_fine_mg}
                        size="md"
                        highlight={
                          row.net_outstanding_fine_mg > 0 ? "warning" : "positive"
                        }
                      />
                    </td>
                    <td>
                      <span className="badge badge-neutral">
                        {row.open_jobs_count} Open
                      </span>
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => handleOpenDetail(row)}
                        className="btn-secondary text-xs py-1.5 px-3"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Detailed Ledger
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Karigar Detailed Ledger Modal */}
      {selectedKarigar && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="card-glass w-full max-w-5xl p-6 border border-slate-700 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-yellow-500/20 text-yellow-400 flex items-center justify-center font-bold">
                  {selectedKarigar.karigar_code}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">
                    {selectedKarigar.karigar_name} — Detailed Ledger Audit
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Audit as of {asOfDate}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedKarigar(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {detailLoading || !karigarDetail ? (
              <div className="py-12">
                <LoadingState message="Loading work orders and settlement records..." />
              </div>
            ) : (
              <div className="overflow-y-auto space-y-6 pt-4 pr-1">
                {/* 1. Job Settlements Table */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Work Order Settlements ({karigarDetail.jobs.length})
                  </h4>
                  <div className="border border-slate-800 rounded-lg overflow-hidden">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Job No</th>
                          <th>Category</th>
                          <th>Wastage %</th>
                          <th>Issued</th>
                          <th>Returned</th>
                          <th>Allowed Wastage</th>
                          <th>Excess Loss</th>
                          <th>Net Outstanding</th>
                          <th>Status</th>
                          <th className="text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {karigarDetail.jobs.map((job) => {
                          const s = job.settlement;
                          return (
                            <tr key={job.job_id}>
                              <td className="font-mono font-bold text-yellow-400">
                                {job.job_no}
                              </td>
                              <td className="text-xs text-slate-300">
                                {job.category_name}
                              </td>
                              <td className="font-mono text-xs text-slate-400">
                                {fmtPurity(job.wastage_bp)}%
                              </td>
                              <td>
                                <GoldNumber value={s.issued_fine_mg} />
                              </td>
                              <td>
                                <GoldNumber
                                  value={s.returned_mg}
                                  highlight="positive"
                                />
                              </td>
                              <td>
                                <GoldNumber value={s.allowed_mg} />
                              </td>
                              <td>
                                <GoldNumber
                                  value={s.excess_mg}
                                  highlight={
                                    s.excess_mg > 0 ? "negative" : null
                                  }
                                />
                              </td>
                              <td>
                                <GoldNumber
                                  value={s.outstanding_mg}
                                  highlight={
                                    s.outstanding_mg > 0 ? "warning" : "positive"
                                  }
                                />
                              </td>
                              <td>
                                <span
                                  className={`badge ${
                                    job.status === "closed"
                                      ? "badge-neutral"
                                      : "badge-success"
                                  }`}
                                >
                                  {job.status}
                                </span>
                              </td>
                              <td className="text-right">
                                {job.status === "open" && (
                                  <button
                                    onClick={() => handleCloseJob(job.job_id)}
                                    className="btn-secondary text-[11px] py-1 px-2.5"
                                  >
                                    Close Job
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 2. Chronological Transactions Table */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Append-Only Ledger Transactions
                  </h4>
                  <div className="border border-slate-800 rounded-lg overflow-hidden">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Txn ID</th>
                          <th>Date</th>
                          <th>Type</th>
                          <th>Gross Wt</th>
                          <th>Purity</th>
                          <th>Fine Gold</th>
                          <th>HUID / Detail</th>
                          <th>Status</th>
                          <th className="text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {karigarDetail.transactions.map((txn) => (
                          <tr
                            key={txn.txn_id}
                            className={txn.is_voided ? "opacity-40 line-through" : ""}
                          >
                            <td className="font-mono font-bold text-yellow-400">
                              {txn.txn_id}
                            </td>
                            <td className="text-xs text-slate-400">
                              {txn.entry_date}
                            </td>
                            <td>
                              <span
                                className={`badge ${
                                  txn.type === "issue"
                                    ? "badge-gold"
                                    : "badge-success"
                                }`}
                              >
                                {txn.type}
                              </span>
                            </td>
                            <td>
                              <GoldNumber value={txn.gross_mg} />
                            </td>
                            <td>
                              <GoldNumber
                                value={txn.purity_bp}
                                type="purity"
                              />
                            </td>
                            <td className="font-bold">
                              <GoldNumber
                                value={txn.fine_mg}
                                highlight="gold"
                              />
                            </td>
                            <td className="text-xs font-mono text-slate-300">
                              {txn.huid || txn.note || "—"}
                            </td>
                            <td>
                              {txn.is_voided ? (
                                <span className="badge badge-danger">
                                  Voided
                                </span>
                              ) : (
                                <span className="badge badge-success">
                                  Valid
                                </span>
                              )}
                            </td>
                            <td className="text-right">
                              {!txn.is_voided && (
                                <button
                                  onClick={() =>
                                    setVoidTarget({
                                      type: txn.type,
                                      id: txn.id,
                                      txn_id: txn.txn_id,
                                    })
                                  }
                                  className="btn-danger text-[10px] py-1 px-2"
                                >
                                  Void Entry
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Void Modal Confirmation */}
      {voidTarget && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
          <div className="card-glass w-full max-w-md p-6 border border-rose-800">
            <h3 className="text-base font-bold text-rose-400 flex items-center gap-2">
              <RotateCcw className="w-4 h-4" />
              Void Transaction {voidTarget.txn_id}
            </h3>
            <p className="text-xs text-slate-300 mt-2">
              Ledger transactions are strictly append-only. Voiding this entry will permanently mark it void in the audit trail and neutralize its balance effect.
            </p>

            {voidError && (
              <div className="mt-3 p-2.5 rounded bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">
                {voidError}
              </div>
            )}

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Mandatory Reason for Void (Min 5 chars)
              </label>
              <textarea
                rows={3}
                required
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="e.g. Weigh scale tare button error during issue"
                className="input-base text-xs"
              />
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setVoidTarget(null)}
                className="btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmVoid}
                disabled={voidLoading || voidReason.trim().length < 5}
                className="btn-danger text-xs"
              >
                {voidLoading ? "Recording Void..." : "Confirm Void Entry"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
