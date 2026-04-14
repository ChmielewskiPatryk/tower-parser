import { useState, useMemo } from 'react';
import DropZone from './components/DropZone';
import Timeline from './components/Timeline';
import StatCard from './components/StatCard';
import DataTable from './components/DataTable';
import TeamBadge from './components/TeamBadge';
import {
  parseFile, buildSessions, buildPlayerStats, buildTeamStats,
  formatDuration, resetColors, getTeamColor,
} from './lib/parser';

const ACCENT_COLORS = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6'];

function Card({ children, style }) {
  return (
    <div style={{
      background: '#12141f',
      border: '1px solid #252840',
      borderRadius: 12,
      padding: 24,
      ...style,
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 style={{
      fontSize: 11,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      color: '#6b7280',
      marginBottom: 16,
    }}>
      {children}
    </h2>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [errors, setErrors] = useState([]);
  const [activeTab, setActiveTab] = useState('sessions');
  const [sortState, setSortState] = useState({ col: null, asc: false });
  const [pendingData, setPendingData] = useState(null);
  const [nameInputs, setNameInputs] = useState({});
  const [playerNames, setPlayerNames] = useState({});

  const handleFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      resetColors();
      const { rows, errors: errs, gameOver } = parseFile(e.target.result);
      setErrors(errs);
      if (!rows.length) { setData(null); return; }

      const sessions = buildSessions(rows, gameOver ?? null);
      const startTs = sessions[0]?.start ?? rows[0].ts;
      const endTs = gameOver?.ts ?? rows[rows.length - 1].ts;
      const totalDuration = Math.max(endTs - startTs, 1);
      const players = buildPlayerStats(rows, sessions);
      const teams = buildTeamStats(sessions, totalDuration);

      const parsed = { rows, sessions, players, teams, startTs, totalDuration, gameOver };
      const initInputs = {};
      players.forEach(p => { initInputs[String(p.player)] = ''; });
      setNameInputs(initInputs);
      setPendingData(parsed);
      setData(null);
      setSortState({ col: null, asc: false });
      setActiveTab('sessions');
    };
    reader.readAsText(file, 'UTF-8');
  };

  const sortedSessions = useMemo(() => {
    if (!data) return [];
    if (!sortState.col) return data.sessions;
    return [...data.sessions].sort((a, b) => {
      const va = sortState.col === 'duration' ? (a.duration ?? 0) : a.damage;
      const vb = sortState.col === 'duration' ? (b.duration ?? 0) : b.damage;
      return sortState.asc ? va - vb : vb - va;
    });
  }, [data, sortState]);

  const sessionColumns = [
    { key: 'idx', label: '#', render: (_r, i) => i + 1 },
    { key: 'team', label: 'Drużyna', render: r => <TeamBadge name={r.team} /> },
    { key: 'capturedBy', label: 'Przejął', render: r => playerLabel(r.capturedBy) },
    { key: 'duration', label: 'Czas kontroli', sortable: true, render: r => r.duration != null ? formatDuration(r.duration) : '—' },
  ];

  const playerColumns = [
    { key: 'player', label: 'Gracz', render: r => <strong style={{ color: '#e2e4f0' }}>{playerLabel(r.player)}</strong> },
    { key: 'team', label: 'Drużyna', render: r => <TeamBadge name={r.team} /> },
    { key: 'shots', label: 'Strzałów' },
    { key: 'captures', label: 'Przejęć wieży', render: r => (
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {r.captures > 0 && <span style={{ color: '#f59e0b' }}>⚑</span>}
        {r.captures}
      </span>
    )},
    { key: 'holdTime', label: 'Czas kontroli', render: r => formatDuration(r.holdTime) },
  ];

  const teamColumns = [
    { key: 'team', label: 'Drużyna', render: r => <TeamBadge name={r.team} /> },
    { key: 'sessions', label: 'Sesji' },
    { key: 'time', label: 'Łączny czas', render: r => formatDuration(r.time) },
    {
      key: 'pct', label: '% kontroli', render: r => r.pct != null ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            height: 6, width: `${r.pct}px`, minWidth: 2, maxWidth: 80,
            background: getTeamColor(r.team), borderRadius: 3, display: 'inline-block'
          }} />
          {r.pct.toFixed(1)}%
        </span>
      ) : '—'
    },
    { key: 'damage', label: 'Łączny DMG', render: r => r.damage.toLocaleString() },
    { key: 'players', label: 'Gracze', render: r => r.players.map(playerLabel).join(', ') },
  ];

