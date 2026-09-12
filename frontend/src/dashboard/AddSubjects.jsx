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
import { LuBookOpen } from 'react-icons/lu';
import { fetchSubjects, uploadSubjectsExcel, saveSubjects, createSubject, updateSubject, deleteSubject, deleteSubjectsBatch, deleteAllSubjects } from '../services/subjectService';
import { fetchClasses } from '../services/classService';
import SearchBar from '../components/classes/SearchBar';
import SubjectSortSelect from '../components/subjects/SubjectSortSelect';
import EmptyState from '../components/classes/EmptyState';
import SubjectsTable from '../components/subjects/SubjectsTable';
import ExcelUploadCard from '../components/subjects/ExcelUploadCard';
import ManualSubjectModal from '../components/subjects/ManualSubjectModal';
import DeleteSubjectModal from '../components/subjects/DeleteSubjectModal';
import BulkDeleteModal from '../components/common/BulkDeleteModal';
import '../components/classes/classes.css';
import '../components/subjects/subjects.css';
import '../components/common/common.css';

const PER_PAGE = 8;

export default function AddSubjects() {
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort, setSort] = useState('created_at:desc');
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
        const data = await deleteSubjectsBatch([...selectedIds]);
        toast.success(data.message || 'Selected subjects deleted successfully.');
        pruneSelection(data.deleted_ids || []);
      } else {
        const data = await deleteAllSubjects();
        toast.success(data.message || 'All subjects deleted successfully.');
        setSelectedIds(new Set());
      }
      setBulkDeleteOpen(false);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to delete subjects.');
    } finally {
      setBulkDeleteBusy(false);
    }
  };

  const [classes, setClasses] = useState([]);

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
      const data = await fetchSubjects({ search: debouncedSearch, page, per_page: PER_PAGE, sort_by: sortBy, order });
      setRecords(data.records || []);
      setTotal(data.total || 0);
      setTotalPages(data.total_pages || 1);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to load subjects.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page, sort]);

  useEffect(() => {
    load();
  }, [load]);

  const loadAllPages = async (fetcher, perPage = 100) => {
    const all = [];
    let page = 1;
    let data = await fetcher({ per_page: perPage, page });
    all.push(...(data.records || []));
    const totalPages = data.total_pages || 1;
    for (let p = 2; p <= totalPages; p++) {
      data = await fetcher({ per_page: perPage, page: p });
      all.push(...(data.records || []));
    }
    return all;
  };

  const loadClasses = useCallback(async () => {
    try {
      const cls = await loadAllPages(fetchClasses);
      setClasses(cls);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to load classes.');
    }
  }, []);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  const handleValidate = async () => {
    if (!file) return;
    setUploadBusy(true);
    try {
      const data = await uploadSubjectsExcel(file);
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
      .map(({ subject_code, subject_name, branch_classes }) => ({
        subject_code,
        subject_name,
        branch_classes,
      }));
    if (!valid.length) return;
    setSavingValid(true);
    try {
      const data = await saveSubjects(valid);
      toast.success(data.message || 'Subjects saved successfully.');
      setPreview(null);
      setFile(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to save subjects.');
    } finally {
      setSavingValid(false);
    }
  };

  const handleManualSave = async (payload, record) => {
    setManualBusy(true);
    try {
      if (record) {
        const data = await updateSubject(record.id, payload);
        toast.success(data.message || 'Subject updated successfully.');
      } else {
        const data = await createSubject(payload);
        toast.success(data.message || 'Subject added successfully.');
      }
      setModalOpen(false);
      setEditRecord(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to save subject.');
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
      const data = await deleteSubject(deleteRecord.id);
      toast.success(data.message || 'Subject deleted successfully.');
      setDeleteOpen(false);
      setDeleteRecord(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to delete subject.');
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
            <h1>Add Subjects</h1>
            <p>Create subjects manually or upload a spreadsheet — then manage them all in one place.</p>
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
                <p>Create a single subject using a quick form. Subject codes are validated for uniqueness.</p>
              </div>
              <button
                type="button"
                className="class-btn class-btn-primary"
                onClick={() => setModalOpen(true)}
              >
                <FiPlus size={16} aria-hidden="true" />
                Add Subject
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
                    <div key={`${row.subject_code}-${index}`} className="class-preview-row">
                      <div className="class-preview-row-info">
                        <span className={`class-preview-status ${row.errors?.length ? 'class-preview-status-bad' : 'class-preview-status-ok'}`}>
                          {row.errors?.length ? <FiAlertTriangle size={14} aria-hidden="true" /> : <FiCheckCircle size={14} aria-hidden="true" />}
                        </span>
                        <div>
                          <strong>{row.subject_code}</strong>
                          <small> · {row.subject_name}</small>
                          {row.branch_classes?.length > 0 && (
                            <div className="subject-branch-list" style={{ marginTop: 6 }}>
                              {row.branch_classes.map((code) => (
                                <span className="subject-branch-chip" key={code}>
                                  {code}
                                </span>
                              ))}
                            </div>
                          )}
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
                    {savingValid ? 'Saving...' : `Save ${validCount} valid subject${validCount === 1 ? '' : 's'}`}
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
                <h2>Your Subjects</h2>
                <p>{total} subject{total === 1 ? '' : 's'} found</p>
              </div>
              <div className="addclass-list-controls">
                <SearchBar value={search} onChange={setSearch} placeholder="Search subjects..." />
                <SubjectSortSelect value={sort} onChange={setSort} />
              </div>
            </div>

            {loading ? (
              <div className="class-loading">Loading subjects...</div>
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
                <SubjectsTable
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
                  Delete All Subjects
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
                icon={LuBookOpen}
                title={search ? 'No matching subjects' : 'No subjects yet'}
                subtitle={
                  search
                    ? 'Try a different search term or clear the search.'
                    : 'Upload a spreadsheet or add a subject manually to get started.'
                }
                actionLabel={search ? undefined : 'Add your first subject'}
                onAction={search ? undefined : () => setModalOpen(true)}
              />
            )}
          </section>

          <ManualSubjectModal
            isOpen={modalOpen}
            onClose={() => {
              setModalOpen(false);
              setEditRecord(null);
            }}
            busy={manualBusy}
            record={editRecord}
            onSave={handleManualSave}
            classes={classes}
          />

          <DeleteSubjectModal
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
            entityLabel="subject"
            scope={bulkDeleteScope}
            onConfirm={handleBulkDeleteConfirm}
          />
        </motion.div>
      </div>
    </div>
  );
}
