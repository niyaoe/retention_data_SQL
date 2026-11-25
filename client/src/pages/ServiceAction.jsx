import { useEffect, useState } from "react";
import {
  FiRefreshCw,
  FiChevronLeft,
  FiChevronRight,
  FiDatabase,
  FiUpload,
  FiSearch,
} from "react-icons/fi";

import api from "../services/api";
import "./ServiceAction.css";

const columns = [
  ["release_year", "Release Year"],
  ["release_month", "Release Month"],
  ["release_date", "Release Date"],
  ["ro_date", "RO Date"],
  ["zone", "Zone"],
  ["regional_office", "Regional Office"],
  ["parent_group", "Parent Group"],
  ["dealer_name", "Dealer Name"],
  ["dealer_code", "Dealer Code"],
  ["location_name", "Location Name"],
  ["location_code", "Location Code"],
  ["segment", "Segment"],
  ["model_family", "Model Family"],
  ["model_name", "Model Name"],
  ["chassis", "Chassis"],
  ["recall_type", "Recall Type"],
  ["service_action_type", "Service Action Type"],
  ["complaint_code", "Complaint Code"],
  ["complaint_description", "Complaint Description"],
  ["ro_id", "RO ID"],
  ["attended_indicator", "Attended"],
  ["days", "Days"],
  ["days_bucket", "Days Bucket"],
  ["universal_count", "Universal Count"],
  ["complete_count", "Complete Count"],
  ["complete_count_percent", "Complete %"],
  ["pending_count", "Pending Count"],
  ["pending_count_percent", "Pending %"],
];

function ServiceAction() {
  const [records, setRecords] = useState([]);

  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 25,
    totalPages: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const fetchRecords = async (page = 1, searchValue = search) => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/service-action", {
        params: {
          page,
          limit: 25,
          search: searchValue,
        },
      });

      setRecords(response.data.records || []);
      setPagination(response.data.pagination);
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to load Service Action records",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords(1, "");
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchRecords(1, search.trim());
  };

  const formatDate = (value) => {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleDateString("en-IN");
  };

  const formatValue = (key, value) => {
    if (value === null || value === undefined || value === "") {
      return "—";
    }

    if (key === "release_date" || key === "ro_date") {
      return formatDate(value);
    }

    if (key === "complete_count_percent" || key === "pending_count_percent") {
      return String(value) + "%";
    }

    return String(value);
  };

  const total = Number(pagination.total || 0);
  const currentPage = Number(pagination.page || 1);
  const pageLimit = Number(pagination.limit || 25);
  const totalPages = Number(pagination.totalPages || 0);

  const startRecord = total > 0 ? (currentPage - 1) * pageLimit + 1 : 0;

  const endRecord = Math.min(currentPage * pageLimit, total);

  return (
    <div className="rd-kit-service-action">
      {/* HEADER */}

      <div className="rd-kit-service-action-header">
        <div className="rd-kit-service-action-title">
          <div className="rd-kit-service-action-breadcrumb">
            DATA MANAGEMENT / SERVICE ACTION
          </div>

          <h2>Service Action</h2>

          <p>MySQL service action records</p>
        </div>

        <div className="rd-kit-service-action-header-right">
          <div className="rd-kit-service-action-counts">
            <div>
              <span>Total Records</span>
              <strong>{total.toLocaleString("en-IN")}</strong>
            </div>

            <div>
              <span>Page</span>
              <strong>
                {currentPage} / {totalPages || 1}
              </strong>
            </div>

            <div>
              <span>Per Page</span>
              <strong>{pageLimit}</strong>
            </div>
          </div>

          <button
            className="rd-kit-service-action-refresh"
            onClick={() => fetchRecords(currentPage)}
            disabled={loading}
          >
            <FiRefreshCw
              className={loading ? "rd-kit-service-action-spin" : ""}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* TABLE CARD */}

      <div className="rd-kit-service-action-card">
        <div className="rd-kit-service-action-card-heading">
          <div>
            <h3>
              <FiDatabase />
              Service Action Records
            </h3>

            <p>Service action data retrieved from MySQL database</p>
          </div>

          <span className="rd-kit-service-action-record-count">
            {records.length.toLocaleString("en-IN")} Records
          </span>
        </div>

        {/* SEARCH */}

        <form className="rd-kit-service-action-search" onSubmit={handleSearch}>
          <FiSearch />

          <input
            type="search"
            placeholder="Search chassis, dealer, complaint, RO ID, model..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <button type="submit">Search</button>
        </form>

        {/* TABLE */}

        {loading ? (
          <div className="rd-kit-service-action-message">
            <FiRefreshCw className="rd-kit-service-action-spin" />
            Loading Service Action records...
          </div>
        ) : error ? (
          <div className="rd-kit-service-action-error">
            {error}

            <button onClick={() => fetchRecords(currentPage)}>Retry</button>
          </div>
        ) : (
          <div className="rd-kit-service-action-table-scroll">
            <table className="rd-kit-service-action-table">
              <thead>
                <tr>
                  <th>ID</th>

                  {columns.map(([key, label]) => (
                    <th key={key}>{label}</th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {records.length > 0 ? (
                  records.map((record) => (
                    <tr key={record.id}>
                      <td>{record.id}</td>

                      {columns.map(([key]) => (
                        <td
                          key={key}
                          className={
                            key === "chassis"
                              ? "rd-kit-service-action-chassis"
                              : ""
                          }
                          title={
                            key === "complaint_description"
                              ? record[key] || ""
                              : undefined
                          }
                        >
                          {formatValue(key, record[key])}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={columns.length + 1}
                      className="rd-kit-service-action-empty"
                    >
                      No Service Action records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PAGINATION */}

      <div className="rd-kit-service-action-pagination">
        <span>
          Showing {startRecord.toLocaleString("en-IN")}–
          {endRecord.toLocaleString("en-IN")} of {total.toLocaleString("en-IN")}{" "}
          records
        </span>

        <div className="rd-kit-service-action-pagination-buttons">
          <button
            disabled={loading || currentPage <= 1}
            onClick={() => fetchRecords(currentPage - 1)}
          >
            <FiChevronLeft />
            Previous
          </button>

          <button
            disabled={loading || currentPage >= totalPages}
            onClick={() => fetchRecords(currentPage + 1)}
          >
            Next
            <FiChevronRight />
          </button>
        </div>
      </div>
    </div>
  );
}

export default ServiceAction;
