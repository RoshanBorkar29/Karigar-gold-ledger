import React, { useState, useEffect } from "react";
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Vault,
  Hammer,
  Flame,
  Scale,
  Lock,
  ArrowRightLeft,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
} from "lucide-react";
import AppShell from "../components/layout/AppShell";
import GoldNumber from "../components/GoldNumber";
import LoadingState from "../components/LoadingState";
import ErrorState from "../components/ErrorState";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { parseG } from "../lib/format";

export default function DailyStock() {
  const { isFinanceHead } = useAuth();

  const [statement, setStatement] = useState(null);
  const [asOfDate, setAsOfDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Vault Movement Form states
  const [movementKind, setMovementKind] = useState("bullion_in");
  const [movementWeightInput, setMovementWeightInput] = useState("");
  const [movementDate, setMovementDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [movementNote, setMovementNote] = useState("");
  const [submittingMovement, setSubmittingMovement] = useState(false);
  const [movementError, setMovementError] = useState(null);
  const [movementSuccess, setMovementSuccess] = useState(null);

  const fetchStock = async () => {
    if (!isFinanceHead) return;
    try {
      setLoading(true);
      setError(null);
      const data = await api.getDailyStock(asOfDate);
      setStatement(data);
    } catch (err) {
      setError(err.message || "Failed to load stock statement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStock();
  }, [asOfDate, isFinanceHead]);

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      await api.exportTallyCsv(asOfDate);
    } catch (err) {
      alert("Export failed: " + err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleRecordMovement = async (e) => {
    e.preventDefault();
    setMovementError(null);
    setMovementSuccess(null);

    let fineMg;
    try {
      fineMg = parseG(movementWeightInput);
    } catch (err) {
      setMovementError(err.message || "Invalid weight format");
      return;
    }

    if (fineMg <= 0) {
      setMovementError("Fine gold weight must be strictly positive");
      return;
    }

    setSubmittingMovement(true);
    try {
      await api.createVaultMovement({
        kind: movementKind,
        fine_mg: fineMg,
        entry_date: movementDate,
        note: movementNote.trim() || undefined,
      });

      setMovementSuccess("Vault bullion movement recorded successfully.");
      setMovementWeightInput("");
      setMovementNote("");
      fetchStock();
    } catch (err) {
      setMovementError(err.message || "Failed to record vault movement");
    } finally {
      setSubmittingMovement(false);
    }
  };

  if (!isFinanceHead) {
    return (
      <AppShell title="Access Denied">
        <div className="card-glass p-8 text-center max-w-md mx-auto my-12 border border-rose-900/60">
          <Lock className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-100">
            Owner & Finance Head Access Only
          </h2>
          <p className="text-xs text-slate-400 mt-2">
            Consolidated daily bullion stock position and Tally ERP financial exports are confidential controls restricted to workshop management.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Daily Bullion Stock Statement"
      subtitle="Consolidated fine-gold stock position across vault, active artisan workbenches, and external refiners"
      actions={
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="input-base text-xs font-mono py-1.5"
            />
          </div>

          <button
            onClick={handleExportCsv}
            disabled={exporting || !statement}
            className="btn-gold text-xs py-2 px-3"
          >
            <Download className="w-3.5 h-3.5" />
            {exporting ? "Generating CSV..." : "Export Tally CSV"}
          </button>
        </div>
      }
    >
      {loading ? (
        <LoadingState message="Aggregating workshop bullion stock..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchStock} />
      ) : statement ? (
        <div className="space-y-6">
          {/* 4 Macro Stock Position Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* 1. Vault */}
            <div className="card-glass p-5 border border-yellow-500/30 bg-slate-900/70">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">
                  Main Workshop Vault
                </span>
                <Vault className="w-5 h-5 text-yellow-400" />
              </div>
              <div className="mt-3">
                <GoldNumber
                  value={statement.vault_fine_mg}
                  size="xl"
                  highlight="gold"
                />
              </div>
              <span className="text-[11px] text-slate-500 font-mono block mt-1">
                {statement.vault_fine_mg.toLocaleString()} mg pure bullion
              </span>
            </div>

            {/* 2. In Hands of Karigars */}
            <div className="card-glass p-5 border border-slate-800 bg-slate-900/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">
                  With Artisans (Work in Progress)
                </span>
                <Hammer className="w-5 h-5 text-amber-400" />
              </div>
              <div className="mt-3">
                <GoldNumber
                  value={statement.karigars_fine_mg}
                  size="xl"
                  highlight="warning"
                />
              </div>
              <span className="text-[11px] text-slate-500 font-mono block mt-1">
                {statement.karigars_fine_mg.toLocaleString()} mg on benches
              </span>
            </div>

            {/* 3. At Refiner */}
            <div className="card-glass p-5 border border-slate-800 bg-slate-900/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">
                  At External Refiner
                </span>
                <Flame className="w-5 h-5 text-rose-400" />
              </div>
              <div className="mt-3">
                <GoldNumber
                  value={statement.refiner_fine_mg}
                  size="xl"
                  highlight={statement.refiner_fine_mg > 0 ? "warning" : null}
                />
              </div>
              <span className="text-[11px] text-slate-500 font-mono block mt-1">
                {statement.refiner_fine_mg.toLocaleString()} mg refining
              </span>
            </div>

            {/* 4. Total Bullion Position */}
            <div className="card-glass p-5 border border-yellow-500/50 bg-gradient-to-br from-yellow-500/10 via-slate-900 to-slate-950">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider">
                  Total Gold Stock
                </span>
                <Scale className="w-5 h-5 text-yellow-400" />
              </div>
              <div className="mt-3">
                <GoldNumber
                  value={statement.total_fine_mg}
                  size="xl"
                  highlight="gold"
                />
              </div>
              <span className="text-[11px] text-yellow-300/80 font-mono block mt-1">
                {statement.total_fine_mg.toLocaleString()} mg total pure
              </span>
            </div>
          </div>

          {/* Vault Bullion Movement Form (Finance Head Only) */}
          <div className="card-glass p-5 border border-slate-800 bg-slate-900/60 rounded-lg space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-yellow-400" />
                <h3 className="text-sm font-semibold text-slate-100">
                  Record Vault Bullion Movement
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                Finance Operation
              </span>
            </div>

            {movementSuccess && (
              <div className="p-3 rounded bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{movementSuccess}</span>
              </div>
            )}

            {movementError && (
              <div className="p-3 rounded bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{movementError}</span>
              </div>
            )}

            <form onSubmit={handleRecordMovement} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Movement Kind
                </label>
                <select
                  value={movementKind}
                  onChange={(e) => setMovementKind(e.target.value)}
                  className="input-base"
                >
                  <option value="bullion_in">Bullion In (Vault Deposit)</option>
                  <option value="to_refiner">To Refiner (Scrap Recovery)</option>
                  <option value="from_refiner">From Refiner (Pure Gold In)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Fine Weight (Grams)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="100.000"
                    value={movementWeightInput}
                    onChange={(e) => setMovementWeightInput(e.target.value)}
                    className="input-base font-mono pr-8"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-mono">
                    g
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Entry Date
                </label>
                <input
                  type="date"
                  required
                  value={movementDate}
                  onChange={(e) => setMovementDate(e.target.value)}
                  className="input-base font-mono"
                />
              </div>

              <div>
                <button
                  type="submit"
                  disabled={submittingMovement}
                  className="w-full btn-gold py-2.5 text-xs flex items-center justify-center gap-2"
                >
                  <PlusCircle className="w-4 h-4" />
                  {submittingMovement ? "Writing to Vault..." : "Commit Movement"}
                </button>
              </div>

              <div className="md:col-span-4">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Reference Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. MMTC Bullion invoice #8841 or refinery batch lot #12"
                  value={movementNote}
                  onChange={(e) => setMovementNote(e.target.value)}
                  className="input-base text-xs"
                />
              </div>
            </form>
          </div>

          {/* Breakdown Table of Gold with Karigars */}
          <div className="card-glass overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  Artisan Workbench Stock Breakdown
                </h3>
                <p className="text-xs text-slate-400">
                  Fine gold distributed across active goldsmith workbenches as of {asOfDate}
                </p>
              </div>
              <span className="badge badge-gold font-mono text-xs">
                {statement.karigars_breakdown?.length || 0} Karigars
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Artisan Code</th>
                    <th>Full Name</th>
                    <th>Total Fine Gold Issued</th>
                    <th>Total Fine Gold Returned</th>
                    <th>Current Workbench Balance</th>
                    <th>Open Jobs</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.karigars_breakdown?.map((row) => (
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
                      <td className="font-bold">
                        <GoldNumber
                          value={row.net_outstanding_fine_mg}
                          highlight={
                            row.net_outstanding_fine_mg > 0
                              ? "warning"
                              : "positive"
                          }
                        />
                      </td>
                      <td>
                        <span className="badge badge-neutral">
                          {row.open_jobs_count} Open
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
