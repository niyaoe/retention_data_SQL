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

  const [locationFilter, setLocationFilter] = useState("");

  const [selectedSegment, setSelectedSegment] = useState("");
  const [segments, setSegments] = useState([]);

  const [deliveryMonths, setDeliveryMonths] = useState([]);
  const [selectedDeliveryMonth, setSelectedDeliveryMonth] = useState("");

  const [selectedCallStatus, setSelectedCallStatus] = useState("");

  const [caseStatuses, setCaseStatuses] = useState([]);
  const [caseSubstatuses, setCaseSubstatuses] = useState([]);

  const [selectedCaseStatus, setSelectedCaseStatus] = useState("");
  const [selectedCaseSubstatus, setSelectedCaseSubstatus] = useState("");

  // ========================================
  // FETCH CHASSIS MASTER
  // ========================================

  const fetchChassisMaster = async (
    page = 1,
    searchValue = search,
    branchValue = selectedSaleBranch,
    dealerBranchValue = selectedDealerBranch,
    monthValue = selectedFreePaidMonth,
    locationValue = locationFilter,
    segmentValue = selectedSegment,
    deliveryMonthValue = selectedDeliveryMonth,
    callStatusValue = selectedCallStatus,
    caseStatusValue = selectedCaseStatus,
    caseSubstatusValue = selectedCaseSubstatus,
  ) => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get(
        `/chassis-master?page=${page}&limit=25&search=${encodeURIComponent(
          searchValue.trim(),
        )}&saleBranch=${encodeURIComponent(
          branchValue,
        )}&dealerBranchId=${encodeURIComponent(
          dealerBranchValue,
        )}&freePaidMonth=${encodeURIComponent(
          monthValue,
        )}&locationFilter=${encodeURIComponent(
          locationValue.trim(),
        )}&segment=${encodeURIComponent(segmentValue)}&deliveryMonth=${encodeURIComponent(deliveryMonthValue)}&callStatus=${encodeURIComponent(callStatusValue)}&caseStatusId=${encodeURIComponent(caseStatusValue)}
&caseSubstatusId=${encodeURIComponent(caseSubstatusValue)}`,
      );

      setRecords(response.data.records || []);
      setBranches(response.data.branches || []);
      setDealerBranches(response.data.dealerBranches || []);
      setFreePaidMonths(response.data.freePaidMonths || []);
      setSegments(response.data.segments || []);
      setDeliveryMonths(response.data.deliveryMonths || []);
      setCaseStatuses(response.data.caseStatuses || []);
      setCaseSubstatuses(response.data.caseSubstatuses || []);

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
                  <th>
                    <div className="rd-kit-sales-master-th-filter">
                      <span>Delivery Date</span>

                      <select
                        value={selectedDeliveryMonth}
                        onChange={(e) => {
                          const value = e.target.value;

                          setSelectedDeliveryMonth(value);

                          fetchChassisMaster(
                            1,
                            search,
                            selectedSaleBranch,
                            selectedDealerBranch,
                            selectedFreePaidMonth,
                            locationFilter,
                            selectedSegment,
                            value,
                          );
                        }}
                      >
                        <option value="">All Months</option>

                        {deliveryMonths.map((month) => (
                          <option key={month.value} value={month.value}>
                            {month.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </th>
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
                  <th className="rd-kit-location-filter-th">
                    <div className="rd-kit-location-filter">
                      <span>Place / District</span>

                      <form
                        onSubmit={(e) => {
                          e.preventDefault();

                          fetchChassisMaster(
                            1,
                            search,
                            selectedSaleBranch,
                            selectedDealerBranch,
                            selectedFreePaidMonth,
                            locationFilter,
                          );
                        }}
                      >
                        <input
                          type="text"
                          placeholder="PIN / Place / District"
                          value={locationFilter}
                          onChange={(e) => setLocationFilter(e.target.value)}
                        />

                        {locationFilter && (
                          <button
                            type="button"
                            title="Clear location filter"
                            onClick={() => {
                              setLocationFilter("");

                              fetchChassisMaster(
                                1,
                                search,
                                selectedSaleBranch,
                                selectedDealerBranch,
                                selectedFreePaidMonth,
                                "",
                              );
                            }}
                          >
                            <FiX />
                          </button>
                        )}
                      </form>
                    </div>
                  </th>
                  <th>Mobile Number</th>
                  <th>
                    <div className="rd-kit-sales-master-th-filter">
                      <span>Segment</span>

                      <select
                        value={selectedSegment}
                        onChange={(e) => {
                          const value = e.target.value;
                          setSelectedSegment(value);

                          fetchChassisMaster(
                            1,
                            search,
                            selectedSaleBranch,
                            selectedDealerBranch,
                            selectedFreePaidMonth,
                            locationFilter,
                            value,
                          );
                        }}
                      >
                        <option value="">All Segments</option>

                        {segments.map((segment) => (
                          <option key={segment} value={segment}>
                            {segment}
                          </option>
                        ))}
                      </select>
                    </div>
                  </th>
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
                        <option value="blank">No Dealer Branch</option>

                        {dealerBranches.map((branch) => (
                          <option key={branch.id} value={branch.id}>
                            {branch.branchName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </th>
                  <th>Service Count</th>
                  <th>
                    <div className="rd-kit-sales-master-th-filter">
                      <span>Case Status</span>

                      <select
                        value={selectedCaseStatus}
                        onChange={(e) => {
                          const value = e.target.value;

                          setSelectedCaseStatus(value);
                          setSelectedCaseSubstatus("");

                          fetchChassisMaster(
                            1,
                            search,
                            selectedSaleBranch,
                            selectedDealerBranch,
                            selectedFreePaidMonth,
                            locationFilter,
                            selectedSegment,
                            selectedDeliveryMonth,
                            selectedCallStatus,
                            value,
                            "",
                          );
                        }}
                      >
                        <option value="">All Case Statuses</option>

                        {caseStatuses.map((status) => (
                          <option key={status.id} value={status.id}>
                            {status.status_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </th>

                  <th>
                    <div className="rd-kit-sales-master-th-filter">
                      <span>Case Substatus</span>

                      <select
                        value={selectedCaseSubstatus}
                        disabled={!selectedCaseStatus}
                        onChange={(e) => {
                          const value = e.target.value;

                          setSelectedCaseSubstatus(value);

                          fetchChassisMaster(
                            1,
                            search,
                            selectedSaleBranch,
                            selectedDealerBranch,
                            selectedFreePaidMonth,
                            locationFilter,
                            selectedSegment,
                            selectedDeliveryMonth,
                            selectedCallStatus,
                            selectedCaseStatus,
                            value,
                          );
                        }}
                      >
                        <option value="">All Substatuses</option>

                        {caseSubstatuses
                          .filter(
                            (item) =>
                              String(item.status_id) ===
                              String(selectedCaseStatus),
                          )
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.substatus_name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </th>
                  <th>
                    <div className="rd-kit-sales-master-th-filter">
                      <span>Call Status</span>

                      <select
                        value={selectedCallStatus}
                        onChange={(e) => {
                          const value = e.target.value;
                          setSelectedCallStatus(value);

                          fetchChassisMaster(
                            1,
                            search,
                            selectedSaleBranch,
                            selectedDealerBranch,
                            selectedFreePaidMonth,
                            locationFilter,
                            selectedSegment,
                            selectedDeliveryMonth,
                            value,
                          );
                        }}
                      >
                        <option value="">All Statuses</option>
                        <option value="Closed">Closed</option>
                        <option value="Complaint">Complaint</option>
                        <option value="Follow-up">Follow-up</option>
                      </select>
                    </div>
                  </th>
                  {/* <th>Last Synced</th> */}
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

                      <td className="rd-kit-sales-master-location-cell">
                        <div
                          className="rd-kit-sales-master-place"
                          title={`Place: ${record.place || "—"} | District: ${record.district || "—"}`}
                        >
                          <strong>{record.place || "—"}</strong>
                          <small>{record.district || "—"}</small>
                        </div>
                      </td>

                      <td>{record.salesData?.mobileNumber || "—"}</td>

                      <td>{record.segment || "—"}</td>

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
                      <td>
                        {record.caseStatus ? (
                          <span className="rd-kit-case-status">
                            {record.caseStatus}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td>
                        {record.caseSubstatus ? (
                          <span className="rd-kit-case-substatus">
                            {record.caseSubstatus}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        {record.callStatus ? (
                          <span
                            className={`rd-kit-call-status rd-kit-call-status-${record.callStatus
                              .toLowerCase()
                              .replace(/[^a-z]+/g, "-")}`}
                          >
                            {record.callStatus}
                          </span>
                        ) : (
                          <span className="rd-kit-call-status-empty">—</span>
                        )}
                      </td>

                      {/* <td>{formatDate(record.lastSyncedAt)}</td> */}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="18" className="rd-kit-sales-master-empty">
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
