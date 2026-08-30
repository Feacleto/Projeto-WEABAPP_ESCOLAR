/**
 * Stacked bar horizontal pra mostrar composição de um total.
 * Substitui pie chart — bem mais fácil de ler pra idoso.
 *
 * Props:
 *  - segments: [{ label, value, color, count? }]
 *     Cores: 'emerald' | 'blue' | 'amber' | 'red' | 'gray'
 */
import { SERIE_GRAFICO } from '../../config/paletaCategorica';
export default function StackedBar({ segments = [] }) {
  const total = segments.reduce((acc, s) => acc + (Number(s.value) || 0), 0);


  return (
    <div className="space-y-3">
      <div className="h-6 bg-neutro rounded-full overflow-hidden flex">
        {segments.map((s, i) => {
          const value = Number(s.value) || 0;
          if (value <= 0) return null;
          const pct = total > 0 ? (value / total) * 100 : 0;
          return (
            <div
              key={i}
              className={`h-full ${SERIE_GRAFICO[s.color] || SERIE_GRAFICO.gray} transition-all`}
              style={{ width: `${pct}%` }}
              title={`${s.label}: ${pct.toFixed(0)}%`}
            />
          );
        })}
      </div>

      {/* Legenda */}
      <div className="space-y-1">
        {segments.map((s, i) => {
          const value = Number(s.value) || 0;
          const pct = total > 0 ? (value / total) * 100 : 0;
          return (
            <div
              key={i}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span className="flex items-center gap-2">
                <span
                  className={`w-3 h-3 rounded ${SERIE_GRAFICO[s.color] || SERIE_GRAFICO.gray}`}
                />
                <span className="text-text font-medium">{s.label}</span>
              </span>
              <span className="text-textMuted tabular-nums">
                {s.count != null ? `${s.count} · ` : ''}
                {pct.toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
