import { useEffect, useMemo, useState } from "react";
import {
  FiMapPin,
  FiSearch,
  FiRefreshCw,
  FiEye,
  FiX,
  FiGitBranch,
  FiCheckCircle,
  FiAlertCircle,
  FiLayers,
  FiPlus,
  FiEdit2,
  FiPower,
  FiSave,
} from "react-icons/fi";

import api from "../services/api";
import "./BranchManagement.css";

const emptyForm = {
  district: "",
  branchName: "",
  locationCode: "",
  dmsName: "",
  mdReportName: "",
  branchShort: "",
  slC: "",
  slB: "",
  aopDistrict: "",
  bsZone: "",
  dCode: "",
  preH2: "",
};

const formFields = [
  ["branchName", "Branch Name", true],
  ["district", "District", true],
  ["locationCode", "Location Code", true],
  ["dCode", "D-Code"],
  ["branchShort", "Branch Short", true],
  ["dmsName", "DMS Name"],
  ["mdReportName", "For MD Report"],
  ["slC", "SL C"],
  ["slB", "SL B"],
  ["aopDistrict", "AOP District"],
  ["bsZone", "BS Zone"],
  ["preH2", "PRE-H2"],
];

function BranchManagement() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selectedBranch, setSelectedBranch] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadBranches = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/branches");
      setBranches(response.data.branches || []);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load branches.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranches();
  }, []);

  const getStatus = (branch) => {
    const value = String(branch.status ?? "active").toLowerCase();

    return ["inactive", "disabled", "false", "0"].includes(value)
      ? "inactive"
      : "active";
  };

  const filteredBranches = useMemo(() => {
    const query = search.trim().toLowerCase();

    return branches.filter((branch) => {
      const matchesSearch = [
        branch.branchName,
        branch.locationCode,
        branch.dCode,
        branch.district,
        branch.branchShort,
        branch.dmsName,
        branch.mdReportName,
        branch.aopDistrict,
        branch.bsZone,
      ].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(query),
      );

      const matchesStatus =
        statusFilter === "all" || getStatus(branch) === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [branches, search, statusFilter]);

  const activeCount = branches.filter(
    (branch) => getStatus(branch) === "active",
  ).length;

  const inactiveCount = branches.length - activeCount;

  const openCreate = () => {
    setError("");
    setSuccess("");
    setEditingBranch(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (branch) => {
    setError("");
    setSuccess("");
    setSelectedBranch(null);
    setEditingBranch(branch);

    setForm({
      district: branch.district || "",
      branchName: branch.branchName || "",
      locationCode: branch.locationCode || "",
      dmsName: branch.dmsName || "",
      mdReportName: branch.mdReportName || "",
      branchShort: branch.branchShort || "",
      slC: branch.slC || "",
      slB: branch.slB || "",
      aopDistrict: branch.aopDistrict || "",
      bsZone: branch.bsZone || "",
      dCode: branch.dCode || "",
      preH2: branch.preH2 || "",
    });

    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;
    setShowForm(false);
    setEditingBranch(null);
    setForm(emptyForm);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: name === "branchShort" ? value.toUpperCase() : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (
      !form.branchName.trim() ||
      !form.district.trim() ||
      !form.locationCode.trim() ||
      !form.branchShort.trim()
    ) {
      setError(
        "Branch name, district, location code and branch short are required.",
      );
      return;
    }

    setSaving(true);

    try {
      if (editingBranch) {
        await api.put(`/branches/${editingBranch.id}`, form);
        setSuccess("Branch updated successfully.");
      } else {
        await api.post("/branches", form);
        setSuccess("Branch created successfully.");
      }

      setShowForm(false);
      setEditingBranch(null);
      setForm(emptyForm);

      await loadBranches();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save branch.");
    } finally {
      setSaving(false);
    }
  };

  const toggleBranchStatus = async (branch) => {
    const currentStatus = getStatus(branch);
    const isActive = currentStatus !== "active";

    const action = isActive ? "activate" : "deactivate";

    if (
      !window.confirm(
        `Are you sure you want to ${action} ${branch.branchName}?`,
      )
    ) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      await api.patch(`/branches/${branch.id}/status`, {
        isActive,
      });

      setSuccess(
        `${branch.branchName} ${isActive ? "activated" : "deactivated"} successfully.`,
      );

      await loadBranches();
    } catch (err) {
      setError(err.response?.data?.message || `Unable to ${action} branch.`);
    }
  };

  const detailFields = selectedBranch
    ? [
        ["Branch Name", selectedBranch.branchName],
        ["D-Code", selectedBranch.dCode],
        ["Location Code", selectedBranch.locationCode],
        ["Branch Short", selectedBranch.branchShort],
        ["District", selectedBranch.district],
        ["DMS Name", selectedBranch.dmsName],
        ["MD Report Name", selectedBranch.mdReportName],
        ["SL C", selectedBranch.slC],
        ["SL B", selectedBranch.slB],
        ["AOP District", selectedBranch.aopDistrict],
        ["BS Zone", selectedBranch.bsZone],
        ["Pre H2", selectedBranch.preH2],
      ]
    : [];

  return (
    <div className="rd-kit-branches-page">
      {/* HEADER */}
      <div className="rd-kit-branches-heading">
        <div className="rd-kit-branches-heading-left">
          <div className="rd-kit-branches-heading-icon">
            <FiGitBranch />
          </div>
          <h2>Branch Management</h2>
        </div>

        <div className="rd-kit-branches-heading-actions">
          <button
            type="button"
            className="rd-kit-branches-add"
            onClick={openCreate}
          >
            <FiPlus />
            <span>Add Branch</span>
          </button>

          <button
            type="button"
            className="rd-kit-branches-refresh"
            onClick={loadBranches}
            disabled={loading}
            title="Refresh branches"
          >
            <FiRefreshCw className={loading ? "rd-kit-branches-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ALERTS */}
      {error && (
        <div className="rd-kit-branches-alert">
          <FiAlertCircle />
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Dismiss error"
          >
            <FiX />
          </button>
        </div>
      )}

      {success && (
        <div className="rd-kit-branches-success">
          <FiCheckCircle />
          <span>{success}</span>
          <button
            type="button"
            onClick={() => setSuccess("")}
            aria-label="Dismiss message"
          >
            <FiX />
          </button>
        </div>
      )}

      {/* SUMMARY */}
      <div className="rd-kit-branches-summary">
        <div className="rd-kit-branches-stat">
          <span className="rd-kit-branches-stat-icon total">
            <FiLayers />
          </span>
          <div>
            <small>Total Branches</small>
            <strong>{branches.length}</strong>
          </div>
        </div>

        <div className="rd-kit-branches-stat">
          <span className="rd-kit-branches-stat-icon active">
            <FiCheckCircle />
          </span>
          <div>
            <small>Active Branches</small>
            <strong>{activeCount}</strong>
          </div>
        </div>

        <div className="rd-kit-branches-stat">
          <span className="rd-kit-branches-stat-icon inactive">
            <FiMapPin />
          </span>
          <div>
            <small>Inactive Branches</small>
            <strong>{inactiveCount}</strong>
          </div>
        </div>
      </div>

      {/* SEARCH AND FILTER */}
      <div className="rd-kit-branches-toolbar">
        <div className="rd-kit-branches-search">
          <FiSearch />

          <input
            type="text"
            placeholder="Search branch, D-Code, district..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              title="Clear search"
            >
              <FiX />
            </button>
          )}
        </div>

        <select
          className="rd-kit-branches-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter branches by status"
        >
          <option value="all">All Branches</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <span className="rd-kit-branches-count">
          {filteredBranches.length} / {branches.length}
        </span>
      </div>

      {/* TABLE */}
      <div className="rd-kit-branches-table-container">
        <table className="rd-kit-branches-table">
          <thead>
            <tr>
              <th className="rd-kit-branches-number-col">#</th>
              <th>Branch Name</th>
              <th>D-Code</th>
              <th>Branch Short</th>
              <th>District</th>
              <th>DMS Name</th>
              <th>BS Zone</th>
              <th>Status</th>
              <th className="rd-kit-branches-action-col">Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="9" className="rd-kit-branches-empty">
                  <FiRefreshCw className="rd-kit-branches-spin" />
                  Loading branches...
                </td>
              </tr>
            ) : filteredBranches.length === 0 ? (
              <tr>
                <td colSpan="9" className="rd-kit-branches-empty">
                  No branches found
                </td>
              </tr>
            ) : (
              filteredBranches.map((branch, index) => {
                const status = getStatus(branch);

                return (
                  <tr key={branch.id}>
                    <td className="rd-kit-branches-number">{index + 1}</td>

                    <td>
                      <div className="rd-kit-branches-name">
                        <span className="rd-kit-branches-row-icon">
                          <FiMapPin />
                        </span>
                        <strong>{branch.branchName || "—"}</strong>
                      </div>
                    </td>

                    <td>
                      <span className="rd-kit-branches-code">
                        {branch.dCode || "—"}
                      </span>
                    </td>

                    <td>{branch.branchShort || "—"}</td>
                    <td>{branch.district || "—"}</td>
                    <td>{branch.dmsName || "—"}</td>
                    <td>{branch.bsZone || "—"}</td>

                    <td>
                      <span className={`rd-kit-branches-status ${status}`}>
                        <i />
                        {status}
                      </span>
                    </td>

                    <td>
                      <div className="rd-kit-branches-row-actions">
                        <button
                          type="button"
                          className="rd-kit-branches-view"
                          onClick={() => setSelectedBranch(branch)}
                          title="View branch"
                        >
                          <FiEye />
                        </button>

                        <button
                          type="button"
                          className="rd-kit-branches-edit"
                          onClick={() => openEdit(branch)}
                          title="Edit branch"
                        >
                          <FiEdit2 />
                        </button>

                        <button
                          type="button"
                          className={`rd-kit-branches-power ${status}`}
                          onClick={() => toggleBranchStatus(branch)}
                          title={
                            status === "active"
                              ? "Deactivate branch"
                              : "Activate branch"
                          }
                        >
                          <FiPower />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* CREATE / EDIT MODAL */}
      {showForm && (
        <div
          className="rd-kit-branches-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeForm();
          }}
        >
          <section
            className="rd-kit-branches-modal rd-kit-branches-form-modal"
            role="dialog"
            aria-modal="true"
          >
            <div className="rd-kit-branches-modal-header">
              <div className="rd-kit-branches-modal-heading">
                <span className="rd-kit-branches-modal-icon">
                  {editingBranch ? <FiEdit2 /> : <FiPlus />}
                </span>

                <div>
                  <h3>{editingBranch ? "Update Branch" : "Create Branch"}</h3>
                  <span>Branch information</span>
                </div>
              </div>

              <button
                type="button"
                className="rd-kit-branches-modal-close"
                onClick={closeForm}
                disabled={saving}
                aria-label="Close"
              >
                <FiX />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="rd-kit-branches-modal-body">
                <div className="rd-kit-branches-form-grid">
                  {formFields.map(([name, label, required]) => (
                    <div className="rd-kit-branches-form-field" key={name}>
                      <label htmlFor={`branch-${name}`}>
                        {label}
                        {required && <span> *</span>}
                      </label>

                      <input
                        id={`branch-${name}`}
                        name={name}
                        value={form[name]}
                        onChange={handleFormChange}
                        required={Boolean(required)}
                        autoComplete="off"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="rd-kit-branches-modal-footer">
                <button
                  type="button"
                  className="rd-kit-branches-cancel"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="rd-kit-branches-save"
                  disabled={saving}
                >
                  {saving ? (
                    <FiRefreshCw className="rd-kit-branches-spin" />
                  ) : (
                    <FiSave />
                  )}
                  {saving
                    ? "Saving..."
                    : editingBranch
                      ? "Update Branch"
                      : "Create Branch"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* BRANCH DETAILS MODAL */}
      {selectedBranch && (
        <div
          className="rd-kit-branches-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedBranch(null);
            }
          }}
        >
          <section
            className="rd-kit-branches-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rd-kit-branches-modal-title"
          >
            <div className="rd-kit-branches-modal-header">
              <div className="rd-kit-branches-modal-heading">
                <span className="rd-kit-branches-modal-icon">
                  <FiGitBranch />
                </span>

                <div>
                  <h3 id="rd-kit-branches-modal-title">
                    {selectedBranch.branchName || "Branch Details"}
                  </h3>
                  <span>D-Code: {selectedBranch.dCode || "—"}</span>
                </div>
              </div>

              <button
                type="button"
                className="rd-kit-branches-modal-close"
                onClick={() => setSelectedBranch(null)}
                aria-label="Close"
              >
                <FiX />
              </button>
            </div>

            <div className="rd-kit-branches-modal-body">
              <div className="rd-kit-branches-detail-grid">
                {detailFields.map(([label, value]) => (
                  <div className="rd-kit-branches-detail-item" key={label}>
                    <span>{label}</span>
                    <strong>{value || "—"}</strong>
                  </div>
                ))}
              </div>

              <div className="rd-kit-branches-detail-status">
                <span>Status</span>
                <span
                  className={`rd-kit-branches-status ${getStatus(selectedBranch)}`}
                >
                  <i />
                  {getStatus(selectedBranch)}
                </span>
              </div>
            </div>

            <div className="rd-kit-branches-modal-footer">
              <button
                type="button"
                onClick={() => {
                  const branch = selectedBranch;
                  openEdit(branch);
                }}
              >
                <FiEdit2 /> Edit Branch
              </button>

              <button type="button" onClick={() => setSelectedBranch(null)}>
                Close
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default BranchManagement;
