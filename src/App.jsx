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

function buildMatchSummary(games) {
  const gameWinners = games.map(g => {
    if (!g.teams || g.teams.length === 0) return null;
    const sorted = [...g.teams].sort((a, b) => b.time - a.time);
    if (sorted.length < 2 || sorted[0].time === sorted[1].time) return 'TIE';
    return sorted[0].team;
  });

  const wins = {};
  const totalTime = {};
  for (let i = 0; i < games.length; i++) {
    const w = gameWinners[i];
    if (w && w !== 'TIE') wins[w] = (wins[w] || 0) + 1;
    for (const t of games[i].teams) {
      totalTime[t.team] = (totalTime[t.team] || 0) + t.time;
    }
  }

  const allTeams = [...new Set([...Object.keys(wins), ...Object.keys(totalTime)])];
  const overallWinner = allTeams.length
    ? allTeams.sort((a, b) => {
        const wDiff = (wins[b] || 0) - (wins[a] || 0);
        if (wDiff !== 0) return wDiff;
        return (totalTime[b] || 0) - (totalTime[a] || 0);
      })[0]
    : null;

  const playerMap = {};
  for (const g of games) {
    for (const p of g.players) {
      if (!playerMap[p.player]) {
        playerMap[p.player] = { player: p.player, team: p.team, captures: 0, holdTime: 0, shots: 0 };
      }
      playerMap[p.player].captures += p.captures;
      playerMap[p.player].holdTime += p.holdTime;
      playerMap[p.player].shots += p.shots;
    }
  }
  const allPlayers = Object.values(playerMap);
  const topCapturer = allPlayers.length ? allPlayers.reduce((a, b) => b.captures > a.captures ? b : a) : null;
  const topHolder = allPlayers.length ? allPlayers.reduce((a, b) => b.holdTime > a.holdTime ? b : a) : null;

  return { gameWinners, wins, totalTime, overallWinner, topCapturer, topHolder, allTeams };
}

