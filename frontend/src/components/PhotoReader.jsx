import React, { useState } from "react";
import { Camera, CheckCircle2, AlertCircle, RefreshCw, Upload, Eye } from "lucide-react";
import { api } from "../lib/api";

export default function PhotoReader({
  mode = "scale", // "scale" | "karat"
  currentTypedValue = "",
  onReadingConfirmed,
}) {
  const [loading, setLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [reading, setReading] = useState(null);
  const [manualValue, setManualValue] = useState("");
  const [error, setError] = useState(null);
  const [mismatchWarning, setMismatchWarning] = useState(false);

  const isScale = mode === "scale";

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setReading(null);
    setManualValue("");
    setMismatchWarning(false);
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

      const aiVal = isScale ? result.value_text : result.purity_text;
      if (result.readable && aiVal && currentTypedValue && currentTypedValue.trim() !== "") {
        if (aiVal.trim() !== currentTypedValue.trim()) {
          setMismatchWarning(true);
        }
      }
    } catch (err) {
      setError(err.message || "Failed to analyze photo");
    } finally {
      setLoading(false);
    }
  };

  const handleApplyExtractedValue = async (overrideMismatch = false) => {
    if (!reading) return;
    const extractedVal = isScale ? reading.value_text : reading.purity_text;
    if (!extractedVal) return;

    try {
      setLoading(true);
      await api.confirmReading(reading.reading_id, extractedVal, overrideMismatch);

      if (onReadingConfirmed) {
        onReadingConfirmed({
          readingId: reading.reading_id,
          valueStr: extractedVal,
        });
      }
      setMismatchWarning(false);
    } catch (err) {
      setError(err.message || "Confirmation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleApplyManualValue = async () => {
    if (!reading || !manualValue.trim()) return;

    try {
      setLoading(true);
      await api.confirmReading(reading.reading_id, manualValue.trim(), true);

      if (onReadingConfirmed) {
        onReadingConfirmed({
          readingId: reading.reading_id,
          valueStr: manualValue.trim(),
        });
      }
    } catch (err) {
      setError(err.message || "Failed to confirm manual entry");
    } finally {
      setLoading(false);
    }
  };

  const isFallback = reading && (reading.fallback === "manual" || !reading.readable);

  return (
    <div className="card-glass p-4 border border-slate-700/80 bg-slate-900/60 rounded-lg">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-yellow-400" />
          <h4 className="text-sm font-semibold text-slate-200">
            {isScale ? "Digital Scale Photo Reader" : "Karatmeter Photo Reader"}
          </h4>
        </div>
        <span className="text-[11px] font-medium text-slate-400">
          Vision OCR Assist
        </span>
      </div>

      <div className="mt-3 flex flex-col md:flex-row gap-4 items-center">
        {/* Upload box */}
        <label className="flex-1 w-full flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-700 hover:border-yellow-500/50 rounded-lg cursor-pointer bg-slate-800/40 transition">
          <Upload className="w-5 h-5 text-slate-400 mb-1" />
          <span className="text-xs font-medium text-slate-300">
            {imagePreview ? "Choose another photo" : isScale ? "Upload scale readout photo" : "Upload karatmeter printout photo"}
          </span>
          <span className="text-[10px] text-slate-500 mt-0.5">PNG, JPG, WEBP (Max 5MB)</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
            disabled={loading}
          />
        </label>

        {/* Thumbnail Preview */}
        {imagePreview && (
          <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-slate-700 bg-black shrink-0">
            <img
              src={imagePreview}
              alt="Readout preview"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition">
              <Eye className="w-4 h-4 text-white" />
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-4 text-xs text-yellow-400">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Processing photo readout...</span>
        </div>
      )}

      {error && (
        <div className="mt-3 p-2.5 rounded bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Fallback to Manual Entry */}
      {isFallback && (
        <div className="mt-4 p-3 bg-amber-950/40 border border-amber-700/60 rounded-lg space-y-3">
          <div className="flex items-start gap-2 text-amber-200 text-xs">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">AI Reading Unavailable / Unreadable</p>
              <p className="text-[11px] text-amber-300/80 mt-0.5">
                The digits could not be verified automatically. Please verify the physical instrument and enter the reading manually below.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={manualValue}
                onChange={(e) => setManualValue(e.target.value)}
                placeholder={isScale ? "e.g. 112.450" : "e.g. 91.60"}
                className="input-base font-mono text-sm pr-8"
              />
              <span className="absolute right-3 top-2 text-xs text-slate-400 font-mono">
                {isScale ? "g" : "%"}
              </span>
            </div>
            <button
              type="button"
              onClick={handleApplyManualValue}
              disabled={!manualValue.trim()}
              className="btn-gold text-xs py-2 px-3 whitespace-nowrap"
            >
              Apply Manual Value
            </button>
          </div>
        </div>
      )}

      {/* Legible Extraction */}
      {reading && !isFallback && (
        <div className="mt-4 p-3 bg-slate-800/70 border border-slate-700 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-semibold text-slate-200">
                Extracted:{" "}
                <span className="text-yellow-400 font-mono text-sm ml-1">
                  {isScale ? `${reading.value_text} g` : `${reading.purity_text} %`}
                </span>
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              Confidence: {reading.confidence}%
            </span>
          </div>

          {mismatchWarning && (
            <div className="mt-2 p-2 rounded bg-amber-950/40 border border-amber-700/60 text-amber-200 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Value Mismatch Warning</p>
                <p className="text-[11px] text-amber-300/90 mt-0.5">
                  Extracted photo value differs from currently entered input ({currentTypedValue}).
                </p>
              </div>
            </div>
          )}

          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => handleApplyExtractedValue(mismatchWarning)}
              className="btn-gold text-xs py-1.5 px-3"
            >
              Use Extracted Value
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
