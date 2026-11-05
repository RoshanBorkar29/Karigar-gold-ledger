import React, { useState, useEffect } from "react";
import {
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  CheckCircle,
  XCircle,
  RefreshCw,
  Search,
  MessageSquare,
  Lock,
} from "lucide-react";
import AppShell from "../components/layout/AppShell";
import GoldNumber from "../components/GoldNumber";
import LoadingState from "../components/LoadingState";
import ErrorState from "../components/ErrorState";
import EmptyState from "../components/EmptyState";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { fmtPurity } from "../lib/format";

export default function LossAlerts() {
  const { isFinanceHead } = useAuth();

  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [scanning, setScanning] = useState(false);

  // AI Explanation Modal State
  const [selectedAlertForAi, setSelectedAlertForAi] = useState(null);
  const [aiNotes, setAiNotes] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState(null);

  // Review Modal State
  const [reviewAlertTarget, setReviewAlertTarget] = useState(null);
  const [reviewStatus, setReviewStatus] = useState("reviewed");
  const [reviewNote, setReviewNote] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);

  const fetchAlerts = async () => {
    if (!isFinanceHead) return;
    try {
      setLoading(true);
      setError(null);
      const data = await api.getAlerts(
        statusFilter === "all" ? undefined : statusFilter
      );
      setAlerts(data);
    } catch (err) {
      setError(err.message || "Failed to load loss alerts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [statusFilter, isFinanceHead]);

  const handleTriggerScan = async () => {
    setScanning(true);
    try {
      await api.triggerAlertScan();
      await fetchAlerts();
    } catch (err) {
      alert("Failed to run anomaly scan: " + err.message);
    } finally {
      setScanning(false);
    }
  };

  const handleRequestAiExplanation = async () => {
    if (!selectedAlertForAi) return;
    setAiLoading(true);
    try {
      const res = await api.explainLoss(
        selectedAlertForAi.karigar_id,
        selectedAlertForAi.job_id,
        aiNotes.trim() || undefined
      );
      setAiResponse(res);
      // Refresh list to update explanation
      fetchAlerts();
    } catch (err) {
      alert("Failed to generate AI explanation: " + err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveReview = async () => {
    if (!reviewAlertTarget) return;
    setReviewLoading(true);
    try {
      await api.reviewAlert(
        reviewAlertTarget.id,
        reviewStatus,
        reviewNote.trim() || undefined
      );
      setReviewAlertTarget(null);
      setReviewNote("");
      fetchAlerts();
    } catch (err) {
      alert("Failed to review alert: " + err.message);
    } finally {
      setReviewLoading(false);
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
            Loss-drift statistical alerts and artisan wastage variance calculations are confidential financial controls restricted to workshop management.
          </p>
        </div>
      </AppShell>
    );
  }

  const openCount = alerts.filter((a) => a.status === "open").length;
  const reviewedCount = alerts.filter((a) => a.status === "reviewed").length;

  return (
    <AppShell
      title="Loss-Drift Alerts & AI Craft Audit"
      subtitle="Early warning system flagging abnormal artisan wastage before month-end reconciliation"
      actions={
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-base text-xs py-2"
          >
            <option value="all">All Alerts</option>
            <option value="open">Open Only</option>
            <option value="reviewed">Reviewed</option>
            <option value="dismissed">Dismissed</option>
          </select>

          <button
            onClick={handleTriggerScan}
            disabled={scanning}
            className="btn-gold text-xs py-2 px-3"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${scanning ? "animate-spin" : ""}`}
            />
            {scanning ? "Scanning Artisans..." : "Run Drift Scan"}
          </button>
        </div>
      }
    >
      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card-glass p-4 border border-rose-900/40 bg-rose-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-300">
              Open Anomaly Alerts
            </span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-rose-200">
            {openCount}
          </div>
          <span className="text-[11px] text-rose-300/80">
            Artisans exceeding baseline + 50 bp / 1 stddev
          </span>
        </div>

        <div className="card-glass p-4 border border-emerald-900/40 bg-emerald-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-300">
              Reviewed & Audited
            </span>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-emerald-200">
            {reviewedCount}
          </div>
          <span className="text-[11px] text-emerald-300/80">
            Assessed with workshop explanatory notes
          </span>
        </div>

        <div className="card-glass p-4 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">
              AI Auditor Engine
            </span>
            <Sparkles className="w-4 h-4 text-yellow-400" />
          </div>
          <div className="mt-2 text-sm font-semibold text-slate-200">
            Groq Llama-3.3 70B
          </div>
          <span className="text-[11px] text-slate-400">
            Objective craftsmanship loss explanations
          </span>
        </div>
      </div>

      {loading ? (
        <LoadingState message="Scanning statistical loss drift records..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchAlerts} />
      ) : alerts.length === 0 ? (
        <EmptyState
          title="All Artisans Operating Within Normal Tolerance"
          description="No abnormal wastage loss drift detected across active karigar workbenches."
          icon={ShieldCheck}
          actionText="Run Verification Scan"
          onAction={handleTriggerScan}
        />
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`card-glass p-5 border transition ${
                alert.status === "open"
                  ? "border-rose-800/80 bg-slate-900/80"
                  : "border-slate-800 bg-slate-900/40 opacity-80"
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center font-bold font-mono">
                    {alert.karigar_code}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                      {alert.karigar_name}
                      <span
                        className={`badge ${
                          alert.status === "open"
                            ? "badge-danger"
                            : alert.status === "reviewed"
                            ? "badge-success"
                            : "badge-neutral"
                        }`}
                      >
                        {alert.status}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5 font-mono">
                      Detected: {alert.created_at?.slice(0, 10)}
                    </p>
                  </div>
                </div>

                {/* Variance Metrics Pills */}
                <div className="flex items-center gap-4 text-xs">
                  <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 block">
                      Recent Job Loss
                    </span>
                    <span className="font-mono font-bold text-rose-400 text-sm">
                      {fmtPurity(alert.recent_loss_bp)}%
                    </span>
                  </div>

                  <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 block">
                      Baseline Average
                    </span>
                    <span className="font-mono font-bold text-slate-300 text-sm">
                      {fmtPurity(alert.baseline_mean_bp)}%
                    </span>
                  </div>

                  <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 block">
                      Sample Size
                    </span>
                    <span className="font-mono text-slate-300 text-sm">
                      {alert.sample_size} Jobs
                    </span>
                  </div>
                </div>
              </div>

              {/* Explanation Note */}
              <div className="mt-4 p-3.5 rounded-lg bg-slate-950 border border-slate-800/80 flex items-start gap-3">
                <Sparkles className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-yellow-400">
                      Craft Audit Analysis
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono uppercase">
                      Source: {alert.explanation_source || "system"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 whitespace-pre-line leading-relaxed">
                    {alert.explanation}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAlertForAi(alert);
                    setAiNotes("");
                    setAiResponse(null);
                  }}
                  className="btn-secondary text-xs py-1.5 px-3"
                >
                  <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                  AI Craft Analysis
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setReviewAlertTarget(alert);
                    setReviewStatus("reviewed");
                    setReviewNote("");
                  }}
                  className="btn-gold text-xs py-1.5 px-3"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Review & Resolve
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AI Explanation Dialog */}
      {selectedAlertForAi && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50">
          <div className="card-glass w-full max-w-lg p-6 border border-yellow-500/40">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              Generate Objective Loss Explanation
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Produce a professional audit note citing exact metrics ({fmtPurity(selectedAlertForAi.recent_loss_bp)}% vs {fmtPurity(selectedAlertForAi.baseline_mean_bp)}%) and potential workshop factors (melting crucible wear, fine filigree setting, etc.).
            </p>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Workshop Context / Floor Observation (Optional)
              </label>
              <textarea
                rows={3}
                value={aiNotes}
                onChange={(e) => setAiNotes(e.target.value)}
                placeholder="e.g. Broken crucible during induction melting; recovery crucible ash pending refining."
                className="input-base text-xs"
              />
            </div>

            {aiResponse && (
              <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-xs">
                <span className="font-bold text-yellow-400 block mb-1">
                  Generated Note ({aiResponse.source}):
                </span>
                <p className="text-slate-200">{aiResponse.explanation}</p>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedAlertForAi(null)}
                className="btn-secondary text-xs"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleRequestAiExplanation}
                disabled={aiLoading}
                className="btn-gold text-xs"
              >
                {aiLoading ? "Consulting AI Auditor..." : "Generate Explanation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Dialog */}
      {reviewAlertTarget && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50">
          <div className="card-glass w-full max-w-md p-6 border border-slate-700">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-yellow-400" />
              Review Loss Alert: {reviewAlertTarget.karigar_name}
            </h3>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Resolution Decision
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setReviewStatus("reviewed")}
                    className={`p-2.5 rounded-lg border text-xs font-semibold ${
                      reviewStatus === "reviewed"
                        ? "border-emerald-500 bg-emerald-500/15 text-emerald-300"
                        : "border-slate-800 bg-slate-900 text-slate-400"
                    }`}
                  >
                    Mark Reviewed
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewStatus("dismissed")}
                    className={`p-2.5 rounded-lg border text-xs font-semibold ${
                      reviewStatus === "dismissed"
                        ? "border-slate-600 bg-slate-800 text-slate-200"
                        : "border-slate-800 bg-slate-900 text-slate-400"
                    }`}
                  >
                    Dismiss Alert
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Reviewer Audit Note (Optional)
                </label>
                <textarea
                  rows={3}
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="e.g. Artisan verified; excess loss recovered in bench wash filings."
                  className="input-base text-xs"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReviewAlertTarget(null)}
                className="btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveReview}
                disabled={reviewLoading}
                className="btn-gold text-xs"
              >
                {reviewLoading ? "Saving..." : "Confirm Review"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
