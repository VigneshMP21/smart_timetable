import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion } from 'framer-motion';
import { FiUploadCloud, FiFile, FiCheckCircle, FiAlertCircle, FiX } from 'react-icons/fi';
import { validateExcelFile } from '../../utils/validators';
import { formatFileSize } from '../../utils/helpers';
import Button from '../Buttons/Button';
import './UploadBox.css';

/**
 * Drag-and-drop file upload box with validation.
 * @param {function} onFileSelect - Callback when valid file is selected
 * @param {boolean} isUploading - Whether upload is in progress
 * @param {number} uploadProgress - Upload progress percentage
 * @param {string} uploadError - Upload error message
 * @param {function} onReset - Reset upload state
 */
export default function UploadBox({ onFileSelect, isUploading, uploadProgress, uploadError, onReset }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [validationError, setValidationError] = useState(null);

  const onDrop = useCallback((acceptedFiles) => {
    setValidationError(null);
    const file = acceptedFiles[0];
    if (!file) return;

    const { valid, error } = validateExcelFile(file);
    if (!valid) {
      setValidationError(error);
      return;
    }
    setSelectedFile(file);
    if (onFileSelect) onFileSelect(file);
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
    disabled: isUploading,
  });

  const handleReset = () => {
    setSelectedFile(null);
    setValidationError(null);
    if (onReset) onReset();
  };

  const error = validationError || uploadError;

  return (
    <div className="upload-box-container">
      <motion.div
        {...getRootProps()}
        className={`upload-box ${isDragActive ? 'drag-active' : ''} ${error ? 'has-error' : ''} ${selectedFile && !error ? 'has-file' : ''} ${isUploading ? 'uploading' : ''}`}
        whileHover={!isUploading ? { scale: 1.01 } : {}}
        whileTap={!isUploading ? { scale: 0.99 } : {}}
      >
        <input {...getInputProps()} />
        {isUploading ? (
          <div className="upload-progress-content">
            <FiUploadCloud className="upload-icon spinning" size={48} />
            <p className="upload-text">Uploading...</p>
            <div className="upload-progress-bar">
              <motion.div
                className="upload-progress-fill"
                initial={{ width: 0 }}
                animate={{ width: `${uploadProgress}%` }}
              />
            </div>
            <span className="upload-progress-text">{uploadProgress}%</span>
          </div>
        ) : selectedFile && !error ? (
          <div className="upload-file-content">
            <FiCheckCircle className="upload-icon success" size={48} />
            <p className="upload-text">{selectedFile.name}</p>
            <p className="upload-subtext">{formatFileSize(selectedFile.size)}</p>
            <button className="upload-remove" onClick={(e) => { e.stopPropagation(); handleReset(); }} aria-label="Remove file">
              <FiX size={16} /> Remove
            </button>
          </div>
        ) : isDragActive ? (
          <div className="upload-drag-content">
            <FiUploadCloud className="upload-icon" size={48} />
            <p className="upload-text">Drop your Excel file here</p>
          </div>
        ) : (
          <div className="upload-idle-content">
            <FiUploadCloud className="upload-icon" size={48} />
            <p className="upload-text">Drag & drop your Excel file here</p>
            <p className="upload-subtext">or click to browse</p>
            <p className="upload-formats">Supports .xlsx and .xls files (max 10MB)</p>
          </div>
        )}
      </motion.div>

      {error && (
        <motion.div
          className="upload-error"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <FiAlertCircle size={16} />
          <span>{error}</span>
        </motion.div>
      )}
    </div>
  );
}
