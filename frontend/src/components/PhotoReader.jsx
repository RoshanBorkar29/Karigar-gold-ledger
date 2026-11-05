import React, { useState } from "react";
import { Camera, CheckCircle2, AlertCircle, RefreshCw, Upload, Eye } from "lucide-react";
import { api } from "../lib/api";
import { fmtG, fmtPurity } from "../lib/format";

export default function PhotoReader({
  mode = "scale", // "scale" | "karat"
  currentTypedValue = "",
  onReadingConfirmed,
}) {
  const [loading, setLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [reading, setReading] = useState(null);
  const [error, setError] = useState(null);
  const [mismatchWarning, setMismatchWarning] = useState(false);

  const isScale = mode === "scale";

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setReading(null);
    setMismatchWarning(false);
    setLoading(true);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result;
        setImagePreview(base64Data);

        let result;
        if (isScale) {
          result = await api.readScalePhoto(base64Data);
        } else {
          result = await api.readKaratPhoto(base64Data);
        }
        setReading(result);

        // Check mismatch with typed value if clerk has already typed something
        if (currentTypedValue && currentTypedValue.trim() !== "") {
          const aiValue = isScale ? fmtG(result.raw_value_mg) : fmtPurity(result.raw_value_bp);
          if (aiValue !== currentTypedValue.trim()) {
            setMismatchWarning(true);
          }
        }
      } catch (err) {
        setError(err.message || "Failed to analyze photo");
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setError("Failed to read image file");
      setLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleApplyValue = async (overrideMismatch = false) => {
    if (!reading) return;
    try {
      setLoading(true);
      const appliedValue = isScale
        ? fmtG(reading.raw_value_mg)
        : fmtPurity(reading.raw_value_bp);

      // Confirm with AI audit trail endpoint
      await api.confirmReading(reading.id, appliedValue, overrideMismatch);

      if (onReadingConfirmed) {
        onReadingConfirmed({
          readingId: reading.id,
          valueStr: appliedValue,
          mg: reading.raw_value_mg,
          bp: reading.raw_value_bp,
        });
      }
      setMismatchWarning(false);
    } catch (err) {
      setError(err.message || "Confirmation failed");
    } finally {
      setLoading(false);
    }
  };

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
            {imagePreview ? "Choose another photo" : "Upload scale readout photo"}
          </span>
          <span className="text-[10px] text-slate-500 mt-0.5">PNG, JPG, WEBP (Max 5MB)</span>
          <input
            type="file"
            accept="image/*"
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

      {reading && (
        <div className="mt-4 p-3 bg-slate-800/70 border border-slate-700 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-semibold text-slate-200">
                Extracted:{" "}
                <span className="text-yellow-400 font-mono text-sm ml-1">
                  {isScale ? `${fmtG(reading.raw_value_mg)} g` : `${fmtPurity(reading.raw_value_bp)} %`}
                </span>
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              Confidence: {Math.round(reading.confidence_score * 100)}%
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
              onClick={() => handleApplyValue(mismatchWarning)}
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
