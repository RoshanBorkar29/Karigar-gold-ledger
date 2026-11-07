import React, { useState } from "react";
import { Camera, Upload, AlertTriangle } from "lucide-react";
import { api } from "../lib/api";
import { parseG, parsePurity } from "../lib/format";
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
  isOpen = false,
  onClose = null,
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
      if (onClose) onClose();
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
      if (onClose) onClose();
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

  let displayValue = 0;
  if (reading && reading.readable) {
    if (isScale) {
      if (typeof reading.value_mg === "number") {
        displayValue = reading.value_mg;
      } else if (reading.value_text) {
        try {
          displayValue = parseG(reading.value_text);
        } catch {
          displayValue = Math.round(parseFloat(reading.value_text) * 1000) || 0;
        }
      }
    } else {
      if (typeof reading.purity_bp === "number") {
        displayValue = reading.purity_bp;
      } else if (reading.purity_text) {
        try {
          displayValue = parsePurity(reading.purity_text);
        } catch {
          displayValue = Math.round(parseFloat(reading.purity_text) * 100) || 0;
        }
      }
    }
  }

  // If collapsed and no mismatch, return null
  if (!isOpen && !isMismatch) {
    return null;
  }

  return (
    <div className="bg-surface border border-border rounded p-4 space-y-3">
      {/* Component Title & Close Button */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-bronze stroke-[1.75]" />
          <h4 className="text-xs font-semibold text-ink m-0">
            {isScale ? "Scale photo reader" : "Karatmeter photo reader"}
          </h4>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted">Vision OCR</span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-muted hover:text-ink ml-2 bg-transparent border-none cursor-pointer p-0"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Upload button & file input */}
      <div>
        <label className="flex items-center justify-center gap-2 h-10 px-3 border border-[#D9D1BF] hover:border-bronze rounded bg-white text-xs text-ink font-medium cursor-pointer transition">
          <Upload className="w-3.5 h-3.5 text-muted stroke-[1.75]" />
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
        <div className="py-3 text-center text-xs text-muted">
          Analyzing instrument display...
        </div>
      )}

      {error && (
        <div className="p-2.5 bg-status-problem-tint border border-status-problem/20 rounded text-xs text-status-problem">
          {error}
        </div>
      )}

      {/* Photo on left, AI reading on right */}
      {imagePreview && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 items-center">
          {/* Photo on left */}
          <div className="relative aspect-[4/3] rounded border border-border bg-background overflow-hidden flex items-center justify-center">
            <img
              src={imagePreview}
              alt="Readout preview"
              className="w-full h-full object-contain"
            />
          </div>

          {/* AI reading on right */}
          <div className="space-y-2">
            {isFallback ? (
              <div className="p-2.5 bg-status-review-tint border border-status-review/20 rounded text-xs text-status-review">
                <p className="font-medium m-0">Photo reading is not available</p>
                <p className="mt-0.5 m-0 text-muted">Enter the value manually.</p>
              </div>
            ) : reading && reading.readable ? (
              <div className="space-y-1.5">
                <div className="text-xs text-muted">Instrument reading</div>
                <GoldNumber
                  value={displayValue}
                  type={isScale ? "weight" : "purity"}
                  size="xl"
                  isKeyBalance
                />
                <div className="text-xs text-muted">
                  Confidence: <span className="font-medium text-ink">{confidenceWord}</span>
                </div>

                {/* Two clear buttons */}
                <div className="pt-1.5 flex flex-wrap gap-2">
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
        <div className="pt-2 border-t border-border space-y-1.5">
          <div className="text-xs font-medium text-ink">
            Manual instrument entry
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              placeholder={isScale ? "e.g. 112.450" : "e.g. 91.60"}
              className="h-10 px-3 bg-white border border-[#D9D1BF] rounded text-xs font-mono text-ink outline-none focus:border-bronze focus:ring-2 focus:ring-bronze flex-1"
            />
            <Button
              variant="secondary"
              size="sm"
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
