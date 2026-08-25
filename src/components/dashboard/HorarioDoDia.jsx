import { Bus, Home, CircleAlert, UserCheck } from 'lucide-react';
import { horariosCombinados, horaCurta } from '../../services/horariosService';
import { ABSENCE_TYPES } from '../../services/absencesService';

/**
 * "Hoje" — os dois horários que o responsável abre o app pra ver.
 *
 * POR QUE ELE É O BLOCO MAIS DESTACADO DA TELA
 * A pergunta que faz o pai abrir o app é "que horas eu preciso estar na
 * porta?". Antes a resposta mais próxima disso era uma estimativa de chegada
 * calculada por distância em linha reta dividida por 18 km/h — um número que o
 * app inventava. Agora é o horário que o MOTORISTA COMBINOU com ele.
 *
 * O QUE ELE SE RECUSA A MOSTRAR
 * Horário presumido. Enquanto o motorista não confirmar, a criança opera com
 * uma hora chutada pelo período antigo (pra ela não sumir da rota), e mostrar
 * esse chute aqui seria pior que não mostrar nada: o pai desceria com a
 * criança na hora errada e a culpa cairia no app — com razão.
 */
export default function HorarioDoDia({ child, absence }) {
  if (!child) return null;

  const { pega, entrega, presumido } = horariosCombinados(child);
  const tipo = absence?.type;

  const semIda = tipo === ABSENCE_TYPES.FULL || tipo === ABSENCE_TYPES.NO_PICKUP;
  const semVolta = tipo === ABSENCE_TYPES.FULL || tipo === ABSENCE_TYPES.NO_DROPOFF;

  return (
    <section
      className="bg-card rounded-3xl shadow-sm overflow-hidden"
      aria-label="Horários de hoje"
    >
      <div className="px-5 pt-4 pb-1 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-widest text-textMuted">
          Hoje
        </h2>
        {tipo === ABSENCE_TYPES.FULL && (
          <span className="text-[11px] font-semibold text-amber-700">
            você avisou que não vai
          </span>
        )}
      </div>

      {presumido ? (
        <div className="px-5 pb-5 pt-2 flex items-start gap-3">
          <CircleAlert size={20} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-textMuted leading-relaxed">
            O motorista ainda não confirmou os horários de{' '}
            {child.name?.split(' ')[0] || 'seu filho'}.{' '}
            <span className="text-text font-medium">
              Combine com ele a hora de pegar e de entregar
            </span>{' '}
            — assim que registrar, aparece aqui.
          </p>
        </div>
      ) : (
        <div className="px-5 pb-5 pt-1 divide-y divide-gray-100">
          <Linha
            icon={Bus}
            hora={pega}
            titulo="entra na perua"
            cancelado={semIda}
            motivo={
              tipo === ABSENCE_TYPES.NO_PICKUP
                ? 'você leva hoje'
                : 'não vai hoje'
            }
          />
          <Linha
            icon={Home}
            hora={entrega}
            titulo="chega em casa"
            cancelado={semVolta}
            motivo={
              tipo === ABSENCE_TYPES.NO_DROPOFF
                ? 'você busca hoje'
                : 'não vai hoje'
            }
          />
        </div>
      )}
    </section>
  );
}

function Linha({ icon: Icon, hora, titulo, cancelado, motivo }) {
  return (
    <div className="flex items-center gap-4 py-3">
      <div
        className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
          cancelado ? 'bg-gray-100 text-textMuted' : 'bg-primary/10 text-primary'
        }`}
      >
        {cancelado ? <UserCheck size={20} /> : <Icon size={20} />}
      </div>

      <div className="flex-1 min-w-0">
        {/* O número é o elemento maior da tela de propósito: é a única coisa
          * que o responsável precisa ler de longe, com a criança no colo. */}
        <p
          className={`font-bold leading-none tabular-nums ${
            cancelado
              ? 'text-2xl text-textMuted line-through'
              : 'text-4xl text-text'
          }`}
        >
          {horaCurta(hora)}
        </p>
        <p
          className={`mt-1 ${
            cancelado
              ? 'text-xs text-amber-700 font-semibold'
              : 'text-sm text-textMuted'
          }`}
        >
          {cancelado ? motivo : titulo}
        </p>
      </div>
    </div>
  );
}
