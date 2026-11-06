import React, { useState, useEffect } from "react";
import { Users, Plus, Check, Settings2, UserPlus, AlertCircle } from "lucide-react";
import AppShell from "../components/layout/AppShell";
import LoadingState from "../components/LoadingState";
import ErrorState from "../components/ErrorState";
import EmptyState from "../components/EmptyState";
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
  const [addLoading, setAddLoading] = useState(false);

  // Wastage Drawer State
  const [selectedKarigar, setSelectedKarigar] = useState(null);
  const [wastages, setWastages] = useState([]);
  const [wastageInputs, setWastageInputs] = useState({});
  const [savingWastage, setSavingWastage] = useState(false);
  const [wastageMsg, setWastageMsg] = useState(null);

  // New Category State
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [catLoading, setCatLoading] = useState(false);

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
      setWastageMsg({ type: "success", text: "Agreed wastage rate updated successfully." });
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
    setAddLoading(true);
    try {
      await api.createKarigar({ code: newCode.trim(), name: newName.trim() });
      setShowAddKarigar(false);
      setNewCode("");
      setNewName("");
      fetchData();
    } catch (err) {
      setAddError(err.message || "Failed to create karigar profile");
    } finally {
      setAddLoading(false);
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setCatLoading(true);
    try {
      await api.createCategory(newCategoryName.trim());
      setNewCategoryName("");
      setShowAddCategory(false);
      const cData = await api.getCategories();
      setCategories(cData);
    } catch (err) {
      alert(err.message || "Failed to add category");
    } finally {
      setCatLoading(false);
    }
  };

  return (
    <AppShell
      title="Karigar Master & Agreed Wastage"
      subtitle="Manage karigar profiles and contractual wastage limits per ornament category"
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowAddCategory(!showAddCategory)}
            icon={Plus}
          >
            New Category
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowAddKarigar(true)}
            icon={UserPlus}
          >
            Add Karigar
          </Button>
        </div>
      }
    >
      {/* Quick Add Category Inline Form */}
      {showAddCategory && (
        <form
          onSubmit={handleCreateCategory}
          className="mb-6 p-4 bg-surface border border-border rounded flex flex-col sm:flex-row items-stretch sm:items-end gap-3"
        >
          <div className="flex-1">
            <Field
              label="New Ornament Category Name"
              id="newCategoryName"
              placeholder="e.g. Antique Choker, Temple Haar, Mangalsutra"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              required
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={catLoading}
          >
            Save Category
          </Button>
        </form>
      )}

      {/* Modal: Add Karigar */}
      {showAddKarigar && (
        <div className="fixed inset-0 bg-ink/50 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-surface p-6 border border-border rounded shadow-lg">
            <h3 className="text-base font-semibold text-ink flex items-center gap-2 m-0">
              <UserPlus className="w-4 h-4 stroke-[2] text-bronze" />
              Register New Karigar
            </h3>
            <p className="text-xs text-muted mt-1 m-0">
              Add a new goldsmith karigar to workshop records.
            </p>

            {addError && (
              <div className="mt-3 p-2.5 rounded bg-status-problem-tint border border-status-problem/20 text-status-problem text-xs">
                {addError}
              </div>
            )}

            <form onSubmit={handleCreateKarigar} className="mt-4 space-y-4">
              <Field
                label="Karigar Code"
                id="artisanCode"
                placeholder="e.g. K-041"
                required
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
              />

              <Field
                label="Full Name"
                id="artisanName"
                placeholder="e.g. Murugan Vel"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />

              <div className="mt-6 flex justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowAddKarigar(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={addLoading}
                >
                  Create Profile
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <LoadingState message="Loading karigar master registry..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchData} />
      ) : karigars.length === 0 ? (
        <EmptyState
          title="No Karigars Registered"
          description="Register your workshop karigars to start tracking gold issues and agreed wastage."
          actionText="Add First Karigar"
          onAction={() => setShowAddKarigar(true)}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Karigars List Table */}
          <div className="lg:col-span-2">
            <TableContainer>
              <TableHead>
                <tr>
                  <TableHeaderCell>Karigar Code</TableHeaderCell>
                  <TableHeaderCell>Full Name</TableHeaderCell>
                  <TableHeaderCell align="center">Status</TableHeaderCell>
                  <TableHeaderCell align="right">Actions</TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {karigars.map((k) => (
                  <TableRow
                    key={k.id}
                    onClick={() => handleOpenWastage(k)}
                    className={selectedKarigar?.id === k.id ? "bg-background/80" : ""}
                  >
                    <TableCell className="font-mono font-medium text-ink">
                      {k.code}
                    </TableCell>
                    <TableCell className="font-medium text-ink">{k.name}</TableCell>
                    <TableCell align="center">
                      <StatusBadge
                        status={k.is_active ? "active" : "neutral"}
                        label={k.is_active ? "Active" : "Inactive"}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenWastage(k);
                        }}
                        icon={Settings2}
                      >
                        Agreed Wastage
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </TableContainer>
          </div>

          {/* Agreed Wastage Settings Panel */}
          <div className="p-5 bg-surface border border-border rounded">
            {selectedKarigar ? (
              <div>
                <div className="pb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-background border border-border text-ink font-semibold">
                      {selectedKarigar.code}
                    </span>
                    <h3 className="text-sm font-semibold text-ink m-0">
                      {selectedKarigar.name}
                    </h3>
                  </div>
                  <p className="text-xs text-muted mt-1 m-0">
                    Contractual category wastage percentage limits
                  </p>
                </div>

                {wastageMsg && (
                  <div
                    className={`mt-3 p-2.5 rounded text-xs flex items-center gap-2 ${
                      wastageMsg.type === "success"
                        ? "bg-status-ok-tint border border-status-ok/20 text-status-ok"
                        : "bg-status-problem-tint border border-status-problem/20 text-status-problem"
                    }`}
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 stroke-[2]" />
                    <span>{wastageMsg.text}</span>
                  </div>
                )}

                <div className="mt-4 space-y-2.5">
                  {categories.map((cat) => {
                    const currentVal = wastageInputs[cat.id] || "";
                    return (
                      <div
                        key={cat.id}
                        className="p-3 rounded bg-background border border-border flex items-center justify-between gap-3"
                      >
                        <span className="text-xs font-medium text-ink">
                          {cat.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="relative w-24">
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
                              className="w-full h-8 px-2 pr-6 bg-surface border border-border rounded text-xs font-mono text-ink text-right outline-none focus:border-bronze focus:ring-1 focus:ring-bronze"
                            />
                            <span className="absolute right-2 top-2 text-xs text-muted pointer-events-none">
                              %
                            </span>
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-8 min-w-[32px] px-2"
                            onClick={() => handleSaveWastage(cat.id)}
                            disabled={savingWastage}
                            title="Save rate"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[2]" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-muted">
                <Settings2 className="w-8 h-8 mx-auto mb-2 text-muted/60 stroke-[1.5]" />
                <p className="text-xs m-0">
                  Select a karigar to view and update contractual category wastage rates.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
