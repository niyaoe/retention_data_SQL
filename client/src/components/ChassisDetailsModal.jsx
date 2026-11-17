
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
} from "react-icons/fi";

import api from "../services/api";
import "./ChassisDetailsModal.css";

function ChassisDetailsModal({ chassisNumber, onClose }) {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await api.get(
          `/sales-master/${encodeURIComponent(chassisNumber)}`
        );

        setRecord(response.data.record);
      } catch (err) {
        setError(
          err.response?.data?.message ||
            "Unable to load chassis details"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [chassisNumber]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const formatDate = (date) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-IN");
  };

  if (!chassisNumber) return null;

  const sales = record?.salesData || {};
  const services = record?.serviceRecords || [];

  const InfoTile = ({ icon, label, value }) => (
    <div className="rd-k44-info-tile">
      <div className="rd-k44-tile-icon">{icon}</div>

      <div className="rd-k44-tile-content">
        <span>{label}</span>
        <strong title={value || ""}>{value || "—"}</strong>
      </div>
    </div>
  );

  return (
    <div
      className="rd-k44-overlay"
      onClick={onClose}
    >
      <div
        className="rd-k44-modal"
        onClick={(e) => e.stopPropagation()}
      >
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
              {/* SALES INFORMATION */}

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
                    VEHICLE DETAILS
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
                    icon={<FiGrid />}
                    label="Segment"
                    value={sales.segment}
                  />

                </div>
              </section>

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
                    {services.length} RECORDS
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
                        </tr>
                      </thead>

                      <tbody>
                        {services.map((service, index) => (
                          <tr
                            key={service.sourceServiceId || index}
                          >
                            <td className="rd-k44-row-number">
                              {index + 1}
                            </td>

                            <td className="rd-k44-ro-number">
                              {service.repairOrderNumber || "—"}
                            </td>

                            <td>{formatDate(service.roDate)}</td>

                            <td>{formatDate(service.billDate)}</td>

                            <td>
                              {service.registrationNumber || "—"}
                            </td>

                            <td>
                              {service.dealerLocation || "—"}
                            </td>

                            <td>
                              <span className="rd-k44-category">
                                {service.serviceCategory || "—"}
                              </span>
                            </td>

                            <td>{service.serviceType || "—"}</td>

                            <td>
                              {service.roServiceAdvisor || "—"}
                            </td>

                            <td>{service.productName || "—"}</td>
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
          ) : null}
        </div>

        {/* FOOTER */}

        <div className="rd-k44-footer">
          <span>
            {record
              ? `${services.length} service records`
              : "Sales Master"}
          </span>

          <button
            type="button"
            onClick={onClose}
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}

export default ChassisDetailsModal;
