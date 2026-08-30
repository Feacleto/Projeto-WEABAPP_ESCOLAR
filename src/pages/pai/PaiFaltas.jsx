import { useMemo, useState } from 'react';
import {
  CalendarDays,
  CalendarPlus,
  CalendarX2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import Header from '../../components/layout/Header';
import Card from '../../components/common/Card';
import Skeleton from '../../components/common/Skeleton';
import AbsenceSheet from '../../components/absences/AbsenceSheet';
import { useActiveChild } from '../../hooks/useActiveChild';
import { useChildAbsenceHistory } from '../../hooks/useAbsences';
import { ABSENCE_LABELS } from '../../services/absencesService';
import {
  chaveDoMes,
  dataDaChave,
  faltasDoMes,
  rotuloDoMes,
  somaMeses,
} from '../../utils/faltas';

/**
 * AS FALTAS DO FILHO — mês a mês, pra trás.
 *
 * POR QUE UMA TELA, E NÃO SÓ O BLOCO DO PAINEL
 * O painel já mostra semana e mês corrente. O que ele não responde é a
 * pergunta que aparece na conversa com a escola e na conferência da
 * mensalidade: "quantas vezes ele faltou em maio?". Sem lugar pra olhar pra
 * trás, o responsável recorre à memória — e memória de falta é sempre menor
 * que a real.
 *
 * NÃO DÁ PRA MARCAR MÊS FUTURO, e isso é a regra do projeto, não um limite
 * desta tela. `AbsenceSheet` tem teto de 14 dias, com o motivo escrito lá:
 * avisar com muita antecedência abre o buraco em que o plano muda, ninguém
 * desmarca, e no dia o motorista não passa na porta. O histórico anda meses
 * pra trás; o aviso continua cabendo em duas semanas.
 *
 * O BOTÃO DE AVISAR ABRE O MESMO `AbsenceSheet` do painel. Uma segunda tela
 * de declarar seria uma segunda régua pra envelhecer sozinha — e a que
 * envelhecesse seria justamente a que ninguém abriu pra revisar.
 */
export default function PaiFaltas() {
  const { child, loading: carregandoCrianca } = useActiveChild();
  const { history, loading } = useChildAbsenceHistory(child?.id);

  const [mes, setMes] = useState(() => chaveDoMes());
  const [avisando, setAvisando] = useState(false);

  const doMes = useMemo(() => faltasDoMes(history, mes), [history, mes]);

  // O mês corrente é o teto da navegação PRA FRENTE.
  //
  // Não é limitação técnica: mês à frente só teria avisos marcados, e essa
  // lista já vive no painel, onde ele consegue desmarcar. Deixar navegar pra
  // frente aqui criaria meses vazios sem fim, e a sensação de que a tela
  // quebrou quando não quebrou.
  const mesAtual = chaveDoMes();
  const podeAvancar = mes < mesAtual;

  if (carregandoCrianca || !child) {
    return (
      <div className="min-h-screen pb-28">
        <Header title="Faltas" showBack backLabel="Início" backTo="/pai" />
        <div className="px-5 pt-4">
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28">
      <Header title="Faltas" showBack backLabel="Início" backTo="/pai" />

      <div className="space-y-4 px-5 pt-4">
        {/* Navegação de mês, grudada no topo: rolar uma lista de vinte
          * faltas não pode custar a resposta de QUAL mês se está lendo. */}
        <div className="sticky top-14 z-10 -mx-5 flex items-center gap-2 border-b border-gray-100 bg-bg px-5 pb-3 pt-1">
          <button
            type="button"
            onClick={() => setMes((m) => somaMeses(m, -1))}
            aria-label="Mês anterior"
            className="tap flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-textMuted"
          >
            <ChevronLeft size={17} />
          </button>

          <div className="min-w-0 flex-1 text-center">
            <p className="text-sm font-bold capitalize leading-tight text-text">
              {rotuloDoMes(mes)}
            </p>
            <p className="text-[11px] text-textMuted">
              {doMes.length === 0
                ? 'nenhuma falta'
                : `${doMes.length} ${doMes.length === 1 ? 'falta' : 'faltas'}`}
            </p>
          </div>

          <button
            type="button"
            disabled={!podeAvancar}
            onClick={() => podeAvancar && setMes((m) => somaMeses(m, 1))}
            aria-label="Próximo mês"
            className="tap flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-textMuted disabled:opacity-30"
          >
            <ChevronRight size={17} />
          </button>
        </div>

        {loading && <Skeleton className="h-40 rounded-2xl" />}

        {!loading && doMes.length === 0 && (
          <Card className="py-8 text-center">
            <CalendarDays size={30} className="mx-auto text-textMuted" />
            <p className="mt-2 text-sm font-semibold text-text">
              Nenhuma falta em {rotuloDoMes(mes)}
            </p>
            <p className="mx-auto mt-1 max-w-[20rem] text-xs leading-relaxed text-textMuted">
              Só aparece aqui o que foi avisado pelo app. Falta combinada por
              fora com o motorista não entra nesta conta.
            </p>
          </Card>
        )}

        {!loading && doMes.length > 0 && (
          <div className="space-y-2">
            {doMes.map((a) => (
              <Linha key={a.dateKey} falta={a} />
            ))}
          </div>
        )}

        {/* AVISAR fica no fim, e não no topo: quem abriu esta tela veio
          * conferir o passado. Quem veio avisar tem o botão no painel, que é
          * de onde ele já usa todo dia. */}
        <button
          type="button"
          onClick={() => setAvisando(true)}
          className="tap flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-gray-200 bg-card text-sm font-bold text-text"
        >
          <CalendarPlus size={17} className="text-primary" />
          Avisar uma falta
        </button>

        <p className="px-1 text-center text-[11px] leading-relaxed text-textMuted">
          Dá pra avisar até 14 dias à frente. Mais que isso o plano costuma
          mudar, e um aviso que ninguém lembra de desmarcar faz o motorista
          não passar na porta.
        </p>
      </div>

      <AbsenceSheet
        open={avisando}
        onClose={() => setAvisando(false)}
        child={child}
        declaredBy="parent"
        status={child.status}
      />
    </div>
  );
}

/**
 * Uma falta na lista.
 *
 * A DATA VEM COM O DIA DA SEMANA. "12/05" não diz nada sozinho; "segunda,
 * 12 de maio" é o que permite cruzar com a lembrança ("foi no dia da
 * consulta"). É a mesma informação, lida pela porta que a memória usa.
 */
function Linha({ falta }) {
  const d = dataDaChave(falta.dateKey);
  const quando = d
    ? new Intl.DateTimeFormat('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
      }).format(d)
    : falta.dateKey;

  return (
    <div className="flex items-start gap-3 rounded-2xl bg-card px-4 py-3 shadow-sm">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <CalendarX2 size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold capitalize text-text">{quando}</p>
        <p className="mt-0.5 text-xs text-textMuted">
          {ABSENCE_LABELS[falta.type] || 'Não vai'}
        </p>
      </div>
    </div>
  );
}
