
import { useEffect, useState } from "react";
import {
  FiRefreshCw,
  FiChevronLeft,
  FiChevronRight,
  FiDatabase,
} from "react-icons/fi";

import api from "../services/api";
import "./SalesData.css";

function SalesData() {
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 25,
    totalPages: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchSalesData = async (page = 1) => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get(
        `/sales-data?page=${page}&limit=25`
      );

      setRecords(response.data.records);
      setPagination(response.data.pagination);
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to load sales data"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalesData(1);
  }, []);

  const formatDate = (date) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-IN");
  };

  return (
    <div className="rd-kit-sales-data">

      {/* HEADER */}

      <div className="rd-kit-sales-data-header">
        <div className="rd-kit-sales-data-title">
          <div className="rd-kit-sales-data-breadcrumb">
            DATA MANAGEMENT / SALES
          </div>

          <h2>Sales Data</h2>

          <p>MySQL sales source records</p>
        </div>

        <div className="rd-kit-sales-data-header-right">
          <div className="rd-kit-sales-data-counts">
            <div>
              <span>Total Records</span>
              <strong>
                {Number(pagination.total || 0).toLocaleString("en-IN")}
              </strong>
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

          <button
            className="rd-kit-sales-data-refresh"
            onClick={() => fetchSalesData(pagination.page)}
            disabled={loading}
          >
            <FiRefreshCw
              className={loading ? "rd-kit-sales-data-spin" : ""}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* TABLE CARD */}

      <div className="rd-kit-sales-data-card">

        <div className="rd-kit-sales-data-card-heading">
          <div>
            <h3>
              <FiDatabase />
              Sales Records
            </h3>

            <p>Sales data retrieved from MySQL database</p>
          </div>

          <span className="rd-kit-sales-data-record-count">
            {records.length.toLocaleString("en-IN")} Records
          </span>
        </div>

        {loading ? (
          <div className="rd-kit-sales-data-message">
            <FiRefreshCw className="rd-kit-sales-data-spin" />
            Loading sales records...
          </div>
        ) : error ? (
          <div className="rd-kit-sales-data-error">
            {error}
            <button onClick={() => fetchSalesData(pagination.page)}>
              Retry
            </button>
          </div>
        ) : (
          <div className="rd-kit-sales-data-table-scroll">
            <table className="rd-kit-sales-data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Delivery Date</th>
                  <th>Chassis Number</th>
                  <th>Sale Branch</th>
                  <th>Model</th>
                  <th>Customer Name</th>
                  <th>PIN Code</th>
                  <th>Mobile Number</th>
                  <th>Segment</th>
                </tr>
              </thead>

              <tbody>
                {records.length > 0 ? (
                  records.map((record) => (
                    <tr key={record.id}>
                      <td>{record.id}</td>
                      <td>{formatDate(record.delivery_date)}</td>
                      <td className="rd-kit-sales-data-chassis">
                        {record.chassis_no || "—"}
                      </td>
                      <td>{record.sale_branch || "—"}</td>
                      <td>{record.model_group || "—"}</td>
                      <td>{record.cust_name || "—"}</td>
                      <td>{record.postal_code || "—"}</td>
                      <td>{record.mobile_no || "—"}</td>
                      <td>{record.segment || "—"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="9" className="rd-kit-sales-data-empty">
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

      <div className="rd-kit-sales-data-pagination">
        <span>
          Showing {records.length} records on page {pagination.page}
          {" "}of {pagination.totalPages || 1}
        </span>

        <div className="rd-kit-sales-data-pagination-buttons">
          <button
            disabled={loading || pagination.page <= 1}
            onClick={() => fetchSalesData(pagination.page - 1)}
          >
            <FiChevronLeft />
            Previous
          </button>

          <button
            disabled={
              loading ||
              pagination.page >= pagination.totalPages
            }
            onClick={() => fetchSalesData(pagination.page + 1)}
          >
            Next
            <FiChevronRight />
          </button>
        </div>
      </div>

    </div>
  );
}

export default SalesData;
