import React, { useState, useEffect } from "react";
import {
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Lock,
} from "lucide-react";
import AppShell from "../components/layout/AppShell";
import GoldNumber from "../components/GoldNumber";
import LoadingState from "../components/LoadingState";
import ErrorState from "../components/ErrorState";
import EmptyState from "../components/EmptyState";
import Button from "../components/ui/Button";
import Field from "../components/ui/Field";
import StatusBadge from "../components/ui/StatusBadge";
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
      <AppShell title="Access Restricted">
        <div className="p-8 text-center max-w-md mx-auto my-12 bg-surface border border-border rounded">
          <div className="w-10 h-10 rounded-full bg-status-problem-tint text-status-problem flex items-center justify-center mx-auto mb-3">
            <Lock className="w-5 h-5 stroke-[2]" />
          </div>
          <h2 className="text-base font-semibold text-ink m-0">
            Finance Head Access Only
          </h2>
          <p className="text-xs text-muted mt-2 m-0 leading-relaxed">
            Loss-drift statistical alerts and karigar wastage variance calculations are confidential financial controls restricted to workshop management.
          </p>
        </div>
      </AppShell>
    );
  }

  const openCount = alerts.filter((a) => a.status === "open").length;
  const reviewedCount = alerts.filter((a) => a.status === "reviewed").length;

  return (
    <AppShell
      title="Loss-Drift Alerts & Craft Audit"
      subtitle="Statistical early-warning system flagging abnormal karigar wastage before month-end reconciliation"
      actions={
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 bg-surface border border-border rounded text-xs text-ink outline-none focus:border-bronze focus:ring-2 focus:ring-bronze/20"
          >
            <option value="all">All Alerts</option>
            <option value="open">Open Only</option>
            <option value="reviewed">Reviewed</option>
            <option value="dismissed">Dismissed</option>
          </select>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleTriggerScan}
            loading={scanning}
            icon={RefreshCw}
          >
            Run Drift Scan
          </Button>
        </div>
      }
    >
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-surface border border-border rounded flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted font-medium">
              Open Anomaly Alerts
            </span>
            <AlertTriangle className="w-4 h-4 text-status-problem stroke-[2]" />
          </div>
          <div className="my-2">
            <span className="font-mono text-xl font-semibold text-status-problem">
              {openCount}
            </span>
          </div>
          <span className="text-xs text-muted">
            Karigars exceeding baseline + 50 bp / 1 stddev
          </span>
        </div>

        <div className="p-4 bg-surface border border-border rounded flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted font-medium">
              Reviewed & Audited
            </span>
            <CheckCircle2 className="w-4 h-4 text-status-ok stroke-[2]" />
          </div>
          <div className="my-2">
            <span className="font-mono text-xl font-semibold text-ink">
              {reviewedCount}
            </span>
          </div>
          <span className="text-xs text-muted">
            Assessed with workshop explanatory notes
          </span>
        </div>

        <div className="p-4 bg-surface border border-border rounded flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted font-medium">
              AI Auditor Engine
            </span>
            <Sparkles className="w-4 h-4 text-bronze stroke-[2]" />
          </div>
          <div className="my-2">
            <span className="text-base font-semibold text-ink">
              Groq Llama-3.3 70B
            </span>
          </div>
          <span className="text-xs text-muted">
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
          title="All Karigars Operating Within Normal Tolerance"
          description="No abnormal wastage loss drift detected across active karigar workbenches."
          actionText="Run Verification Scan"
          onAction={handleTriggerScan}
        />
      ) : (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-ink mb-2">
            For Review ({alerts.length})
          </h2>

          {alerts.map((alert) => {
            const diffBp = alert.recent_loss_bp - alert.baseline_mean_bp;
            const isAiSource = (alert.explanation_source || "").toLowerCase().includes("ai") || (alert.explanation_source || "").toLowerCase().includes("groq");

            return (
              <div
                key={alert.id}
                className="p-5 bg-surface border border-border rounded space-y-4"
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-background border border-border text-ink font-semibold">
                      {alert.karigar_code}
                    </span>
                    <h3 className="text-sm font-semibold text-ink m-0">
                      {alert.karigar_name}
                    </h3>
                    <StatusBadge
                      status={alert.status}
                      label={alert.status}
                    />
                  </div>

                  <span className="text-xs text-muted font-mono">
                    Detected: {alert.created_at?.slice(0, 10)}
                  </span>
                </div>

                {/* Numbers row: recent loss, usual loss, difference */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-background border border-border rounded">
                  <div>
                    <span className="text-xs text-muted block mb-0.5">
                      Recent Loss
                    </span>
                    <GoldNumber
                      value={alert.recent_loss_bp}
                      type="purity"
                      size="sm"
                    />
                  </div>

                  <div>
                    <span className="text-xs text-muted block mb-0.5">
                      Usual Loss
                    </span>
                    <GoldNumber
                      value={alert.baseline_mean_bp}
                      type="purity"
                      size="sm"
                    />
                  </div>

                  <div>
                    <span className="text-xs text-muted block mb-0.5">
                      Difference
                    </span>
                    <GoldNumber
                      value={diffBp}
                      type="purity"
                      size="sm"
                      isExcess={diffBp > 0}
                      excessLabel="Exceeds baseline"
                    />
                  </div>

                  <div>
                    <span className="text-xs text-muted block mb-0.5">
                      Sample Size
                    </span>
                    <span className="font-mono text-sm text-ink">
                      {alert.sample_size} jobs
                    </span>
                  </div>
                </div>

                {/* Explanation text box */}
                <div className="p-3 bg-background border border-border rounded text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-ink flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-bronze stroke-[2]" />
                      Craft Analysis Note
                    </span>
                    <span className="text-[11px] text-muted font-mono uppercase">
                      Source: {isAiSource ? "AI-written" : "Standard text"}
                    </span>
                  </div>
                  <p className="text-muted leading-relaxed m-0 whitespace-pre-line">
                    {alert.explanation || "No craft analysis note provided yet."}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSelectedAlertForAi(alert);
                      setAiNotes("");
                      setAiResponse(null);
                    }}
                    icon={Sparkles}
                  >
                    AI Craft Analysis
                  </Button>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setReviewAlertTarget(alert);
                      setReviewStatus("reviewed");
                      setReviewNote("");
                    }}
                    icon={ShieldCheck}
                  >
                    Review & Resolve
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* AI Explanation Dialog */}
      {selectedAlertForAi && (
        <div className="fixed inset-0 bg-ink/50 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-lg bg-surface p-6 border border-border rounded shadow-lg">
            <h3 className="text-base font-semibold text-ink flex items-center gap-2 m-0">
              <Sparkles className="w-4 h-4 text-bronze stroke-[2]" />
              Generate Objective Loss Explanation
            </h3>
            <p className="text-xs text-muted mt-1 m-0">
              Produce a professional audit note citing exact metrics ({fmtPurity(selectedAlertForAi.recent_loss_bp)}% vs {fmtPurity(selectedAlertForAi.baseline_mean_bp)}%) and craft factors (crucible wear, filigree setting, casting porosity).
            </p>

            <div className="mt-4">
              <Field
                label="Workshop Context / Floor Observation (Optional)"
                id="aiNotes"
                type="textarea"
                value={aiNotes}
                onChange={(e) => setAiNotes(e.target.value)}
                placeholder="e.g. Broken crucible during melting; crucible ash pending refining recovery."
              />
            </div>

            {aiResponse && (
              <div className="mt-4 p-3 rounded bg-status-ok-tint border border-status-ok/20 text-xs">
                <span className="font-semibold text-status-ok block mb-1">
                  Generated Note ({aiResponse.source}):
                </span>
                <p className="text-ink leading-relaxed m-0">{aiResponse.explanation}</p>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2 pt-4 border-t border-border">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedAlertForAi(null)}
              >
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleRequestAiExplanation}
                loading={aiLoading}
              >
                Generate Explanation
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Review Dialog */}
      {reviewAlertTarget && (
        <div className="fixed inset-0 bg-ink/50 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-surface p-6 border border-border rounded shadow-lg">
            <h3 className="text-base font-semibold text-ink flex items-center gap-2 m-0">
              <ShieldCheck className="w-4 h-4 text-bronze stroke-[2]" />
              Review Loss Alert: {reviewAlertTarget.karigar_name}
            </h3>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink mb-1.5">
                  Resolution Decision
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setReviewStatus("reviewed")}
                    className={`h-10 px-3 rounded border text-xs font-medium transition cursor-pointer ${
                      reviewStatus === "reviewed"
                        ? "border-status-ok bg-status-ok-tint text-status-ok"
                        : "border-border bg-background text-muted hover:text-ink"
                    }`}
                  >
                    Mark Reviewed
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewStatus("dismissed")}
                    className={`h-10 px-3 rounded border text-xs font-medium transition cursor-pointer ${
                      reviewStatus === "dismissed"
                        ? "border-border bg-background text-ink font-semibold"
                        : "border-border bg-background text-muted hover:text-ink"
                    }`}
                  >
                    Dismiss Alert
                  </button>
                </div>
              </div>

              <div>
                <Field
                  label="Reviewer Audit Note (Optional)"
                  id="reviewNote"
                  type="textarea"
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="e.g. Karigar verified; excess loss recovered in bench wash filings."
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 pt-4 border-t border-border">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setReviewAlertTarget(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveReview}
                loading={reviewLoading}
              >
                Confirm Review
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
