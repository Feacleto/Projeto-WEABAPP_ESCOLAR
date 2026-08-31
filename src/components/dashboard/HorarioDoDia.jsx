import { Bus, Home, CircleAlert, UserCheck } from 'lucide-react';
import { horariosCombinados, horaCurta } from '../../dominio/rota/horarios';
import { ABSENCE_TYPES } from '../../services/absencesService';
import { primeiroNome } from '../../compartilhado/formatters';

/**
 * "Hoje" — os dois horários que o responsável abre o app pra ver.
 *
 * POR QUE ELE É O BLOCO MAIS DESTACADO DA TELA
 * A pergunta que faz o pai abrir o app é "que horas eu preciso estar na
 * porta?". Antes a resposta mais próxima disso era uma estimativa de chegada
 * calculada por distância em linha reta dividida por 18 km/h — um número que o
 * app inventava. Agora é o horário que o MOTORISTA COMBINOU com ele.
 *
 * QUEM DEFINE É O MOTORISTA, E O PAI É INFORMADO.
 * Não há negociação a fazer nesta tela, e ela não sugere que haja: o horário
 * sai da rota inteira — distância, ordem das outras crianças, trânsito — e o
 * responsável não tem nenhuma dessas informações pra propor outra coisa. O
 * que ele precisa é saber a hora de estar na porta.
 *
 * O QUE ELE SE RECUSA A MOSTRAR
 * Horário presumido. Enquanto o motorista não define o dele, a criança opera
 * com uma hora chutada pelo período antigo (pra ela não sumir da rota), e
 * mostrar esse chute aqui seria pior que não mostrar nada: o pai desceria com
 * a criança na hora errada e a culpa cairia no app — com razão.
 */
export default function HorarioDoDia({
  child,
  absence,
  ride = null,
  // SEM CASCA: quando o bloco vive DENTRO do cartão de hoje, quem desenha a
  // superfície é o cartão. Duas bordas arredondadas coladas leem como dois
  // cartões empilhados, e o ponto do cartão único é justamente parecer um.
  semCasca = false,
}) {
  if (!child) return null;

  const { pega, entrega, presumido } = horariosCombinados(child);
  const tipo = absence?.type;

  const semIda = tipo === ABSENCE_TYPES.FULL || tipo === ABSENCE_TYPES.NO_PICKUP;
  // ALREADY_PICKED entra aqui junto: sem ele o `cancelado` ficava falso e o
  // rótulo "você já pegou" nunca apareceria — o pai que acabou de buscar a
  // criança continuaria lendo "chega em casa às 12h35".
  const semVolta =
    tipo === ABSENCE_TYPES.FULL
    || tipo === ABSENCE_TYPES.NO_DROPOFF
    || tipo === ABSENCE_TYPES.ALREADY_PICKED;

  return (
    // A âncora fica NO COMPONENTE, e não na tela que o monta.
    //
    // `PaiDashboard` renderiza este painel em dois estados diferentes
    // (esperando e acompanhando). Marcar os dois pontos de montagem daria
    // duas âncoras iguais na árvore e o tutorial iluminaria a primeira que
    // encontrasse — que nem sempre é a que está na tela.
    <section
      data-tour="horario-dia"
      className={
        semCasca ? 'overflow-hidden' : 'bg-card rounded-3xl shadow-sm overflow-hidden'
      }
      aria-label="Horários de hoje"
    >
      <div className="px-5 pt-4 pb-1 flex items-baseline justify-between gap-2">
        {/* O título "Hoje" some dentro do cartão: a tarja do topo já diz o
          * momento, e repetir a palavra a 20px de distância é ruído. */}
        {!semCasca && (
          <h2 className="text-sm font-bold uppercase tracking-widest text-textMuted">
            Hoje
          </h2>
        )}
        {tipo === ABSENCE_TYPES.FULL && (
          <span className="text-[11px] font-semibold text-warningText">
            você avisou que não vai
          </span>
        )}
      </div>

      {presumido ? (
        <div className="px-5 pb-5 pt-2 flex items-start gap-3">
          <CircleAlert size={20} className="text-warningText shrink-0 mt-0.5" />
          <p className="text-sm text-textMuted leading-relaxed">
            O motorista ainda não informou os horários de{' '}
            {child.name?.split(' ')[0] || 'seu filho'}.{' '}
            <span className="text-text font-medium">
              Assim que ele definir, a hora aparece aqui
            </span>{' '}
            — é ele quem monta a rota e sabe a ordem das crianças.
          </p>
        </div>
      ) : (
        <div className="px-5 pb-5 pt-1 divide-y divide-neutro">
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
                : tipo === ABSENCE_TYPES.ALREADY_PICKED
                ? 'você já pegou'
                : 'não vai hoje'
            }
          />
        </div>
      )}

      {/* A POSIÇÃO NA FILA.
        * O motorista publica isto ao iniciar a rota, porque o responsável não
        * tem como calcular: a fila é feita das outras crianças, que ele não lê.
        * É o ordinal do dia, não "quantas faltam" — um número estável vale
        * mais que um contador que às vezes mente. */}
      {!presumido && (ride?.ordemIda || ride?.ordemVolta) && (
        <div className="px-5 pb-4 -mt-1">
          <p className="text-xs text-textMuted bg-sunken rounded-xl px-3 py-2 leading-relaxed">
            {/* A HORA, NÃO O PERÍODO DO DIA.
              * Dizia "De manhã" e "Na volta" — herança dos seis turnos, que
              * morreram. O ordinal é por VIAGEM, então a mãe do Theo, pego às
              * 12h20, lia "De manhã, Theo é a 1ª parada de 2" — e a mãe da Ana,
              * pega às 6h20, lia "1ª parada" também, com outro total. Dois pais
              * lendo o mesmo número sobre viagens diferentes.
              * A hora combinada já está no doc; é ela que identifica a viagem. */}
            {ride.ordemIda ? (
              <>
                {ride.combinado?.ida ? `Na ida das ${horaCurta(ride.combinado.ida)}` : 'Na ida'},{' '}
                {primeiroNome(child.name, 'seu filho')} é a{' '}
                <b className="text-text">{ride.ordemIda}ª parada</b> de{' '}
                {ride.totalIda}.
              </>
            ) : null}
            {ride.ordemIda && ride.ordemVolta ? ' ' : null}
            {ride.ordemVolta ? (
              <>
                {ride.combinado?.volta
                  ? `Na volta das ${horaCurta(ride.combinado.volta)}`
                  : 'Na volta'}
                , a <b className="text-text">{ride.ordemVolta}ª</b> de{' '}
                {ride.totalVolta}.
              </>
            ) : null}
          </p>
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
          cancelado ? 'bg-neutro text-textMuted' : 'bg-primary/10 text-primary'
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
              ? 'text-xs text-warningText font-semibold'
              : 'text-sm text-textMuted'
          }`}
        >
          {cancelado ? motivo : titulo}
        </p>
      </div>
    </div>
  );
}
