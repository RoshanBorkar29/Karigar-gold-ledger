/**
 * Format utilities for exact gold weight (milligrams) and purity (basis points).
 * Strictly mirrors the Python backend rules in app/core/gold.py.
 */

/**
 * Format milligram weight to 3 decimal places (grams).
 * @param {number|bigint|null|undefined} mg 
 * @returns {string} e.g. 103004 -> "103.004", 5 -> "0.005", 0 -> "0.000"
 */
export function fmtG(mg) {
  if (mg === null || mg === undefined || isNaN(Number(mg))) return "0.000";
  const num = BigInt(Math.round(Number(mg)));
  const sign = num < 0n ? "-" : "";
  const abs = num < 0n ? -num : num;
  const grams = abs / 1000n;
  const millis = abs % 1000n;
  return `${sign}${grams.toString()}.${millis.toString().padStart(3, "0")}`;
}

/**
 * Format purity or wastage basis points as percentage with 2 decimal places.
 * @param {number|bigint|null|undefined} bp 
 * @returns {string} e.g. 9160 -> "91.60", 300 -> "3.00", 0 -> "0.00"
 */
export function fmtPurity(bp) {
  if (bp === null || bp === undefined || isNaN(Number(bp))) return "0.00";
  const num = BigInt(Math.round(Number(bp)));
  const sign = num < 0n ? "-" : "";
  const abs = num < 0n ? -num : num;
  const whole = abs / 100n;
  const part = abs % 100n;
  return `${sign}${whole.toString()}.${part.toString().padStart(2, "0")}`;
}

export const fmtWastage = fmtPurity;

/**
 * Format monetary amount in paise into INR string.
 * @param {number|bigint|null|undefined} paise 
 * @returns {string} e.g. 20000000 -> "₹2,00,000.00"
 */
export function fmtPaise(paise) {
  if (paise === null || paise === undefined || isNaN(Number(paise))) return "₹0.00";
  const rupees = Number(paise) / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

/**
 * Parse gram text input to integer milligrams.
 * Accepts "112.450", "112.45", "112", rejects negatives, empty, >3 decimals.
 * @param {string} text 
 * @returns {number} milligrams
 */
export function parseG(text) {
  if (!text || typeof text !== "string") throw new Error("Weight is required");
  const s = text.trim();
  if (!s) throw new Error("Weight is required");
  if (s.includes(" ") || s.includes("-") || s.includes("+") || s.includes(",")) {
    throw new Error("Invalid weight format");
  }
  const parts = s.split(".");
  if (parts.length > 2) throw new Error("Multiple decimal points");
  const whole = parts[0];
  const frac = parts[1] || "";
  if (!/^\d+$/.test(whole) || (frac && !/^\d+$/.test(frac))) {
    throw new Error("Weight must be numeric digits only");
  }
  if (frac.length > 3) throw new Error("Weight cannot exceed 3 decimal places");
  const paddedFrac = frac.padEnd(3, "0");
  return parseInt(whole, 10) * 1000 + parseInt(paddedFrac, 10);
}

/**
 * Parse percentage text input to basis points (1 to 10000).
 * Accepts "91.60", "91.6", "91", rejects negatives, >100.00, >2 decimals.
 * @param {string} text 
 * @returns {number} basis points
 */
export function parsePurity(text) {
  if (!text || typeof text !== "string") throw new Error("Purity is required");
  const s = text.trim();
  if (!s) throw new Error("Purity is required");
  if (s.includes(" ") || s.includes("-") || s.includes("+") || s.includes(",")) {
    throw new Error("Invalid purity format");
  }
  const parts = s.split(".");
  if (parts.length > 2) throw new Error("Multiple decimal points");
  const whole = parts[0];
  const frac = parts[1] || "";
  if (!/^\d+$/.test(whole) || (frac && !/^\d+$/.test(frac))) {
    throw new Error("Purity must be numeric digits only");
  }
  if (frac.length > 2) throw new Error("Purity cannot exceed 2 decimal places");
  const paddedFrac = frac.padEnd(2, "0");
  const bp = parseInt(whole, 10) * 100 + parseInt(paddedFrac, 10);
  if (bp <= 0 || bp > 10000) {
    throw new Error("Purity must be between 0.01% and 100.00%");
  }
  return bp;
}

/**
 * Parse wastage percentage string to basis points (0 to 10000).
 * @param {string} text 
 * @returns {number} basis points
 */
export function parseWastage(text) {
  if (text === "" || text === undefined || text === null) return 0;
  const s = String(text).trim();
  if (!s) return 0;
  const parts = s.split(".");
  if (parts.length > 2) throw new Error("Multiple decimal points in wastage");
  const whole = parts[0];
  const frac = parts[1] || "";
  if (!/^\d+$/.test(whole) || (frac && !/^\d+$/.test(frac))) {
    throw new Error("Wastage must be numeric digits only");
  }
  if (frac.length > 2) throw new Error("Wastage cannot exceed 2 decimal places");
  const paddedFrac = frac.padEnd(2, "0");
  const bp = parseInt(whole, 10) * 100 + parseInt(paddedFrac, 10);
  if (bp < 0 || bp > 10000) {
    throw new Error("Wastage must be between 0.00% and 100.00%");
  }
  return bp;
}

/**
 * Calculate fine gold weight in integer milligrams: (gross_mg * purity_bp + 5000) // 10000
 * @param {number} grossMg 
 * @param {number} purityBp 
 * @returns {number} fine weight in mg
 */
export function calcFineMg(grossMg, purityBp) {
  if (!grossMg || !purityBp) return 0;
  const g = BigInt(grossMg);
  const p = BigInt(purityBp);
  return Number((g * p + 5000n) / 10000n);
}

/**
 * Calculate allowed wastage in integer milligrams: (issued_fine_mg * wastage_bp + 5000) // 10000
 * @param {number} issuedFineMg 
 * @param {number} wastageBp 
 * @returns {number} allowed wastage in mg
 */
export function calcAllowedMg(issuedFineMg, wastageBp) {
  if (!issuedFineMg || !wastageBp) return 0;
  const f = BigInt(issuedFineMg);
  const w = BigInt(wastageBp);
  return Number((f * w + 5000n) / 10000n);
}
