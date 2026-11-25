
import { useEffect, useState } from "react";
import {
  FiX,
  FiTruck,
  FiCalendar,
  FiMapPin,
  FiUser,
  FiHash,
  FiRefreshCw,
  FiPhone,
  FiGrid,
  FiFileText,
  FiPhoneCall,
  FiSave,
  FiClock,
  FiAlertCircle,
  FiCheckCircle,
} from "react-icons/fi";

import api from "../services/api";
import "./ChassisDetailsModal.css";

function ChassisDetailsModal({ chassisNumber, onClose }) {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [activeTab, setActiveTab] = useState("salesService");

  // Call Section states
  const [statuses, setStatuses] = useState([]);
  const [substatuses, setSubstatuses] = useState([]);
  const [callCase, setCallCase] = useState(null);
  const [history, setHistory] = useState([]);

  const [callLoading, setCallLoading] = useState(false);
  const [savingCall, setSavingCall] = useState(false);
  const [callError, setCallError] = useState("");
  const [callSuccess, setCallSuccess] = useState("");

  const [callForm, setCallForm] = useState({
    statusId: "",
    substatusId: "",
    contactDate: "",
    followupDate: "",
    customerVoice: "",
  });

  // LOAD CHASSIS DETAILS
  useEffect(() => {
    if (!chassisNumber) return;

    let active = true;

    const fetchDetails = async () => {
      try {
        setLoading(true);
        setError("");
        setRecord(null);
        setActiveTab("salesService");

        const response = await api.get(
          `/chassis-master/${encodeURIComponent(chassisNumber)}`
        );

        if (active) {
          setRecord(response.data.record);
        }
      } catch (err) {
        if (active) {
          setError(
            err.response?.data?.message || "Unable to load chassis details"
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchDetails();

    return () => {
      active = false;
    };
  }, [chassisNumber]);

  // LOAD CALL SECTION WHEN ITS TAB OPENS
  useEffect(() => {
    if (activeTab !== "call" || !chassisNumber) return;

    let active = true;

    const loadCallSection = async () => {
      try {
        setCallLoading(true);
        setCallError("");
        setCallSuccess("");

        const encodedChassis = encodeURIComponent(chassisNumber);

        const [statusResponse, caseResponse, historyResponse] =
          await Promise.all([
            api.get("/call-section/statuses"),
            api.get(`/call-section/${encodedChassis}`),
            api.get(`/call-section/${encodedChassis}/history`),
          ]);

        if (!active) return;

        const statusList = statusResponse.data.statuses || [];
        const currentCase = caseResponse.data.callCase;

        setStatuses(statusList);
        setCallCase(currentCase);
        setHistory(historyResponse.data.history || []);

        const selectedStatusId = currentCase?.status_id
          ? String(currentCase.status_id)
          : "";

        const selectedSubstatusId = currentCase?.substatus_id
          ? String(currentCase.substatus_id)
          : "";

        setCallForm({
          statusId: selectedStatusId,
          substatusId: selectedSubstatusId,
          contactDate: currentCase?.contact_date || "",
          followupDate: currentCase?.followup_date || "",
          customerVoice: currentCase?.customer_voice || "",
        });

        // Load substatuses for the existing status
        if (selectedStatusId) {
          const subResponse = await api.get(
            `/call-section/statuses/${selectedStatusId}/substatuses`
          );

          if (active) {
            setSubstatuses(subResponse.data.substatuses || []);
          }
        } else {
          setSubstatuses([]);
        }
      } catch (err) {
        if (active) {
          setCallError(
            err.response?.data?.message ||
              "Unable to load Call Section information"
          );
        }
      } finally {
        if (active) setCallLoading(false);
      }
    };

    loadCallSection();

    return () => {
      active = false;
    };
  }, [activeTab, chassisNumber]);

  // ESCAPE TO CLOSE
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  // DATE FORMAT
  const formatDate = (date) => {
    if (!date) return "—";

    // Preserve MySQL DATE values without timezone shifting
    const dateString = String(date).slice(0, 10);

    const parts = dateString.split("-");

    if (parts.length !== 3) return "—";

    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const formatDateTime = (date) => {
    if (!date) return "—";

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) return "—";

    return parsed.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  // HANDLE FORM INPUTS
  const handleCallChange = (e) => {
    const { name, value } = e.target;

    setCallForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    setCallError("");
    setCallSuccess("");
  };

  // CHANGE STATUS AND LOAD ITS SUBSTATUSES
  const handleStatusChange = async (e) => {
    const statusId = e.target.value;

    setCallForm((prev) => ({
      ...prev,
      statusId,
      substatusId: "",
    }));

    setSubstatuses([]);
    setCallError("");
    setCallSuccess("");

    if (!statusId) return;

    try {
      const response = await api.get(
        `/call-section/statuses/${statusId}/substatuses`
      );

      setSubstatuses(response.data.substatuses || []);
    } catch (err) {
      setCallError(
        err.response?.data?.message || "Unable to load substatuses"
      );
    }
  };

  // SAVE CALL CASE
  const handleSaveCall = async (e) => {
    e.preventDefault();

    try {
      setSavingCall(true);
      setCallError("");
      setCallSuccess("");

      const payload = {
        statusId: callForm.statusId || null,
        substatusId: callForm.substatusId || null,
        contactDate: callForm.contactDate || null,
        followupDate: callForm.followupDate || null,
        customerVoice: callForm.customerVoice,
      };

      const encodedChassis = encodeURIComponent(chassisNumber);

      await api.put(`/call-section/${encodedChassis}`, payload);

      setCallSuccess("Call case saved successfully");

      // Refresh current case and history
      const [caseResponse, historyResponse] = await Promise.all([
        api.get(`/call-section/${encodedChassis}`),
        api.get(`/call-section/${encodedChassis}/history`),
      ]);

      setCallCase(caseResponse.data.callCase);
      setHistory(historyResponse.data.history || []);
    } catch (err) {
      setCallError(
        err.response?.data?.message || "Unable to save call case"
      );
    } finally {
      setSavingCall(false);
    }
  };

  if (!chassisNumber) return null;

  const sales = record?.salesData;
  const services = record?.serviceRecords || [];

  const InfoTile = ({ icon, label, value }) => (
    <div className="rd-k44-info-tile">
      <div className="rd-k44-tile-icon">{icon}</div>

      <div className="rd-k44-tile-content">
        <span>{label}</span>
        <strong title={String(value ?? "")}>{value || "—"}</strong>
      </div>
    </div>
  );

  return (
    <div className="rd-k44-overlay" onClick={onClose}>
      <div className="rd-k44-modal" onClick={(e) => e.stopPropagation()}>
        {/* HEADER */}

        <div className="rd-k44-header">
          <div className="rd-k44-header-left">
            <div className="rd-k44-header-icon">
              <FiTruck />
            </div>

            <div className="rd-k44-header-text">
              <h2>Chassis Details</h2>
              <p>{chassisNumber}</p>
            </div>
          </div>

          <button
            type="button"
            className="rd-k44-close"
            onClick={onClose}
            title="Close"
          >
            <FiX />
          </button>
        </div>

        {/* CONTENT */}

        <div className="rd-k44-content">
          {loading ? (
            <div className="rd-k44-state">
              <FiRefreshCw className="rd-k44-spin" />
              <span>Loading chassis information...</span>
            </div>
          ) : error ? (
            <div className="rd-k44-error">
              <FiFileText />
              <span>{error}</span>
            </div>
          ) : record ? (
            <>
              {/* TAB NAVIGATION */}

              <div className="rd-k44-tabs">
                <button
                  type="button"
                  className={activeTab === "salesService" ? "active" : ""}
                  onClick={() => setActiveTab("salesService")}
                >
                  <FiTruck />
                  <span>Sales & Service</span>
                </button>

                <button
                  type="button"
                  className={activeTab === "call" ? "active" : ""}
                  onClick={() => setActiveTab("call")}
                >
                  <FiPhoneCall />
                  <span>Call Section</span>
                </button>
              </div>

              {/* SALES AND SERVICE */}

              {activeTab === "salesService" && (
                <>
                  {sales ? (
                    <section className="rd-k44-section">
                      <div className="rd-k44-section-heading">
                        <div>
                          <h3>
                            <FiTruck />
                            Sales Information
                          </h3>
                          <p>Vehicle and customer details</p>
                        </div>

                        <span className="rd-k44-section-tag">
                          SALES DATA AVAILABLE
                        </span>
                      </div>

                      <div className="rd-k44-sales-grid">
                        <InfoTile
                          icon={<FiHash />}
                          label="Chassis Number"
                          value={record.chassisNumber}
                        />

                        <InfoTile
                          icon={<FiUser />}
                          label="Customer Name"
                          value={sales.customerName}
                        />

                        <InfoTile
                          icon={<FiGrid />}
                          label="Model"
                          value={sales.modelGroup}
                        />

                        <InfoTile
                          icon={<FiMapPin />}
                          label="Sale Branch"
                          value={sales.saleBranch}
                        />

                        <InfoTile
                          icon={<FiCalendar />}
                          label="Delivery Date"
                          value={formatDate(sales.deliveryDate)}
                        />

                        <InfoTile
                          icon={<FiFileText />}
                          label="Registration Number"
                          value={
                            services.find((s) => s.registrationNumber)
                              ?.registrationNumber
                          }
                        />

                        <InfoTile
                          icon={<FiPhone />}
                          label="Mobile Number"
                          value={sales.mobileNumber}
                        />

                        <InfoTile
                          icon={<FiMapPin />}
                          label="PIN Code"
                          value={sales.postalCode}
                        />

                        <InfoTile
                          icon={<FiMapPin />}
                          label="Place / District"
                          value={[record.place, record.district]
                            .filter(Boolean)
                            .join(" / ")}
                        />

                        <InfoTile
                          icon={<FiGrid />}
                          label="Segment"
                          value={record.segment}
                        />
                      </div>
                    </section>
                  ) : (
                    <section className="rd-k44-section">
                      <div className="rd-k44-section-heading">
                        <div>
                          <h3>
                            <FiTruck />
                            Sales Information
                          </h3>
                          <p>No matching Sales Data record found</p>
                        </div>

                        <span className="rd-k44-section-tag rd-k44-service-only">
                          SERVICE ONLY
                        </span>
                      </div>

                      <div className="rd-k44-empty">
                        This chassis exists in Service Data but does not have
                        a matching Sales Data record.
                      </div>
                    </section>
                  )}

                  {/* SERVICE HISTORY */}

                  <section className="rd-k44-section rd-k44-service-section">
                    <div className="rd-k44-section-heading">
                      <div>
                        <h3>
                          <FiFileText />
                          Service History
                        </h3>
                        <p>Complete repair order information</p>
                      </div>

                      <span className="rd-k44-service-count">
                        {record.serviceCount ?? services.length} RECORDS
                      </span>
                    </div>

                    {services.length > 0 ? (
                      <div className="rd-k44-table-wrapper">
                        <table className="rd-k44-service-table">
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>RO Number</th>
                              <th>RO Date</th>
                              <th>Bill Date</th>
                              <th>Registration</th>
                              <th>Dealer Location</th>
                              <th>Category</th>
                              <th>Service Type</th>
                              <th>Service Advisor</th>
                              <th>Product</th>
                              <th>Segment</th>
                            </tr>
                          </thead>

                          <tbody>
                            {services.map((service, index) => (
                              <tr key={service.sourceServiceId || index}>
                                <td className="rd-k44-row-number">
                                  {index + 1}
                                </td>

                                <td className="rd-k44-ro-number">
                                  {service.repairOrderNumber || "—"}
                                </td>

                                <td>{formatDate(service.roDate)}</td>
                                <td>{formatDate(service.billDate)}</td>
                                <td>{service.registrationNumber || "—"}</td>
                                <td>{service.dealerLocation || "—"}</td>

                                <td>
                                  <span className="rd-k44-category">
                                    {service.serviceCategory || "—"}
                                  </span>
                                </td>

                                <td>{service.serviceType || "—"}</td>
                                <td>{service.roServiceAdvisor || "—"}</td>
                                <td>{service.productName || "—"}</td>

                                <td>
                                  <span className="rd-k44-segment">
                                    {service.segment || "—"}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="rd-k44-empty">
                        No service history available for this chassis.
                      </div>
                    )}
                  </section>
                </>
              )}

              {/* CALL SECTION */}

              {activeTab === "call" && (
                <>
                  {callLoading ? (
                    <div className="rd-k44-state">
                      <FiRefreshCw className="rd-k44-spin" />
                      <span>Loading Call Section...</span>
                    </div>
                  ) : (
                    <>
                      <section className="rd-k44-section">
                        <div className="rd-k44-section-heading">
                          <div>
                            <h3>
                              <FiPhoneCall />
                              Customer Call Details
                            </h3>
                            <p>
                              Update customer status and follow-up information
                            </p>
                          </div>

                          <span className="rd-k44-section-tag">
                            {callCase ? "EXISTING CASE" : "NEW CASE"}
                          </span>
                        </div>

                        <form
                          className="rd-k44-call-form"
                          onSubmit={handleSaveCall}
                        >
                          <div className="rd-k44-call-grid">
                            <div className="rd-k44-field">
                              <label htmlFor="callStatus">
                                Case Status
                              </label>

                              <select
                                id="callStatus"
                                name="statusId"
                                value={callForm.statusId}
                                onChange={handleStatusChange}
                              >
                                <option value="">Select status</option>

                                {statuses.map((status) => (
                                  <option
                                    key={status.id}
                                    value={status.id}
                                  >
                                    {status.status_name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="rd-k44-field">
                              <label htmlFor="callSubstatus">
                                Case Substatus
                              </label>

                              <select
                                id="callSubstatus"
                                name="substatusId"
                                value={callForm.substatusId}
                                onChange={handleCallChange}
                                disabled={!callForm.statusId}
                              >
                                <option value="">
                                  {callForm.statusId
                                    ? "Select substatus"
                                    : "Select status first"}
                                </option>

                                {substatuses.map((substatus) => (
                                  <option
                                    key={substatus.id}
                                    value={substatus.id}
                                  >
                                    {substatus.substatus_name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="rd-k44-field">
                              <label htmlFor="contactDate">
                                Contact Date
                              </label>

                              <input
                                id="contactDate"
                                type="date"
                                name="contactDate"
                                value={callForm.contactDate}
                                onChange={handleCallChange}
                              />
                            </div>

                            <div className="rd-k44-field">
                              <label htmlFor="followupDate">
                                Follow-up Date
                              </label>

                              <input
                                id="followupDate"
                                type="date"
                                name="followupDate"
                                value={callForm.followupDate}
                                onChange={handleCallChange}
                              />
                            </div>

                            <div className="rd-k44-field rd-k44-voice-field">
                              <label htmlFor="customerVoice">
                                Customer Voice
                              </label>

                              <textarea
                                id="customerVoice"
                                name="customerVoice"
                                rows="3"
                                placeholder="Enter customer feedback or call remarks..."
                                value={callForm.customerVoice}
                                onChange={handleCallChange}
                              />
                            </div>
                          </div>

                          {callError && (
                            <div className="rd-k44-call-alert error">
                              <FiAlertCircle />
                              {callError}
                            </div>
                          )}

                          {callSuccess && (
                            <div className="rd-k44-call-alert success">
                              <FiCheckCircle />
                              {callSuccess}
                            </div>
                          )}

                          <div className="rd-k44-call-actions">
                            <span>
                              {callCase?.updated_by_name
                                ? `Last updated by ${callCase.updated_by_name}`
                                : "No previous call update"}
                            </span>

                            <button
                              type="submit"
                              disabled={savingCall}
                            >
                              {savingCall ? (
                                <FiRefreshCw className="rd-k44-spin" />
                              ) : (
                                <FiSave />
                              )}
                              {savingCall ? "Saving..." : "Save Call Details"}
                            </button>
                          </div>
                        </form>
                      </section>

                      {/* CALL HISTORY */}

                      <section className="rd-k44-section rd-k44-call-history-section">
                        <div className="rd-k44-section-heading">
                          <div>
                            <h3>
                              <FiClock />
                              Call History
                            </h3>
                            <p>Previous updates and customer interactions</p>
                          </div>

                          <span className="rd-k44-service-count">
                            {history.length} UPDATES
                          </span>
                        </div>

                        {history.length > 0 ? (
                          <div className="rd-k44-table-wrapper">
                            <table className="rd-k44-history-table">
                              <thead>
                                <tr>
                                  <th>#</th>
                                  <th>Updated By</th>
                                  <th>Date & Time</th>
                                  <th>Status</th>
                                  <th>Substatus</th>
                                  <th>Contact Date</th>
                                  <th>Follow-up Date</th>
                                  <th>Customer Voice</th>
                                  <th>Changed Fields</th>
                                </tr>
                              </thead>

                              <tbody>
                                {history.map((item, index) => {
                                  let changed = [];

                                  try {
                                    changed = Array.isArray(item.changed_fields)
                                      ? item.changed_fields
                                      : JSON.parse(item.changed_fields || "[]");
                                  } catch {
                                    changed = [];
                                  }

                                  return (
                                    <tr key={item.id}>
                                      <td className="rd-k44-row-number">
                                        {index + 1}
                                      </td>

                                      <td className="rd-k44-history-user">
                                        {item.updated_by_name || "Unknown"}
                                      </td>

                                      <td>
                                        {formatDateTime(item.updated_at)}
                                      </td>

                                      <td>
                                        <div className="rd-k44-history-change">
                                          {item.old_status && (
                                            <span className="old">
                                              {item.old_status}
                                            </span>
                                          )}
                                          {item.old_status && (
                                            <span className="arrow">→</span>
                                          )}
                                          <strong>
                                            {item.new_status || "—"}
                                          </strong>
                                        </div>
                                      </td>

                                      <td>
                                        <div className="rd-k44-history-change">
                                          {item.old_substatus && (
                                            <span className="old">
                                              {item.old_substatus}
                                            </span>
                                          )}
                                          {item.old_substatus && (
                                            <span className="arrow">→</span>
                                          )}
                                          <strong>
                                            {item.new_substatus || "—"}
                                          </strong>
                                        </div>
                                      </td>

                                      <td>
                                        {formatDate(item.new_contact_date)}
                                      </td>

                                      <td>
                                        {formatDate(item.new_followup_date)}
                                      </td>

                                      <td className="rd-k44-history-voice">
                                        {item.new_customer_voice || "—"}
                                      </td>

                                      <td>
                                        <div className="rd-k44-changed-tags">
                                          {changed.map((field) => (
                                            <span key={field}>
                                              {field === "customerVoice"
                                                ? "Voice"
                                                : field === "contactDate"
                                                  ? "Contact"
                                                  : field === "followupDate"
                                                    ? "Follow-up"
                                                    : field}
                                            </span>
                                          ))}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="rd-k44-empty">
                            No call history available for this chassis yet.
                          </div>
                        )}
                      </section>
                    </>
                  )}
                </>
              )}
            </>
          ) : null}
        </div>

        {/* FOOTER */}

        <div className="rd-k44-footer">
          <span>
            {record
              ? `${record.serviceCount ?? services.length} service records`
              : "Chassis Master"}
          </span>

          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChassisDetailsModal;
