
import { useRef, useState } from "react";
import {
  FiUpload,
  FiFile,
  FiRefreshCw,
  FiCheckCircle,
  FiAlertCircle,
  FiX,
  FiDatabase,
} from "react-icons/fi";

import api from "../services/api";
import "./ServiceActionExcelImport.css";

const formatNumber = (value) =>
  Number(value || 0).toLocaleString("en-IN");

export default function ServiceActionExcelImport() {
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [importSummary, setImportSummary] = useState(null);

  const selectFile = (selectedFile) => {
    if (!selectedFile) return;

    const extension = selectedFile.name.split(".").pop().toLowerCase();

    if (!["xlsx", "xls"].includes(extension)) {
      setError("Please select a valid Excel file (.xlsx or .xls).");
      return;
    }

    if (selectedFile.size > 20 * 1024 * 1024) {
      setError("File size cannot exceed 20 MB.");
      return;
    }

    setFile(selectedFile);
    setError("");
    setSuccess("");
    setImportSummary(null);
  };

  const handleFileChange = (event) => {
    selectFile(event.target.files?.[0]);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    selectFile(event.dataTransfer.files?.[0]);
  };

  const resetPage = () => {
    setFile(null);
    setError("");
    setSuccess("");
    setImportSummary(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleImport = async () => {
    if (!file || importing) return;

    const confirmed = window.confirm(
      "WARNING: This will delete all existing Service Action records and replace them with rows where Attended Indicator is NO.\n\n" +
        "YES and blank rows will be excluded.\n\n" +
        "Do you want to continue?"
    );

    if (!confirmed) return;

    try {
      setImporting(true);
      setError("");
      setSuccess("");
      setImportSummary(null);

      const formData = new FormData();
      formData.append("file", file);

      const response = await api.post(
        "/service-action/import",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          timeout: 0,
        }
      );

      setSuccess(
        response.data.message ||
          "Service Action import completed successfully."
      );

      setImportSummary(response.data.summary || null);
      setFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Service Action import failed. Please try again."
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="rd-kit-sa-import">
      {/* HEADER */}
      <div className="rd-kit-sa-import-header">
        <div>
          <div className="rd-kit-sa-import-breadcrumb">
            DATA MANAGEMENT / SERVICE ACTION
          </div>

          <h2>Service Action Excel Import</h2>

          <p>
            Upload and replace Service Action data from Excel.
          </p>
        </div>

        <button
          type="button"
          className="rd-kit-sa-import-reset"
          onClick={resetPage}
          disabled={importing}
        >
          <FiRefreshCw />
          Reset
        </button>
      </div>

      {/* ERROR ALERT */}
      {error && (
        <div className="rd-kit-sa-import-alert error">
          <FiAlertCircle />

          <span>{error}</span>

          <button
            type="button"
            onClick={() => setError("")}
          >
            <FiX />
          </button>
        </div>
      )}

      {/* SUCCESS ALERT */}
      {success && (
        <div className="rd-kit-sa-import-alert success">
          <FiCheckCircle />

          <span>{success}</span>

          <button
            type="button"
            onClick={() => setSuccess("")}
          >
            <FiX />
          </button>
        </div>
      )}

      {/* IMPORT INFORMATION */}
      <div className="rd-kit-sa-import-info">
        <div className="rd-kit-sa-import-info-icon">
          <FiDatabase />
        </div>

        <div>
          <strong>Full Replacement Import</strong>

          <p>
            Existing Service Action records will be replaced.
            Only rows with Attended Indicator = NO will be
            imported. YES and blank rows will be excluded.
          </p>
        </div>
      </div>

      {/* UPLOAD CARD */}
      <div className="rd-kit-sa-import-card">
        <div className="rd-kit-sa-import-card-title">
          <div>
            <h3>Upload Excel File</h3>
            <p>Select your Service Action workbook.</p>
          </div>

          <span className="rd-kit-sa-import-format">
            XLSX / XLS
          </span>
        </div>

        {/* DROPZONE */}
        <div
          className={`rd-kit-sa-import-dropzone ${
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
              <div className="rd-kit-sa-import-file-icon">
                <FiFile />
              </div>

              <strong>{file.name}</strong>

              <span>
                {(file.size / (1024 * 1024)).toFixed(2)} MB
              </span>

              <button
                type="button"
                className="rd-kit-sa-import-remove"
                onClick={(event) => {
                  event.stopPropagation();
                  resetPage();
                }}
              >
                <FiX />
                Remove file
              </button>
            </>
          ) : (
            <>
              <div className="rd-kit-sa-import-upload-icon">
                <FiUpload />
              </div>

              <strong>Drop your Excel file here</strong>

              <span>
                or click to browse your computer
              </span>

              <small>Maximum file size: 20 MB</small>
            </>
          )}
        </div>

        {/* ACTION */}
        <div className="rd-kit-sa-import-actions">
          <button
            type="button"
            className="rd-kit-sa-import-submit"
            onClick={handleImport}
            disabled={!file || importing}
          >
            {importing ? (
              <>
                <FiRefreshCw className="rd-kit-sa-import-spin" />
                Importing...
              </>
            ) : (
              <>
                <FiDatabase />
                Replace Service Action Data
              </>
            )}
          </button>
        </div>
      </div>

      {/* PROGRESS */}
      {importing && (
        <div className="rd-kit-sa-import-progress">
          <FiRefreshCw className="rd-kit-sa-import-spin" />

          <div>
            <strong>Import is running...</strong>

            <p>
              Processing Excel records. Please keep this page
              open and do not submit another import.
            </p>
          </div>
        </div>
      )}

      {/* IMPORT RESULT */}
      {importSummary && (
        <div className="rd-kit-sa-import-result">
          <div className="rd-kit-sa-import-result-heading">
            <FiCheckCircle />

            <div>
              <h3>Import Completed Successfully</h3>
              <p>Your Service Action data has been replaced.</p>
            </div>
          </div>

          <div className="rd-kit-sa-import-result-grid">
            <div>
              <span>Total Excel Rows</span>
              <strong>
                {formatNumber(importSummary.totalExcelRows)}
              </strong>
            </div>

            <div>
              <span>Attended NO</span>
              <strong>
                {formatNumber(importSummary.noCount)}
              </strong>
            </div>

            <div>
              <span>YES Excluded</span>
              <strong>
                {formatNumber(importSummary.yesCount)}
              </strong>
            </div>

            <div>
              <span>Blank Excluded</span>
              <strong>
                {formatNumber(importSummary.blankCount)}
              </strong>
            </div>

            <div>
              <span>Inserted Records</span>
              <strong>
                {formatNumber(importSummary.insertedCount)}
              </strong>
            </div>
          </div>

          <div className="rd-kit-sa-import-result-note">
            <FiCheckCircle />
            Only records with Attended Indicator = NO were imported.
          </div>
        </div>
      )}
    </div>
  );
}
