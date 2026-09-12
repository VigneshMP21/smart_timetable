import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiInfo, FiDownload, FiAlertTriangle } from 'react-icons/fi';
import UploadBox from '../components/UploadBox/UploadBox';
import Button from '../components/Buttons/Button';
import { useUpload } from '../hooks/useUpload';
import './Upload.css';

const SHEET_META = [
  { key: 'classes', label: 'Classes', path: '/dashboard/add-class', sheet: 'Classes' },
  { key: 'rooms', label: 'Rooms', path: '/dashboard/add-room', sheet: 'Rooms' },
  { key: 'subjects', label: 'Subjects', path: '/dashboard/add-subjects', sheet: 'Subjects' },
  { key: 'faculty', label: 'Faculty', path: '/dashboard/add-faculty', sheet: 'Faculty' },
];

export default function Upload() {
  const navigate = useNavigate();
  const {
    importFile,
    downloadTemplate,
    importProgress,
    isImporting,
    isDownloadingTemplate,
    importResult,
    importErrors,
    importError,
    resetUpload,
  } = useUpload();
  const [file, setFile] = useState(null);
  const [uploadBoxKey, setUploadBoxKey] = useState(0);

  const handleFileSelect = useCallback((selectedFile) => {
    setFile(selectedFile);
  }, []);

  const handleImport = useCallback(async () => {
    if (!file) return;
    try {
      await importFile(file);
    } catch (err) {
      // Error handled in hook
    }
  }, [file, importFile]);

  const handleDownloadTemplate = useCallback(async () => {
    try {
      await downloadTemplate();
    } catch (err) {
      // Error handled in hook
    }
  }, [downloadTemplate]);

  const handleReset = useCallback(() => {
    resetUpload();
    setFile(null);
    setUploadBoxKey((key) => key + 1);
  }, [resetUpload]);

  const importedTotal = importResult?.imported_total ?? 0;
  const skippedTotal = importResult?.skipped_total ?? 0;

  return (
    <div className="page-wrapper">
      <div className="container">
        <motion.div
          className="upload-page"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="page-header upload-header">
            <div>
              <h1>Upload Complete Timetable Data</h1>
              <p>
                Import all your classes, rooms, subjects and faculty at once using a single Excel workbook.
              </p>
            </div>
            <Button
              variant="outline"
              loading={isDownloadingTemplate}
              disabled={isDownloadingTemplate}
              onClick={handleDownloadTemplate}
              className="upload-template-btn"
            >
              <FiDownload size={16} /> Download Sample Excel
            </Button>
          </div>

          <div className="upload-content">
            <UploadBox
              key={uploadBoxKey}
              onFileSelect={handleFileSelect}
              isUploading={isImporting}
              uploadProgress={importProgress}
              uploadError={importError}
              onReset={handleReset}
            />

            <div className="upload-import-actions">
              <Button
                variant="primary"
                size="lg"
                onClick={handleImport}
                disabled={!file || isImporting}
                loading={isImporting}
              >
                {isImporting ? 'Importing...' : 'Upload & Import'}
              </Button>
              {file && !isImporting && !importResult && (
                <Button variant="outline" onClick={handleReset}>
                  Clear
                </Button>
              )}
            </div>

            {importErrors.length > 0 && (
              <motion.div
                className="upload-errors-card"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="upload-errors-header">
                  <FiAlertTriangle size={18} />
                  <h3>Import Failed</h3>
                </div>
                <p className="upload-errors-message">
                  {importError || 'Fix the issues below and upload the workbook again. No data was imported.'}
                </p>
                <div className="upload-errors-list">
                  {importErrors.map((entry, i) => (
                    <div className="upload-error-row" key={i}>
                      <span className="upload-error-loc">
                        {entry.sheet ? `${entry.sheet}` : 'Workbook'}
                        {entry.row ? ` - Row ${entry.row}` : ''}
                      </span>
                      <span className="upload-error-text">{entry.problem || entry.error}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {importResult && (
              <motion.div
                className="upload-success-card"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="upload-success-header">
                  <h3>Import Successful</h3>
                  <p className="upload-success-message">
                    {importResult.message}
                  </p>
                </div>
                <div className="upload-summary">
                  {SHEET_META.map(({ key, label, sheet }) => {
                    const entity = importResult[key] || {};
                    return (
                      <div className="upload-summary-item" key={key}>
                        <span className="summary-label">{label} ({sheet})</span>
                        <div className="summary-row">
                          <div className="summary-stat">
                            <span className="summary-value imported">{entity.imported ?? 0}</span>
                            <span className="summary-sub">imported</span>
                          </div>
                          <div className="summary-stat">
                            <span className="summary-value skipped">{entity.skipped ?? 0}</span>
                            <span className="summary-sub">skipped</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="upload-actions">
                  <div className="upload-actions-info">
                    {importedTotal} record(s) imported
                    {skippedTotal > 0 ? `, ${skippedTotal} duplicate(s) skipped` : ''}.
                  </div>
                  <div className="upload-actions-buttons">
                    <Button variant="primary" onClick={() => navigate('/dashboard/add-class')}>
                      View Imported Data
                    </Button>
                    <Button variant="outline" onClick={handleReset}>
                      Upload New File
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            <div className="upload-info">
              <FiInfo size={16} />
              <div>
                <p>
                  Your Excel workbook must contain 4 sheets named{' '}
                  <strong>Classes</strong>, <strong>Rooms</strong>, <strong>Subjects</strong> and{' '}
                  <strong>Faculty</strong>, with these columns:
                </p>
                <ul className="upload-info-sheets">
                  <li>
                    <strong>Classes</strong>: Class Name, Short Code, Section
                  </li>
                  <li>
                    <strong>Rooms</strong>: Room No, Class Short Code, Section
                  </li>
                  <li>
                    <strong>Subjects</strong>: Subject Code, Subject Name, Branch/Class
                  </li>
                  <li>
                    <strong>Faculty</strong>: Faculty Name, Subject Code, Subject Name, Classes/Branch (branch + section together, e.g. CSE-1, CSM-2)
                  </li>
                </ul>
                <p>
                  The whole file is validated before anything is saved, so rows that reference a
                  class or subject that doesn&apos;t exist will block the import. Duplicate records
                  are skipped automatically and reported above.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
