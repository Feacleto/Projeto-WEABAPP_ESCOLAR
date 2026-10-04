import { useVoltarFechaFolha } from '../../hooks/useVoltarFechaFolha';
import { useState } from 'react';
import { X, UserX, Sunrise, Sunset, Trash2, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  ABSENCE_TYPES,
  declareAbsence,
  removeAbsence,
  notifyAbsence,
} from '../../services/absencesService';
import { getDateKey } from '../../dominio/rota/horarios';
import {
  DIAS_DE_AVISO_DE_FALTA,
  limiteDoAviso,
} from '../../dominio/rota/faltas.js';
import { useArrastarPraFechar } from '../../hooks/useArrastarPraFechar';
import { useAbsenceForChild } from '../../hooks/useAbsences';

/**
 * Folha de avisar FALTA. Na tela da família a palavra é "falta" em todo
 * lugar — "ausência" sobrevive só no nome do arquivo e da coleção.
 *
 * Props:
 *  - open: bool
 *  - onClose: () => void
 *  - child: { id, name, parentUid }
 *  - declaredBy: 'parent' | 'admin'
 *  (destinatário da notificação é determinado internamente pelo notifyAbsence)
 *  - currentAbsence: a falta de HOJE que o painel já assina. Só vale enquanto
 *    a data escolhida for hoje — ver `faltaDoDia` abaixo.
 *  - dateKey: opcional, default = hoje
 */
