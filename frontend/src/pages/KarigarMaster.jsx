import React, { useState, useEffect } from "react";
import { Users, Plus, Check, Settings2, UserPlus, AlertCircle } from "lucide-react";
import AppShell from "../components/layout/AppShell";
import GoldNumber from "../components/GoldNumber";
import LoadingState from "../components/LoadingState";
import ErrorState from "../components/ErrorState";
import EmptyState from "../components/EmptyState";
import { api } from "../lib/api";
import { fmtWastage, parseWastage } from "../lib/format";

export default function KarigarMaster() {
  const [karigars, setKarigars] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // New Karigar Form State
  const [showAddKarigar, setShowAddKarigar] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [addError, setAddError] = useState(null);

  // Wastage Drawer State
  const [selectedKarigar, setSelectedKarigar] = useState(null);
  const [wastages, setWastages] = useState([]);
  const [wastageInputs, setWastageInputs] = useState({});
  const [savingWastage, setSavingWastage] = useState(false);
  const [wastageMsg, setWastageMsg] = useState(null);

  // New Category State
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showAddCategory, setShowAddCategory] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [kData, cData] = await Promise.all([
        api.getKarigars(),
        api.getCategories(),
      ]);
      setKarigars(kData);
      setCategories(cData);
    } catch (err) {
      setError(err.message || "Failed to load karigars");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenWastage = async (karigar) => {
    setSelectedKarigar(karigar);
    setWastageMsg(null);
    try {
      const wData = await api.getKarigarWastages(karigar.id);
      setWastages(wData);
      const inputs = {};
      wData.forEach((w) => {
        inputs[w.category_id] = fmtWastage(w.wastage_bp);
      });
      setWastageInputs(inputs);
    } catch (err) {
      setWastageMsg({ type: "error", text: err.message });
    }
  };

  const handleSaveWastage = async (categoryId) => {
    if (!selectedKarigar) return;
    setSavingWastage(true);
    setWastageMsg(null);
    try {
      const valStr = wastageInputs[categoryId] || "0.00";
      const bp = parseWastage(valStr);
      await api.setKarigarWastage(selectedKarigar.id, categoryId, bp);
      setWastageMsg({ type: "success", text: "Agreed wastage rate updated." });
      // Refresh
      const wData = await api.getKarigarWastages(selectedKarigar.id);
      setWastages(wData);
    } catch (err) {
      setWastageMsg({ type: "error", text: err.message });
    } finally {
      setSavingWastage(false);
    }
  };

  const handleCreateKarigar = async (e) => {
    e.preventDefault();
    setAddError(null);
    try {
      await api.createKarigar({ code: newCode.trim(), name: newName.trim() });
      setShowAddKarigar(false);
      setNewCode("");
      setNewName("");
      fetchData();
    } catch (err) {
      setAddError(err.message || "Failed to create karigar");
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      await api.createCategory(newCategoryName.trim());
      setNewCategoryName("");
      setShowAddCategory(false);
      const cData = await api.getCategories();
      setCategories(cData);
    } catch (err) {
      alert(err.message || "Failed to add category");
    }
  };

  return (
    <AppShell
      title="Karigar Master & Agreed Wastage"
      subtitle="Manage artisan profiles and contractual wastage limits per ornament category"
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddCategory(!showAddCategory)}
            className="btn-secondary text-xs py-2 px-3"
          >
            <Plus className="w-3.5 h-3.5" />
            New Category
          </button>
          <button
            onClick={() => setShowAddKarigar(true)}
            className="btn-gold text-xs py-2 px-3"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Add Karigar
          </button>
        </div>
      }
    >
      {/* Quick Add Category Inline Box */}
      {showAddCategory && (
        <form
          onSubmit={handleCreateCategory}
          className="mb-6 p-4 card-glass border border-slate-700 bg-slate-900/70 flex items-center gap-3 rounded-lg"
        >
          <input
            type="text"
            required
            placeholder="New Category Name (e.g. Antique Choker, Mangalsutra)"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            className="input-base text-xs"
          />
          <button type="submit" className="btn-gold text-xs py-2 px-4 shrink-0">
            Save Category
          </button>
        </form>
      )}

      {/* Modal: Add Karigar */}
      {showAddKarigar && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="card-glass w-full max-w-md p-6 border border-slate-700">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-yellow-400" />
              Register New Karigar
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Add a new goldsmith artisan to workshop records.
            </p>

            {addError && (
              <div className="mt-3 p-2.5 rounded bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">
                {addError}
              </div>
            )}

            <form onSubmit={handleCreateKarigar} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Artisan Code
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. K-041"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="input-base"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Murugan Vel"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="input-base"
                />
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddKarigar(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-gold text-xs">
                  Create Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <LoadingState message="Loading artisan master registry..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchData} />
      ) : karigars.length === 0 ? (
        <EmptyState
          title="No Karigars Registered"
          description="Register your workshop artisans to start tracking gold issues and agreed wastage."
          actionText="Add First Karigar"
          onAction={() => setShowAddKarigar(true)}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Karigars List Table */}
          <div className="lg:col-span-2 card-glass overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-200">
                Registered Artisans ({karigars.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Artisan Code</th>
                    <th>Full Name</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {karigars.map((k) => (
                    <tr
                      key={k.id}
                      className={selectedKarigar?.id === k.id ? "bg-yellow-500/10" : ""}
                    >
                      <td className="font-mono font-bold text-yellow-400">
                        {k.code}
                      </td>
                      <td className="font-medium text-slate-200">{k.name}</td>
                      <td>
                        <span
                          className={`badge ${
                            k.is_active ? "badge-success" : "badge-neutral"
                          }`}
                        >
                          {k.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="text-right">
                        <button
                          onClick={() => handleOpenWastage(k)}
                          className="btn-secondary text-xs py-1.5 px-3"
                        >
                          <Settings2 className="w-3.5 h-3.5" />
                          Agreed Wastage
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Agreed Wastage Settings Panel */}
          <div className="card-glass p-5">
            {selectedKarigar ? (
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">
                      Contract Wastage: {selectedKarigar.name}
                    </h3>
                    <p className="text-xs text-yellow-400 font-mono">
                      {selectedKarigar.code}
                    </p>
                  </div>
                </div>

                {wastageMsg && (
                  <div
                    className={`mt-3 p-2.5 rounded text-xs flex items-center gap-2 ${
                      wastageMsg.type === "success"
                        ? "bg-emerald-950/40 border border-emerald-800 text-emerald-300"
                        : "bg-rose-950/40 border border-rose-800 text-rose-300"
                    }`}
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{wastageMsg.text}</span>
                  </div>
                )}

                <div className="mt-4 space-y-3">
                  {categories.map((cat) => {
                    const currentVal = wastageInputs[cat.id] || "";
                    return (
                      <div
                        key={cat.id}
                        className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between gap-3"
                      >
                        <span className="text-xs font-semibold text-slate-200">
                          {cat.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="relative w-20">
                            <input
                              type="text"
                              value={currentVal}
                              onChange={(e) =>
                                setWastageInputs({
                                  ...wastageInputs,
                                  [cat.id]: e.target.value,
                                })
                              }
                              placeholder="3.00"
                              className="input-base text-xs font-mono py-1 px-2 text-right pr-6"
                            />
                            <span className="absolute right-2 top-1.5 text-xs text-slate-400 pointer-events-none">
                              %
                            </span>
                          </div>
                          <button
                            onClick={() => handleSaveWastage(cat.id)}
                            disabled={savingWastage}
                            className="p-1.5 rounded bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition"
                            title="Save rate"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">
                <Settings2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">
                  Select a karigar to view and edit contractual category wastage percentages.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
