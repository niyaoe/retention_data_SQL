
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiLayers,
  FiSearch,
  FiRefreshCw,
  FiX,
  FiCheckCircle,
  FiAlertCircle,
  FiPlus,
  FiEdit2,
  FiUpload,
  FiPower
} from "react-icons/fi";

import api from "../services/api";
import "./ModelManagement.css";

function ModelManagement() {
  const fileInputRef = useRef(null);

  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [segmentFilter, setSegmentFilter] = useState("all");

  const [showModal, setShowModal] = useState(false);
  const [editingModel, setEditingModel] = useState(null);

  const [form, setForm] = useState({
    model_group: "",
    segment: "",
    sub_segment: ""
  });

  const [importReport, setImportReport] = useState(null);

  const loadModels = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/models");
      setModels(response.data.models || []);
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to load models."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModels();
  }, []);

  const activeCount = models.filter(
    (model) => Number(model.is_active) === 1
  ).length;

  const inactiveCount = models.length - activeCount;

  const segments = useMemo(
    () => [...new Set(models.map((model) => model.segment).filter(Boolean))].sort(),
    [models]
  );

  const filteredModels = useMemo(() => {
    const query = search.trim().toLowerCase();

    return models.filter((model) => {
      const matchesSearch = [
        model.model_group,
        model.segment,
        model.sub_segment
      ].some((value) =>
        String(value || "").toLowerCase().includes(query)
      );

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && Number(model.is_active) === 1) ||
        (statusFilter === "inactive" && Number(model.is_active) === 0);

      const matchesSegment =
        segmentFilter === "all" || model.segment === segmentFilter;

      return matchesSearch && matchesStatus && matchesSegment;
    });
  }, [models, search, statusFilter, segmentFilter]);

  const openCreateModal = () => {
    setEditingModel(null);
    setForm({
      model_group: "",
      segment: "",
      sub_segment: ""
    });
    setError("");
    setShowModal(true);
  };

  const openEditModal = (model) => {
    setEditingModel(model);
    setForm({
      model_group: model.model_group || "",
      segment: model.segment || "",
      sub_segment: model.sub_segment || ""
    });
    setError("");
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;
    setShowModal(false);
    setEditingModel(null);
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({
      ...previous,
      [name]: value
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();

    if (!form.model_group.trim() || !form.segment.trim()) {
      setError("Model Group and Segment are required.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      if (editingModel) {
        await api.put(`/models/${editingModel.id}`, form);
        setSuccess("Model updated successfully.");
      } else {
        await api.post("/models", form);
        setSuccess("Model created successfully.");
      }

      setShowModal(false);
      setEditingModel(null);
      await loadModels();
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to save model."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (model) => {
    const action = Number(model.is_active) === 1
      ? "deactivate"
      : "activate";

    if (!window.confirm(`Are you sure you want to ${action} ${model.model_group}?`)) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      await api.patch(`/models/${model.id}/status`);
      setSuccess(`${model.model_group} ${action}d successfully.`);
      await loadModels();
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to update model status."
      );
    }
  };

  const handleExcelImport = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const extension = file.name.split(".").pop().toLowerCase();

    if (!["xlsx", "xls"].includes(extension)) {
      setError("Please select an .xlsx or .xls file.");
      event.target.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Excel file must be below 10 MB.");
      event.target.value = "";
      return;
    }

    const confirmed = window.confirm(
      "Import this Model Master Excel file? Existing model mappings will be updated."
    );

    if (!confirmed) {
      event.target.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setImporting(true);
    setError("");
    setSuccess("");
    setImportReport(null);

    try {
      const response = await api.post(
        "/model-import/import",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data"
          }
        }
      );

      setImportReport(response.data.report);
      setSuccess(response.data.message || "Model import completed.");
      await loadModels();
    } catch (err) {
      setError(
        err.response?.data?.message || "Model Excel import failed."
      );
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  const formatNumber = (value) =>
    Number(value || 0).toLocaleString("en-IN");

  return (
    <div className="rd-kit-models-page">

      <div className="rd-kit-models-heading">
        <div className="rd-kit-models-heading-left">
          <div className="rd-kit-models-heading-icon">
            <FiLayers />
          </div>
          <h2>Model Management</h2>
        </div>

        <div className="rd-kit-models-heading-actions">
          <button
            type="button"
            className="rd-kit-models-refresh"
            onClick={loadModels}
            disabled={loading || importing}
          >
            <FiRefreshCw className={loading ? "rd-kit-models-spin" : ""} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            className="rd-kit-models-import"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            {importing ? (
              <FiRefreshCw className="rd-kit-models-spin" />
            ) : (
              <FiUpload />
            )}
            <span>{importing ? "Importing..." : "Import Excel"}</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            hidden
            onChange={handleExcelImport}
          />

          <button
            type="button"
            className="rd-kit-models-add"
            onClick={openCreateModal}
          >
            <FiPlus />
            <span>Add Model</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rd-kit-models-alert error">
          <FiAlertCircle />
          <span>{error}</span>
          <button type="button" onClick={() => setError("")}>
            <FiX />
          </button>
        </div>
      )}

      {success && (
        <div className="rd-kit-models-alert success">
          <FiCheckCircle />
          <span>{success}</span>
          <button type="button" onClick={() => setSuccess("")}>
            <FiX />
          </button>
        </div>
      )}

      <div className="rd-kit-models-summary">
        <div className="rd-kit-models-stat">
          <span className="rd-kit-models-stat-icon total">
            <FiLayers />
          </span>
          <div>
            <small>Total Models</small>
            <strong>{formatNumber(models.length)}</strong>
          </div>
        </div>

        <div className="rd-kit-models-stat">
          <span className="rd-kit-models-stat-icon active">
            <FiCheckCircle />
          </span>
          <div>
            <small>Active Models</small>
            <strong>{formatNumber(activeCount)}</strong>
          </div>
        </div>

        <div className="rd-kit-models-stat">
          <span className="rd-kit-models-stat-icon inactive">
            <FiPower />
          </span>
          <div>
            <small>Inactive Models</small>
            <strong>{formatNumber(inactiveCount)}</strong>
          </div>
        </div>
      </div>

      <div className="rd-kit-models-toolbar">
        <div className="rd-kit-models-search">
          <FiSearch />
          <input
            type="text"
            placeholder="Search model, segment or sub-segment..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          {search && (
            <button type="button" onClick={() => setSearch("")}>
              <FiX />
            </button>
          )}
        </div>

        <select
          className="rd-kit-models-filter"
          value={segmentFilter}
          onChange={(event) => setSegmentFilter(event.target.value)}
        >
          <option value="all">All Segments</option>
          {segments.map((segment) => (
            <option key={segment} value={segment}>
              {segment}
            </option>
          ))}
        </select>

        <select
          className="rd-kit-models-filter"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="all">All Models</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <span className="rd-kit-models-count">
          {filteredModels.length} / {models.length}
        </span>
      </div>

      <div className="rd-kit-models-table-container">
        <table className="rd-kit-models-table">
          <thead>
            <tr>
              <th className="rd-kit-models-number-col">#</th>
              <th>Model Group</th>
              <th>Segment</th>
              <th>Sub Segment</th>
              <th>Status</th>
              <th className="rd-kit-models-action-col">Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="rd-kit-models-empty">
                  <FiRefreshCw className="rd-kit-models-spin" />
                  Loading models...
                </td>
              </tr>
            ) : filteredModels.length === 0 ? (
              <tr>
                <td colSpan="6" className="rd-kit-models-empty">
                  No models found.
                </td>
              </tr>
            ) : (
              filteredModels.map((model, index) => {
                const active = Number(model.is_active) === 1;

                return (
                  <tr key={model.id}>
                    <td className="rd-kit-models-number">{index + 1}</td>

                    <td>
                      <div className="rd-kit-models-name">
                        <span className="rd-kit-models-row-icon">
                          <FiLayers />
                        </span>
                        <strong>{model.model_group}</strong>
                      </div>
                    </td>

                    <td>
                      <span className="rd-kit-models-segment">
                        {model.segment || "—"}
                      </span>
                    </td>

                    <td>{model.sub_segment || "—"}</td>

                    <td>
                      <span className={`rd-kit-models-status ${active ? "active" : "inactive"}`}>
                        <i />
                        {active ? "Active" : "Inactive"}
                      </span>
                    </td>

                    <td>
                      <div className="rd-kit-models-actions">
                        <button
                          type="button"
                          className="rd-kit-models-edit"
                          onClick={() => openEditModal(model)}
                          title="Edit model"
                        >
                          <FiEdit2 />
                        </button>

                        <button
                          type="button"
                          className={`rd-kit-models-toggle ${active ? "deactivate" : "activate"}`}
                          onClick={() => handleToggleStatus(model)}
                          title={active ? "Deactivate model" : "Activate model"}
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

      {importReport && (
        <div className="rd-kit-models-import-report">
          <div className="rd-kit-models-report-heading">
            <FiCheckCircle />
            <strong>Last Excel Import Report</strong>
          </div>

          <div className="rd-kit-models-report-grid">
            <div>
              <small>Total Rows</small>
              <strong>{formatNumber(importReport.totalRows)}</strong>
            </div>
            <div>
              <small>Inserted</small>
              <strong>{formatNumber(importReport.inserted)}</strong>
            </div>
            <div>
              <small>Updated</small>
              <strong>{formatNumber(importReport.updated)}</strong>
            </div>
            <div>
              <small>Duplicates</small>
              <strong>{formatNumber(importReport.duplicateRows)}</strong>
            </div>
            <div>
              <small>Invalid Rows</small>
              <strong>
                {formatNumber(
                  (importReport.blankModelRows || 0) +
                  (importReport.blankSegmentRows || 0)
                )}
              </strong>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div
          className="rd-kit-models-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <section
            className="rd-kit-models-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rd-kit-models-modal-title"
          >
            <div className="rd-kit-models-modal-header">
              <div className="rd-kit-models-modal-heading">
                <span className="rd-kit-models-modal-icon">
                  <FiLayers />
                </span>
                <div>
                  <h3 id="rd-kit-models-modal-title">
                    {editingModel ? "Edit Model" : "Add New Model"}
                  </h3>
                  <span>Model Master Details</span>
                </div>
              </div>

              <button
                type="button"
                className="rd-kit-models-modal-close"
                onClick={closeModal}
                disabled={saving}
              >
                <FiX />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="rd-kit-models-modal-body">
                <div className="rd-kit-models-form-grid">
                  <label>
                    Model Group <span>*</span>
                    <input
                      name="model_group"
                      value={form.model_group}
                      onChange={handleFormChange}
                      placeholder="Enter model group"
                      required
                    />
                  </label>

                  <label>
                    Segment <span>*</span>
                    <input
                      name="segment"
                      value={form.segment}
                      onChange={handleFormChange}
                      placeholder="Enter segment"
                      required
                    />
                  </label>

                  <label className="rd-kit-models-full-field">
                    Sub Segment
                    <input
                      name="sub_segment"
                      value={form.sub_segment}
                      onChange={handleFormChange}
                      placeholder="Enter sub-segment"
                    />
                  </label>
                </div>
              </div>

              <div className="rd-kit-models-modal-footer">
                <button
                  type="button"
                  className="rd-kit-models-cancel"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="rd-kit-models-save"
                  disabled={saving}
                >
                  {saving ? "Saving..." : editingModel ? "Update Model" : "Create Model"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export default ModelManagement;