export default function AbsenceSheet({
  open,
  onClose,
  child,
  declaredBy,
  currentAbsence,
  dateKey,
  // Status efetivo da criança agora. Só serve pra decidir se a opção
  // "já peguei" aparece — ela não faz sentido antes de a criança chegar
  // na escola, e uma opção impossível na lista é ruído no momento em que
  // o responsável está com pressa.
  status,
}) {
  // O voltar do celular fecha esta folha, em vez de sair da tela (03/10/2026).
  useVoltarFechaFolha(open, onClose);
  const { alcaProps, estilo } = useArrastarPraFechar(onClose);
  const [submitting, setSubmitting] = useState(false);
  const [closing, setClosing] = useState(false);

  /**
   * A DATA É ESCOLHÍVEL AQUI.
   *
   * A folha sempre aceitou qualquer `dateKey` — só que ninguém nunca passou
   * outro além de hoje. Quem descobre com uma semana de antecedência que a
   * criança tem consulta na quinta não tinha o que fazer além de LEMBRAR de
   * avisar na quinta de manhã, que é o minuto em que ele está mais ocupado.
   *
   * Os atalhos de hoje e amanhã ficam na home; aqui mora o resto do calendário.
   *
   * Declarado ANTES do `if (!open)`: hook depois de return condicional muda a
   * ordem dos hooks entre renders, e o React quebra.
   */
  const dataInicial = dateKey || getDateKey();
  const [dataEscolhida, setDataEscolhida] = useState(dataInicial);

  /**
   * ⚠️ O ESTADO DA FOLHA É O DA DATA ESCOLHIDA, NÃO O DE HOJE.
   *
   * O painel passa `currentAbsence` — a falta de HOJE. Com a data trocável,
   * ela escolhia quinta e a folha continuava mostrando "avisado" e o botão
   * de desfazer com o estado de hoje, enquanto `handleRemove` apagava pela
   * data ESCOLHIDA: o botão prometia desfazer uma coisa e apagava outra (ou
   * nada). Agora a folha escuta a falta do dia escolhido — um documento só,
   * id `{dia}_{criança}`, sem consulta e portanto sem escopo de `adminUid`
   * para esquecer — e `currentAbsence` só cobre o instante em que essa
   * escuta ainda não respondeu E o dia é hoje.
   *
   * Fechada, a folha não escuta nada: `null` desliga a assinatura.
   */
  const { absence: faltaEscutada, loading: carregandoFalta } = useAbsenceForChild(
    open ? dataEscolhida : null,
    child?.id
  );
  const ehHoje = dataEscolhida === getDateKey();
  const faltaDoDia = carregandoFalta
    ? (ehHoje ? currentAbsence || null : null)
    : faltaEscutada;

  if (!open) {
    // Garante que próxima abertura comece sem animação de fechamento.
    // Acontece dentro do render porque o componente só monta quando open=true.
    if (closing) setClosing(false);
    // E a próxima abertura começa no dia que o chamador pediu: o componente
    // continua montado enquanto fechado, e sem isto quem escolheu quinta,
    // fechou e reabriu para avisar HOJE encontrava a folha ainda em quinta.
    if (dataEscolhida !== dataInicial) setDataEscolhida(dataInicial);
    return null;
  }

  const targetDate = dataEscolhida;
  const firstName = child?.name?.split(' ')[0] || 'Aluno';
  // "hoje", "amanhã", "na quinta, dia 16" — entra no meio das frases;
  // `oDia` é a forma sem artigo, para "para …" e "aviso de …".
  const noDia = diaNaFrase(dataEscolhida);
  const oDia = diaCurto(dataEscolhida);

  async function handleSelect(type) {
    if (!child?.id) return;
    setSubmitting(true);
    try {
      await declareAbsence({
        dateKey: targetDate,
        childId: child.id,
        childName: child.name || '',
        parentUid: child.parentUid || null,
        adminUid: child.adminUid || null,
        type,
        declaredBy,
      });
      // Notifica o outro lado — fire-and-forget. A função encontra o
      // destinatário internamente (admin via appState/init ou parent via child).
      notifyAbsence({
        // `adminUid` viaja junto: é ele que diz a QUAL motorista o aviso
        // pertence. Sem ele a notificação caía no ponteiro global da
        // plataforma e a rule negava a escrita (ver notifyAbsence).
        child: {
          name: child.name,
          parentUid: child.parentUid,
          adminUid: child.adminUid,
        },
        type,
        dateKey: targetDate,
        declaredBy,
      });
      // A confirmação diz o DIA: é o que ela precisa conferir depois de
      // tocar, sobretudo quando a data não é hoje.
      toast.success(`Falta avisada para ${oDia}: ${resumoDoTipo(type, firstName)}.`);
      handleClose();
    } catch (err) {
      console.error('Erro ao avisar a falta:', err);
      toast.error('Não foi possível registrar. Tente novamente.');
      setSubmitting(false);
    }
  }

  async function handleRemove() {
    if (!child?.id) return;
    setSubmitting(true);
    try {
      await removeAbsence({ dateKey: targetDate, childId: child.id });
      toast.success(`Aviso de ${oDia} desfeito.`);
      handleClose();
    } catch (err) {
      console.error('Erro ao desfazer a falta:', err);
      toast.error('Não foi possível remover.');
      setSubmitting(false);
    }
  }

  function handleClose() {
    setClosing(true);
    setTimeout(() => {
      setSubmitting(false);
      onClose?.();
    }, 200);
  }

  const overlay = closing
    ? 'opacity-0'
    : 'opacity-100';
  const sheet = closing
    ? 'translate-y-full'
    : 'translate-y-0';

  return (
    <div
      className={`fixed inset-0 z-50 max-w-mobile mx-auto bg-black/40 backdrop-blur-sm transition-opacity duration-estado ${overlay}`}
      onClick={handleClose}
    >
      <div
        className={`absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl shadow-2xl transition-transform duration-estado ${sheet}`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)', ...estilo }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div
          {...alcaProps}
          className={`pt-3 pb-1 flex justify-center ${alcaProps.className}`}
        >
          <span className="block w-10 h-1.5 rounded-full bg-borderStrong" />
        </div>

        <div className="px-5 pt-2 pb-5 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-text leading-tight">
                {firstName} vai faltar?
              </h2>
              <p className="text-sm text-textMuted mt-1">
                Escolha o dia e o que se aplica
              </p>
            </div>
            <button
              onClick={handleClose}
              className="tap w-12 h-12 shrink-0 rounded-full bg-neutro flex items-center justify-center text-textMuted"
              aria-label="Fechar"
            >
              <X size={20} />
            </button>
          </div>

          {/* PARA QUAL DIA.
            * Fica no topo porque muda o significado de tudo que vem depois:
            * escolher "não vai" sem saber pra qual dia é o tipo de erro que a
            * pessoa só descobre quando a perua não passa. */}
          <label className="block">
            <span className="rotulo block mb-1.5">
              Para qual dia
            </span>
            {/* O TETO DE 14 DIAS É DELIBERADO.
              * Avisar com muita antecedência abre um buraco: o plano muda, o
              * responsável não lembra de desmarcar, e no dia o motorista não
              * passa na porta. Duas semanas cobrem consulta, viagem e feriado
              * — que é o que as pessoas realmente marcam por dia — sem virar
              * promessa que ninguém lembra de ter feito.
              *
              * O teto sozinho NÃO resolve (dá pra esquecer um aviso de três
              * dias igual). Ele anda junto com o `AvisosFuturos`, que traz o
              * aviso de volta pra tela, e com a pergunta da véspera. */}
            <input
              type="date"
              value={dataEscolhida}
              min={getDateKey()}
              max={getDateKey(limiteDoAviso())}
              onChange={(e) => setDataEscolhida(e.target.value || getDateKey())}
              className="w-full h-12 rounded-2xl border-2 border-border bg-card px-3 text-base text-text focus:outline-none focus:border-primary"
            />
            {/* O dia por extenso é a CONFERÊNCIA do que foi escolhido — é
              * texto de leitura (16px). O teto é detalhe (14px). */}
            <span className="block text-base font-semibold capitalize text-text mt-2">
              {rotuloDoDia(dataEscolhida)}
            </span>
            <span className="block text-sm text-textMuted">
              Dá pra avisar até {DIAS_DE_AVISO_DE_FALTA} dias à frente
            </span>
          </label>

          {/* Opções */}
          <div className="space-y-2">
            <OptionCard
              icon={UserX}
              title="Não vai"
              subtitle={`O motorista não busca nem traz ${noDia}`}
              gradient="from-dangerSoft to-dangerChip"
              iconBg="bg-danger"
              active={faltaDoDia?.type === ABSENCE_TYPES.FULL}
              disabled={submitting}
              onClick={() => handleSelect(ABSENCE_TYPES.FULL)}
            />
            <OptionCard
              icon={Sunrise}
              title="Eu levo"
              subtitle={`Você leva de manhã ${noDia}; o motorista só traz de volta`}
              gradient="from-warningSoft to-warningChip"
              iconBg="bg-warning"
              active={faltaDoDia?.type === ABSENCE_TYPES.NO_PICKUP}
              disabled={submitting}
              onClick={() => handleSelect(ABSENCE_TYPES.NO_PICKUP)}
            />
            <OptionCard
              icon={Sunset}
              title="Eu busco"
              subtitle={`Você busca à tarde ${noDia}; o motorista só leva`}
              gradient="from-escolaSoft to-escolaChip"
              iconBg="bg-escola"
              active={faltaDoDia?.type === ABSENCE_TYPES.NO_DROPOFF}
              disabled={submitting}
              onClick={() => handleSelect(ABSENCE_TYPES.NO_DROPOFF)}
            />

            {/* O FATO CONSUMADO, e não o plano.
              * Só aparece com a criança já na escola: é a situação de quem
              * resolveu buscar no meio do dia e está ali com ela na mão. Sem
              * esta frase o responsável escolhia "vou buscar à tarde" — que é
              * outra coisa — ou avisava por WhatsApp, fora do app, onde a rota
              * não enxerga e o motorista passa na escola à toa.
              *
              * `status` é o de AGORA, então a opção só vale para hoje: "já
              * peguei" na quinta que vem não existe. Noutro dia ela só aparece
              * se já estiver marcada, para poder ser vista e desfeita. */}
            {((ehHoje && (status === 'atSchool' || status === 'onboard'))
              || faltaDoDia?.type === ABSENCE_TYPES.ALREADY_PICKED) && (
              <OptionCard
                icon={UserCheck}
                title="Já peguei na escola"
                subtitle={`O motorista não precisa passar lá ${noDia}`}
                gradient="from-primarySoft to-primaryChip"
                iconBg="bg-primary"
                active={faltaDoDia?.type === ABSENCE_TYPES.ALREADY_PICKED}
                disabled={submitting}
                onClick={() => handleSelect(ABSENCE_TYPES.ALREADY_PICKED)}
              />
            )}
          </div>

          {/* Desfazer o aviso DESTE dia — o rótulo diz o dia, porque é ele
            * que `handleRemove` apaga. */}
          {faltaDoDia && (
            <button
              onClick={handleRemove}
              disabled={submitting}
              className="tap w-full min-h-12 rounded-xl py-3 px-4 bg-neutro text-base text-text font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Trash2 size={18} />
              Desfazer o aviso de {oDia}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function OptionCard({
  icon: Icon,
  title,
  subtitle,
  gradient,
  iconBg,
  active,
  disabled,
  onClick,
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`tap w-full text-left rounded-2xl p-4 flex items-center gap-3 bg-gradient-to-br ${gradient} ${
        active ? 'ring-2 ring-text/30' : ''
      } disabled:opacity-50`}
    >
      <div
        className={`w-11 h-11 rounded-xl text-white flex items-center justify-center shrink-0 shadow-sm ${iconBg}`}
      >
        <Icon size={22} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-base font-semibold text-text leading-tight">{title}</p>
        <p className="text-sm text-textMuted mt-0.5">{subtitle}</p>
      </div>
      {active && (
        <span className="rotulo shrink-0 text-text bg-white/70 px-2 py-0.5 rounded-full">
          Avisado
        </span>
      )}
    </button>
  );
}

/**
 * "hoje", "amanhã", "quinta, 28 de agosto".
 *
 * Data crua (2026-08-28) obriga a pessoa a converter de cabeça pra saber se
 * escolheu o dia certo — e é justamente aí que ela erra.
 */
function rotuloDoDia(chave) {
  const [y, m, d] = String(chave || '').split('-').map(Number);
  if (!y || !m || !d) return '';
  const data = new Date(y, m - 1, d);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dias = Math.round((data - hoje) / 86400000);
  if (dias === 0) return 'Hoje';
  if (dias === 1) return 'Amanhã';
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(data);
}

/**
 * O dia DENTRO da frase: "hoje", "amanhã", "na quinta, dia 16".
 *
 * As legendas das opções diziam "hoje" fixo — com a quinta escolhida no
 * campo, "o motorista não busca nem traz hoje" era a frase errada no minuto
 * exato em que ela confere o que vai fazer. O número do dia vai junto porque
 * o teto é de 14 dias: "na quinta" sozinho pode ser duas quintas.
 */
const DIAS_DA_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

// "hoje", "amanhã", "quinta, dia 16" — para "para …" e "aviso de …".
function diaCurto(chave) {
  const [y, m, d] = String(chave || '').split('-').map(Number);
  if (!y || !m || !d) return 'hoje';
  const data = new Date(y, m - 1, d);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dias = Math.round((data - hoje) / 86400000);
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'amanhã';
  return `${DIAS_DA_SEMANA[data.getDay()]}, dia ${d}`;
}

// O mesmo dia com o artigo da frase corrida: "na quinta", "no sábado".
function diaNaFrase(chave) {
  const curto = diaCurto(chave);
  if (curto === 'hoje' || curto === 'amanhã') return curto;
  const fimDeSemana = curto.startsWith('sábado') || curto.startsWith('domingo');
  return `${fimDeSemana ? 'no' : 'na'} ${curto}`;
}

/** O que muda, em poucas palavras — fecha a frase da confirmação. */
function resumoDoTipo(tipo, nome) {
  if (tipo === ABSENCE_TYPES.NO_PICKUP) return 'você leva de manhã';
  if (tipo === ABSENCE_TYPES.NO_DROPOFF) return 'você busca à tarde';
  if (tipo === ABSENCE_TYPES.ALREADY_PICKED) return 'você já pegou na escola';
  return `${nome} não vai`;
}
