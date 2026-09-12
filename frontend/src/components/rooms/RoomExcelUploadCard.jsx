import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { FiUploadCloud, FiFileText, FiX } from 'react-icons/fi';
import { UPLOAD_ERRORS } from '../../utils/constants';
import ExcelExample from '../common/ExcelExample';

const MAX_SIZE = 10 * 1024 * 1024;
const ACCEPTED = {
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
};

/**
 * RoomExcelUploadCard - drag & drop upload card for the room Excel file.
 * @param {File|null} file - Currently selected file (controlled by parent).
 * @param {function} onFileChange - Sets the selected file.
 * @param {boolean} busy - True while the file is being validated.
 * @param {function} onValidate - Called when the user confirms the selected file.
 */
export default function RoomExcelUploadCard({ file, onFileChange, busy, onValidate }) {
  const onDrop = useCallback(
    (accepted, rejected) => {
      if (rejected && rejected.length > 0) {
        const [entry] = rejected;
        const reason = entry?.errors?.[0]?.code;
        onFileChange({ invalid: true, message: reason === 'file-too-large' ? UPLOAD_ERRORS.TOO_LARGE : UPLOAD_ERRORS.INVALID_TYPE });
        return;
      }
      const [chosen] = accepted;
      if (!chosen) return;
      if (chosen.size > MAX_SIZE) {
        onFileChange({ invalid: true, message: UPLOAD_ERRORS.TOO_LARGE });
        return;
      }
      onFileChange(chosen);
    },
    [onFileChange]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    maxFiles: 1,
    maxSize: MAX_SIZE,
    disabled: busy,
  });

  return (
    <div className="method-card addclass-upload-card">
      <div className="method-card-head">
        <div className="method-icon method-icon-upload">
          <FiUploadCloud size={22} aria-hidden="true" />
        </div>
        <h3>Upload Excel File</h3>
        <p>Add multiple rooms at once using a spreadsheet.</p>
      </div>

      <div
        {...getRootProps()}
        className={`class-dropzone${isDragActive ? ' class-dropzone-active' : ''}${busy ? ' is-disabled' : ''}`}
      >
        <input {...getInputProps()} />
        <FiUploadCloud className="class-dropzone-icon" size={34} aria-hidden="true" />
        <p className="class-dropzone-title">{isDragActive ? 'Drop the file here' : 'Drag & drop your file here'}</p>
        <p className="class-dropzone-sub">or <span>click to browse</span> · .xlsx / .xls · max 10 MB</p>
      </div>

      {file && !file.invalid && (
        <div className="class-file-chip">
          <FiFileText size={18} aria-hidden="true" />
          <span className="class-file-name">{file.name}</span>
          <span className="class-file-size">{(file.size / 1024).toFixed(0)} KB</span>
          <button
            type="button"
            className="class-file-remove"
            onClick={() => onFileChange(null)}
            disabled={busy}
            aria-label="Remove file"
          >
            <FiX size={16} />
          </button>
        </div>
      )}

      {file && file.invalid && (
        <div className="class-file-error">
          <span>{file.message}</span>
          <button type="button" className="class-file-remove" onClick={() => onFileChange(null)} aria-label="Dismiss">
            <FiX size={16} />
          </button>
        </div>
      )}

      <button
        type="button"
        className="class-btn class-btn-primary class-btn-block"
        onClick={onValidate}
        disabled={!file || file.invalid || busy}
      >
        {busy ? 'Validating...' : 'Upload & Validate'}
      </button>
      <p className="class-hint">
        <ExcelExample
          headings={['Room No', 'Class Short Code', 'Section']}
          rows={[
            ['A-101', 'CSE', 'A'],
            ['B-204', 'ECE', 'B'],
          ]}
          title="Expected Excel columns (Room No required; others optional)"
        />
      </p>
    </div>
  );
}
