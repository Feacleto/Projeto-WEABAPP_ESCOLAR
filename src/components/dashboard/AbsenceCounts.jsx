import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, UserX } from 'lucide-react';
import { ABSENCE_LABELS } from '../../services/absencesService';

/**
 * Bloco de "Faltas" da criança no Pai — semana + mês com expansão.
 *
 * "Semana" = últimos 7 dias incluindo hoje.
 * "Mês"    = mês corrente (01 do mês até hoje).
 *
 * Toca em "Ver detalhes" pra expandir a lista de datas/tipos.
 */
export default function AbsenceCounts({ history = [] }) {
  const [expanded, setExpanded] = useState(false);

  const { weekCount, monthCount, monthList } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 6); // 7 dias incluindo hoje

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const inWeek = [];
    const inMonth = [];
    for (const a of history) {
      const d = parseDate(a.dateKey);
      if (!d) continue;
      if (d >= weekStart && d <= today) inWeek.push(a);
      if (d >= monthStart && d <= today) inMonth.push(a);
    }
    return {
      weekCount: inWeek.length,
      monthCount: inMonth.length,
      monthList: inMonth,
    };
  }, [history]);

  return (
    <section className="space-y-2">
      <h2 className="text-[11px] font-semibold uppercase tracking-widest text-textMuted px-1">
        Faltas
      </h2>
      <div className="grid grid-cols-2 gap-2">
        <CountCard label="Esta semana" value={weekCount} />
        <CountCard label="Este mês" value={monthCount} />
      </div>

      {monthCount > 0 && (
        <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="tap w-full p-3 flex items-center justify-between text-xs font-semibold text-textMuted"
          >
            <span>
              {expanded ? 'Ocultar datas' : 'Ver datas das faltas'}
            </span>
            {expanded ? (
              <ChevronUp size={14} />
            ) : (
              <ChevronDown size={14} />
            )}
          </button>
          {expanded && (
            <div className="border-t border-gray-100 divide-y divide-gray-100">
              {monthList.map((a) => (
                <div key={a.id} className="p-3 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <UserX size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text">
                      {formatDateBR(a.dateKey)}
                    </p>
                    <p className="text-[11px] text-textMuted">
                      {ABSENCE_LABELS[a.type] || 'Ausência'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function CountCard({ label, value }) {
  return (
    <div className="bg-card rounded-2xl shadow-sm p-4 flex items-start justify-between gap-2">
      <div>
        <p className="text-xs text-textMuted">{label}</p>
        <p className="text-3xl font-bold text-text leading-none mt-1.5 tabular-nums">
          {value}
        </p>
      </div>
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
          value > 0
            ? 'bg-amber-100 text-amber-700'
            : 'bg-gray-100 text-textMuted'
        }`}
      >
        <UserX size={18} />
      </div>
    </div>
  );
}

function parseDate(dateKey) {
  if (!dateKey) return null;
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatDateBR(dateKey) {
  const d = parseDate(dateKey);
  if (!d) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
  }).format(d);
}
