import { useState, useMemo } from 'react';
import { FiSearch, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import './TablePreview.css';

/**
 * Reusable data table with search, sort, and pagination.
 * @param {Array} columns - [{ key, label, sortable }]
 * @param {Array} data - Row data
 * @param {number} rowsPerPage - Rows per page
 * @param {string} title - Optional table title
 */
export default function TablePreview({ columns = [], data = [], rowsPerPage = 10, title }) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let result = [...data];
    if (search) {
      const lower = search.toLowerCase();
      result = result.filter((row) =>
        columns.some((col) => String(row[col.key] || '').toLowerCase().includes(lower))
      );
    }
    if (sortKey) {
      result.sort((a, b) => {
        const aVal = a[sortKey] || '';
        const bVal = b[sortKey] || '';
        const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return result;
  }, [data, search, sortKey, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const paginated = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  return (
    <div className="table-preview">
      {title && <h3 className="table-preview-title">{title}</h3>}
      <div className="table-preview-toolbar">
        <div className="table-search">
          <FiSearch className="table-search-icon" size={16} />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="table-search-input"
            aria-label="Search table"
          />
        </div>
        <span className="table-count">{filtered.length} records</span>
      </div>
      <div className="table-wrapper">
        <table className="data-table" role="grid">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`data-th ${col.sortable ? 'sortable' : ''}`}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  aria-sort={sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span className="sort-arrow">{sortDir === 'asc' ? ' \u2191' : ' \u2193'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="data-empty">No data found</td>
              </tr>
            ) : (
              paginated.map((row, i) => (
                <tr key={i}>
                  {columns.map((col) => (
                    <td key={col.key} className="data-td">{row[col.key] ?? '--'}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="table-pagination">
          <button
            className="pagination-btn"
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            aria-label="Previous page"
          >
            <FiChevronLeft size={16} />
          </button>
          <span className="pagination-info">
            Page {page} of {totalPages}
          </span>
          <button
            className="pagination-btn"
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            aria-label="Next page"
          >
            <FiChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
