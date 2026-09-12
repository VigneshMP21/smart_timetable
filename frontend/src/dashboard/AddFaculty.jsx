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
import { LuUsers } from 'react-icons/lu';
import { fetchFaculties, uploadFacultiesExcel, saveFaculties, createFaculty, updateFaculty, deleteFaculty, deleteFacultiesBatch, deleteAllFaculties } from '../services/facultyService';
import { fetchSubjects } from '../services/subjectService';
import SearchBar from '../components/classes/SearchBar';
import EmptyState from '../components/classes/EmptyState';
import FacultySortSelect from '../components/faculty/FacultySortSelect';
import FacultyTable from '../components/faculty/FacultyTable';
import ExcelUploadCard from '../components/faculty/ExcelUploadCard';
import ManualFacultyModal from '../components/faculty/ManualFacultyModal';
import DeleteFacultyModal from '../components/faculty/DeleteFacultyModal';
import BulkDeleteModal from '../components/common/BulkDeleteModal';
import '../components/classes/classes.css';
import '../components/faculty/faculty.css';
import '../components/common/common.css';

const PER_PAGE = 8;

export default function AddFaculty() {
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
        const data = await deleteFacultiesBatch([...selectedIds]);
        toast.success(data.message || 'Selected faculty assignments deleted successfully.');
        pruneSelection(data.deleted_ids || []);
      } else {
        const data = await deleteAllFaculties();
        toast.success(data.message || 'All faculty assignments deleted successfully.');
        setSelectedIds(new Set());
      }
      setBulkDeleteOpen(false);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to delete faculty assignments.');
    } finally {
      setBulkDeleteBusy(false);
    }
  };

  const [subjects, setSubjects] = useState([]);

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
      const data = await fetchFaculties({ search: debouncedSearch, page, per_page: PER_PAGE, sort_by: sortBy, order });
      setRecords(data.records || []);
      setTotal(data.total || 0);
      setTotalPages(data.total_pages || 1);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to load faculty.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page, sort]);

  useEffect(() => {
    load();
  }, [load]);

  const loadAllPages = async (fetcher, perPage = 100) => {
    const all = [];
    let currentPage = 1;
    let data = await fetcher({ per_page: perPage, page: currentPage });
    all.push(...(data.records || []));
    const pages = data.total_pages || 1;
    for (let p = 2; p <= pages; p++) {
      data = await fetcher({ per_page: perPage, page: p });
      all.push(...(data.records || []));
    }
    return all;
  };

  const loadSubjects = useCallback(async () => {
    try {
      setSubjects(await loadAllPages(fetchSubjects));
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to load subjects.');
    }
  }, []);

  useEffect(() => {
    loadSubjects();
  }, [loadSubjects]);

  const handleValidate = async () => {
    if (!file) return;
    setUploadBusy(true);
    try {
      const data = await uploadFacultiesExcel(file);
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
      .map(({ faculty_name, subject_name, subject_id, branch_classes }) => ({
        faculty_name,
        subject_name,
        subject_id,
        branch_classes,
      }));
    if (!valid.length) return;
    setSavingValid(true);
    try {
      const data = await saveFaculties(valid);
      toast.success(data.message || 'Faculty assignments saved successfully.');
      setPreview(null);
      setFile(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to save faculty assignments.');
    } finally {
      setSavingValid(false);
    }
  };

  const handleManualSave = async (payload, record) => {
    setManualBusy(true);
    try {
      if (record) {
        const data = await updateFaculty(record.id, {
          faculty_name: payload.faculty_name,
          subject_id: payload.subject_id,
          branch_classes: payload.branch_classes,
        });
        toast.success(data.message || 'Faculty assignment updated successfully.');
      } else {
        const data = await createFaculty(payload);
        toast.success(data.message || 'Faculty assignment added successfully.');
      }
      setModalOpen(false);
      setEditRecord(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to save faculty assignment.');
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
      const data = await deleteFaculty(deleteRecord.id);
      toast.success(data.message || 'Faculty assignment deleted successfully.');
      setDeleteOpen(false);
      setDeleteRecord(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to delete faculty assignment.');
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
            <h1>Add Faculty</h1>
            <p>Assign faculty members to subjects manually or upload a spreadsheet — then manage them all in one place.</p>
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
                <p>Assign a single faculty member to a subject using a quick form.</p>
              </div>
              <button
                type="button"
                className="class-btn class-btn-primary"
                onClick={() => setModalOpen(true)}
              >
                <FiPlus size={16} aria-hidden="true" />
                Add Faculty
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
                    <div key={`${row.faculty_name}-${index}`} className="class-preview-row">
                      <div className="class-preview-row-info">
                        <span className={`class-preview-status ${row.errors?.length ? 'class-preview-status-bad' : 'class-preview-status-ok'}`}>
                          {row.errors?.length ? <FiAlertTriangle size={14} aria-hidden="true" /> : <FiCheckCircle size={14} aria-hidden="true" />}
                        </span>
                        <div>
                          <strong>{row.faculty_name || '(unnamed)'}</strong>
                          <small> · {row.subject_name || 'no subject'}</small>
                          {row.branch_classes?.length > 0 && (
                            <div className="faculty-branch-list" style={{ marginTop: 6 }}>
                              {row.branch_classes.map((code) => (
                                <span className="faculty-branch-chip" key={code}>
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
                    {savingValid ? 'Saving...' : `Save ${validCount} valid assignment${validCount === 1 ? '' : 's'}`}
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
                <h2>Faculty Assignments</h2>
                <p>{total} assignment{total === 1 ? '' : 's'} found</p>
              </div>
              <div className="addclass-list-controls">
                <SearchBar value={search} onChange={setSearch} placeholder="Search faculty, subject or branch..." />
                <FacultySortSelect value={sort} onChange={setSort} />
              </div>
            </div>

            {loading ? (
              <div className="class-loading">Loading faculty...</div>
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
                <FacultyTable
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
                  Delete All Faculty
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
                icon={LuUsers}
                title={search ? 'No matching faculty' : 'No faculty yet'}
                subtitle={
                  search
                    ? 'Try a different search term or clear the search.'
                    : 'Upload a spreadsheet or add a faculty assignment manually to get started.'
                }
                actionLabel={search ? undefined : 'Add your first faculty'}
                onAction={search ? undefined : () => setModalOpen(true)}
              />
            )}
          </section>

          <ManualFacultyModal
            isOpen={modalOpen}
            onClose={() => {
              setModalOpen(false);
              setEditRecord(null);
            }}
            busy={manualBusy}
            record={editRecord}
            onSave={handleManualSave}
            subjects={subjects}
          />

          <DeleteFacultyModal
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
            entityLabel="faculty assignment"
            scope={bulkDeleteScope}
            onConfirm={handleBulkDeleteConfirm}
          />
        </motion.div>
      </div>
    </div>
  );
}
