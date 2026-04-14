const th = {
  padding: '10px 14px',
  textAlign: 'left',
  color: '#6b7280',
  fontWeight: 600,
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  borderBottom: '1px solid #252840',
  whiteSpace: 'nowrap',
};

const td = {
  padding: '10px 14px',
  borderBottom: '1px solid #1a1d2e',
  fontSize: 13,
};

export default function DataTable({ columns, rows, onSort, sortState }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th
                key={i}
                style={{
                  ...th,
                  cursor: col.sortable ? 'pointer' : 'default',
                  color: col.sortable && sortState?.col === col.key ? '#818cf8' : '#6b7280',
                  userSelect: 'none',
                }}
                onClick={() => col.sortable && onSort && onSort(col.key)}
              >
                {col.label}
                {col.sortable && (
                  <span style={{ marginLeft: 4, opacity: 0.5 }}>
                    {sortState?.col === col.key ? (sortState.asc ? '↑' : '↓') : '↕'}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              style={{ transition: 'background .1s' }}
              onMouseEnter={e => e.currentTarget.style.background = '#1a1d2e'}
              onMouseLeave={e => e.currentTarget.style.background = ''}
            >
              {columns.map((col, ci) => (
                <td key={ci} style={{ ...td, borderBottom: ri === rows.length - 1 ? 'none' : td.borderBottom }}>
                  {col.render ? col.render(row, ri) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