export default function App() {
  const [data, setData] = useState(null); // { games: [...] }
  const [errors, setErrors] = useState([]);
  const [activeTopTab, setActiveTopTab] = useState('summary');
  const [activeTab, setActiveTab] = useState('sessions');
  const [sortState, setSortState] = useState({ col: null, asc: false });
  const [pendingData, setPendingData] = useState(null);
  const [nameInputs, setNameInputs] = useState({});
  const [playerNames, setPlayerNames] = useState({});

  const handleFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      resetColors();
      const { games: rawGames, errors: errs } = parseFile(e.target.result);
      setErrors(errs);

      const validGames = rawGames.filter(g => g.rows.length > 0);
      if (!validGames.length) { setData(null); return; }

      const parsedGames = validGames.map(({ rows, gameOver }) => {
        const sessions = buildSessions(rows, gameOver ?? null);
        const startTs = sessions[0]?.start ?? rows[0].ts;
        const endTs = gameOver?.ts ?? rows[rows.length - 1].ts;
        const totalDuration = Math.max(endTs - startTs, 1);
        const players = buildPlayerStats(rows, sessions);
        const teams = buildTeamStats(sessions, totalDuration);
        return { rows, sessions, players, teams, startTs, totalDuration, gameOver };
      });

      // Collect unique players across all games
      const allPlayersMap = {};
      for (const g of parsedGames) {
        for (const p of g.players) {
          if (!allPlayersMap[p.player]) allPlayersMap[p.player] = p;
        }
      }
      const allPlayers = Object.values(allPlayersMap);

      const initInputs = {};
      allPlayers.forEach(p => { initInputs[String(p.player)] = ''; });
      setNameInputs(initInputs);
      setPendingData({ games: parsedGames, allPlayers });
      setData(null);
      setSortState({ col: null, asc: false });
      setActiveTopTab('summary');
      setActiveTab('sessions');
    };
    reader.readAsText(file, 'UTF-8');
  };

  const activeGame = data && typeof activeTopTab === 'number' ? (data.games[activeTopTab] ?? null) : null;

  const sortedSessions = useMemo(() => {
    if (!activeGame) return [];
    if (!sortState.col) return activeGame.sessions;
    return [...activeGame.sessions].sort((a, b) => {
      const va = sortState.col === 'duration' ? (a.duration ?? 0) : a.damage;
      const vb = sortState.col === 'duration' ? (b.duration ?? 0) : b.damage;
      return sortState.asc ? va - vb : vb - va;
    });
  }, [activeGame, sortState]);

  const playerLabel = (id) => {
    const name = playerNames[String(id)];
    return name ? `#${id} ${name}` : `#${id}`;
  };

  const handleSort = (col) => {
    setSortState(prev => ({ col, asc: prev.col === col ? !prev.asc : false }));
  };

  const confirmNames = () => {
    setPlayerNames({ ...nameInputs });
    setData({ games: pendingData.games });
    setPendingData(null);
  };

  const matchSummary = useMemo(() => {
    if (!data) return null;
    return buildMatchSummary(data.games);
  }, [data]);

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
    { key: 'time', label: 'Łączny czas', render: r => formatDuration(r.time) },
    {
      key: 'pct', label: '% kontroli', render: r => r.pct != null ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            height: 6, width: `${r.pct}px`, minWidth: 2, maxWidth: 80,
            background: getTeamColor(r.team), borderRadius: 3, display: 'inline-block',
          }} />
          {r.pct.toFixed(1)}%
        </span>
      ) : '—'
    },
  ];

  const INNER_TABS = [
    { key: 'sessions', label: 'Kontrola' },
    { key: 'players', label: 'Gracze' },
    { key: 'teams', label: 'Drużyny' },
  ];

  const tabBtn = (isActive, onClick, label) => (
    <button
      onClick={onClick}
      style={{
        padding: '10px 20px',
        borderRadius: '8px 8px 0 0',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 600,
        border: 'none',
        background: isActive ? '#1a1d2e' : 'transparent',
        color: isActive ? '#818cf8' : '#6b7280',
        borderBottom: isActive ? '2px solid #6366f1' : '2px solid transparent',
        transition: 'all .15s',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0a0c14', color: '#e2e4f0', fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid #252840', padding: '0 32px', background: '#0d0f1a' }}>
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
          background: '#0d1020', border: '1px solid #252840', borderRadius: 10,
          padding: '12px 18px', marginBottom: 20, fontSize: 12, color: '#6b7280',
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

        <DropZone onFile={handleFile} />

        {errors.length > 0 && (
          <div style={{
            background: '#1f0f0f', border: '1px solid #5a2020', borderRadius: 10,
            padding: '14px 18px', color: '#f87171', marginTop: 16, fontSize: 13,
          }}>
            <strong>Ostrzeżenia ({errors.length}):</strong>
            <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
              {errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}

        {data && (
          <div style={{ marginTop: 28 }}>
            {/* Top-level tabs */}
            <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid #252840', marginBottom: 28 }}>
              {tabBtn(activeTopTab === 'summary', () => setActiveTopTab('summary'), 'Podsumowanie meczu')}
              {data.games.map((_, i) =>
                tabBtn(
                  activeTopTab === i,
                  () => { setActiveTopTab(i); setSortState({ col: null, asc: false }); setActiveTab('sessions'); },
                  `Gra nr ${i + 1}`,
                )
              )}
            </div>

            {/* ── Summary tab ── */}
            {activeTopTab === 'summary' && matchSummary && (
              <div>
                <SectionTitle>Wynik meczu</SectionTitle>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 32 }}>
                  {data.games.map((g, i) => {
                    const winner = matchSummary.gameWinners[i];
                    const color = winner === 'RED' ? '#f43f5e' : winner === 'BLUE' ? '#06b6d4' : '#6b7280';
                    return (
                      <div key={i} style={{
                        background: '#12141f', border: '1px solid #252840',
                        borderTop: `3px solid ${color}`, borderRadius: 10, padding: '16px 22px', minWidth: 160,
                      }}>
                        <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                          Gra nr {i + 1}
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 700, color }}>
                          {winner === 'TIE' ? 'Remis' : winner ?? '—'}
                        </div>
                        {(() => {
                          const times = Object.fromEntries(g.teams.map(t => [t.team, t.time]));
                          return (
                            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                              {Object.entries(times).map(([team, sec]) => `${team} ${formatDuration(sec)}`).join(' / ')}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}

                  {matchSummary.overallWinner && (
                    <div style={{
                      background: '#12141f',
                      border: `2px solid ${matchSummary.overallWinner === 'RED' ? '#f43f5e' : '#06b6d4'}`,
                      borderRadius: 10, padding: '16px 22px', minWidth: 180,
                    }}>
                      <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                        Zwycięzca meczu
                      </div>
                      <div style={{
                        fontSize: 24, fontWeight: 700,
                        color: matchSummary.overallWinner === 'RED' ? '#f43f5e' : '#06b6d4',
                      }}>
                        {matchSummary.overallWinner}
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                        {matchSummary.wins[matchSummary.overallWinner] ?? 0}/{data.games.length} wygranych gier
                      </div>
                    </div>
                  )}
                </div>

                <SectionTitle>Łączny czas kontroli drużyn</SectionTitle>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 32 }}>
                  {Object.entries(matchSummary.totalTime).sort((a, b) => b[1] - a[1]).map(([team, sec]) => (
                    <div key={team} style={{
                      background: '#12141f', border: '1px solid #252840',
                      borderTop: `3px solid ${getTeamColor(team)}`,
                      borderRadius: 10, padding: '16px 22px', minWidth: 160,
                    }}>
                      <div style={{ marginBottom: 8 }}>
                        <TeamBadge name={team} />
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: getTeamColor(team) }}>
                        {formatDuration(sec)}
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                        {matchSummary.wins[team] ?? 0} wygrane gry
                      </div>
                    </div>
                  ))}
                </div>

                <SectionTitle>Wyróżnienia graczy (cały mecz)</SectionTitle>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                  {matchSummary.topCapturer && (
                    <div style={{
                      background: '#12141f', border: '1px solid #252840', borderRadius: 10,
                      padding: '16px 20px', borderTop: `3px solid ${getTeamColor(matchSummary.topCapturer.team)}`,
                    }}>
                      <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                        Najwięcej przejęć
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#e2e4f0' }}>{playerLabel(matchSummary.topCapturer.player)}</div>
                      <div style={{ fontSize: 13, color: getTeamColor(matchSummary.topCapturer.team), marginTop: 4 }}>
                        ⚑ {matchSummary.topCapturer.captures} przejęć łącznie
                      </div>
                    </div>
                  )}
                  {matchSummary.topHolder && (
                    <div style={{
                      background: '#12141f', border: '1px solid #252840', borderRadius: 10,
                      padding: '16px 20px', borderTop: `3px solid ${getTeamColor(matchSummary.topHolder.team)}`,
                    }}>
                      <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                        Najdłuższa kontrola wieży
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#e2e4f0' }}>{playerLabel(matchSummary.topHolder.player)}</div>
                      <div style={{ fontSize: 13, color: getTeamColor(matchSummary.topHolder.team), marginTop: 4 }}>
                        {formatDuration(matchSummary.topHolder.holdTime)} łącznie
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Per-game tab ── */}
            {typeof activeTopTab === 'number' && activeGame && (() => {
              const game = activeGame;
              const byTeam = {};
              for (const p of game.players) {
                if (!byTeam[p.team]) byTeam[p.team] = [];
                byTeam[p.team].push(p);
              }
              return (
                <>
                  {/* Stats grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                    gap: 12, marginBottom: 20,
                  }}>
                    {[
                      { label: 'Czas rozgrywki', value: formatDuration(game.totalDuration), accent: ACCENT_COLORS[0] },
                      ...game.teams.map(t => ({ label: t.team, value: formatDuration(t.time), accent: getTeamColor(t.team) })),
                    ].map(s => <StatCard key={s.label} {...s} />)}
                  </div>

                  {/* Per-team highlights */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
                    {Object.entries(byTeam).map(([team, players]) => {
                      const topHold = players.reduce((a, b) => b.holdTime > a.holdTime ? b : a);
                      const topCap = players.reduce((a, b) => b.captures > a.captures ? b : a);
                      const color = getTeamColor(team);
                      return [
                        <div key={`${team}-hold`} style={{ background: '#12141f', border: '1px solid #252840', borderRadius: 10, padding: '14px 18px', borderTop: `2px solid ${color}` }}>
                          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{team} — najdłużej trzymał</div>
                          <div style={{ fontSize: 20, fontWeight: 700, color: '#e2e4f0' }}>{playerLabel(topHold.player)}</div>
                          <div style={{ fontSize: 13, color, marginTop: 2 }}>{formatDuration(topHold.holdTime)}</div>
                        </div>,
                        <div key={`${team}-cap`} style={{ background: '#12141f', border: '1px solid #252840', borderRadius: 10, padding: '14px 18px', borderTop: `2px solid ${color}` }}>
                          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{team} — najwięcej przejęć</div>
                          <div style={{ fontSize: 20, fontWeight: 700, color: '#e2e4f0' }}>{playerLabel(topCap.player)}</div>
                          <div style={{ fontSize: 13, color, marginTop: 2 }}>{topCap.captures} przejęć</div>
                        </div>,
                      ];
                    })}
                  </div>

                  {/* Timeline */}
                  <Card style={{ marginBottom: 20 }}>
                    <SectionTitle>Oś czasu kontroli wieży</SectionTitle>
                    <Timeline
                      sessions={game.sessions}
                      totalDuration={game.totalDuration}
                      startTs={game.startTs}
                      teams={game.teams}
                    />
                  </Card>

                  {/* Tables */}
                  <Card>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #252840' }}>
                      {INNER_TABS.map(tab => (
                        <button
                          key={tab.key}
                          onClick={() => setActiveTab(tab.key)}
                          style={{
                            padding: '8px 18px', borderRadius: '8px 8px 0 0', cursor: 'pointer',
                            fontSize: 13, fontWeight: 500, border: 'none',
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
                      <DataTable columns={playerColumns} rows={game.players} />
                    )}
                    {activeTab === 'teams' && (
                      <DataTable columns={teamColumns} rows={game.teams} />
                    )}
                  </Card>
                </>
              );
            })()}
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
              {pendingData.allPlayers.map(p => (
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
                onClick={() => { setPlayerNames({}); setData({ games: pendingData.games }); setPendingData(null); }}
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