const TABS = [
    { key: 'sessions', label: 'Kontrola' },
    { key: 'players', label: 'Gracze' },
    { key: 'teams', label: 'Drużyny' },
  ];

  const confirmNames = () => {
    setPlayerNames({ ...nameInputs });
    setData(pendingData);
    setPendingData(null);
  };

  const playerLabel = (id) => {
    const name = playerNames[String(id)];
    return name ? `#${id} ${name}` : `#${id}`;
  };

  const handleSort = (col) => {
    setSortState(prev => ({ col, asc: prev.col === col ? !prev.asc : false }));
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0c14', color: '#e2e4f0', fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{
        borderBottom: '1px solid #252840',
        padding: '0 32px',
        background: '#0d0f1a',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 0', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, flexShrink: 0,
          }}>🗼</div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e2e4f0', margin: 0 }}>Tower Shot Parser</h1>
            <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>Analiza strzałów do wieży i sesji kontroli</p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 32px' }}>

        {/* Hint */}
        <div style={{
          background: '#0d1020',
          border: '1px solid #252840',
          borderRadius: 10,
          padding: '12px 18px',
          marginBottom: 20,
          fontSize: 12,
          color: '#6b7280',
          display: 'flex', gap: 8, alignItems: 'flex-start',
        }}>
          <span style={{ color: '#6366f1', fontSize: 14, flexShrink: 0 }}>ℹ</span>
          <span>
            Obsługiwane formaty:&nbsp;
            <code style={{ background: '#0a0c14', borderRadius: 4, padding: '1px 6px', color: '#7dd3fc', fontFamily: 'Consolas, monospace', fontSize: 11 }}>
              timestamp=00:01:43.0 (uptime) player=1 team=RED damage=1
            </code>
            &nbsp;lub stary CSV:&nbsp;
            <code style={{ background: '#0a0c14', borderRadius: 4, padding: '1px 6px', color: '#7dd3fc', fontFamily: 'Consolas, monospace', fontSize: 11 }}>
              00:01:23, Kowalski, Blue, 150
            </code>
          </span>
        </div>

        {/* Drop zone */}
        <DropZone onFile={handleFile} />

        {/* Errors */}
        {errors.length > 0 && (
          <div style={{
            background: '#1f0f0f',
            border: '1px solid #5a2020',
            borderRadius: 10,
            padding: '14px 18px',
            color: '#f87171',
            marginTop: 16,
            fontSize: 13,
          }}>
            <strong>Ostrzeżenia ({errors.length}):</strong>
            <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
              {errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}

        {/* Results */}
        {data && (
          <div style={{ marginTop: 28 }}>
            {/* Stats grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 12,
              marginBottom: 20,
            }}>
              {[
                { label: 'Czas rozgrywki', value: formatDuration(data.totalDuration), accent: ACCENT_COLORS[0] },
                ...(data.gameOver ? [
                  { label: 'RED (oficjalnie)', value: `${(data.gameOver.redMs / 1000).toFixed(2)}s`, accent: '#f43f5e' },
                  { label: 'BLUE (oficjalnie)', value: `${(data.gameOver.blueMs / 1000).toFixed(2)}s`, accent: '#06b6d4' },
                ] : []),
              ].map(s => <StatCard key={s.label} {...s} />)}
            </div>

            {/* Per-team highlights */}
            {(() => {
              const byTeam = {};
              for (const p of data.players) {
                if (!byTeam[p.team]) byTeam[p.team] = [];
                byTeam[p.team].push(p);
              }
              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
                  {Object.entries(byTeam).map(([team, players]) => {
                    const topHold = players.reduce((a, b) => b.holdTime > a.holdTime ? b : a);
                    const topCap  = players.reduce((a, b) => b.captures > a.captures ? b : a);
                    const color = getTeamColor(team);
                    return [
                      <div key={`${team}-hold`} style={{ background: '#12141f', border: '1px solid #252840', borderRadius: 10, padding: '14px 18px', borderTop: `2px solid ${color}` }}>
                        <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                          {team} — najdłużej trzymał
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: '#e2e4f0' }}>{playerLabel(topHold.player)}</div>
                        <div style={{ fontSize: 13, color: color, marginTop: 2 }}>{formatDuration(topHold.holdTime)}</div>
                      </div>,
                      <div key={`${team}-cap`} style={{ background: '#12141f', border: '1px solid #252840', borderRadius: 10, padding: '14px 18px', borderTop: `2px solid ${color}` }}>
                        <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                          {team} — najwięcej przejęć
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: '#e2e4f0' }}>{playerLabel(topCap.player)}</div>
                        <div style={{ fontSize: 13, color: color, marginTop: 2 }}>{topCap.captures} przejęć</div>
                      </div>,
                    ];
                  })}
                </div>
              );
            })()}

            {/* Timeline */}
            <Card style={{ marginBottom: 20 }}>
              <SectionTitle>Oś czasu kontroli wieży</SectionTitle>
              <Timeline
                sessions={data.sessions}
                totalDuration={data.totalDuration}
                startTs={data.startTs}
                teams={data.teams}
              />
            </Card>

            {/* Tables */}
            <Card>
              {/* Tabs */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #252840', paddingBottom: 0 }}>
                {TABS.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    style={{
                      padding: '8px 18px',
                      borderRadius: '8px 8px 0 0',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 500,
                      border: 'none',
                      background: activeTab === tab.key ? '#1a1d2e' : 'transparent',
                      color: activeTab === tab.key ? '#818cf8' : '#6b7280',
                      borderBottom: activeTab === tab.key ? '2px solid #6366f1' : '2px solid transparent',
                      transition: 'all .15s',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === 'sessions' && (
                <DataTable
                  columns={sessionColumns}
                  rows={sortedSessions.map((s, i) => ({ ...s, _idx: i }))}
                  onSort={handleSort}
                  sortState={sortState}
                />
              )}
              {activeTab === 'players' && (
                <DataTable columns={playerColumns} rows={data.players} />
              )}
              {activeTab === 'teams' && (
                <DataTable columns={teamColumns} rows={data.teams} />
              )}
            </Card>
          </div>
        )}
      </div>

      {/* Player name modal */}
      {pendingData && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            background: '#12141f', border: '1px solid #252840', borderRadius: 16,
            padding: 32, minWidth: 360, maxWidth: 480, width: '100%',
            boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          }}>
            <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: '#e2e4f0' }}>
              Przypisz imiona graczy
            </h2>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: '#6b7280' }}>
              Opcjonalnie — możesz pominąć i edytować później.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {pendingData.players.map(p => (
                <div key={p.player} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{
                    fontSize: 12, fontWeight: 600, color: getTeamColor(p.team),
                    background: '#0a0c14', border: `1px solid ${getTeamColor(p.team)}33`,
                    borderRadius: 6, padding: '4px 10px', minWidth: 80, textAlign: 'center',
                    flexShrink: 0,
                  }}>
                    {p.team} #{p.player}
                  </span>
                  <input
                    type="text"
                    placeholder={`Imię gracza #${p.player}`}
                    value={nameInputs[String(p.player)] ?? ''}
                    onChange={ev => setNameInputs(prev => ({ ...prev, [String(p.player)]: ev.target.value }))}
                    onKeyDown={ev => { if (ev.key === 'Enter') confirmNames(); }}
                    style={{
                      flex: 1, background: '#0a0c14', border: '1px solid #252840',
                      borderRadius: 8, padding: '8px 12px', color: '#e2e4f0',
                      fontSize: 14, outline: 'none',
                    }}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setPlayerNames({}); setData(pendingData); setPendingData(null); }}
                style={{
                  padding: '8px 20px', borderRadius: 8, border: '1px solid #252840',
                  background: 'transparent', color: '#6b7280', cursor: 'pointer', fontSize: 14,
                }}
              >
                Pomiń
              </button>
              <button
                onClick={confirmNames}
                style={{
                  padding: '8px 24px', borderRadius: 8, border: 'none',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                }}
              >
                Potwierdź
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
