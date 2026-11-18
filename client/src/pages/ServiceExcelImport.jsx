import { useRef, useState } from "react";
import {
  FiUpload,
  FiFile,
  FiRefreshCw,
  FiCheckCircle,
  FiAlertCircle,
  FiX,
  FiDatabase,
  FiCalendar,
  FiCopy,
  FiDownload,
} from "react-icons/fi";

import api from "../services/api";
import "./ServiceExcelImport.css";

const formatNumber = (value) => Number(value || 0).toLocaleString("en-IN");

export default function ServiceExcelImport() {
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [importResult, setImportResult] = useState(null);

  const selectFile = (selectedFile) => {
    if (!selectedFile) return;

    const extension = selectedFile.name.split(".").pop().toLowerCase();

    if (!["xlsx", "xls"].includes(extension)) {
      setError("Please select a valid Excel file (.xlsx or .xls).");
      return;
    }

    if (selectedFile.size > 50 * 1024 * 1024) {
      setError("File size cannot exceed 50 MB.");
      return;
    }

    setFile(selectedFile);
    setPreview(null);
    setImportResult(null);
    setError("");
    setSuccess("");
  };

  const handleFileChange = (event) => {
    selectFile(event.target.files?.[0]);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    selectFile(event.dataTransfer.files?.[0]);
  };

  const handlePreview = async () => {
    if (!file) {
      setError("Please select an Excel file first.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");
      setPreview(null);
      setImportResult(null);

      const formData = new FormData();
      formData.append("file", file);

      const response = await api.post("/service-excel/preview", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setPreview(response.data);
      setSuccess("Excel file validated successfully.");
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to generate Excel preview.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file || !preview) return;

    if (
      preview.report?.invalidInvoiceDates > 0 ||
      preview.report?.validRows === 0
    ) {
      setError("Please correct the Excel validation issues before importing.");
      return;
    }

    const confirmed = window.confirm(
      `Import ${formatNumber(preview.report.validRows)} unique RO records?\n\n` +
        "Existing RO numbers will be updated.\n" +
        "New RO numbers will be inserted.\n" +
        "Records absent from Excel will be preserved.\n" +
        "RO dates will be set to blank for imported records.",
    );

    if (!confirmed) return;

    try {
      setImporting(true);
      setError("");
      setSuccess("");
      setImportResult(null);

      const formData = new FormData();
      formData.append("file", file);

      const response = await api.post("/service-excel/upsert", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        timeout: 0,
      });

      setImportResult(response.data);
      setSuccess(response.data.message);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Service Data import failed. Please try again.",
      );
    } finally {
      setImporting(false);
    }
  };

  const resetPage = () => {
    setFile(null);
    setPreview(null);
    setImportResult(null);
    setError("");
    setSuccess("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const report = preview?.report;

  return (
    <div className="rd-kit-service-import">
      <div className="rd-kit-service-import-header">
        <div>
          <div className="rd-kit-service-import-breadcrumb">
            Data Management / Service Data
          </div>

          <h2>Service Excel Import</h2>

          <p>Upload, validate and update Service Data from Excel.</p>
        </div>

        <button
          className="rd-kit-service-import-refresh"
          onClick={resetPage}
          disabled={loading || importing}
        >
          <FiRefreshCw />
          Reset
        </button>
      </div>

      {error && (
        <div className="rd-kit-service-import-alert error">
          <FiAlertCircle />
          <span>{error}</span>
          <button onClick={() => setError("")}>
            <FiX />
          </button>
        </div>
      )}

      {success && (
        <div className="rd-kit-service-import-alert success">
          <FiCheckCircle />
          <span>{success}</span>
          <button onClick={() => setSuccess("")}>
            <FiX />
          </button>
        </div>
      )}

      <div className="rd-kit-service-import-info">
        <div className="rd-kit-service-import-info-icon">
          <FiDatabase />
        </div>

        <div>
          <strong>UPSERT import mode</strong>
          <p>
            Existing RO numbers are updated, new records are inserted, and
            records missing from Excel are preserved.
          </p>
        </div>
      </div>

      <div className="rd-kit-service-import-card">
        <div className="rd-kit-service-import-card-title">
          <div>
            <h3>Upload Excel File</h3>
            <p>Select your Service Data workbook.</p>
          </div>

          <span className="rd-kit-service-import-format">XLSX / XLS</span>
        </div>

        <div
          className={`rd-kit-service-import-dropzone ${
            dragging ? "dragging" : ""
          } ${file ? "has-file" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            hidden
          />

          {file ? (
            <>
              <div className="rd-kit-service-import-file-icon">
                <FiFile />
              </div>

              <strong>{file.name}</strong>

              <span>{(file.size / (1024 * 1024)).toFixed(2)} MB</span>

              <button
                type="button"
                className="rd-kit-service-import-remove"
                onClick={(event) => {
                  event.stopPropagation();
                  resetPage();
                }}
              >
                <FiX /> Remove file
              </button>
            </>
          ) : (
            <>
              <div className="rd-kit-service-import-upload-icon">
                <FiUpload />
              </div>

              <strong>Drop your Excel file here</strong>

              <span>or click to browse your computer</span>

              <small>Maximum file size: 50 MB</small>
            </>
          )}
        </div>

        <div className="rd-kit-service-import-actions">
          <button
            className="rd-kit-service-import-preview-btn"
            onClick={handlePreview}
            disabled={!file || loading || importing}
          >
            {loading ? (
              <>
                <FiRefreshCw className="rd-kit-service-import-spin" />
                Validating...
              </>
            ) : (
              <>
                <FiCheckCircle />
                Validate & Preview
              </>
            )}
          </button>

          <button
            className="rd-kit-service-import-submit-btn"
            onClick={handleImport}
            disabled={
              !preview ||
              loading ||
              importing ||
              preview.report?.invalidInvoiceDates > 0 ||
              preview.report?.validRows === 0
            }
          >
            {importing ? (
              <>
                <FiRefreshCw className="rd-kit-service-import-spin" />
                Importing...
              </>
            ) : (
              <>
                <FiDatabase />
                Import / UPSERT
              </>
            )}
          </button>
        </div>
      </div>

      {report && (
        <>
          <div className="rd-kit-service-import-section-heading">
            <div>
              <h3>Import Preview</h3>
              <p>Validation results from your Excel workbook.</p>
            </div>

            <span className="rd-kit-service-import-ready">
              <FiCheckCircle /> Preview ready
            </span>
          </div>

          <div className="rd-kit-service-import-stats">
            <div className="rd-kit-service-import-stat">
              <span>Total Excel Rows</span>
              <strong>{formatNumber(report.totalRows)}</strong>
            </div>

            <div className="rd-kit-service-import-stat">
              <span>Unique RO Records</span>
              <strong className="orange">
                {formatNumber(report.validRows)}
              </strong>
            </div>

            <div className="rd-kit-service-import-stat">
              <span>Duplicate Rows</span>
              <strong>{formatNumber(report.duplicateRows)}</strong>
            </div>

            <div className="rd-kit-service-import-stat">
              <span>Blank RO Numbers</span>
              <strong>{formatNumber(report.blankRONumbers)}</strong>
            </div>

            <div className="rd-kit-service-import-stat">
              <span>Invalid Bill Dates</span>
              <strong className={report.invalidInvoiceDates ? "red" : "green"}>
                {formatNumber(report.invalidInvoiceDates)}
              </strong>
            </div>
          </div>

          <div className="rd-kit-service-import-mapping">
            <div>
              <FiCalendar />
              <span>Invoice Date</span>
              <strong>Bill Date</strong>
            </div>

            <div>
              <FiCalendar />
              <span>RO Date</span>
              <strong>Always blank (NULL)</strong>
            </div>

            <div>
              <FiCopy />
              <span>Duplicate RO</span>
              <strong>Latest invoice date wins</strong>
            </div>
          </div>

          {report.duplicateRONumbers?.length > 0 && (
            <div className="rd-kit-service-import-duplicates">
              <div className="rd-kit-service-import-duplicate-heading">
                <div>
                  <FiAlertCircle />
                  <strong>Duplicate RO Numbers</strong>
                </div>

                <span>{report.duplicateRONumbers.length} unique ROs</span>
              </div>

              <div className="rd-kit-service-import-duplicate-list">
                {report.duplicateRONumbers.map((ro, index) => (
                  <span key={`${ro}-${index}`}>{ro}</span>
                ))}
              </div>

              <p>
                The record with the latest invoice date will be imported for
                each duplicate RO number.
              </p>
            </div>
          )}

          <div className="rd-kit-service-import-table-card">
            <div className="rd-kit-service-import-table-heading">
              <div>
                <h3>Data Preview</h3>
                <p>First 10 unique records after duplicate removal.</p>
              </div>
              <span>{formatNumber(report.validRows)} records</span>
            </div>

            <div className="rd-kit-service-import-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Bill Date</th>
                    <th>RO Number</th>
                    <th>Location</th>
                    <th>Registration</th>
                    <th>Chassis Number</th>
                    <th>Category</th>
                    <th>Service Type</th>
                    <th>Advisor</th>
                    <th>Model</th>
                    <th>RO Date</th>
                  </tr>
                </thead>

                <tbody>
                  {preview.preview?.map((record, index) => (
                    <tr key={`${record.repair_order_number}-${index}`}>
                      <td>{record.bill_date || "—"}</td>
                      <td className="strong">{record.repair_order_number}</td>
                      <td>{record.dealer_location || "—"}</td>
                      <td>{record.registration_number || "—"}</td>
                      <td>{record.chassis_number || "—"}</td>
                      <td>{record.service_category || "—"}</td>
                      <td>{record.service_type || "—"}</td>
                      <td>{record.ro_service_advisor || "—"}</td>
                      <td>{record.product_name || "—"}</td>
                      <td>
                        <span className="rd-kit-service-import-null">NULL</span>
                      </td>
                    </tr>
                  ))}

                  {!preview.preview?.length && (
                    <tr>
                      <td colSpan="10" className="empty">
                        No preview records available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {importing && (
        <div className="rd-kit-service-import-progress">
          <FiRefreshCw className="rd-kit-service-import-spin" />
          <div>
            <strong>Import is running...</strong>
            <p>
              Processing Excel records in batches. Please keep this page open
              and do not submit another import.
            </p>
          </div>
        </div>
      )}

      {importResult?.report && (
        <div className="rd-kit-service-import-result">
          <div className="rd-kit-service-import-result-heading">
            <FiCheckCircle />
            <div>
              <h3>Import Completed Successfully</h3>
              <p>Your Service Data has been updated.</p>
            </div>
          </div>

          <div className="rd-kit-service-import-result-grid">
            <div>
              <span>Submitted Rows</span>
              <strong>{formatNumber(importResult.report.submittedRows)}</strong>
            </div>

            <div>
              <span>Completed Batches</span>
              <strong>
                {formatNumber(importResult.report.batchesCompleted)}
              </strong>
            </div>

            <div>
              <span>Duplicates Removed</span>
              <strong>{formatNumber(importResult.report.duplicateRows)}</strong>
            </div>

            <div>
              <span>Records Deleted</span>
              <strong>0</strong>
            </div>
          </div>

          <div className="rd-kit-service-import-result-note">
            <FiCheckCircle />
            Existing records not present in Excel were preserved.
          </div>
        </div>
      )}
    </div>
  );
}
