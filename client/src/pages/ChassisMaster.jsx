import { useEffect, useState } from "react";
import {
  FiRefreshCw,
  FiChevronLeft,
  FiChevronRight,
  FiSearch,
  FiX,
} from "react-icons/fi";

import api from "../services/api";
import "./ChassisMaster.css";

import ChassisDetailsModal from "../components/ChassisDetailsModal";

function ChassisMaster() {
  const [records, setRecords] = useState([]);

  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 25,
    totalPages: 0,
  });

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedChassis, setSelectedChassis] = useState(null);

  const [selectedSaleBranch, setSelectedSaleBranch] = useState("");
  const [branches, setBranches] = useState([]);

  const [selectedDealerBranch, setSelectedDealerBranch] = useState("");
  const [dealerBranches, setDealerBranches] = useState([]);

  const [freePaidMonths, setFreePaidMonths] = useState([]);
  const [selectedFreePaidMonth, setSelectedFreePaidMonth] = useState("");

  // ========================================
  // FETCH CHASSIS MASTER
  // ========================================

  const fetchChassisMaster = async (
    page = 1,
    searchValue = search,
    branchValue = selectedSaleBranch,
    dealerBranchValue = selectedDealerBranch,
    monthValue = selectedFreePaidMonth,
  ) => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get(
        `/chassis-master?page=${page}&limit=25&search=${encodeURIComponent(
          searchValue.trim(),
        )}&saleBranch=${encodeURIComponent(
          branchValue,
        )}&dealerBranchId=${encodeURIComponent(dealerBranchValue)}&freePaidMonth=${encodeURIComponent(monthValue)}`,
      );

      setRecords(response.data.records || []);
      setBranches(response.data.branches || []);
      setDealerBranches(response.data.dealerBranches || []);
      setFreePaidMonths(response.data.freePaidMonths || []);

      setPagination(
        response.data.pagination || {
          total: 0,
          page: 1,
          limit: 25,
          totalPages: 0,
        },
      );
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to load Chassis Master data.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChassisMaster(1);
  }, []);

  // ========================================
  // SEARCH
  // ========================================

  const handleSearch = (e) => {
    e.preventDefault();
    fetchChassisMaster(1, search);
  };

  const clearSearch = () => {
    setSearch("");
    fetchChassisMaster(1, "");
  };

  // ========================================
  // HELPERS
  // ========================================

  const formatDate = (date) => {
    if (!date) return "—";

    return new Date(date).toLocaleDateString("en-IN");
  };

  const formatNumber = (value) => Number(value || 0).toLocaleString("en-IN");

  return (
    <div className="rd-kit-sales-master">
      {/* HEADER */}

      <div className="rd-kit-sales-master-header">
        <div className="rd-kit-sales-master-title">
          <div className="rd-kit-sales-master-breadcrumb">
            DATA MANAGEMENT / CHASSIS MASTER
          </div>

          <h2>Chassis Master</h2>

          <p>All unique chassis with linked sales and service history</p>
        </div>

        <div className="rd-kit-sales-master-header-right">
          {/* RECORD COUNT */}
          <span className="rd-kit-sales-master-record-count">
            {records.length.toLocaleString("en-IN")} Records
          </span>
          {/* COUNTS */}

          <div className="rd-kit-sales-master-counts">
            <div>
              <span>Total Chassis</span>
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

          {/* SEARCH */}

          <form className="rd-kit-sales-master-search" onSubmit={handleSearch}>
            <FiSearch />

            <input
              type="text"
              placeholder="Search chassis, customer, mobile, RO..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            {search && (
              <button type="button" onClick={clearSearch} title="Clear search">
                <FiX />
              </button>
            )}
          </form>

          {/* REFRESH */}

          <button
            type="button"
            className="rd-kit-sales-master-refresh"
            onClick={() => fetchChassisMaster(pagination.page)}
            disabled={loading}
          >
            <FiRefreshCw
              className={loading ? "rd-kit-sales-master-spin" : ""}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* TABLE CARD */}

      <div className="rd-kit-sales-master-card">
        {loading ? (
          <div className="rd-kit-sales-master-message">
            <FiRefreshCw className="rd-kit-sales-master-spin" />
            Loading Chassis Master records...
          </div>
        ) : error ? (
          <div className="rd-kit-sales-master-error">
            {error}

            <button
              type="button"
              onClick={() => fetchChassisMaster(pagination.page)}
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="rd-kit-sales-master-table-scroll">
            <table className="rd-kit-sales-master-table">
              <thead>
                <tr>
                  <th>Chassis Number</th>
                  <th>Delivery Date</th>
                  <th>
                    <div className="rd-kit-sales-master-th-filter">
                      <span>Sale Branch</span>

                      <select
                        value={selectedSaleBranch}
                        onChange={(e) => {
                          const value = e.target.value;
                          setSelectedSaleBranch(value);

                          fetchChassisMaster(
                            1,
                            search,
                            value,
                            selectedDealerBranch,
                            selectedFreePaidMonth,
                          );
                        }}
                      >
                        <option value="">All Branches</option>

                        {branches.map((branch) => (
                          <option key={branch} value={branch}>
                            {branch}
                          </option>
                        ))}
                      </select>
                    </div>
                  </th>
                  <th>Model</th>
                  <th>Customer Name</th>
                  <th>PIN Code</th>
                  <th>Place / District</th>
                  <th>Mobile Number</th>
                  <th>Segment</th>
                  <th>Last Free/Paid</th>
                  <th>
                    <div className="rd-kit-sales-master-th-filter">
                      <span>Free/Paid Date</span>

                      <select
                        value={selectedFreePaidMonth}
                        onChange={(e) => {
                          const value = e.target.value;
                          setSelectedFreePaidMonth(value);

                          fetchChassisMaster(
                            1,
                            search,
                            selectedSaleBranch,
                            selectedDealerBranch,
                            value,
                          );
                        }}
                      >
                        <option value="">All Months</option>

                        {freePaidMonths.map((month) => (
                          <option key={month.value} value={month.value}>
                            {month.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </th>
                  <th>Last Service Type</th>
                  <th>Last Service Date</th>
                  <th>
                    <div className="rd-kit-sales-master-th-filter">
                      <span>Dealer Location</span>

                      <select
                        value={selectedDealerBranch}
                        onChange={(e) => {
                          const value = e.target.value;
                          setSelectedDealerBranch(value);

                          fetchChassisMaster(
                            1,
                            search,
                            selectedSaleBranch,
                            value,
                            selectedFreePaidMonth,
                          );
                        }}
                      >
                        <option value="">All Dealer Branches</option>

                        {dealerBranches.map((branch) => (
                          <option key={branch.id} value={branch.id}>
                            {branch.branchName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </th>
                  <th>Service Count</th>
                  <th>Last Synced</th>
                </tr>
              </thead>

              <tbody>
                {records.length > 0 ? (
                  records.map((record) => (
                    <tr key={record._id}>
                      {/* CHASSIS */}

                      <td className="rd-kit-sales-master-chassis">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedChassis(record.chassisNumber)
                          }
                          title="View chassis details"
                        >
                          {record.chassisNumber || "—"}
                        </button>
                      </td>

                      {/* SALES DATA */}

                      <td>{formatDate(record.salesData?.deliveryDate)}</td>

                      <td>{record.salesData?.saleBranch || "—"}</td>

                      <td>{record.salesData?.modelGroup || "—"}</td>

                      <td>{record.salesData?.customerName || "—"}</td>

                      <td>{record.salesData?.postalCode || "—"}</td>

                      <td>
                        <div className="rd-kit-sales-master-place">
                          <strong>{record.place || "—"}</strong>
                          <small>{record.district || "—"}</small>
                        </div>
                      </td>

                      <td>{record.salesData?.mobileNumber || "—"}</td>

                      <td>{record.salesData?.segment || "—"}</td>

                      {/* LAST FREE OR PAID - EXISTING DATA */}
                      <td>
                        {record.lastFreePaidService?.serviceCategory ? (
                          <span
                            className={`rd-kit-sales-master-service-tag ${
                              record.lastFreePaidService.serviceCategory ===
                              "Free Service"
                                ? "rd-kit-sales-master-free"
                                : "rd-kit-sales-master-paid"
                            }`}
                          >
                            {record.lastFreePaidService.serviceCategory}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td>
                        {formatDate(record.lastFreePaidService?.billDate)}
                      </td>

                      {/* NEW: LATEST SERVICE TYPE */}
                      <td>{record.lastServiceType || "—"}</td>

                      {/* NEW: LATEST SERVICE DATE */}
                      <td>{formatDate(record.lastServiceDate)}</td>

                      <td>
                        {record.lastServiceDealerLocation ||
                          record.lastFreePaidService?.dealerLocation ||
                          "—"}
                      </td>

                      {/* SERVICE COUNT */}

                      <td>
                        <span className="rd-kit-sales-master-service-count">
                          {formatNumber(record.serviceCount)}
                        </span>
                      </td>

                      <td>{formatDate(record.lastSyncedAt)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="16" className="rd-kit-sales-master-empty">
                      No Chassis Master records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PAGINATION */}

      <div className="rd-kit-sales-master-pagination">
        <span>
          Showing {records.length} records on page {pagination.page} of{" "}
          {pagination.totalPages || 1}
        </span>

        <div className="rd-kit-sales-master-pagination-buttons">
          <button
            type="button"
            disabled={loading || pagination.page <= 1}
            onClick={() => fetchChassisMaster(pagination.page - 1)}
          >
            <FiChevronLeft />
            Previous
          </button>

          <button
            type="button"
            disabled={loading || pagination.page >= pagination.totalPages}
            onClick={() => fetchChassisMaster(pagination.page + 1)}
          >
            Next
            <FiChevronRight />
          </button>
        </div>
      </div>

      {/* CHASSIS DETAILS */}

      {selectedChassis && (
        <ChassisDetailsModal
          chassisNumber={selectedChassis}
          onClose={() => setSelectedChassis(null)}
        />
      )}
    </div>
  );
}

export default ChassisMaster;
