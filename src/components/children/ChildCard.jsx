import {
  GraduationCap,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  MapPinOff,
  UserX,
} from 'lucide-react';
import Avatar from '../common/Avatar';
import Button from '../common/Button';
import StatusBadge from './StatusBadge';
import { PERIOD_LABELS, formatAge } from '../../compartilhado/formatters';
import { getEffectiveStatus } from '../../services/childrenService';
import { ABSENCE_LABELS } from '../../services/absencesService';

/**
 * Card de criança na lista "Minha turma".
 *
 * A REGRA DA LISTA: título curto, tudo que o tio precisa pra AGIR, e o resto
 * na ficha.
 *
 * O título é nome + idade + escola, porque é isso que ele usa pra saber com
 * quem está falando na porta e pra distinguir dois irmãos.
 *
 * A AUSÊNCIA DO DIA aparece em destaque no título. Antes ela só existia na
 * tela de rota, então o tio olhava a lista e não sabia quem ia faltar hoje —
 * a informação mais perecível de todas ficava no lugar mais escondido.
 *
 * UM TOQUE, UMA INTENÇÃO (03/10/2026)
 * O cartão tinha TRÊS alvos para DUAS intenções: a foto abria a ficha, o
 * resto da linha abria um detalhe ali mesmo, e um "Ver mais" abria o MESMO
 * detalhe — que terminava num "Ver ficha completa". Quem tocava no lugar
 * errado não sabia por que a tela fez outra coisa. O motivo do detalhe
 * embutido era não perder a lista ao abrir a ficha, e isso deixou de valer:
 * a ficha agora abre POR CIMA da lista (`ChildDetailSheet`), com filtro,
 * busca e rolagem intactos atrás. Então a linha inteira abre a ficha, e
 * endereço, responsáveis e telefone moram lá.
 *
 * O NOME NÃO PODE COMER A IDADE
 * Nome e idade viviam no mesmo `truncate`. Num celular estreito o nome longo
 * consumia a linha inteira e a idade sumia junto com as reticências — some
 * justamente o dado que distingue dois irmãos. Agora são duas caixas: o nome
 * encolhe e corta, a idade é `shrink-0` e sobrevive a qualquer largura.
 *
 * Props:
 *   - child
 *   - absence:  declaração de hoje (ou null) — { type, ... }
 *   - onClick:  abre a ficha
 *   - action:   { label, nextStatus } | null — próximo passo da rota
 *   - onAdvance: (nextStatus) => void
 *   - advancing: bool
 */
export default function ChildCard({
  child,
  absence = null,
  onClick,
  action = null,
  onAdvance = null,
  advancing = false,
}) {
  const status = getEffectiveStatus(child);
  const pendingInvite = child.inviteStatus === 'pending';
  // Salva sem coordenada (endereço que o mapa não conhece). Cobre também as
  // crianças cadastradas antes do campo existir: lat/lng ausente conta igual.
  const geoPending =
    child.geoPending === true || child.lat == null || child.lng == null;

  const age = formatAge(child.birthDate);
  const absenceLabel = absence ? ABSENCE_LABELS[absence.type] : null;

  return (
    <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={onClick}
        aria-label={`Abrir a ficha de ${child.name}`}
        className="tap w-full p-4 flex items-center gap-3 text-left"
      >
        <Avatar
          photoURL={child.photoURL}
          gender={child.gender}
          seed={child.id}
          kind="child"
          size="md"
        />

        <div className="flex-1 min-w-0">
          {/* Linha 1: nome + idade — o que identifica a criança.
            * Caixas separadas: só o nome corta (ver comentário do topo). */}
          <h3 className="flex items-baseline gap-1 leading-tight">
            <span className="min-w-0 truncate text-lg font-bold text-text">
              {child.name}
            </span>
            {age && (
              <span className="shrink-0 text-sm font-normal text-textMuted">
                · {age}
              </span>
            )}
          </h3>

          {/* Linha 2: escola e período */}
          <p className="text-base text-textMuted flex items-center gap-1 mt-0.5 truncate">
            <GraduationCap size={16} className="shrink-0" />
            <span className="truncate">{child.school || 'Escola não informada'}</span>
            {child.period && (
              <>
                <span className="shrink-0">·</span>
                <span className="shrink-0">{PERIOD_LABELS[child.period]}</span>
              </>
            )}
          </p>

          {/* Linha 3: o que muda a ação de hoje */}
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {/* A ausência vem PRIMEIRO: é a informação mais perecível e a
              * única que muda a rota de hoje. */}
            {absenceLabel && (
              <span className="inline-flex items-center gap-1 text-sm font-bold text-dangerText bg-dangerChip px-2.5 py-0.5 rounded-full">
                <UserX size={14} />
                {absenceLabel}
              </span>
            )}
            <StatusBadge status={status} />
            {pendingInvite && (
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-warningText bg-warningChip px-2.5 py-0.5 rounded-full">
                <AlertTriangle size={14} />
                Convite pendente
              </span>
            )}
            {geoPending && (
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-infoText bg-infoChip px-2.5 py-0.5 rounded-full">
                <MapPinOff size={14} />
                Sem local
              </span>
            )}
          </div>
        </div>

        <ChevronRight size={20} aria-hidden className="text-textMuted shrink-0" />
      </button>

      {/* AVANÇAR O STATUS DAQUI, num toque.
        *
        * O status da criança só podia ser mudado na tela de rota. Mas a
        * lista é onde o tio já está quando encontra a criança na porta —
        * obrigá-lo a trocar de tela pra registrar o embarque é o atrito
        * que faz o status nunca ser atualizado, e é o status que o pai
        * está esperando ver mudar.
        *
        * Fica FORA do botão da linha (botão dentro de botão não existe) e
        * não aparece pra quem faltou: não há o que avançar. */}
      {action && onAdvance && !absence && (
        <div className="px-4 pb-4">
          <Button
            size="md"
            disabled={advancing}
            onClick={() => onAdvance(action.nextStatus)}
            icon={CheckCircle2}
          >
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
}
