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
  const tenths = Math.round(sec * 10) / 10;
  if (tenths < 60) return `${tenths.toFixed(1)}s`;
  const h = Math.floor(tenths / 3600);
  const m = Math.floor((tenths % 3600) / 60);
  const s = (tenths % 60).toFixed(1);
  if (h) return `${h}:${String(m).padStart(2, '0')}:${s.padStart(4, '0')}`;
  return `${m}:${s.padStart(4, '0')}`;
}

const RE_KV = /timestamp=(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?|\d{1,2}:\d{2}:\d{2}(?:\.\d+)?)(?:\s+\(\w+\))?\s+player=(\S+)\s+team=(\S+)\s+damage=(\S+)/;
const RE_GAME_OVER = /game_over=(\d{1,2}:\d{2}:\d{2}(?:\.\d+)?)(?:\s+\(\w+\))?\s+red_ms=(\d+)\s+blue_ms=(\d+)/i;

export function parseFile(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('//'));
  const rows = [];
  const errors = [];
  let gameOver = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const go = RE_GAME_OVER.exec(line);
    if (go) {
      gameOver = {
        ts: parseTimestamp(go[1]),
        redMs: parseInt(go[2], 10),
        blueMs: parseInt(go[3], 10),
      };
      continue;
    }

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
  return { rows, errors, gameOver };
}

export function buildSessions(rows, gameOver) {
  const sessions = [];
  let current = null;

  // if game_over provides authoritative total time, infer true game start
  // (server started counting before first logged shot)
  const gameOverTs = gameOver?.ts ?? null;
  const inferredStart = (gameOver != null)
    ? gameOver.ts - (gameOver.redMs + gameOver.blueMs) / 1000
    : null;

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
      // anchor first session to server-inferred start
      if (sessions.length === 0 && inferredStart != null) {
        current.start = inferredStart;
      }
      sessions.push(current);
    }
    current.shots.push(row);
    current.damage += row.damage;
    row.session = sessions.length - 1;
  }
  if (current) {
    if (gameOverTs != null) {
      current.end = gameOverTs;
      current.duration = gameOverTs - current.start;
    } else {
      current.end = null;
      current.duration = null;
    }
  }
  return sessions;
}

export function buildPlayerStats(rows, sessions) {
  const map = {};
  for (const row of rows) {
    if (!map[row.player]) map[row.player] = { player: row.player, team: row.team, shots: 0, captures: 0, holdTime: 0 };
    map[row.player].shots++;
  }
  for (const s of sessions) {
    if (map[s.capturedBy]) map[s.capturedBy].captures++;
    if (s.end == null) continue;

    // split session into per-player sub-segments based on who is shooting
    let subStart = s.start;
    let currentPlayer = s.shots[0]?.player;
    for (let i = 1; i < s.shots.length; i++) {
      const shot = s.shots[i];
      if (shot.player !== currentPlayer) {
        if (map[currentPlayer]) map[currentPlayer].holdTime += shot.ts - subStart;
        subStart = shot.ts;
        currentPlayer = shot.player;
      }
    }
    if (currentPlayer && map[currentPlayer]) map[currentPlayer].holdTime += s.end - subStart;
  }
  return Object.values(map).sort((a, b) => b.holdTime - a.holdTime);
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
