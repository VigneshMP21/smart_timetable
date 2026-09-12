import './common.css';

/**
 * ExcelExample - small "expected format" table shown on the upload cards.
 * @param {Array<string>} headings - Column labels, e.g. ['Room No', 'Class Short Code', 'Section'].
 * @param {Array<Array<string>>} rows - Sample rows, e.g. [['A-101', 'CSE', 'A']].
 * @param {string} title - One-line description above the table.
 */
export default function ExcelExample({ headings = [], rows = [], title = 'Expected Excel format' }) {
  return (
    <div className="excel-example">
      <p className="excel-example-title">{title}</p>
      <div className="excel-example-wrap">
        <table className="excel-example-table">
          <thead>
            <tr>
              {headings.map((heading) => (
                <th key={heading}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
