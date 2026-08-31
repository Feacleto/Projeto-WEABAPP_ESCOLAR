import { useEffect, useMemo, useState } from 'react';
import { Notebook, School, User as UserIcon } from 'lucide-react';
import Header from '../../components/layout/Header';
import EmptyState from '../../components/common/EmptyState';
import Skeleton from '../../components/common/Skeleton';
import { useAuth } from '../../hooks/useAuth';
import TioAgendaFAB from '../../components/agenda/TioAgendaFAB';
import { AGENDA_TYPES, watchAdminAgenda } from '../../services/agendaService';
import { formatDateTime } from '../../compartilhado/formatters';

/**
 * A AGENDA — e a razão de parecerem duas.
 *
 * Só existe UMA: `agendaEntries`, com um serviço só. O que havia eram duas
 * PORTAS que não se encontravam — o botão "Avisar pais" morava na tela de
 * crianças e escrevia; esta tela lia e não escrevia. Quem chegava aqui
 * encontrava um vazio dizendo "use o botão na tela de crianças", ou seja: a
 * tela do assunto mandava a pessoa embora pra fazer o assunto.
 *
 * O botão agora mora nas duas. Não é duplicação de estado — `TioAgendaFAB` é
 * o mesmo componente, gravando na mesma coleção, e o histórico embaixo é a
 * lista dele. Mandar um aviso e ver o que foi mandado viraram um lugar só.
 *
 * Filtragem por escopo (todos / criança / escola) na barra superior.
 */
export default function TioAgenda() {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | child | school

  useEffect(() => {
    if (!user?.uid) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const unsub = watchAdminAgenda(
      user.uid,
      (list) => {
        setEntries(list);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [user?.uid]);

  const filtered = useMemo(() => {
    if (filter === 'all') return entries;
    return entries.filter((e) => e.scope === filter);
  }, [entries, filter]);

  return (
    <>
      <Header title="Avisos enviados" showBack backLabel="Início" backTo="/tio" />

      <div className="p-5 space-y-3">
        <div className="flex gap-2">
          {[
            { value: 'all', label: 'Todos' },
            { value: 'child', label: 'Crianças' },
            { value: 'school', label: 'Escolas' },
          ].map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`shrink-0 h-9 px-4 rounded-full text-sm font-semibold tap border ${
                filter === f.value
                  ? 'bg-text text-white border-text'
                  : 'bg-card text-textMuted border-border'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Notebook}
            title="Nenhum aviso ainda"
            description="Toque em “Avisar pais”, aqui embaixo, pra mandar o primeiro."
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((e) => (
              <EntryRow key={e.id} entry={e} />
            ))}
          </div>
        )}
      </div>

      {/* O MESMO botão da tela de crianças, e não uma cópia: escrever e ler a
        * agenda passam a caber num lugar só. */}
      <TioAgendaFAB />
    </>
  );
}

function EntryRow({ entry }) {
  const t = AGENDA_TYPES[entry.type] || AGENDA_TYPES.other;
  const date = entry.createdAt?.toDate?.();
  const dateLabel = date ? formatDateTime(date) : '';
  const ScopeIcon = entry.scope === 'school' ? School : UserIcon;
  const recipient =
    entry.scope === 'school' ? entry.schoolName : entry.childName;

  return (
    <div className="bg-card rounded-2xl shadow-sm overflow-hidden border border-neutro">
      <div
        className={`bg-gradient-to-r ${t.color} text-white px-4 py-2 flex items-center gap-2`}
      >
        <span className="text-base" aria-hidden>
          {t.emoji}
        </span>
        <span className="text-xs font-bold uppercase tracking-wide flex-1 truncate">
          {t.label}
        </span>
        <span className="text-[10px] text-white/80">{dateLabel}</span>
      </div>
      <div className="p-3 space-y-1.5">
        <p className="text-xs text-textMuted inline-flex items-center gap-1">
          <ScopeIcon size={11} />
          {recipient || '—'}
        </p>
        <p className="text-sm text-text leading-relaxed whitespace-pre-wrap">
          {entry.message || <em className="text-textMuted">(sem mensagem)</em>}
        </p>
      </div>
    </div>
  );
}
