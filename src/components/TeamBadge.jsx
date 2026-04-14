import { getTeamColor } from '../lib/parser';

export default function TeamBadge({ name }) {
  const color = getTeamColor(name);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '2px 10px', borderRadius: 20,
      background: `${color}18`,
      border: `1px solid ${color}44`,
      color, fontSize: 12, fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {name}
    </span>
  );
}
