import { useRef, useState } from "react";
import {
  FiUploadCloud,
  FiFile,
  FiRefreshCw,
  FiCheckCircle,
  FiAlertCircle,
  FiDatabase,
  FiArrowUpCircle,
} from "react-icons/fi";

import api from "../services/api";
import "./SalesExcelImport.css";

function SalesExcelImport() {
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  const selectFile = (selectedFile) => {
    console.log("SELECTED FILE:", selectedFile);
    setError("");
    setPreview(null);
    setReport(null);

    if (!selectedFile) return;

    const extension = selectedFile.name.split(".").pop().toLowerCase();

    if (!["xlsx", "xls"].includes(extension)) {
      setError("Please select an .xlsx or .xls Excel file.");
      return;
    }

    if (selectedFile.size > 30 * 1024 * 1024) {
      setError("File size must be below 30 MB.");
      return;
    }

    setFile(selectedFile);
  };

  const handlePreview = async () => {
    console.log("FILE STATE:", file);
    console.log("FILE INPUT:", fileInputRef.current?.files?.[0]);
    if (!file) {
      setError("Please select a Sales Excel file first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);
      setError("");
      setPreview(null);
      setReport(null);

      const response = await api.post("/sales-excel/preview", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setPreview(response.data);
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to preview the Excel file.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file || !preview) return;

    const confirmed = window.confirm(
      `Import ${preview.validRows.toLocaleString("en-IN")} valid sales records into MySQL?\n\nExisting chassis records will be updated. New chassis records will be inserted. Records missing from Excel will be preserved.`,
    );

    if (!confirmed) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);
      setError("");
      setReport(null);

      const response = await api.post("/sales-excel/import", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setReport(response.data.report);
      setPreview(null);
      setFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      setError(err.response?.data?.message || "Sales Excel import failed.");
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (value) => Number(value || 0).toLocaleString("en-IN");

  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);

    selectFile(event.dataTransfer.files?.[0]);
  };

  return (
    <div className="rd-kit-sales-import">
      <div className="rd-kit-si-header">
        <div>
          <div className="rd-kit-si-eyebrow">DATA MANAGEMENT / SALES</div>

          <h4>Sales Excel Import</h4>

          <p>Upload and synchronize Sales Data with the MySQL database.</p>
        </div>

        <div className="rd-kit-si-header-icon">
          <FiDatabase />
        </div>
      </div>

      <div className="rd-kit-si-info">
        <div className="rd-kit-si-info-icon">
          <FiRefreshCw />
        </div>

        <div>
          <strong>Upsert by Chassis Number</strong>
          <p>
            Existing chassis records will be updated. New chassis records will
            be inserted. Records absent from Excel will remain unchanged.
          </p>
        </div>
      </div>

      <div className="rd-kit-si-card">
        <div className="rd-kit-si-card-heading">
          <div>
            <h5>Upload Sales Workbook</h5>
            <p>Select the Excel file containing your Sales Data.</p>
          </div>

          <span className="rd-kit-si-format">XLSX / XLS</span>
        </div>

        <div
          className={`rd-kit-si-dropzone ${
            dragging ? "rd-kit-si-dragging" : ""
          } ${file ? "rd-kit-si-has-file" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              fileInputRef.current?.click();
            }
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            hidden
            onChange={(event) => selectFile(event.target.files?.[0])}
          />

          {file ? (
            <>
              <div className="rd-kit-si-file-icon">
                <FiFile />
              </div>

              <strong>{file.name}</strong>

              <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>

              <small>Click to select another file</small>
            </>
          ) : (
            <>
              <div className="rd-kit-si-upload-icon">
                <FiUploadCloud />
              </div>

              <strong>Drop your Excel file here</strong>

              <span>
                or <b>browse files</b> from your computer
              </span>

              <small>Maximum file size: 30 MB</small>
            </>
          )}
        </div>

        <div className="rd-kit-si-upload-footer">
          <div className="rd-kit-si-sheet-note">
            <FiFile />
            <span>
              Expected worksheet: <b>Sales Data</b>
            </span>
          </div>

          <button
            type="button"
            className="rd-kit-si-button rd-kit-si-primary"
            onClick={handlePreview}
            disabled={!file || loading}
          >
            {loading ? (
              <>
                <span className="rd-kit-si-spinner" />
                Processing...
              </>
            ) : (
              <>
                <FiDatabase />
                Preview Excel
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="rd-kit-si-error">
          <FiAlertCircle />
          <span>{error}</span>
        </div>
      )}

      {preview && (
        <div className="rd-kit-si-card rd-kit-si-preview-card">
          <div className="rd-kit-si-card-heading">
            <div>
              <h5>Excel Preview</h5>
              <p>
                Worksheet: <b>{preview.worksheet}</b>
              </p>
            </div>

            <span className="rd-kit-si-ready">
              <FiCheckCircle />
              Ready to import
            </span>
          </div>

          <div className="rd-kit-si-stats">
            <div>
              <span>Total Rows</span>
              <strong>{formatNumber(preview.totalRows)}</strong>
            </div>

            <div>
              <span>Valid Rows</span>
              <strong>{formatNumber(preview.validRows)}</strong>
            </div>

            <div>
              <span>Duplicate Rows</span>
              <strong>{formatNumber(preview.duplicateRows)}</strong>
            </div>

            <div>
              <span>Blank Chassis</span>
              <strong>{formatNumber(preview.blankChassis)}</strong>
            </div>

            <div>
              <span>Invalid Dates</span>
              <strong>{formatNumber(preview.invalidDates)}</strong>
            </div>
          </div>

          <div className="rd-kit-si-table-heading">
            <strong>First 10 Records</strong>
            <span>{preview.headers?.length || 0} columns</span>
          </div>

          <div className="rd-kit-si-table-wrap">
            <table>
              <thead>
                <tr>
                  {preview.headers?.map((header) => (
                    <th key={header}>{header}</th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {preview.preview?.map((row, index) => (
                  <tr key={`${row.chassis_no}-${index}`}>
                    {preview.headers?.map((header) => {
                      const values = {
                        Delivery_Date: row.delivery_date,
                        Chassis_No: row.chassis_no,
                        "Sale Branch": row.sale_branch,
                        Model_Group: row.model_group,
                        "Cust Name": row.cust_name,
                        PostalCode: row.postal_code,
                        "Mobile no": row.mobile_no,
                        Segment: row.segment,
                      };

                      const key = Object.keys(values).find(
                        (item) =>
                          item.toLowerCase().replace(/[^a-z0-9]/g, "") ===
                          header.toLowerCase().replace(/[^a-z0-9]/g, ""),
                      );

                      return (
                        <td key={header}>
                          {key &&
                          values[key] !== null &&
                          values[key] !== undefined
                            ? String(values[key])
                            : "-"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rd-kit-si-import-footer">
            <div>
              <strong>Ready for MySQL upsert</strong>
              <span>
                {formatNumber(preview.validRows)} records will be processed.
              </span>
            </div>

            <button
              type="button"
              className="rd-kit-si-button rd-kit-si-import-action"
              onClick={handleImport}
              disabled={loading || !preview.validRows}
            >
              {loading ? (
                <>
                  <span className="rd-kit-si-spinner" />
                  Importing...
                </>
              ) : (
                <>
                  <FiArrowUpCircle />
                  Confirm & Import
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {report && (
        <div className="rd-kit-si-card rd-kit-si-report">
          <div className="rd-kit-si-report-heading">
            <FiCheckCircle />
            <div>
              <h5>Import Completed</h5>
              <p>Sales data has been processed successfully.</p>
            </div>
          </div>

          <div className="rd-kit-si-stats">
            <div>
              <span>Total Excel Rows</span>
              <strong>{formatNumber(report.totalRows)}</strong>
            </div>

            <div>
              <span>Valid Rows</span>
              <strong>{formatNumber(report.validRows)}</strong>
            </div>

            <div className="rd-kit-si-success-stat">
              <span>Inserted</span>
              <strong>{formatNumber(report.inserted)}</strong>
            </div>

            <div className="rd-kit-si-update-stat">
              <span>Updated</span>
              <strong>{formatNumber(report.updated)}</strong>
            </div>

            <div>
              <span>Duplicates</span>
              <strong>{formatNumber(report.duplicateRows)}</strong>
            </div>

            <div>
              <span>Blank Chassis</span>
              <strong>{formatNumber(report.blankChassis)}</strong>
            </div>

            <div>
              <span>Invalid Dates</span>
              <strong>{formatNumber(report.invalidDates)}</strong>
            </div>

            <div>
              <span>Batches</span>
              <strong>{formatNumber(report.batchesCompleted)}</strong>
            </div>
          </div>

          <div className="rd-kit-si-report-footer">
            <FiCheckCircle />
            Existing records absent from Excel were preserved.
          </div>
        </div>
      )}
    </div>
  );
}

export default SalesExcelImport;
