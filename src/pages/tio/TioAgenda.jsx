import { useEffect, useMemo, useState } from 'react';
import { Notebook, School, User as UserIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../components/layout/Header';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import IconePorNome from '../../components/common/IconePorNome';
import Skeleton from '../../components/common/Skeleton';
import { useAuth } from '../../hooks/useAuth';
import TioAgendaFAB from '../../components/agenda/TioAgendaFAB';
import {
  AGENDA_TYPES,
  maisAvisosDoMotorista,
  watchAdminAgenda,
} from '../../services/agendaService';
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
 * O botão passou a morar aqui, e desde 03/10/2026 SÓ aqui: na "Minha turma"
 * o canto de baixo à direita é de "Cadastrar criança", a ação principal
 * daquela tela. Mandar um aviso e ver o que foi mandado são um lugar só, e é
 * para cá que o atalho de Meu transporte ("perua quebrou") traz.
 *
 * Filtragem por escopo (todos / criança / escola) na barra superior.
 *
 * ── ⚠️ OS 100 MAIS RECENTES, E "VER AVISOS MAIS ANTIGOS" NO FIM (03/10/2026)
 * A tela assinava a lista INTEIRA — mais de mil recados num ano de quem avisa
 * a turma todo dia, relidos a cada abertura. Agora os 100 mais novos vêm ao
 * vivo e o resto chega de 100 em 100, só quando ele pede. O botão é grande e
 * diz o que faz: quem procura um aviso de meses atrás precisa saber que ele
 * ainda existe.
 */
export default function TioAgenda() {
  const { user } = useAuth();
  const [vivo, setVivo] = useState({ lista: [], cursor: null, temMais: false });
  const [antigos, setAntigos] = useState({ lista: [], cursor: null, temMais: false });
  const [loading, setLoading] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [filter, setFilter] = useState('all'); // all | child | school

  useEffect(() => {
    if (!user?.uid) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setAntigos({ lista: [], cursor: null, temMais: false });
    const unsub = watchAdminAgenda(
      user.uid,
      (lista, pagina) => {
        setVivo({ lista, cursor: pagina?.cursor || null, temMais: !!pagina?.temMais });
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [user?.uid]);

  // As páginas antigas continuam depois da ÚLTIMA carregada; sem nenhuma,
  // depois da página ao vivo. Um aviso novo empurra a página ao vivo e pode
  // repetir um item na fronteira — por isso a junção é pelo id.
  const entries = useMemo(() => {
    const porId = new Map();
    [...vivo.lista, ...antigos.lista].forEach((e) => {
      if (!porId.has(e.id)) porId.set(e.id, e);
    });
    return [...porId.values()];
  }, [vivo.lista, antigos.lista]);
  const temMais = antigos.lista.length ? antigos.temMais : vivo.temMais;

  const verMais = async () => {
    const cursor = antigos.lista.length ? antigos.cursor : vivo.cursor;
    if (!user?.uid || !cursor) return;
    setCarregandoMais(true);
    try {
      const pagina = await maisAvisosDoMotorista(user.uid, cursor);
      setAntigos((antes) => ({
        lista: [...antes.lista, ...pagina.lista],
        cursor: pagina.cursor || antes.cursor,
        temMais: pagina.temMais,
      }));
    } catch (err) {
      console.error('[agenda] avisos antigos não vieram:', err);
      toast.error('Não deu pra carregar os avisos antigos. Tente de novo.');
    } finally {
      setCarregandoMais(false);
    }
  };

  const filtered = useMemo(() => {
    if (filter === 'all') return entries;
    return entries.filter((e) => e.scope === filter);
  }, [entries, filter]);

  return (
    <>
      <Header title="Avisos enviados" showBack backLabel="Início" backTo="/tio" />

      <div className="p-5 space-y-3">
        <div className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-1">
          {[
            { value: 'all', label: 'Todos' },
            { value: 'child', label: 'Crianças' },
            { value: 'school', label: 'Escolas' },
          ].map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`shrink-0 h-12 px-5 rounded-full text-base font-semibold tap border ${
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

        {/* Fora do ramo da lista: com o filtro em "Escolas", a página pode vir
          * sem nenhum aviso de escola e ainda haver mais para trás. */}
        {!loading && temMais && (
          <Button
            variant="secondary"
            size="lg"
            loading={carregandoMais}
            onClick={verMais}
          >
            Ver avisos mais antigos
          </Button>
        )}
      </div>

      {/* Escrever e ler a agenda cabem num lugar só — ver o topo do arquivo. */}
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
        <IconePorNome nome={t.icone} size={16} />
        <span className="flex-1 truncate text-sm font-bold text-white">
          {t.label}
        </span>
        <span className="text-sm text-white">{dateLabel}</span>
      </div>
      <div className="p-3 space-y-1.5">
        <p className="text-sm text-textMuted inline-flex items-center gap-1">
          <ScopeIcon size={16} />
          {recipient || '—'}
        </p>
        <p className="text-base text-text leading-relaxed whitespace-pre-wrap">
          {entry.message || <em className="text-textMuted">(sem mensagem)</em>}
        </p>
      </div>
    </div>
  );
}
