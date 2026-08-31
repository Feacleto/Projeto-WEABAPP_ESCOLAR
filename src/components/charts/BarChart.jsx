import { formatCurrency } from '../../compartilhado/formatters';

/**
 * Gráfico de barras horizontais minimalista — sem libs externas.
 *
 * Props:
 *  - data: [{ label, value, sublabel? }]
 *  - color: 'emerald' | 'blue' | 'amber' | 'red' (default emerald)
 *  - showValues: bool (default true) — formata como BRL
 *
 * Pensado pra idosos: barras GROSSAS, labels claros, ordem fácil de seguir.
 */
import { SERIE_GRAFICO } from '../../config/paletaCategorica';
export default function BarChart({
  data = [],
  color = 'emerald',
  showValues = true,
}) {
  const max = Math.max(...data.map((d) => Number(d.value) || 0), 1);

  const fillClass = SERIE_GRAFICO[color] || SERIE_GRAFICO.emerald;

  return (
    <div className="space-y-2">
      {data.map((row, i) => {
        const value = Number(row.value) || 0;
        const widthPct = max > 0 ? (value / max) * 100 : 0;
        return (
          <div key={i} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="font-semibold text-text capitalize">
                {row.label}
              </span>
              {showValues && (
                <span className="text-textMuted tabular-nums">
                  {formatCurrency(value)}
                </span>
              )}
            </div>
            <div className="h-3 bg-neutro rounded-full overflow-hidden">
              <div
                className={`h-full ${fillClass} rounded-full transition-all`}
                style={{ width: `${Math.max(widthPct, value > 0 ? 3 : 0)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
