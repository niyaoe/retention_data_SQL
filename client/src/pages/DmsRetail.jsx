
import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  FiRefreshCw,
  FiSearch,
  FiChevronLeft,
  FiChevronRight,
  FiDatabase,
} from "react-icons/fi";

import api from "../services/api";
import "./DmsRetail.css";

function DmsRetail() {
  const { user } = useOutletContext();

  const [records, setRecords] = useState([]);

  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 25,
    totalPages: 0,
  });

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadRecords = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/dms-retail", {
        params: {
          page: pagination.page,
          limit: pagination.limit,
          search,
        },
      });

      setRecords(response.data.records || []);

      setPagination((previous) => ({
        ...previous,
        ...response.data.pagination,
      }));
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load DMS Retail records"
      );
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, search]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const handleSearch = (event) => {
    event.preventDefault();

    setPagination((previous) => ({
      ...previous,
      page: 1,
    }));

    setSearch(searchInput.trim());
  };

  const clearSearch = () => {
    setSearchInput("");
    setSearch("");

    setPagination((previous) => ({
      ...previous,
      page: 1,
    }));
  };

  const handleSync = async () => {
    if (syncing) return;

    try {
      setSyncing(true);
      setMessage("");
      setError("");

      const response = await api.post("/dms-retail/sync");

      const result = response.data;

      setMessage(
        `Sync completed. ${Number(
          result.uniqueChassisRows || 0
        ).toLocaleString("en-IN")} unique records processed.`
      );

      setSearch("");
      setSearchInput("");

      setPagination((previous) => ({
        ...previous,
        page: 1,
      }));
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "DMS Retail sync failed"
      );
    } finally {
      setSyncing(false);
    }
  };

  const changePage = (nextPage) => {
    if (
      nextPage < 1 ||
      nextPage > pagination.totalPages
    ) {
      return;
    }

    setPagination((previous) => ({
      ...previous,
      page: nextPage,
    }));
  };

  const formatNumber = (value) =>
    Number(value || 0).toLocaleString("en-IN");

  return (
    <div className="rd-kit-dms">

      {/* HEADER */}

      <div className="rd-kit-dms-header">
        <div className="rd-kit-dms-title">
          <div className="rd-kit-dms-breadcrumb">
            DATA MANAGEMENT / DMS RETAIL
          </div>

          <h2>DMS Retail</h2>

          <p>MySQL retail customer source records</p>
        </div>

        <div className="rd-kit-dms-header-right">

          <div className="rd-kit-dms-counts">
            <div>
              <span>Total Records</span>
              <strong>{formatNumber(pagination.total)}</strong>
            </div>

            <div>
              <span>Page</span>
              <strong>
                {pagination.page} / {pagination.totalPages || 1}
              </strong>
            </div>

            <div>
              <span>Per Page</span>
              <strong>{pagination.limit}</strong>
            </div>
          </div>
          <form
            className="rd-kit-dms-search"
            onSubmit={handleSearch}
          >
            <FiSearch />

            <input
              type="text"
              placeholder="Search chassis, phone, dealer, model, PIN, email..."
              value={searchInput}
              onChange={(event) =>
                setSearchInput(event.target.value)
              }
            />

            {searchInput && (
              <button
                type="button"
                className="rd-kit-dms-clear"
                onClick={clearSearch}
              >
                ×
              </button>
            )}

            <button type="submit">
              Search
            </button>
          </form>

          {user?.role === "admin" && (
            <button
              type="button"
              className="rd-kit-dms-refresh"
              onClick={handleSync}
              disabled={syncing}
            >
              <FiRefreshCw
                className={
                  syncing ? "rd-kit-dms-spin" : ""
                }
              />
              {syncing ? "Syncing..." : "Sync Feed"}
            </button>
          )}

          {user?.role !== "admin" && (
            <button
              type="button"
              className="rd-kit-dms-refresh"
              onClick={loadRecords}
              disabled={loading}
            >
              <FiRefreshCw
                className={loading ? "rd-kit-dms-spin" : ""}
              />
              Refresh
            </button>
          )}

        </div>
      </div>

      {/* STATUS MESSAGES */}

      {message && (
        <div className="rd-kit-dms-status success">
          <span>{message}</span>
          <button
            type="button"
            onClick={() => setMessage("")}
          >
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="rd-kit-dms-status error">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError("")}
          >
            ×
          </button>
        </div>
      )}

      {/* TABLE CARD */}

      <div className="rd-kit-dms-card">

        {/* CARD HEADING */}

        <div className="rd-kit-dms-card-heading">
          <div>
            <h3>
              <FiDatabase />
              DMS Retail Records
            </h3>

            <p>
              Retail customer and vehicle records retrieved from MySQL
            </p>
          </div>

          <span className="rd-kit-dms-record-count">
            {formatNumber(records.length)} Records
          </span>
        </div>

        {/* SEARCH TOOLBAR */}

        {/* <div className="rd-kit-dms-toolbar">
          
        </div> */}

        {/* TABLE CONTENT */}

        {loading ? (
          <div className="rd-kit-dms-message">
            <FiRefreshCw className="rd-kit-dms-spin" />
            Loading DMS Retail records...
          </div>
        ) : error ? (
          <div className="rd-kit-dms-error">
            {error}

            <button
              type="button"
              onClick={loadRecords}
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="rd-kit-dms-table-scroll">
            <table className="rd-kit-dms-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Chassis Number</th>
                  <th>Phone Number</th>
                  <th>Lessee Mobile</th>
                  <th>Dealer Code</th>
                  <th>Model Group</th>
                  <th>PIN</th>
                  <th>Email</th>
                </tr>
              </thead>

              <tbody>
                {records.length > 0 ? (
                  records.map((record) => (
                    <tr key={record.id}>
                      <td>{record.id}</td>

                      <td className="rd-kit-dms-chassis">
                        {record.chassis_no || "—"}
                      </td>

                      <td>{record.phone_no || "—"}</td>

                      <td>
                        {record.lessee_mobile_number || "—"}
                      </td>

                      <td>{record.dealer_code || "—"}</td>

                      <td>{record.model_group || "—"}</td>

                      <td>{record.pin || "—"}</td>

                      <td>{record.email || "—"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="8"
                      className="rd-kit-dms-empty"
                    >
                      No records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* PAGINATION */}

      <div className="rd-kit-dms-pagination">
        <span>
          Showing {formatNumber(records.length)} records on page{" "}
          {pagination.page} of {pagination.totalPages || 1}
        </span>

        <div className="rd-kit-dms-pagination-buttons">
          <button
            type="button"
            disabled={loading || pagination.page <= 1}
            onClick={() =>
              changePage(pagination.page - 1)
            }
          >
            <FiChevronLeft />
            Previous
          </button>

          <button
            type="button"
            disabled={
              loading ||
              pagination.page >= pagination.totalPages
            }
            onClick={() =>
              changePage(pagination.page + 1)
            }
          >
            Next
            <FiChevronRight />
          </button>
        </div>
      </div>

    </div>
  );
}

export default DmsRetail;
