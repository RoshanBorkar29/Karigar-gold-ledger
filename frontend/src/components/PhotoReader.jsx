import React, { useState } from "react";
import { Camera, Upload, AlertTriangle } from "lucide-react";
import { api } from "../lib/api";
import GoldNumber from "./GoldNumber";
import Button from "./ui/Button";

/**
 * Standard PhotoReader component.
 * Photo on the left, AI reading on the right as a large GoldNumber (24px).
 * Confidence label in words: "High" / "Medium" / "Low".
 * Two clear buttons: "Use this reading" and "Enter manually".
 * Visible blocking message when typed value differs with values side-by-side.
 * Calm fallback notice when AI reading is unavailable: "Photo reading is not available. Enter the weight manually."
 */
export default function PhotoReader({
  mode = "scale", // "scale" | "karat"
  currentTypedValue = "",
  onReadingConfirmed,
  onMismatchStateChange = () => {},
}) {
  const [loading, setLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [reading, setReading] = useState(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const [error, setError] = useState(null);

  const isScale = mode === "scale";

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setReading(null);
    setManualMode(false);
    setManualValue("");
    setLoading(true);

    try {
      setImagePreview(URL.createObjectURL(file));

      let result;
      if (isScale) {
        result = await api.readScalePhoto(file);
      } else {
        result = await api.readKaratPhoto(file);
      }
      setReading(result);

      // Check mismatch
      const aiVal = isScale ? result.value_text : result.purity_text;
      const isMismatch = Boolean(
        result.readable &&
        aiVal &&
        currentTypedValue &&
        currentTypedValue.trim() !== "" &&
        aiVal.trim() !== currentTypedValue.trim()
      );
      onMismatchStateChange(isMismatch);
    } catch (err) {
      setError(err.message || "Unable to process photo readout");
      onMismatchStateChange(false);
    } finally {
      setLoading(false);
    }
  };

  const handleUseReading = async () => {
    if (!reading) return;
    const extractedVal = isScale ? reading.value_text : reading.purity_text;
    if (!extractedVal) return;

    try {
      setLoading(true);
      await api.confirmReading(reading.reading_id, extractedVal, false);
      if (onReadingConfirmed) {
        onReadingConfirmed({
          readingId: reading.reading_id,
          valueStr: extractedVal,
        });
      }
      onMismatchStateChange(false);
    } catch (err) {
      setError(err.message || "Failed to confirm reading");
    } finally {
      setLoading(false);
    }
  };

  const handleEnterManually = () => {
    setManualMode(true);
    setManualValue(currentTypedValue || "");
  };

  const handleConfirmManual = async () => {
    if (!manualValue.trim()) return;

    try {
      setLoading(true);
      if (reading) {
        await api.confirmReading(reading.reading_id, manualValue.trim(), true);
      }
      if (onReadingConfirmed) {
        onReadingConfirmed({
          readingId: reading ? reading.reading_id : null,
          valueStr: manualValue.trim(),
        });
      }
      onMismatchStateChange(false);
      setManualMode(false);
    } catch (err) {
      setError(err.message || "Failed to apply manual value");
    } finally {
      setLoading(false);
    }
  };

  const aiValue = reading ? (isScale ? reading.value_text : reading.purity_text) : null;
  const isFallback = reading && (!reading.readable || reading.fallback === "manual");
  const isMismatch = Boolean(
    reading &&
    reading.readable &&
    aiValue &&
    currentTypedValue &&
    currentTypedValue.trim() !== "" &&
    aiValue.trim() !== currentTypedValue.trim()
  );

  const confidenceWord = reading?.confidence
    ? reading.confidence >= 80
      ? "High"
      : reading.confidence >= 50
      ? "Medium"
      : "Low"
    : "Medium";

  return (
    <div className="bg-surface border border-border rounded p-4 space-y-4">
      {/* Component Title */}
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-bronze stroke-[1.75]" />
          <h4 className="text-sm font-semibold text-ink m-0">
            {isScale ? "Precision scale photo reader" : "Karatmeter photo reader"}
          </h4>
        </div>
        <span className="text-xs text-muted">
          Vision OCR
        </span>
      </div>

      {/* Upload button & file input */}
      <div>
        <label className="flex items-center justify-center gap-2 h-11 px-4 border border-border hover:border-bronze rounded bg-background text-sm text-ink font-medium cursor-pointer transition">
          <Upload className="w-4 h-4 text-muted stroke-[1.75]" />
          <span>{imagePreview ? "Replace photo" : isScale ? "Upload scale photo" : "Upload karatmeter printout"}</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
            disabled={loading}
          />
        </label>
        <p className="text-[11px] text-muted mt-1 m-0">
          PNG, JPG, or WEBP up to 5 MB
        </p>
      </div>

      {loading && (
        <div className="py-4 text-center text-xs text-muted">
          Analyzing instrument display...
        </div>
      )}

      {error && (
        <div className="p-3 bg-status-problem-tint border border-status-problem/20 rounded text-xs text-status-problem">
          {error}
        </div>
      )}

      {/* Photo on left, AI reading on right */}
      {imagePreview && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 items-center">
          {/* Photo on left */}
          <div className="relative aspect-[4/3] rounded border border-border bg-background overflow-hidden flex items-center justify-center">
            <img
              src={imagePreview}
              alt="Readout preview"
              className="w-full h-full object-contain"
            />
          </div>

          {/* AI reading on right */}
          <div className="space-y-3">
            {isFallback ? (
              <div className="p-3 bg-status-review-tint border border-status-review/20 rounded text-xs text-status-review">
                <p className="font-medium m-0">Photo reading is not available</p>
                <p className="mt-1 m-0 text-muted">Enter the weight manually.</p>
              </div>
            ) : reading && reading.readable ? (
              <div className="space-y-2">
                <div className="text-xs text-muted">Instrument reading</div>
                <GoldNumber
                  value={isScale ? reading.value_mg : reading.purity_bp}
                  type={isScale ? "weight" : "purity"}
                  size="xl"
                  isKeyBalance
                />
                <div className="text-xs text-muted">
                  Confidence: <span className="font-medium text-ink">{confidenceWord}</span>
                </div>

                {/* Two clear buttons */}
                <div className="pt-2 flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleUseReading}
                  >
                    Use this reading
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleEnterManually}
                  >
                    Enter manually
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Manual Entry override input */}
      {manualMode && (
        <div className="pt-3 border-t border-border space-y-2">
          <div className="text-xs font-medium text-ink">
            Manual instrument entry
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              placeholder={isScale ? "e.g. 112.450" : "e.g. 91.60"}
              className="h-11 px-3 bg-surface border border-border rounded text-sm font-mono text-ink outline-none focus:border-bronze focus:ring-2 focus:ring-bronze/20 flex-1"
            />
            <Button
              variant="secondary"
              size="md"
              onClick={handleConfirmManual}
              disabled={!manualValue.trim()}
            >
              Confirm manual
            </Button>
          </div>
        </div>
      )}

      {/* Visible blocking message when typed value differs */}
      {isMismatch && (
        <div className="p-3 bg-status-problem-tint border border-status-problem/20 rounded space-y-2 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-status-problem">
            <AlertTriangle className="w-4 h-4 shrink-0 stroke-[2]" />
            <span>Reading mismatch detected</span>
          </div>
          <div className="grid grid-cols-2 gap-2 py-1 border-y border-status-problem/10 font-mono">
            <div>
              <span className="text-muted block text-[11px] font-sans">Photo reading:</span>
              <span className="font-medium text-ink">{aiValue} {isScale ? "g" : "%"}</span>
            </div>
            <div>
              <span className="text-muted block text-[11px] font-sans">Entered in form:</span>
              <span className="font-medium text-status-problem">{currentTypedValue} {isScale ? "g" : "%"}</span>
            </div>
          </div>
          <p className="text-muted m-0">
            Form value must match confirmed photo reading or be confirmed manually before saving.
          </p>
        </div>
      )}
    </div>
  );
}
