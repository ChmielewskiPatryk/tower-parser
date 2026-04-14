import { useState, useMemo } from 'react';
import DropZone from './components/DropZone';
import Timeline from './components/Timeline';
import StatCard from './components/StatCard';
import DataTable from './components/DataTable';
import TeamBadge from './components/TeamBadge';
import {
  parseFile, buildSessions, buildPlayerStats, buildTeamStats,
  formatAbsTime, formatDuration, resetColors, getTeamColor,
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

  const handleFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      resetColors();
      const { rows, errors: errs } = parseFile(e.target.result);
      setErrors(errs);
      if (!rows.length) { setData(null); return; }

      const sessions = buildSessions(rows);
      const startTs = rows[0].ts;
      const endTs = rows[rows.length - 1].ts;
      const totalDuration = Math.max(endTs - startTs, 1);
      const players = buildPlayerStats(rows, sessions);
      const teams = buildTeamStats(sessions, totalDuration);

      setData({ rows, sessions, players, teams, startTs, totalDuration });
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
    { key: 'capturedBy', label: 'Przejął' },
    { key: 'start', label: 'Start', render: r => formatAbsTime(r.start) },
    { key: 'end', label: 'Koniec', render: r => r.end != null ? formatAbsTime(r.end) : <em style={{ color: '#6b7280' }}>koniec pliku</em> },
    { key: 'duration', label: 'Czas utrzymania', sortable: true, render: r => r.duration != null ? formatDuration(r.duration) : '—' },
    { key: 'damage', label: 'DMG', sortable: true, render: r => r.damage.toLocaleString() },
    { key: 'shots', label: 'Strzałów', render: r => r.shots.length },
  ];

  const playerColumns = [
    { key: 'player', label: 'Gracz', render: r => <strong style={{ color: '#e2e4f0' }}>{r.player}</strong> },
    { key: 'team', label: 'Drużyna', render: r => <TeamBadge name={r.team} /> },
    { key: 'shots', label: 'Strzałów' },
    { key: 'damage', label: 'Łączny DMG', render: r => r.damage.toLocaleString() },
    { key: 'captures', label: 'Przejęć wieży', render: r => (
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {r.captures > 0 && <span style={{ color: '#f59e0b' }}>⚑</span>}
        {r.captures}
      </span>
    )},
    { key: 'avg', label: 'Avg DMG/strzał', render: r => r.shots ? Math.round(r.damage / r.shots) : 0 },
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
    { key: 'players', label: 'Gracze', render: r => r.players.join(', ') },
  ];

  const rawColumns = [
    { key: 'lineNo', label: '#' },
    { key: 'ts', label: 'Czas', render: r => formatAbsTime(r.ts) },
    { key: 'player', label: 'Gracz' },
    { key: 'team', label: 'Drużyna', render: r => <TeamBadge name={r.team} /> },
    { key: 'damage', label: 'DMG' },
    { key: 'session', label: 'Sesja', render: r => r.session != null ? (
      <span style={{ fontSize: 11, color: '#6b7280' }}>#{r.session + 1}</span>
    ) : '' },
  ];

  const TABS = [
    { key: 'sessions', label: 'Sesje' },
    { key: 'players', label: 'Gracze' },
    { key: 'teams', label: 'Drużyny' },
    { key: 'raw', label: 'Surowe dane' },
  ];

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
              timestamp=2026-04-04 16:21:19 player=1 team=RED damage=1
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
                { label: 'Wierszy', value: data.rows.length, accent: ACCENT_COLORS[0] },
                { label: 'Sesji', value: data.sessions.length, accent: ACCENT_COLORS[1] },
                { label: 'Graczy', value: new Set(data.rows.map(r => r.player)).size, accent: ACCENT_COLORS[2] },
                { label: 'Drużyn', value: new Set(data.rows.map(r => r.team)).size, accent: ACCENT_COLORS[3] },
                { label: 'Łączny DMG', value: data.rows.reduce((a, r) => a + r.damage, 0).toLocaleString(), accent: ACCENT_COLORS[4] },
                { label: 'Czas rozgrywki', value: formatDuration(data.totalDuration), accent: ACCENT_COLORS[0] },
              ].map(s => <StatCard key={s.label} {...s} />)}
            </div>

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
              {activeTab === 'raw' && (
                <DataTable columns={rawColumns} rows={data.rows} />
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
