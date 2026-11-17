
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
  FiLayers
} from "react-icons/fi";

import api from "../services/api";
import "./BranchManagement.css";

function BranchManagement() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedBranch, setSelectedBranch] = useState(null);

  const loadBranches = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/branches");
      setBranches(response.data.branches || []);
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to load branches."
      );
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
        branch.district,
        branch.branchShort,
        branch.dmsName,
        branch.mdReportName,
        branch.aopDistrict,
        branch.bsZone
      ].some((value) =>
        String(value || "").toLowerCase().includes(query)
      );

      const matchesStatus =
        statusFilter === "all" || getStatus(branch) === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [branches, search, statusFilter]);

  const activeCount = branches.filter(
    (branch) => getStatus(branch) === "active"
  ).length;

  const inactiveCount = branches.length - activeCount;

  const detailFields = selectedBranch
    ? [
        ["Branch Name", selectedBranch.branchName],
        ["Location Code", selectedBranch.locationCode],
        ["Branch Short", selectedBranch.branchShort],
        ["District", selectedBranch.district],
        ["DMS Name", selectedBranch.dmsName],
        ["MD Report Name", selectedBranch.mdReportName],
        ["SL C", selectedBranch.slC],
        ["SL B", selectedBranch.slB],
        ["AOP District", selectedBranch.aopDistrict],
        ["BS Zone", selectedBranch.bsZone],
        ["D Code", selectedBranch.dCode],
        ["Pre H2", selectedBranch.preH2]
      ]
    : [];

  return (
    <div className="rd-kit-branches-page">

      {/* Header */}
      <div className="rd-kit-branches-heading">
        <div className="rd-kit-branches-heading-left">
          <div className="rd-kit-branches-heading-icon">
            <FiGitBranch />
          </div>
          <h2>Branch Management</h2>
        </div>

        <button
          type="button"
          className="rd-kit-branches-refresh"
          onClick={loadBranches}
          disabled={loading}
          title="Refresh branches"
        >
          <FiRefreshCw
            className={loading ? "rd-kit-branches-spin" : ""}
          />
          <span>Refresh</span>
        </button>
      </div>

      {/* Error */}
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

      {/* Summary */}
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

      {/* Search and filter */}
      <div className="rd-kit-branches-toolbar">
        <div className="rd-kit-branches-search">
          <FiSearch />

          <input
            type="text"
            placeholder="Search branch, code, district or location..."
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

      {/* Branch table */}
      <div className="rd-kit-branches-table-container">
        <table className="rd-kit-branches-table">
          <thead>
            <tr>
              <th className="rd-kit-branches-number-col">#</th>
              <th>Branch Name</th>
              <th>Location Code</th>
              <th>Branch Short</th>
              <th>District</th>
              <th>DMS Name</th>
              <th>BS Zone</th>
              <th>Status</th>
              <th className="rd-kit-branches-action-col">Action</th>
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
                  <tr key={branch._id}>
                    <td className="rd-kit-branches-number">
                      {index + 1}
                    </td>

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
                        {branch.locationCode || "—"}
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
                      <button
                        type="button"
                        className="rd-kit-branches-view"
                        onClick={() => setSelectedBranch(branch)}
                        title="View branch details"
                      >
                        <FiEye />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Branch details modal */}
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
                  <span>{selectedBranch.locationCode || "—"}</span>
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
                  <div
                    className="rd-kit-branches-detail-item"
                    key={label}
                  >
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
                onClick={() => setSelectedBranch(null)}
              >
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
