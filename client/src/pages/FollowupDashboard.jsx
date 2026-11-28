
import { useCallback, useEffect, useState } from "react";
import {
  FiCalendar,
  FiAlertCircle,
  FiCheckCircle,
  FiRefreshCw,
  FiSearch,
  FiPhone,
  FiChevronLeft,
  FiChevronRight,
  FiUsers,
  FiX,
  FiMessageSquare,
  FiFolder,
} from "react-icons/fi";

import ChassisDetailsModal from "../components/ChassisDetailsModal";
import api from "../services/api";
import "./FollowupDashboard.css";

const PAGE_LIMIT = 25;

const OPEN_FILTERS = [
  { label: "All Open", value: "" },
  { label: "Follow-up", value: "Follow-up" },
  { label: "Complaint", value: "Complaint" },
];

function FollowupDashboard() {
  const currentUser = JSON.parse(
    sessionStorage.getItem("retention_user") || "{}"
  );

  const isAdmin = currentUser.role === "admin";

  const [summary, setSummary] = useState({
    total: 0,
    open: 0,
    closed: 0,
    complaints: 0,
    followups: 0,
  });

  const [followups, setFollowups] = useState([]);
  const [users, setUsers] = useState([]);

  const [view, setView] = useState("open");
  const [statusFilter, setStatusFilter] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_LIMIT,
    total: 0,
    totalPages: 0,
  });

  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedChassis, setSelectedChassis] = useState(null);

  // LOAD SUMMARY
  const loadSummary = useCallback(async () => {
    const params = {};

    if (isAdmin && assignedTo) {
      params.assignedTo = assignedTo;
    }

    const response = await api.get("/call-section/followups/summary", {
      params,
    });

    setSummary(
      response.data.summary || {
        total: 0,
        open: 0,
        closed: 0,
        complaints: 0,
        followups: 0,
      }
    );
  }, [isAdmin, assignedTo]);

  // LOAD RECORDS
  const loadFollowups = useCallback(async () => {
    const params = {
      page,
      limit: PAGE_LIMIT,
      view,
    };

    if (view === "open" && statusFilter) {
      params.status = statusFilter;
    }

    if (isAdmin && assignedTo) {
      params.assignedTo = assignedTo;
    }

    const response = await api.get("/call-section/followups", { params });

    setFollowups(response.data.followups || []);

    setPagination(
      response.data.pagination || {
        page: 1,
        limit: PAGE_LIMIT,
        total: 0,
        totalPages: 0,
      }
    );
  }, [page, view, statusFilter, isAdmin, assignedTo]);

  // LOAD ACTIVE USERS FOR ADMIN
  const loadUsers = useCallback(async () => {
    if (!isAdmin) return;

    const response = await api.get("/users");

    setUsers(
      (response.data.users || []).filter(
        (user) => user.status === "active" || user.is_active === 1
      )
    );
  }, [isAdmin]);

  // LOAD DASHBOARD
  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      await Promise.all([
        loadSummary(),
        loadFollowups(),
        loadUsers(),
      ]);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load follow-up dashboard."
      );
    } finally {
      setLoading(false);
    }
  }, [loadSummary, loadFollowups, loadUsers]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // CHANGE MAIN TAB
  const handleViewChange = (nextView) => {
    setView(nextView);
    setStatusFilter("");
    setPage(1);
    setSearch("");
  };

  // CHANGE OPEN STATUS FILTER
  const handleStatusChange = (nextStatus) => {
    setStatusFilter(nextStatus);
    setPage(1);
    setSearch("");
  };

  // ADMIN ASSIGNMENT
  const handleAssign = async (recordId, userId) => {
    if (!userId) return;

    setActionId(recordId);
    setError("");
    setSuccess("");

    try {
      await api.put(`/call-section/followups/${recordId}/assign`, {
        userId: Number(userId),
      });

      setSuccess("Record assigned successfully.");
      await loadDashboard();
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to assign record."
      );
    } finally {
      setActionId(null);
    }
  };

  // SEARCH CURRENT PAGE
  const filteredFollowups = followups.filter((item) => {
    const term = search.toLowerCase().trim();

    if (!term) return true;

    return (
      item.chassis_number?.toLowerCase().includes(term) ||
      item.assigned_to_name?.toLowerCase().includes(term) ||
      item.phone_number?.toLowerCase().includes(term) ||
      item.status_name?.toLowerCase().includes(term) ||
      item.substatus_name?.toLowerCase().includes(term) ||
      item.call_status?.toLowerCase().includes(term) ||
      item.customer_voice?.toLowerCase().includes(term)
    );
  });

  const formatDate = (date) => {
    if (!date) return "—";

    const value = String(date).slice(0, 10);
    const parsed = new Date(`${value}T00:00:00`);

    if (Number.isNaN(parsed.getTime())) return "—";

    return parsed.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getStatusClass = (status) => {
    if (status === "Closed") return "closed";
    if (status === "Complaint") return "complaint";
    if (status === "Follow-up") return "followup";
    return "";
  };

  const getUserId = (user) => user.id ?? user._id;

  const getUserName = (user) =>
    user.full_name || user.name || user.username || "Unnamed user";

  const columnCount = isAdmin ? 9 : 8;

  return (
    <div className="rd-kit-followups-page">
      {/* HEADER */}
      <div className="rd-kit-followups-heading">
        <div className="rd-kit-followups-heading-left">
          <div className="rd-kit-followups-heading-icon">
            <FiCalendar />
          </div>

          <div>
            <h2>Follow-up Dashboard</h2>
            <small>Manage customer calls and follow-up records</small>
          </div>
        </div>

        <button
          type="button"
          className="rd-kit-followups-refresh"
          onClick={loadDashboard}
          disabled={loading}
          title="Refresh"
        >
          <FiRefreshCw
            className={loading ? "rd-kit-followups-spin" : ""}
          />
        </button>
      </div>

      {/* ALERTS */}
      {error && (
        <div className="rd-kit-followups-alert rd-kit-followups-alert-error">
          <FiAlertCircle />
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Close error"
          >
            <FiX />
          </button>
        </div>
      )}

      {success && (
        <div className="rd-kit-followups-alert rd-kit-followups-alert-success">
          <FiCheckCircle />
          <span>{success}</span>
          <button
            type="button"
            onClick={() => setSuccess("")}
            aria-label="Close message"
          >
            <FiX />
          </button>
        </div>
      )}

      {/* SUMMARY */}
      <div className="rd-kit-followups-summary">
        <div className="rd-kit-followups-stat">
          <span className="rd-kit-followups-stat-icon total">
            <FiUsers />
          </span>
          <div>
            <small>Total Records</small>
            <strong>{summary.total}</strong>
          </div>
        </div>

        <div className="rd-kit-followups-stat">
          <span className="rd-kit-followups-stat-icon open">
            <FiFolder />
          </span>
          <div>
            <small>Open Calls</small>
            <strong>{summary.open}</strong>
          </div>
        </div>

        <div className="rd-kit-followups-stat">
          <span className="rd-kit-followups-stat-icon complaint">
            <FiAlertCircle />
          </span>
          <div>
            <small>Complaints</small>
            <strong>{summary.complaints}</strong>
          </div>
        </div>

        <div className="rd-kit-followups-stat">
          <span className="rd-kit-followups-stat-icon closed">
            <FiCheckCircle />
          </span>
          <div>
            <small>Closed Calls</small>
            <strong>{summary.closed}</strong>
          </div>
        </div>
      </div>

      {/* MAIN TABS */}
      <div className="rd-kit-followups-main-tabs">
        <button
          type="button"
          className={view === "open" ? "active open-tab" : ""}
          onClick={() => handleViewChange("open")}
        >
          <FiFolder />
          Open Calls
          <span>{summary.open}</span>
        </button>

        <button
          type="button"
          className={view === "closed" ? "active closed-tab" : ""}
          onClick={() => handleViewChange("closed")}
        >
          <FiCheckCircle />
          Closed Calls
          <span>{summary.closed}</span>
        </button>
      </div>

      {/* TOOLBAR */}
      <div className="rd-kit-followups-toolbar">
        <div className="rd-kit-followups-filters">
          {view === "open" ? (
            OPEN_FILTERS.map((item) => (
              <button
                type="button"
                key={item.value || "all"}
                className={statusFilter === item.value ? "active" : ""}
                onClick={() => handleStatusChange(item.value)}
              >
                {item.label}
              </button>
            ))
          ) : (
            <span className="rd-kit-followups-closed-label">
              Showing closed customer calls
            </span>
          )}
        </div>

        <div className="rd-kit-followups-tools">
          {isAdmin && (
            <select
              className="rd-kit-followups-user-filter"
              value={assignedTo}
              onChange={(e) => {
                setAssignedTo(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by assigned user"
            >
              <option value="">All Users</option>
              {users.map((user) => (
                <option key={getUserId(user)} value={getUserId(user)}>
                  {getUserName(user)}
                </option>
              ))}
            </select>
          )}

          <div className="rd-kit-followups-search">
            <FiSearch />
            <input
              type="text"
              placeholder="Search chassis, phone, status..."
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

          <span className="rd-kit-followups-count">
            {filteredFollowups.length} / {pagination.total}
          </span>
        </div>
      </div>

      {/* TABLE */}
      <div className="rd-kit-followups-table-container">
        <table className="rd-kit-followups-table">
          <thead>
            <tr>
              <th className="rd-kit-followups-number-col">#</th>
              <th>Chassis Number</th>
              <th>Contact Date</th>
              <th>Follow-up Date</th>
              <th>Customer Voice</th>
              <th>Call Status</th>
              <th>Case Status</th>
              {isAdmin && <th>Assigned To</th>}
              <th>Contact</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columnCount} className="rd-kit-followups-empty">
                  <FiRefreshCw className="rd-kit-followups-spin" />
                  Loading records...
                </td>
              </tr>
            ) : filteredFollowups.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className="rd-kit-followups-empty">
                  No {view === "closed" ? "closed" : "open"} calls found.
                </td>
              </tr>
            ) : (
              filteredFollowups.map((item, index) => (
                <tr key={item.id}>
                  <td className="rd-kit-followups-number">
                    {(page - 1) * PAGE_LIMIT + index + 1}
                  </td>

                  <td>
                    <button
                      type="button"
                      className="rd-kit-followups-chassis-link"
                      onClick={() =>
                        setSelectedChassis(item.chassis_number)
                      }
                      title="View chassis details"
                    >
                      {item.chassis_number || "—"}
                    </button>
                  </td>

                  <td>
                    {formatDate(item.contact_date)}
                  </td>

                  <td>
                    {formatDate(item.followup_date)}
                  </td>

                  <td className="rd-kit-followups-voice">
                    {item.customer_voice || "—"}
                  </td>

                  <td>
                    <span
                      className={`rd-kit-followups-call-status ${getStatusClass(
                        item.call_status
                      )}`}
                    >
                      {item.call_status || "Not set"}
                    </span>
                  </td>

                  <td>
                    <div className="rd-kit-followups-status">
                      <strong>{item.status_name || "Not set"}</strong>
                      {item.substatus_name && (
                        <small>{item.substatus_name}</small>
                      )}
                    </div>
                  </td>

                  {isAdmin && (
                    <td>
                      <select
                        className="rd-kit-followups-assign"
                        value={item.assigned_to || ""}
                        disabled={actionId === item.id}
                        onChange={(e) =>
                          handleAssign(item.id, e.target.value)
                        }
                        aria-label={`Assign ${item.chassis_number}`}
                      >
                        <option value="" disabled>
                          Select user
                        </option>

                        {users.map((user) => (
                          <option
                            key={getUserId(user)}
                            value={getUserId(user)}
                          >
                            {getUserName(user)}
                          </option>
                        ))}
                      </select>
                    </td>
                  )}

                  <td>
                    {item.phone_number ? (
                      <a
                        className="rd-kit-followups-phone"
                        href={`tel:${item.phone_number}`}
                      >
                        <FiPhone />
                        {item.phone_number}
                      </a>
                    ) : (
                      <span className="rd-kit-followups-muted">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* FOOTER */}
      <div className="rd-kit-followups-footer">
        <span>
          Showing {filteredFollowups.length} of {pagination.total} records
        </span>

        <div className="rd-kit-followups-pagination">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
            aria-label="Previous page"
          >
            <FiChevronLeft />
          </button>

          <span>
            Page {pagination.page || page} of {pagination.totalPages || 1}
          </span>

          <button
            type="button"
            disabled={
              page >= pagination.totalPages ||
              loading ||
              pagination.totalPages === 0
            }
            onClick={() => setPage((p) => p + 1)}
            aria-label="Next page"
          >
            <FiChevronRight />
          </button>
        </div>
      </div>

      {/* EXISTING CHASSIS DETAILS MODAL */}
      {selectedChassis && (
        <ChassisDetailsModal
          chassisNumber={selectedChassis}
          onClose={() => setSelectedChassis(null)}
        />
      )}
    </div>
  );
}

export default FollowupDashboard;
