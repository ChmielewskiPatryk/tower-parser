import { useEffect, useRef } from 'react';
import { getTeamColor, formatDuration } from '../lib/parser';

export default function Timeline({ sessions, totalDuration, startTs, teams }) {
  const canvasRef = useRef();
  const wrapRef = useRef();

  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (!canvas || !wrap) return;
      const W = Math.max(wrap.clientWidth - 2, 600);
      canvas.width = W;
      canvas.height = 80;
      const ctx = canvas.getContext('2d');
      const BAR_Y = 24, BAR_H = 36;

      ctx.clearRect(0, 0, W, 80);
      ctx.fillStyle = '#0a0c14';
      ctx.fillRect(0, BAR_Y, W, BAR_H);

      if (!totalDuration) return;

      const toX = t => ((t - startTs) / totalDuration) * W;

      for (const s of sessions) {
        if (s.end == null) continue;
        const x = toX(s.start);
        const w = Math.max(toX(s.end) - x, 1);
        ctx.fillStyle = getTeamColor(s.team);
        ctx.fillRect(x, BAR_Y, w, BAR_H);
      }

      // Subtle grid lines
      ctx.fillStyle = '#252840';
      const ticks = 10;
      for (let i = 0; i <= ticks; i++) {
        const x = (i / ticks) * W;
        ctx.fillRect(x, BAR_Y, 1, BAR_H);
      }

      // Tick labels
      ctx.fillStyle = '#6b7280';
      ctx.font = '10px Consolas, monospace';
      ctx.textAlign = 'center';
      for (let i = 0; i <= ticks; i++) {
        const elapsed = (totalDuration * i) / ticks;
        const x = (elapsed / totalDuration) * W;
        ctx.fillText(formatDuration(elapsed), x, 72);
      }
    };

    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [sessions, totalDuration, startTs]);

  return (
    <div>
      <div ref={wrapRef} style={{ overflowX: 'auto', paddingBottom: 6 }}>
        <canvas ref={canvasRef} height={80} style={{ display: 'block', borderRadius: 6, minWidth: 600 }} />
      </div>
      {teams.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 14 }}>
          {teams.map(t => (
            <span key={t.team} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <span style={{
                width: 10, height: 10, borderRadius: '50%',
                background: getTeamColor(t.team), display: 'inline-block', flexShrink: 0
              }} />
              <span style={{ color: '#e2e4f0' }}>{t.team}</span>
              {t.pct != null && (
                <span style={{ color: '#6b7280', fontSize: 11 }}>{t.pct.toFixed(1)}%</span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
