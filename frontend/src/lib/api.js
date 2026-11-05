/**
 * API client with authentication interceptors and typed backend method bindings.
 */

const BASE_URL = import.meta.env.VITE_API_URL || "";

function getAuthHeader() {
  const token = localStorage.getItem("karigar_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(!isFormData ? { "Content-Type": "application/json" } : {}),
    ...getAuthHeader(),
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem("karigar_token");
    localStorage.removeItem("karigar_user");
    window.dispatchEvent(new Event("karigar-auth-expired"));
  }

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type");
  const isJson = contentType && contentType.includes("application/json");

  if (!response.ok) {
    let errorDetail = `Request failed (${response.status})`;
    if (isJson) {
      try {
        const body = await response.json();
        errorDetail = body.detail || body.message || JSON.stringify(body);
      } catch {
        // Fallback
      }
    } else {
      errorDetail = await response.text();
    }
    const err = new Error(errorDetail);
    err.status = response.status;
    throw err;
  }

  return isJson ? response.json() : response.text();
}

export const api = {
  get: (endpoint) => request(endpoint, { method: "GET" }),
  post: (endpoint, body) => request(endpoint, { method: "POST", body: JSON.stringify(body) }),
  patch: (endpoint, body) => request(endpoint, { method: "PATCH", body: JSON.stringify(body) }),
  delete: (endpoint) => request(endpoint, { method: "DELETE" }),

  // 1. Auth
  login: async (email, password) => {
    const data = await api.post("/api/auth/login", { email, password });
    localStorage.setItem("karigar_token", data.access_token);
    return data;
  },
  getMe: () => api.get("/api/auth/me"),

  // 2. Categories
  getCategories: () => api.get("/api/categories"),
  createCategory: (name) => api.post("/api/categories", { name }),

  // 3. Karigars
  getKarigars: () => api.get("/api/karigars"),
  createKarigar: (data) => api.post("/api/karigars", data),
  getKarigarWastages: (id) => api.get(`/api/karigars/${id}/wastage`),
  setKarigarWastage: (id, category_id, wastage_bp) =>
    api.post(`/api/karigars/${id}/wastage`, { category_id, wastage_bp }),
  getKarigarJobs: (id, open_only = false) =>
    api.get(`/api/karigars/${id}/jobs${open_only ? "?open_only=true" : ""}`),
  createJob: (data) => api.post("/api/karigars/jobs", data),

  // 4. Issues & Receipts
  createIssue: (data) => api.post("/api/issues", data),
  voidIssue: (id, reason) => api.post(`/api/issues/${id}/void`, { reason }),
  createReceipt: (data) => api.post("/api/receipts", data),
  voidReceipt: (id, reason) => api.post(`/api/receipts/${id}/void`, { reason }),

  // 5. Balances & Settlements
  getKarigarBalancesSummary: (as_of) =>
    api.get(`/api/balances/karigars${as_of ? `?as_of=${as_of}` : ""}`),
  getKarigarDetail: (id, as_of) =>
    api.get(`/api/balances/karigars/${id}${as_of ? `?as_of=${as_of}` : ""}`),
  getJobSettlement: (jobId) => api.get(`/api/jobs/${jobId}/settlement`),
  closeJob: (jobId) => api.post(`/api/jobs/${jobId}/close`, {}),

  // 6. Loss Alerts (Finance only)
  getAlerts: (status) => api.get(`/api/alerts${status ? `?status=${status}` : ""}`),
  triggerAlertScan: () => api.post("/api/alerts/scan", {}),
  reviewAlert: (id, status, explanation) =>
    api.patch(`/api/alerts/${id}`, { status, explanation }),
  getKarigarDrift: (karigarId) => api.get(`/api/alerts/karigars/${karigarId}/drift`),

  // 7. Stock & Tally Export (Finance only)
  getDailyStock: (as_of) => api.get(`/api/stock/daily${as_of ? `?as_of=${as_of}` : ""}`),
  exportTallyCsv: async (as_of) => {
    const url = `${BASE_URL}/api/exports/tally${as_of ? `?as_of=${as_of}` : ""}`;
    const response = await fetch(url, {
      headers: { ...getAuthHeader() },
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(err || "Failed to export Tally CSV");
    }
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `tally_stock_${as_of || new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  },

  // 8. Old-Gold Desk
  getOldGoldPurchases: () => api.get("/api/old-gold"),
  createOldGoldPurchase: (data) => api.post("/api/old-gold", data),

  // 9. AI Vision & Explanations
  readScalePhoto: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return request("/api/ai/read-scale", {
      method: "POST",
      body: formData,
    });
  },
  readKaratPhoto: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return request("/api/ai/read-karat", {
      method: "POST",
      body: formData,
    });
  },
  confirmReading: (id, confirmed_value, override = false) =>
    api.post(`/api/ai/readings/${id}/confirm`, {
      confirmed_value,
      override,
    }),
  explainLoss: (karigar_id, job_id, additional_context) =>
    api.post("/api/ai/explain-loss", {
      karigar_id,
      job_id,
      additional_context,
    }),
};
