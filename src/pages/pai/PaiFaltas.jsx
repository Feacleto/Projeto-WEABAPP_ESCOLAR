import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { ABSENCE_TYPES } from '../../services/absencesService';
import {
  DIAS_DE_AVISO_DE_FALTA,
  dataDaChave,
  faltasDoMes,
} from '../../dominio/rota/faltas';
import {
  addMonths,
  formatMonthLabel,
  getCurrentMonthKey,
} from '../../compartilhado/formatters';

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
 * UM NOME POR COISA. A tela diz "falta" em todo lugar, e o tipo de cada
 * falta usa os MESMOS nomes dos botões do Início (`AvisoRapido`): "Não vai",
 * "Eu levo", "Eu busco". `ABSENCE_LABELS` do service é a frase do lado do
 * motorista ("Pai vai levar de manhã") — ela avisou tocando em "Eu levo", e
 * é isso que ela reconhece na lista.
 *
 * O BOTÃO DE AVISAR ABRE O MESMO `AbsenceSheet` do painel. Uma segunda tela
 * de declarar seria uma segunda régua pra envelhecer sozinha — e a que
 * envelhecesse seria justamente a que ninguém abriu pra revisar.
 */
export default function PaiFaltas() {
  const navigate = useNavigate();
  const { child, loading: carregandoCrianca } = useActiveChild();
  const { history, loading } = useChildAbsenceHistory(
    child?.id,
    child?.adminUid
  );

  const [mes, setMes] = useState(() => getCurrentMonthKey());
  const [avisando, setAvisando] = useState(false);

  const doMes = useMemo(() => faltasDoMes(history, mes), [history, mes]);

  // O mês corrente é o teto da navegação PRA FRENTE.
  //
  // Não é limitação técnica: mês à frente só teria avisos marcados, e essa
  // lista já vive no painel, onde ele consegue desmarcar. Deixar navegar pra
  // frente aqui criaria meses vazios sem fim, e a sensação de que a tela
  // quebrou quando não quebrou.
  const mesAtual = getCurrentMonthKey();
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
    // pb-4, e não pb-28: o layout já reserva o espaço das abas, e a barra de
    // avisar (sticky, no fim) precisa pousar logo abaixo do último cartão.
    <div className="min-h-screen pb-4">
      <Header title="Faltas" showBack backLabel="Início" backTo="/pai" />

      <div className="space-y-4 px-5 pt-4">
        {/* Navegação de mês, grudada no topo: rolar uma lista de vinte
          * faltas não pode custar a resposta de QUAL mês se está lendo. */}
        <div className="sticky top-14 z-10 -mx-5 flex items-center gap-2 border-b border-neutro bg-bg px-5 pb-3 pt-1">
          <button
            type="button"
            onClick={() => setMes((m) => addMonths(m, -1))}
            aria-label="Mês anterior"
            className="tap flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border text-textMuted"
          >
            <ChevronLeft size={22} />
          </button>

          <div className="min-w-0 flex-1 text-center">
            <p className="text-lg font-bold capitalize leading-tight text-text">
              {formatMonthLabel(mes)}
            </p>
            <p className="text-base text-textMuted">
              {doMes.length === 0
                ? 'nenhuma falta'
                : `${doMes.length} ${doMes.length === 1 ? 'falta' : 'faltas'}`}
            </p>
          </div>

          <button
            type="button"
            disabled={!podeAvancar}
            onClick={() => podeAvancar && setMes((m) => addMonths(m, 1))}
            aria-label="Próximo mês"
            className="tap flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border text-textMuted disabled:opacity-30"
          >
            <ChevronRight size={22} />
          </button>
        </div>

        {loading && <Skeleton className="h-40 rounded-2xl" />}

        {!loading && doMes.length === 0 && (
          <Card className="py-8 text-center">
            <CalendarDays size={30} className="mx-auto text-textMuted" />
            <p className="mt-2 text-base font-semibold text-text">
              Nenhuma falta em {formatMonthLabel(mes)}
            </p>
            <p className="mx-auto mt-1 max-w-[20rem] text-sm leading-relaxed text-textMuted">
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

        <p className="px-1 text-center text-sm leading-relaxed text-textMuted">
          Dá pra avisar até {DIAS_DE_AVISO_DE_FALTA} dias à frente. Mais que isso o plano costuma
          mudar, e um aviso que ninguém lembra de desmarcar faz o motorista
          não passar na porta.
        </p>

        {/* A RESPOSTA JUNTO DA PERGUNTA.
          *
          * Esta tela mostra "7 faltas em maio" — e a pergunta seguinte é
          * sempre "então pago menos?". A resposta já está assinada na
          * cláusula 7ª, mas ela mora no contrato, três telas adiante: criar a
          * dúvida aqui e guardar a resposta lá é o desenho que produz a
          * mensagem no WhatsApp do motorista.
          *
          * Não é letra miúda escondendo nada — é o contrário: o pai leu e
          * aceitou isso pra entrar, e relembrar no momento certo evita que
          * ele se sinta enganado por uma regra que ele já conhecia. */}
        {doMes.length > 0 && (
          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-base font-semibold text-text">
              Falta não muda a mensalidade
            </p>
            <p className="mt-1 text-sm leading-relaxed text-textMuted">
              O valor é pela <strong>vaga na perua</strong> — ela fica
              reservada para o seu filho todos os dias, inclusive nas férias,
              independente de quantos dias ele usou. É a cláusula 7ª do
              contrato que você aceitou.
            </p>
            <button
              type="button"
              onClick={() => navigate('/pai/contrato')}
              className="tap mt-1 -ml-2 inline-flex h-12 items-center gap-1 px-2 text-base font-bold text-primary"
            >
              Ver o contrato <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>

      {/* AVISAR MORA ONDE O POLEGAR DESCANSA.
        *
        * Ficava no FIM da lista — com o argumento de que quem abre esta tela
        * veio conferir o passado. Mas num mês de muitas faltas o botão saía
        * da tela, e quem conferia e lembrava "e a consulta de quinta?" tinha
        * que rolar até achar. Preso acima das abas, mesma forma e lugar da
        * `BarraDoInicio` do motorista. `sticky` no fim do conteúdo, não
        * `fixed`: rolando até o fim ela pousa no lugar dela e o último
        * cartão nunca fica escondido por baixo. */}
      <div
        className="sticky z-20 mx-3 mt-4 rounded-2xl bg-card p-2 shadow-float"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.75rem)' }}
      >
        <button
          type="button"
          onClick={() => setAvisando(true)}
          className="tap flex h-16 w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 text-lg font-bold text-white"
        >
          <CalendarPlus size={22} />
          Avisar uma falta
        </button>
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

// Os nomes dos botões do Início (`AvisoRapido`) — ver o cabeçalho.
const TIPO_DA_FALTA = {
  [ABSENCE_TYPES.FULL]: 'Não vai',
  [ABSENCE_TYPES.NO_PICKUP]: 'Eu levo',
  [ABSENCE_TYPES.NO_DROPOFF]: 'Eu busco',
  [ABSENCE_TYPES.ALREADY_PICKED]: 'Já peguei na escola',
};

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
      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primaryChip text-primary">
        <CalendarX2 size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold capitalize text-text">{quando}</p>
        <p className="mt-0.5 text-base text-textMuted">
          {TIPO_DA_FALTA[falta.type] || 'Não vai'}
        </p>
      </div>
    </div>
  );
}
