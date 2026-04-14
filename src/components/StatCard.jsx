export default function StatCard({ label, value, accent }) {
  return (
    <div style={{
      background: '#12141f',
      border: '1px solid #252840',
      borderRadius: 10,
      padding: '16px 20px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {accent && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: accent,
        }} />
      )}
      <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#e2e4f0', lineHeight: 1 }}>
        {value}
      </div>
    </div>
  );
}
