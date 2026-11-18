
import { useEffect, useState } from "react";
import {
  FiRefreshCw,
  FiChevronLeft,
  FiChevronRight,
  FiDatabase,
} from "react-icons/fi";

import api from "../services/api";
import "./ServiceData.css";

function ServiceData() {
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 25,
    totalPages: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchServiceData = async (page = 1) => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get(
        `/service-data?page=${page}&limit=25`
      );

      setRecords(response.data.records);
      setPagination(response.data.pagination);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load service data"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServiceData(1);
  }, []);

  const formatDate = (date) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-IN");
  };

  return (
    <div className="rd-kit-service-data">

      {/* HEADER */}

      <div className="rd-kit-service-data-header">
        <div className="rd-kit-service-data-title">
          <div className="rd-kit-service-data-breadcrumb">
            DATA MANAGEMENT / SERVICE
          </div>

          <h2>Service Data</h2>

          <p>MySQL service source records</p>
        </div>

        <div className="rd-kit-service-data-header-right">
          <div className="rd-kit-service-data-counts">
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
            className="rd-kit-service-data-refresh"
            onClick={() => fetchServiceData(pagination.page)}
            disabled={loading}
          >
            <FiRefreshCw
              className={
                loading ? "rd-kit-service-data-spin" : ""
              }
            />
            Refresh
          </button>
        </div>
      </div>

      {/* TABLE CARD */}

      <div className="rd-kit-service-data-card">
        <div className="rd-kit-service-data-card-heading">
          <div>
            <h3>
              <FiDatabase />
              Service Records
            </h3>

            <p>Service data retrieved from MySQL database</p>
          </div>

          <span className="rd-kit-service-data-record-count">
            {records.length.toLocaleString("en-IN")} Records
          </span>
        </div>

        {loading ? (
          <div className="rd-kit-service-data-message">
            <FiRefreshCw className="rd-kit-service-data-spin" />
            Loading service records...
          </div>
        ) : error ? (
          <div className="rd-kit-service-data-error">
            {error}
            <button
              onClick={() => fetchServiceData(pagination.page)}
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="rd-kit-service-data-table-scroll">
            <table className="rd-kit-service-data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Bill Date</th>
                  <th>Dealer Location</th>
                  <th>RO Number</th>
                  <th>RO Date</th>
                  <th>Registration Number</th>
                  <th>Chassis Number</th>
                  <th>PIN Code</th>
                  <th>Service Category</th>
                  <th>Service Type</th>
                  <th>Service Advisor</th>
                  <th>Product</th>
                  <th>Created At</th>
                </tr>
              </thead>

              <tbody>
                {records.length > 0 ? (
                  records.map((record) => (
                    <tr key={record.id}>
                      <td>{record.id}</td>
                      <td>{formatDate(record.bill_date)}</td>
                      <td>{record.dealer_location || "—"}</td>
                      <td className="rd-kit-service-data-ro">
                        {record.repair_order_number || "—"}
                      </td>
                      <td>{formatDate(record.ro_date)}</td>
                      <td>{record.registration_number || "—"}</td>
                      <td>{record.chassis_number || "—"}</td>
                      <td>{record.pincode || "-"}</td>
                      <td>{record.service_category || "—"}</td>
                      <td>{record.service_type || "—"}</td>
                      <td>{record.ro_service_advisor || "—"}</td>
                      <td>{record.product_name || "—"}</td>
                      <td>{formatDate(record.created_at)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="12"
                      className="rd-kit-service-data-empty"
                    >
                      No service records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PAGINATION */}

      <div className="rd-kit-service-data-pagination">
        <span>
          Showing {records.length} records on page {pagination.page}
          {" "}of {pagination.totalPages || 1}
        </span>

        <div className="rd-kit-service-data-pagination-buttons">
          <button
            disabled={loading || pagination.page <= 1}
            onClick={() => fetchServiceData(pagination.page - 1)}
          >
            <FiChevronLeft />
            Previous
          </button>

          <button
            disabled={
              loading ||
              pagination.page >= pagination.totalPages
            }
            onClick={() => fetchServiceData(pagination.page + 1)}
          >
            Next
            <FiChevronRight />
          </button>
        </div>
      </div>

    </div>
  );
}

export default ServiceData;
