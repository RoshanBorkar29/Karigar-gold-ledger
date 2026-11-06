import React, { useState, useEffect } from "react";
import {
  Download,
  Calendar,
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
      <AppShell title="Access Restricted">
        <div className="p-8 text-center max-w-md mx-auto my-12 bg-surface border border-border rounded">
          <div className="w-10 h-10 rounded-full bg-status-problem-tint text-status-problem flex items-center justify-center mx-auto mb-3">
            <Lock className="w-5 h-5 stroke-[2]" />
          </div>
          <h2 className="text-base font-semibold text-ink m-0">
            Finance Head Access Only
          </h2>
          <p className="text-xs text-muted mt-2 m-0 leading-relaxed">
            Consolidated daily bullion stock position and Tally ERP financial exports are confidential controls restricted to workshop management.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Daily Bullion Stock Position"
      subtitle="Consolidated fine-gold stock statement across vault, active artisan workbenches, and external refiners"
      actions={
        <div className="flex items-center gap-3">
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

          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportCsv}
            disabled={!statement}
            loading={exporting}
            icon={Download}
          >
            Export Tally CSV
          </Button>
        </div>
      }
    >
      {loading ? (
        <LoadingState message="Aggregating workshop bullion stock..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchStock} />
      ) : statement ? (
        <div className="space-y-6">
          {/* 4 Plain Figures at the top */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-surface border border-border rounded flex flex-col justify-between">
              <span className="text-xs text-muted font-medium">
                In Vault
              </span>
              <div className="my-2">
                <GoldNumber
                  value={statement.vault_fine_mg}
                  size="xl"
                  isKeyBalance
                />
              </div>
              <span className="text-xs text-muted">
                Main workshop strongroom
              </span>
            </div>

            <div className="p-4 bg-surface border border-border rounded flex flex-col justify-between">
              <span className="text-xs text-muted font-medium">
                With Karigars
              </span>
              <div className="my-2">
                <GoldNumber
                  value={statement.karigars_fine_mg}
                  size="xl"
                  isKeyBalance
                />
              </div>
              <span className="text-xs text-muted">
                Work-in-progress on artisan benches
              </span>
            </div>

            <div className="p-4 bg-surface border border-border rounded flex flex-col justify-between">
              <span className="text-xs text-muted font-medium">
                At Refiner
              </span>
              <div className="my-2">
                <GoldNumber
                  value={statement.refiner_fine_mg}
                  size="xl"
                  isKeyBalance
                />
              </div>
              <span className="text-xs text-muted">
                Scrap recovery lots pending return
              </span>
            </div>

            <div className="p-4 bg-surface border border-border rounded flex flex-col justify-between">
              <span className="text-xs text-muted font-medium">
                Total Bullion Stock
              </span>
              <div className="my-2">
                <GoldNumber
                  value={statement.total_fine_mg}
                  size="xl"
                  isKeyBalance
                  className="text-bronze"
                />
              </div>
              <span className="text-xs text-muted">
                Consolidated pure gold inventory
              </span>
            </div>
          </div>

          {/* Vault Bullion Movement Form */}
          <div className="p-5 bg-surface border border-border rounded space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-bronze stroke-[2]" />
                <h3 className="text-sm font-semibold text-ink m-0">
                  Record Vault Bullion Movement
                </h3>
              </div>
              <span className="text-xs text-muted font-mono">
                Finance Operation
              </span>
            </div>

            {movementSuccess && (
              <div className="p-3 rounded bg-status-ok-tint border border-status-ok/20 text-status-ok text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-status-ok stroke-[2]" />
                <span>{movementSuccess}</span>
              </div>
            )}

            {movementError && (
              <div className="p-3 rounded bg-status-problem-tint border border-status-problem/20 text-status-problem text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-status-problem stroke-[2]" />
                <span>{movementError}</span>
              </div>
            )}

            <form onSubmit={handleRecordMovement} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="movementKind" className="block text-sm font-medium text-ink mb-1.5">
                    Movement Kind <span className="text-status-problem">*</span>
                  </label>
                  <select
                    id="movementKind"
                    value={movementKind}
                    onChange={(e) => setMovementKind(e.target.value)}
                    className="w-full h-11 px-3 bg-surface border border-border rounded text-sm text-ink outline-none focus:border-bronze focus:ring-2 focus:ring-bronze/20"
                  >
                    <option value="bullion_in">Bullion In (Vault Deposit)</option>
                    <option value="to_refiner">To Refiner (Scrap Recovery)</option>
                    <option value="from_refiner">From Refiner (Pure Gold In)</option>
                  </select>
                </div>

                <div>
                  <Field
                    label="Fine Weight"
                    id="movementWeight"
                    required
                    placeholder="100.000"
                    value={movementWeightInput}
                    onChange={(e) => setMovementWeightInput(e.target.value)}
                    helperText="In grams (up to 3 decimals)"
                  />
                </div>

                <div>
                  <Field
                    label="Entry Date"
                    id="movementDate"
                    type="date"
                    required
                    value={movementDate}
                    onChange={(e) => setMovementDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Field
                  label="Reference Note (Optional)"
                  id="movementNote"
                  placeholder="e.g. MMTC Bullion invoice #8841 or refinery batch lot #12"
                  value={movementNote}
                  onChange={(e) => setMovementNote(e.target.value)}
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  loading={submittingMovement}
                  icon={PlusCircle}
                >
                  Commit Vault Movement
                </Button>
              </div>
            </form>
          </div>

          {/* Workbench Stock Breakdown Table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-ink m-0">
                  Artisan Workbench Stock Breakdown
                </h3>
                <p className="text-xs text-muted mt-0.5 m-0">
                  Fine gold distributed across active goldsmith workbenches as of {asOfDate}
                </p>
              </div>
              <span className="text-xs text-muted font-mono">
                {statement.karigars_breakdown?.length || 0} Karigars
              </span>
            </div>

            <TableContainer>
              <TableHead>
                <tr>
                  <TableHeaderCell>Artisan Code</TableHeaderCell>
                  <TableHeaderCell>Full Name</TableHeaderCell>
                  <TableHeaderCell align="right">Total Issued</TableHeaderCell>
                  <TableHeaderCell align="right">Total Returned</TableHeaderCell>
                  <TableHeaderCell align="right">Current Balance</TableHeaderCell>
                  <TableHeaderCell align="center">Open Jobs</TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {statement.karigars_breakdown?.map((row) => (
                  <TableRow key={row.karigar_id}>
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
                        negativeLabel="Surplus"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <StatusBadge
                        status={row.open_jobs_count > 0 ? "open" : "ok"}
                        label={`${row.open_jobs_count} open`}
                      />
                    </TableCell>
                  </TableRow>
                ))}

                {/* Total Row */}
                <TableRow isTotal>
                  <TableCell colSpan={2} className="font-semibold text-ink">
                    Total In Artisans Custody
                  </TableCell>
                  <TableCell align="right">
                    <GoldNumber
                      value={statement.karigars_breakdown?.reduce((acc, r) => acc + (r.total_issued_fine_mg || 0), 0) || 0}
                      align="right"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <GoldNumber
                      value={statement.karigars_breakdown?.reduce((acc, r) => acc + (r.total_returned_fine_mg || 0), 0) || 0}
                      align="right"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <GoldNumber
                      value={statement.karigars_fine_mg}
                      size="base"
                      align="right"
                    />
                  </TableCell>
                  <TableCell align="center" className="text-xs text-muted font-mono">
                    {statement.karigars_breakdown?.reduce((acc, r) => acc + (r.open_jobs_count || 0), 0) || 0} open
                  </TableCell>
                </TableRow>
              </TableBody>
            </TableContainer>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
