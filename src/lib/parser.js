const PALETTE = [
  '#6366f1','#f43f5e','#10b981','#f59e0b','#8b5cf6',
  '#06b6d4','#f97316','#84cc16','#ec4899','#14b8a6',
];

const colorMap = {};
let colorIdx = 0;

export function getTeamColor(name) {
  if (!colorMap[name]) colorMap[name] = PALETTE[colorIdx++ % PALETTE.length];
  return colorMap[name];
}

export function resetColors() {
  Object.keys(colorMap).forEach(k => delete colorMap[k]);
  colorIdx = 0;
}

export function parseTimestamp(raw) {
  raw = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(raw)) {
    const ms = Date.parse(raw.replace(' ', 'T'));
    return isNaN(ms) ? null : ms / 1000;
  }
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const n = parseFloat(raw);
    return n > 1e9 ? n / 1000 : n;
  }
  const parts = raw.split(':').map(Number);
  if (!parts.some(isNaN)) {
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
  }
  return null;
}

export function formatAbsTime(sec) {
  if (sec == null || isNaN(sec)) return '—';
  const d = new Date(sec * 1000);
  if (d.getFullYear() >= 2000) {
    return d.toLocaleTimeString('pl-PL', { hour12: false });
  }
  return formatDuration(sec);
}

export function formatDuration(sec) {
  if (sec == null || isNaN(sec)) return '—';
  sec = Math.round(sec);
  if (sec < 60) return `${sec}s`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const RE_KV = /timestamp=(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s+player=(\S+)\s+team=(\S+)\s+damage=(\S+)/;

export function parseFile(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('//'));
  const rows = [];
  const errors = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let ts, player, team, dmg;

    const kv = RE_KV.exec(line);
    if (kv) {
      ts = parseTimestamp(kv[1]);
      player = kv[2];
      team = kv[3];
      dmg = parseFloat(kv[4]);
    } else {
      const parts = line.split(',');
      if (parts.length < 4) { errors.push(`Linia ${i + 1}: nieznany format — "${line}"`); continue; }
      ts = parseTimestamp(parts[0]);
      player = parts[1].trim();
      team = parts[2].trim();
      dmg = parseFloat(parts[3]);
    }

    if (ts === null) { errors.push(`Linia ${i + 1}: nieprawidłowy timestamp`); continue; }
    if (!player) { errors.push(`Linia ${i + 1}: brak nazwy gracza`); continue; }
    if (!team) { errors.push(`Linia ${i + 1}: brak nazwy drużyny`); continue; }

    rows.push({ ts, player, team, damage: isNaN(dmg) ? 0 : dmg, raw: line, lineNo: i + 1 });
  }

  rows.sort((a, b) => a.ts - b.ts);
  return { rows, errors };
}

export function buildSessions(rows) {
  const sessions = [];
  let current = null;

  for (const row of rows) {
    if (!current || current.team !== row.team) {
      if (current) {
        current.end = row.ts;
        current.duration = current.end - current.start;
      }
      current = {
        team: row.team,
        capturedBy: row.player,
        start: row.ts,
        end: null,
        duration: null,
        shots: [],
        damage: 0,
      };
      sessions.push(current);
    }
    current.shots.push(row);
    current.damage += row.damage;
    row.session = sessions.length - 1;
  }
  if (current) {
    current.end = null;
    current.duration = null;
  }
  return sessions;
}

export function buildPlayerStats(rows, sessions) {
  const map = {};
  for (const row of rows) {
    if (!map[row.player]) map[row.player] = { player: row.player, team: row.team, shots: 0, damage: 0, captures: 0 };
    map[row.player].shots++;
    map[row.player].damage += row.damage;
  }
  for (const s of sessions) {
    if (map[s.capturedBy]) map[s.capturedBy].captures++;
  }
  return Object.values(map).sort((a, b) => b.damage - a.damage);
}

export function buildTeamStats(sessions, totalDuration) {
  const map = {};
  for (const s of sessions) {
    if (!map[s.team]) map[s.team] = { team: s.team, sessions: 0, time: 0, damage: 0, players: new Set() };
    map[s.team].sessions++;
    if (s.duration != null) map[s.team].time += s.duration;
    map[s.team].damage += s.damage;
    for (const sh of s.shots) map[s.team].players.add(sh.player);
  }
  return Object.values(map)
    .map(t => ({ ...t, players: [...t.players], pct: totalDuration ? (t.time / totalDuration * 100) : null }))
    .sort((a, b) => b.time - a.time);
}
