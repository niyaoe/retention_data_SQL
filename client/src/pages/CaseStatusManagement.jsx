import { useEffect, useMemo, useState } from "react";
import {
  FiList,
  FiPlus,
  FiEdit2,
  FiPower,
  FiRefreshCw,
  FiSearch,
  FiX,
  FiCheckCircle,
  FiAlertCircle,
  FiChevronDown,
  FiChevronRight,
  FiLayers,
} from "react-icons/fi";

import api from "../services/api";
import "./CaseStatusManagement.css";

function CaseStatusManagement() {
  const [statuses, setStatuses] = useState([]);
  const [substatuses, setSubstatuses] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState({});
  const [modal, setModal] = useState(null);

  const [form, setForm] = useState({
    name: "",
    statusId: "",
  });

  // LOAD DATA
  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/call-section/admin/statuses");

      setStatuses(response.data.statuses || []);
      setSubstatuses(response.data.substatuses || []);
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to load case status management.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // MODALS
  const openCreateStatus = () => {
    setForm({ name: "", statusId: "" });
    setModal({ type: "createStatus" });
    setError("");
  };

  const openEditStatus = (status) => {
    setForm({
      name: status.status_name,
      statusId: "",
    });

    setModal({
      type: "editStatus",
      item: status,
    });

    setError("");
  };

  const openCreateSubstatus = (status) => {
    setForm({
      name: "",
      statusId: String(status.id),
    });

    setModal({
      type: "createSubstatus",
      item: status,
    });

    setError("");
  };

  const openEditSubstatus = (substatus) => {
    setForm({
      name: substatus.substatus_name,
      statusId: String(substatus.status_id),
    });

    setModal({
      type: "editSubstatus",
      item: substatus,
    });

    setError("");
  };

  const closeModal = () => {
    if (saving) return;

    setModal(null);
    setForm({ name: "", statusId: "" });
    setError("");
  };

  // SAVE STATUS / SUBSTATUS
  const handleSubmit = async (e) => {
    e.preventDefault();

    const name = form.name.trim();
    if (!name || !modal) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (modal.type === "createStatus") {
        await api.post("/call-section/statuses", {
          statusName: name,
        });

        setSuccess("Case status created successfully.");
      }

      if (modal.type === "editStatus") {
        await api.put(`/call-section/statuses/${modal.item.id}`, {
          statusName: name,
        });

        setSuccess("Case status updated successfully.");
      }

      if (modal.type === "createSubstatus") {
        await api.post("/call-section/substatuses", {
          statusId: Number(form.statusId),
          substatusName: name,
        });

        setSuccess("Substatus created successfully.");

        setExpanded((prev) => ({
          ...prev,
          [form.statusId]: true,
        }));
      }

      if (modal.type === "editSubstatus") {
        await api.put(`/call-section/substatuses/${modal.item.id}`, {
          substatusName: name,
        });

        setSuccess("Substatus updated successfully.");
      }

      setModal(null);
      setForm({ name: "", statusId: "" });

      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save changes.");
    } finally {
      setSaving(false);
    }
  };

  // ACTIVATE / DEACTIVATE STATUS
  const toggleStatus = async (status) => {
    const next = Number(status.is_active) === 1 ? 0 : 1;

    const confirmed = window.confirm(
      `${next ? "Activate" : "Deactivate"} "${status.status_name}"?`,
    );

    if (!confirmed) return;

    try {
      setError("");
      setSuccess("");

      await api.put(`/call-section/statuses/${status.id}`, {
        isActive: next,
      });

      setSuccess(`Status ${next ? "activated" : "deactivated"} successfully.`);

      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update status.");
    }
  };

  // ACTIVATE / DEACTIVATE SUBSTATUS
  const toggleSubstatus = async (substatus) => {
    const next = Number(substatus.is_active) === 1 ? 0 : 1;

    const confirmed = window.confirm(
      `${next ? "Activate" : "Deactivate"} "${substatus.substatus_name}"?`,
    );

    if (!confirmed) return;

    try {
      setError("");
      setSuccess("");

      await api.put(`/call-section/substatuses/${substatus.id}`, {
        isActive: next,
      });

      setSuccess(
        `Substatus ${next ? "activated" : "deactivated"} successfully.`,
      );

      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update substatus.");
    }
  };

  // FILTER
  const filteredStatuses = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return statuses;

    return statuses.filter((status) => {
      const ownMatch = status.status_name?.toLowerCase().includes(term);

      const childMatch = substatuses.some(
        (sub) =>
          Number(sub.status_id) === Number(status.id) &&
          sub.substatus_name?.toLowerCase().includes(term),
      );

      return ownMatch || childMatch;
    });
  }, [statuses, substatuses, search]);

  // COUNTS
  const activeStatuses = statuses.filter(
    (item) => Number(item.is_active) === 1,
  ).length;

  const inactiveStatuses = statuses.length - activeStatuses;

  const activeSubstatuses = substatuses.filter(
    (item) => Number(item.is_active) === 1,
  ).length;

  const inactiveSubstatuses = substatuses.length - activeSubstatuses;

  const getSubstatuses = (statusId) =>
    substatuses.filter((item) => Number(item.status_id) === Number(statusId));

  const toggleExpanded = (id) => {
    setExpanded((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const modalTitle = {
    createStatus: "Create Case Status",
    editStatus: "Rename Case Status",
    createSubstatus: "Add Substatus",
    editSubstatus: "Rename Substatus",
  };

  return (
    <div className="rd-kit-case-page">
      {/* HEADER */}
      <div className="rd-kit-case-heading">
        <div className="rd-kit-case-heading-left">
          <div className="rd-kit-case-heading-icon">
            <FiList />
          </div>

          <h2>Case Status Management</h2>
        </div>

        <div className="rd-kit-case-heading-actions">
          <button
            type="button"
            className="rd-kit-case-refresh"
            onClick={loadData}
            disabled={loading}
            title="Refresh"
          >
            <FiRefreshCw className={loading ? "rd-kit-case-spin" : ""} />
          </button>

          <button
            type="button"
            className="rd-kit-case-add"
            onClick={openCreateStatus}
          >
            <FiPlus />
            <span>Add Status</span>
          </button>
        </div>
      </div>

      {/* ALERTS */}
      {error && !modal && (
        <div className="rd-kit-case-alert rd-kit-case-alert-error">
          <FiAlertCircle />
          <span>{error}</span>

          <button type="button" onClick={() => setError("")}>
            <FiX />
          </button>
        </div>
      )}

      {success && (
        <div className="rd-kit-case-alert rd-kit-case-alert-success">
          <FiCheckCircle />
          <span>{success}</span>

          <button type="button" onClick={() => setSuccess("")}>
            <FiX />
          </button>
        </div>
      )}

      {/* SUMMARY */}
      <div className="rd-kit-case-summary">
        <div className="rd-kit-case-stat">
          <span className="rd-kit-case-stat-icon total">
            <FiList />
          </span>

          <div>
            <small>Total Statuses</small>
            <strong>{statuses.length}</strong>
          </div>
        </div>

        <div className="rd-kit-case-stat">
          <span className="rd-kit-case-stat-icon active">
            <FiCheckCircle />
          </span>

          <div>
            <small>Active Statuses</small>
            <strong>{activeStatuses}</strong>
          </div>
        </div>

        <div className="rd-kit-case-stat">
          <span className="rd-kit-case-stat-icon inactive">
            <FiPower />
          </span>

          <div>
            <small>Inactive Statuses</small>
            <strong>{inactiveStatuses}</strong>
          </div>
        </div>

        <div className="rd-kit-case-stat">
          <span className="rd-kit-case-stat-icon branches">
            <FiLayers />
          </span>

          <div>
            <small>Total Substatuses</small>
            <strong>{substatuses.length}</strong>
          </div>
        </div>
      </div>

      {/* SEARCH TOOLBAR */}
      <div className="rd-kit-case-toolbar">
        <div className="rd-kit-case-search">
          <FiSearch />

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search statuses or substatuses..."
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

        <span className="rd-kit-case-count">
          {filteredStatuses.length} / {statuses.length}
        </span>
      </div>

      {/* SCROLLABLE STATUS LIST */}
      <div className="rd-kit-case-list">
        {loading ? (
          <div className="rd-kit-case-empty">
            <FiRefreshCw className="rd-kit-case-spin" />
            Loading case statuses...
          </div>
        ) : filteredStatuses.length === 0 ? (
          <div className="rd-kit-case-empty">No case statuses found.</div>
        ) : (
          filteredStatuses.map((status) => {
            const children = getSubstatuses(status.id);
            const isActive = Number(status.is_active) === 1;
            const isExpanded = Boolean(expanded[status.id]);

            return (
              <section className="rd-kit-case-status-card" key={status.id}>
                {/* STATUS ROW */}
                <div className="rd-kit-case-status-row">
                  <button
                    type="button"
                    className="rd-kit-case-expand"
                    onClick={() => toggleExpanded(status.id)}
                    aria-label="Expand substatuses"
                  >
                    {isExpanded ? <FiChevronDown /> : <FiChevronRight />}
                  </button>

                  <div className="rd-kit-case-status-info">
                    <strong>{status.status_name}</strong>
                    <span>{children.length} substatuses</span>
                  </div>

                  <span
                    className={`rd-kit-case-status-badge ${
                      isActive ? "active" : "inactive"
                    }`}
                  >
                    <i />
                    {isActive ? "Active" : "Inactive"}
                  </span>

                  <div className="rd-kit-case-actions">
                    <button
                      type="button"
                      className="edit"
                      onClick={() => openEditStatus(status)}
                      title="Rename status"
                    >
                      <FiEdit2 />
                    </button>

                    <button
                      type="button"
                      className={isActive ? "deactivate" : "activate"}
                      onClick={() => toggleStatus(status)}
                      title={isActive ? "Deactivate" : "Activate"}
                    >
                      <FiPower />
                    </button>

                    <button
                      type="button"
                      className="add-child"
                      onClick={() => openCreateSubstatus(status)}
                      disabled={!isActive}
                      title="Add substatus"
                    >
                      <FiPlus />
                    </button>
                  </div>
                </div>

                {/* SUBSTATUS LIST */}
                {isExpanded && (
                  <div className="rd-kit-case-sub-list">
                    {children.length === 0 ? (
                      <div className="rd-kit-case-no-sub">
                        No substatuses created.
                      </div>
                    ) : (
                      children.map((sub) => {
                        const subActive = Number(sub.is_active) === 1;

                        return (
                          <div className="rd-kit-case-sub-row" key={sub.id}>
                            <span className="rd-kit-case-sub-name">
                              <FiLayers />
                              {sub.substatus_name}
                            </span>

                            <span
                              className={`rd-kit-case-status-badge ${
                                subActive ? "active" : "inactive"
                              }`}
                            >
                              <i />
                              {subActive ? "Active" : "Inactive"}
                            </span>

                            <div className="rd-kit-case-actions">
                              <button
                                type="button"
                                className="edit"
                                onClick={() => openEditSubstatus(sub)}
                                title="Rename substatus"
                              >
                                <FiEdit2 />
                              </button>

                              <button
                                type="button"
                                className={
                                  subActive ? "deactivate" : "activate"
                                }
                                onClick={() => toggleSubstatus(sub)}
                                title={subActive ? "Deactivate" : "Activate"}
                              >
                                <FiPower />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {modal && (
        <div
          className="rd-kit-case-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <section
            className="rd-kit-case-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rd-kit-case-modal-title"
          >
            <div className="rd-kit-case-modal-header">
              <div className="rd-kit-case-modal-heading">
                <span className="rd-kit-case-modal-icon">
                  {modal.type.includes("edit") ? <FiEdit2 /> : <FiPlus />}
                </span>

                <h3 id="rd-kit-case-modal-title">{modalTitle[modal.type]}</h3>
              </div>

              <button
                type="button"
                className="rd-kit-case-modal-close"
                onClick={closeModal}
                disabled={saving}
                aria-label="Close"
              >
                <FiX />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="rd-kit-case-form">
              {error && (
                <div className="rd-kit-case-alert rd-kit-case-alert-error">
                  <FiAlertCircle />
                  <span>{error}</span>
                </div>
              )}

              {modal.type === "createSubstatus" && (
                <div className="rd-kit-case-field">
                  <label>Parent Status</label>

                  <input value={modal.item.status_name} disabled />
                </div>
              )}

              <div className="rd-kit-case-field">
                <label>
                  {modal.type.includes("Substatus")
                    ? "Substatus Name"
                    : "Status Name"}
                </label>

                <input
                  autoFocus
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder="Enter name"
                  maxLength={100}
                  required
                />
              </div>

              <div className="rd-kit-case-form-note">
                <FiList />
                Case status and substatus configuration
              </div>

              <div className="rd-kit-case-modal-footer">
                <button
                  type="button"
                  className="rd-kit-case-cancel"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="rd-kit-case-save"
                  disabled={saving || !form.name.trim()}
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export default CaseStatusManagement;
