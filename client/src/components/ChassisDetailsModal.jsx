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
  FiChevronDown,
  FiChevronUp,
  FiEdit2,
  FiActivity,
} from "react-icons/fi";

import api from "../services/api";
import "./ChassisDetailsModal.css";

const initialCallForm = {
  callStatus: "",
  statusId: "",
  substatusId: "",
  contactDate: "",
  followupDate: "",
  phoneNumber: "",
  pincode: "",
  customerVoice: "",
};

const initialSalesForm = {
  mobileNumber: "",
  postalCode: "",
};

function ChassisDetailsModal({ chassisNumber, onClose }) {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [statuses, setStatuses] = useState([]);
  const [substatuses, setSubstatuses] = useState([]);
  const [callCase, setCallCase] = useState(null);
  const [history, setHistory] = useState([]);

  const [callLoading, setCallLoading] = useState(false);
  const [savingCall, setSavingCall] = useState(false);
  const [callError, setCallError] = useState("");
  const [callSuccess, setCallSuccess] = useState("");

  const [callForm, setCallForm] = useState(initialCallForm);

  const [editingSalesField, setEditingSalesField] = useState("");
  const [savingSales, setSavingSales] = useState(false);
  const [salesError, setSalesError] = useState("");
  const [salesSuccess, setSalesSuccess] = useState("");
  const [salesForm, setSalesForm] = useState(initialSalesForm);

  const [serviceExpanded, setServiceExpanded] = useState(false);

  const sales = record?.salesData;
  const services = record?.serviceRecords || [];

  // --------------------------------------------------
  // LOAD CHASSIS DETAILS
  // --------------------------------------------------

  useEffect(() => {
    if (!chassisNumber) return;

    let active = true;

    const fetchDetails = async () => {
      try {
        setLoading(true);
        setError("");
        setRecord(null);

        const response = await api.get(
          `/chassis-master/${encodeURIComponent(chassisNumber)}`,
        );

        if (!active) return;

        const loadedRecord = response.data.record;

        setRecord(loadedRecord);

        setSalesForm({
          mobileNumber: loadedRecord.salesData?.mobileNumber || "",
          postalCode: loadedRecord.salesData?.postalCode || "",
        });

        setEditingSalesField("");
        setSalesError("");
        setSalesSuccess("");
      } catch (err) {
        if (active) {
          setError(
            err.response?.data?.message || "Unable to load chassis details",
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

  // --------------------------------------------------
  // LOAD CALL SECTION
  // --------------------------------------------------

  useEffect(() => {
    if (!chassisNumber) return;

    let active = true;

    const loadCallSection = async () => {
      try {
        setCallLoading(true);
        setCallError("");
        setCallSuccess("");

        setStatuses([]);
        setSubstatuses([]);
        setCallCase(null);
        setHistory([]);
        setCallForm(initialCallForm);

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
          callStatus: currentCase?.call_status || "",
          statusId: selectedStatusId,
          substatusId: selectedSubstatusId,
          contactDate: currentCase?.contact_date || "",
          followupDate: currentCase?.followup_date || "",
          phoneNumber: currentCase?.phone_number || "",
          pincode: currentCase?.pincode || "",
          customerVoice: currentCase?.customer_voice || "",
        });

        if (selectedStatusId) {
          const subResponse = await api.get(
            `/call-section/statuses/${selectedStatusId}/substatuses`,
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
              "Unable to load Call Section information",
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
  }, [chassisNumber]);

  // --------------------------------------------------
  // ESCAPE TO CLOSE
  // --------------------------------------------------

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  // --------------------------------------------------
  // DATE HELPERS
  // --------------------------------------------------

  const formatDate = (date) => {
    if (!date) return "—";

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

  // --------------------------------------------------
  // SALES CONTACT EDITING
  // --------------------------------------------------

  const handleSalesChange = (e) => {
    const { name, value } = e.target;

    setSalesForm((prev) => ({
      ...prev,
      [name]: value
        .replace(/\D/g, "")
        .slice(0, name === "mobileNumber" ? 10 : 6),
    }));

    setSalesError("");
    setSalesSuccess("");
  };

  const startSalesEdit = (field) => {
    setSalesForm({
      mobileNumber: sales?.mobileNumber || "",
      postalCode: sales?.postalCode || "",
    });

    setEditingSalesField(field);
    setSalesError("");
    setSalesSuccess("");
  };

  const cancelSalesEdit = () => {
    setSalesForm({
      mobileNumber: sales?.mobileNumber || "",
      postalCode: sales?.postalCode || "",
    });

    setEditingSalesField("");
    setSalesError("");
    setSalesSuccess("");
  };

  const handleSaveSales = async () => {
    if (!/^\d{10}$/.test(salesForm.mobileNumber)) {
      setSalesError("Enter a valid 10-digit mobile number");
      return;
    }

    if (!/^\d{6}$/.test(salesForm.postalCode)) {
      setSalesError("Enter a valid 6-digit PIN code");
      return;
    }

    try {
      setSavingSales(true);
      setSalesError("");
      setSalesSuccess("");

      await api.put(
        `/chassis-master/${encodeURIComponent(chassisNumber)}/sales-contact`,
        salesForm,
      );

      const response = await api.get(
        `/chassis-master/${encodeURIComponent(chassisNumber)}`,
      );

      setRecord(response.data.record);

      setSalesForm({
        mobileNumber: response.data.record.salesData?.mobileNumber || "",
        postalCode: response.data.record.salesData?.postalCode || "",
      });

      setEditingSalesField("");
      setSalesSuccess("Sales details updated successfully");
    } catch (err) {
      setSalesError(
        err.response?.data?.message || "Unable to update sales details",
      );
    } finally {
      setSavingSales(false);
    }
  };

  // --------------------------------------------------
  // CALL FORM
  // --------------------------------------------------

  const handleCallChange = (e) => {
    const { name, value } = e.target;

    const cleanValue =
      name === "phoneNumber"
        ? value.replace(/\D/g, "").slice(0, 10)
        : name === "pincode"
          ? value.replace(/\D/g, "").slice(0, 6)
          : value;

    setCallForm((prev) => ({
      ...prev,
      [name]: cleanValue,
    }));

    setCallError("");
    setCallSuccess("");
  };

  // CASE STATUS AND DYNAMIC SUBSTATUS

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
        `/call-section/statuses/${statusId}/substatuses`,
      );

      setSubstatuses(response.data.substatuses || []);
    } catch (err) {
      setCallError(err.response?.data?.message || "Unable to load substatuses");
    }
  };

  // SAVE CALL DETAILS

  const handleSaveCall = async (e) => {
    e.preventDefault();

    try {
      setSavingCall(true);
      setCallError("");
      setCallSuccess("");

      const payload = {
        callStatus: callForm.callStatus || null,
        statusId: callForm.statusId || null,
        substatusId: callForm.substatusId || null,
        contactDate: callForm.contactDate || null,
        followupDate: callForm.followupDate || null,
        phoneNumber: callForm.phoneNumber,
        pincode: callForm.pincode,
        customerVoice: callForm.customerVoice,
      };

      const encodedChassis = encodeURIComponent(chassisNumber);

      await api.put(`/call-section/${encodedChassis}`, payload);

      setCallSuccess("Call details saved successfully");

      const [caseResponse, historyResponse] = await Promise.all([
        api.get(`/call-section/${encodedChassis}`),
        api.get(`/call-section/${encodedChassis}/history`),
      ]);

      setCallCase(caseResponse.data.callCase);
      setHistory(historyResponse.data.history || []);
    } catch (err) {
      setCallError(
        err.response?.data?.message || "Unable to save call details",
      );
    } finally {
      setSavingCall(false);
    }
  };

  if (!chassisNumber) return null;

  // --------------------------------------------------
  // REUSABLE INFORMATION TILE
  // --------------------------------------------------

  const InfoTile = ({ icon, label, value, children }) => (
    <div className="rd-k44-info-tile">
      <div className="rd-k44-tile-icon">{icon}</div>

      <div className="rd-k44-tile-content">
        <span>{label}</span>

        {children || (
          <strong title={String(value ?? "")}>{value || "—"}</strong>
        )}
      </div>
    </div>
  );

  // --------------------------------------------------
  // EDITABLE SALES TILE
  // --------------------------------------------------

  const EditableSalesTile = ({ icon, label, field, maxLength, value }) => {
    const isEditing = editingSalesField === field;

    return (
      <InfoTile icon={icon} label={label}>
        {isEditing ? (
          <div className="rd-k44-inline-edit">
            <input
              className="rd-k44-inline-input"
              type="text"
              name={field}
              inputMode="numeric"
              maxLength={maxLength}
              value={salesForm[field]}
              onChange={handleSalesChange}
              autoFocus
            />

            <button
              type="button"
              className="rd-k44-inline-action save"
              onClick={handleSaveSales}
              disabled={savingSales}
              title="Save"
            >
              {savingSales ? (
                <FiRefreshCw className="rd-k44-spin" />
              ) : (
                <FiCheckCircle />
              )}
            </button>

            <button
              type="button"
              className="rd-k44-inline-action cancel"
              onClick={cancelSalesEdit}
              disabled={savingSales}
              title="Cancel"
            >
              <FiX />
            </button>
          </div>
        ) : (
          <div className="rd-k44-sales-value">
            <strong title={value || ""}>{value || "—"}</strong>

            <button
              type="button"
              className="rd-k44-inline-action edit"
              onClick={() => startSalesEdit(field)}
              title={`Edit ${label}`}
            >
              <FiEdit2 />
            </button>
          </div>
        )}
      </InfoTile>
    );
  };

  // --------------------------------------------------
  // OLD / NEW HISTORY VALUE
  // --------------------------------------------------

  const HistoryChange = ({ oldValue, newValue }) => (
    <div className="rd-k44-history-change">
      {oldValue ? (
        <>
          <span className="old">{oldValue}</span>
          <span className="arrow">→</span>
        </>
      ) : null}

      <strong>{newValue || "—"}</strong>
    </div>
  );

  // --------------------------------------------------
  // MAIN UI
  // --------------------------------------------------

  return (
    <div className="rd-k44-overlay" onClick={onClose}>
      <div
        className="rd-k44-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Chassis details"
      >
        {/* HEADER */}

        <header className="rd-k44-header">
          <div className="rd-k44-header-left">
            <div className="rd-k44-header-icon">
              <FiTruck />
            </div>

            <div className="rd-k44-header-text">
              <h2>Chassis Details</h2>
              <p>{chassisNumber}</p>
            </div>
          </div>

          <div className="rd-k44-header-right">
            {record && (
              <span className="rd-k44-header-meta">
                <FiActivity />
                {record.serviceCount ?? services.length} SERVICE RECORDS
              </span>
            )}

            <button
              type="button"
              className="rd-k44-close"
              onClick={onClose}
              title="Close"
              aria-label="Close modal"
            >
              <FiX />
            </button>
          </div>
        </header>

        {/* MAIN CONTENT */}

        <main className="rd-k44-content">
          {loading ? (
            <div className="rd-k44-state">
              <FiRefreshCw className="rd-k44-spin" />
              <span>Loading chassis information...</span>
            </div>
          ) : error ? (
            <div className="rd-k44-error">
              <FiAlertCircle />
              <span>{error}</span>
            </div>
          ) : record ? (
            <div className="rd-k44-dashboard">
              {/* SALES INFORMATION */}

              <section className="rd-k44-section rd-k44-sales-section">
                <div className="rd-k44-section-heading">
                  <div>
                    <h3>
                      <FiTruck />
                      Sales Information
                    </h3>
                    <p>Vehicle and customer details</p>
                  </div>

                  <span className="rd-k44-section-tag">
                    {sales ? "SALES DATA AVAILABLE" : "SERVICE ONLY"}
                  </span>
                </div>

                {salesError && (
                  <div className="rd-k44-sales-message error">
                    <FiAlertCircle />
                    {salesError}
                  </div>
                )}

                {salesSuccess && (
                  <div className="rd-k44-sales-message success">
                    <FiCheckCircle />
                    {salesSuccess}
                  </div>
                )}

                {sales ? (
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

                    <EditableSalesTile
                      icon={<FiPhone />}
                      label="Mobile Number"
                      field="mobileNumber"
                      maxLength={10}
                      value={sales.mobileNumber}
                    />

                    <EditableSalesTile
                      icon={<FiMapPin />}
                      label="PIN Code"
                      field="postalCode"
                      maxLength={6}
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
                ) : (
                  <div className="rd-k44-empty">
                    This chassis exists in Service Data but does not have a
                    matching Sales Data record.
                  </div>
                )}
              </section>

              {/* CALL DETAILS */}

              {callLoading ? (
                <div className="rd-k44-state rd-k44-call-loading">
                  <FiRefreshCw className="rd-k44-spin" />
                  <span>Loading Call Section...</span>
                </div>
              ) : (
                <>
                  <section className="rd-k44-section rd-k44-call-section">
                    <div className="rd-k44-section-heading">
                      <div>
                        <h3>
                          <FiPhoneCall />
                          Customer Call Details
                        </h3>
                        <p>Update customer status and follow-up information</p>
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
                          <label htmlFor="rdContactDate">Contact Date</label>

                          <input
                            id="rdContactDate"
                            type="date"
                            name="contactDate"
                            value={callForm.contactDate}
                            onChange={handleCallChange}
                          />
                        </div>

                        <div className="rd-k44-field">
                          <label htmlFor="rdCaseStatus">Case Status</label>

                          <select
                            id="rdCaseStatus"
                            name="statusId"
                            value={callForm.statusId}
                            onChange={handleStatusChange}
                          >
                            <option value="">Select status</option>

                            {statuses.map((status) => (
                              <option key={status.id} value={status.id}>
                                {status.status_name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="rd-k44-field">
                          <label htmlFor="rdCaseSubstatus">
                            Case Substatus
                          </label>

                          <select
                            id="rdCaseSubstatus"
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
                              <option key={substatus.id} value={substatus.id}>
                                {substatus.substatus_name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="rd-k44-field">
                          <label htmlFor="rdFollowupDate">Follow-up Date</label>

                          <input
                            id="rdFollowupDate"
                            type="date"
                            name="followupDate"
                            value={callForm.followupDate}
                            onChange={handleCallChange}
                          />
                        </div>

                        <div className="rd-k44-field">
                          <label htmlFor="rdCallPhone">Phone Number</label>

                          <input
                            id="rdCallPhone"
                            type="text"
                            name="phoneNumber"
                            inputMode="numeric"
                            maxLength={10}
                            placeholder="10-digit phone number"
                            value={callForm.phoneNumber}
                            onChange={handleCallChange}
                            required
                          />
                        </div>

                        <div className="rd-k44-field">
                          <label htmlFor="rdCallPincode">Pincode</label>

                          <input
                            id="rdCallPincode"
                            type="text"
                            name="pincode"
                            inputMode="numeric"
                            maxLength={6}
                            placeholder="6-digit pincode"
                            value={callForm.pincode}
                            onChange={handleCallChange}
                            required
                          />
                        </div>

                        <div className="rd-k44-field">
                          <label htmlFor="rdCallOutcome">Status</label>

                          <select
                            id="rdCallOutcome"
                            name="callStatus"
                            value={callForm.callStatus}
                            onChange={handleCallChange}
                            required
                          >
                            <option value="">Select status</option>
                            <option value="Closed">Closed</option>
                            <option value="Complaint">Complaint</option>
                            <option value="Follow-up">Follow-up</option>
                          </select>
                        </div>

                        <div className="rd-k44-field rd-k44-voice-field">
                          <label htmlFor="rdCustomerVoice">
                            Customer Voice
                          </label>

                          <textarea
                            id="rdCustomerVoice"
                            name="customerVoice"
                            rows={2}
                            placeholder="Enter customer feedback or call remarks..."
                            value={callForm.customerVoice}
                            onChange={handleCallChange}
                          />
                        </div>
                      </div>

                      {callError && (
                        <div className="rd-k44-call-alert error">
                          <FiAlertCircle />
                          <span>{callError}</span>
                        </div>
                      )}

                      {callSuccess && (
                        <div className="rd-k44-call-alert success">
                          <FiCheckCircle />
                          <span>{callSuccess}</span>
                        </div>
                      )}

                      <div className="rd-k44-call-actions">
                        <span>
                          {callCase?.updated_by_name
                            ? `Last updated by ${callCase.updated_by_name}`
                            : "No previous call update"}
                        </span>

                        <button type="submit" disabled={savingCall}>
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
                      <div className="rd-k44-history-table-wrapper">
                        <table className="rd-k44-history-table">
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Updated By</th>
                              <th>Date & Time</th>
                              <th>Case Status</th>
                              <th>Substatus</th>
                              <th>Contact Date</th>
                              <th>Follow-up Date</th>
                              <th>Phone Number</th>
                              <th>Pincode</th>
                              <th>Customer Voice</th>
                              <th>Call Status</th>
                            </tr>
                          </thead>

                          <tbody>
                            {history.map((item, index) => (
                              <tr key={item.id}>
                                <td className="rd-k44-row-number">
                                  {index + 1}
                                </td>

                                <td className="rd-k44-history-user">
                                  {item.updated_by_name || "Unknown"}
                                </td>

                                <td>{formatDateTime(item.updated_at)}</td>

                                <td>
                                  <HistoryChange
                                    oldValue={item.old_status}
                                    newValue={item.new_status}
                                  />
                                </td>

                                <td>
                                  <HistoryChange
                                    oldValue={item.old_substatus}
                                    newValue={item.new_substatus}
                                  />
                                </td>

                                <td>{formatDate(item.new_contact_date)}</td>

                                <td>{formatDate(item.new_followup_date)}</td>

                                <td>
                                  <HistoryChange
                                    oldValue={item.old_phone_number}
                                    newValue={item.new_phone_number}
                                  />
                                </td>

                                <td>
                                  <HistoryChange
                                    oldValue={item.old_pincode}
                                    newValue={item.new_pincode}
                                  />
                                </td>

                                <td className="rd-k44-history-voice">
                                  {item.new_customer_voice || "—"}
                                </td>

                                <td>
                                  <HistoryChange
                                    oldValue={item.old_call_status}
                                    newValue={item.new_call_status}
                                  />
                                </td>
                              </tr>
                            ))}
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

              {/* SERVICE HISTORY */}

              <section className="rd-k44-section rd-k44-service-section">
                <button
                  type="button"
                  className="rd-k44-service-toggle"
                  onClick={() => setServiceExpanded((prev) => !prev)}
                  aria-expanded={serviceExpanded}
                >
                  <div className="rd-k44-service-toggle-title">
                    <div className="rd-k44-service-toggle-icon">
                      <FiFileText />
                    </div>

                    <div>
                      <h3>Service History</h3>
                      <p>Complete repair order information</p>
                    </div>
                  </div>

                  <div className="rd-k44-service-toggle-right">
                    <span className="rd-k44-service-count">
                      {record.serviceCount ?? services.length} RECORDS
                    </span>

                    {serviceExpanded ? <FiChevronUp /> : <FiChevronDown />}
                  </div>
                </button>

                {serviceExpanded && (
                  <div className="rd-k44-service-content">
                    {services.length > 0 ? (
                      <div className="rd-k44-service-table-wrapper">
                        <table className="rd-k44-service-table">
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>RO Number</th>
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
                  </div>
                )}
              </section>
            </div>
          ) : null}
        </main>

        {/* FOOTER */}

        <footer className="rd-k44-footer">
          <span>
            {record
              ? `${record.serviceCount ?? services.length} service records`
              : "Chassis Master"}
          </span>

          <button type="button" onClick={onClose}>
            <FiX />
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}

export default ChassisDetailsModal;
