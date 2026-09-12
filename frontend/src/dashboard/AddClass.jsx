import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiPlus,
  FiRefreshCw,
  FiChevronLeft,
  FiChevronRight,
  FiCheckCircle,
  FiAlertTriangle,
  FiTrash2,
} from 'react-icons/fi';
import { LuGraduationCap } from 'react-icons/lu';
import { fetchClasses, uploadClassesExcel, saveClasses, createClass, updateClass, deleteClass, deleteClassesBatch, deleteAllClasses } from '../services/classService';
import SearchBar from '../components/classes/SearchBar';
import SortSelect from '../components/classes/SortSelect';
import EmptyState from '../components/classes/EmptyState';
import ClassTable from '../components/classes/ClassTable';
import ExcelUploadCard from '../components/classes/ExcelUploadCard';
import ManualClassModal from '../components/classes/ManualClassModal';
import DeleteClassModal from '../components/classes/DeleteClassModal';
import BulkDeleteModal from '../components/common/BulkDeleteModal';
import '../components/classes/classes.css';
import '../components/common/common.css';

const PER_PAGE = 8;

export default function AddClass() {
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort, setSort] = useState('class_name:asc');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [file, setFile] = useState(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [savingValid, setSavingValid] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [manualBusy, setManualBusy] = useState(false);
  const [editRecord, setEditRecord] = useState(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteRecord, setDeleteRecord] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteScope, setBulkDeleteScope] = useState('selected');
  const [bulkDeleteBusy, setBulkDeleteBusy] = useState(false);

  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = records.length > 0 && records.every((item) => next.has(item.id));
      if (allSelected) {
        records.forEach((item) => next.delete(item.id));
      } else {
        records.forEach((item) => next.add(item.id));
      }
      return next;
    });
  }, [records]);

  const pruneSelection = useCallback((deletedIds) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      deletedIds.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  const openBulkDelete = (scope) => {
    setBulkDeleteScope(scope);
    setBulkDeleteOpen(true);
  };

  const handleBulkDeleteConfirm = async () => {
    if (bulkDeleteScope === 'selected' && selectedIds.size === 0) return;
    setBulkDeleteBusy(true);
    try {
      if (bulkDeleteScope === 'selected') {
        const data = await deleteClassesBatch([...selectedIds]);
        toast.success(data.message || 'Selected classes deleted successfully.');
        pruneSelection(data.deleted_ids || []);
      } else {
        const data = await deleteAllClasses();
        toast.success(data.message || 'All classes deleted successfully.');
        setSelectedIds(new Set());
      }
      setBulkDeleteOpen(false);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to delete classes.');
    } finally {
      setBulkDeleteBusy(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, sort]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sortBy, order] = sort.split(':');
      const data = await fetchClasses({ search: debouncedSearch, page, per_page: PER_PAGE, sort_by: sortBy, order });
      setRecords(data.records || []);
      setTotal(data.total || 0);
      setTotalPages(data.total_pages || 1);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to load classes.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page, sort]);

  useEffect(() => {
    load();
  }, [load]);

  const handleValidate = async () => {
    if (!file) return;
    setUploadBusy(true);
    try {
      const data = await uploadClassesExcel(file);
      setPreview(data);
      if ((data.error_count || 0) === 0) {
        toast.success('File is valid — ready to save.');
      } else {
        toast.info('File parsed with some rows needing attention.');
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Could not validate file. Please try again.');
    } finally {
      setUploadBusy(false);
    }
  };

  const handleSaveValid = async () => {
    const valid = (preview?.records || [])
      .filter((row) => !row.errors?.length)
      .map(({ class_name, short_code, section }) => ({ class_name, short_code, section }));
    if (!valid.length) return;
    setSavingValid(true);
    try {
      const data = await saveClasses(valid);
      toast.success(data.message || 'Classes saved successfully.');
      setPreview(null);
      setFile(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to save classes.');
    } finally {
      setSavingValid(false);
    }
  };

  const handleManualSave = async (payload, record) => {
    setManualBusy(true);
    try {
      if (record) {
        const data = await updateClass(record.id, payload);
        toast.success(data.message || 'Class updated successfully.');
      } else {
        const data = await createClass(payload);
        toast.success(data.message || 'Class added successfully.');
      }
      setModalOpen(false);
      setEditRecord(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to save class.');
    } finally {
      setManualBusy(false);
    }
  };

  const handleEdit = (record) => {
    setEditRecord(record);
    setModalOpen(true);
  };

  const handleDelete = (record) => {
    setDeleteRecord(record);
    setDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteRecord) return;
    setDeleteBusy(true);
    try {
      const data = await deleteClass(deleteRecord.id);
      toast.success(data.message || 'Class deleted successfully.');
      setDeleteOpen(false);
      setDeleteRecord(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to delete class.');
    } finally {
      setDeleteBusy(false);
    }
  };

  const validCount = (preview?.records || []).filter((row) => !row.errors?.length).length;
  const errorCount = preview?.error_count || 0;

  return (
    <div className="page-wrapper">
      <div className="container">
        <motion.div
          className="addclass-page"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="page-header">
            <h1>Add Class</h1>
            <p>Create classes manually or upload a spreadsheet — then manage them all in one place.</p>
          </div>

          <div className="addclass-methods">
            <ExcelUploadCard
              file={file}
              onFileChange={setFile}
              busy={uploadBusy}
              onValidate={handleValidate}
            />

            <div className="method-card addclass-manual-card">
              <div className="method-card-head">
                <div className="method-icon method-icon-manual">
                  <FiPlus size={22} aria-hidden="true" />
                </div>
                <h3>Add Manually</h3>
                <p>Create a single class record using a quick form. Short codes and sections are validated for uniqueness.</p>
              </div>
              <button
                type="button"
                className="class-btn class-btn-primary"
                onClick={() => setModalOpen(true)}
              >
                <FiPlus size={16} aria-hidden="true" />
                Add Class
              </button>
            </div>
          </div>

          <AnimatePresence>
            {preview && (
              <motion.div
                className="class-preview"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <div className="class-preview-head">
                  <h3>Upload Preview</h3>
                  <div className="class-preview-summary">
                    <span className="class-preview-badge class-preview-badge-valid">
                      <FiCheckCircle size={14} aria-hidden="true" />
                      {validCount} valid
                    </span>
                    {errorCount > 0 && (
                      <span className="class-preview-badge class-preview-badge-error">
                        <FiAlertTriangle size={14} aria-hidden="true" />
                        {errorCount} with issues
                      </span>
                    )}
                  </div>
                </div>

                <div className="class-preview-list">
                  {(preview.records || []).map((row, index) => (
                    <div key={`${row.class_name}-${index}`} className="class-preview-row">
                      <div className="class-preview-row-info">
                        <span className={`class-preview-status ${row.errors?.length ? 'class-preview-status-bad' : 'class-preview-status-ok'}`}>
                          {row.errors?.length ? <FiAlertTriangle size={14} aria-hidden="true" /> : <FiCheckCircle size={14} aria-hidden="true" />}
                        </span>
                        <div>
                          <strong>{row.class_name}</strong>{' '}
                          <small>
                            · {row.short_code || '—'} · Section {row.section || '—'}
                          </small>
                          {row.errors?.length > 0 && (
                            <p className="class-preview-errors">
                              {row.errors.join(' ')}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="class-preview-actions">
                  <button
                    type="button"
                    className="class-btn class-btn-success"
                    onClick={handleSaveValid}
                    disabled={validCount === 0 || savingValid}
                  >
                    <FiCheckCircle size={16} aria-hidden="true" />
                    {savingValid ? 'Saving...' : `Save ${validCount} valid class${validCount === 1 ? '' : 'es'}`}
                  </button>
                  <button
                    type="button"
                    className="class-btn class-btn-ghost"
                    onClick={() => {
                      setPreview(null);
                      setFile(null);
                    }}
                  >
                    <FiRefreshCw size={16} aria-hidden="true" />
                    Upload Another
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <section className="addclass-list">
            <div className="addclass-list-header">
              <div>
                <h2>Your Classes</h2>
                <p>{total} class{total === 1 ? '' : 'es'} found</p>
              </div>
              <div className="addclass-list-controls">
                <SearchBar value={search} onChange={setSearch} />
                <SortSelect value={sort} onChange={setSort} />
              </div>
            </div>

            {loading ? (
              <div className="class-loading">Loading classes...</div>
            ) : records.length > 0 ? (
              <>
                {selectedIds.size > 0 && (
                  <div className="bulk-bar">
                    <span className="bulk-bar-count">
                      {selectedIds.size} selected
                    </span>
                    <button
                      type="button"
                      className="class-btn class-btn-danger"
                      onClick={() => openBulkDelete('selected')}
                    >
                      <FiTrash2 size={15} aria-hidden="true" />
                      Delete Selected
                    </button>
                    <button
                      type="button"
                      className="class-btn class-btn-ghost"
                      onClick={() => setSelectedIds(new Set())}
                    >
                      Clear Selection
                    </button>
                  </div>
                )}
                <ClassTable
                  records={records}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                  onToggleSelectAll={toggleSelectAll}
                />
                <button
                  type="button"
                  className="class-btn class-btn-danger class-btn-delete-all"
                  onClick={() => openBulkDelete('all')}
                  disabled={total === 0}
                >
                  <FiTrash2 size={15} aria-hidden="true" />
                  Delete All Classes
                </button>
                {totalPages > 1 && (
                  <div className="class-pagination">
                    <button
                      type="button"
                      onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                      disabled={page <= 1}
                    >
                      <FiChevronLeft size={16} aria-hidden="true" />
                      Previous
                    </button>
                    <span>Page {page} of {totalPages}</span>
                    <button
                      type="button"
                      onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={page >= totalPages}
                    >
                      Next
                      <FiChevronRight size={16} aria-hidden="true" />
                    </button>
                  </div>
                )}
              </>
            ) : (
              <EmptyState
                icon={LuGraduationCap}
                title={search ? 'No matching classes' : 'No classes yet'}
                subtitle={
                  search
                    ? 'Try a different search term or clear the search.'
                    : 'Upload a spreadsheet or add a class manually to get started.'
                }
                actionLabel={search ? undefined : 'Add your first class'}
                onAction={search ? undefined : () => setModalOpen(true)}
              />
            )}
          </section>

          <ManualClassModal
            isOpen={modalOpen}
            onClose={() => {
              setModalOpen(false);
              setEditRecord(null);
            }}
            busy={manualBusy}
            record={editRecord}
            onSave={handleManualSave}
          />

          <DeleteClassModal
            isOpen={deleteOpen}
            onClose={() => {
              setDeleteOpen(false);
              setDeleteRecord(null);
            }}
            busy={deleteBusy}
            record={deleteRecord}
            onConfirm={handleDeleteConfirm}
          />

          <BulkDeleteModal
            isOpen={bulkDeleteOpen}
            onClose={() => {
              setBulkDeleteOpen(false);
              setBulkDeleteScope('selected');
            }}
            busy={bulkDeleteBusy}
            count={bulkDeleteScope === 'selected' ? selectedIds.size : total}
            entityLabel="class"
            scope={bulkDeleteScope}
            onConfirm={handleBulkDeleteConfirm}
          />
        </motion.div>
      </div>
    </div>
  );
}
