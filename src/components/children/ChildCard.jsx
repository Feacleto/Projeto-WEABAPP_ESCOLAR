import { useState } from 'react';
import {
  GraduationCap,
  ArrowUpRight,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  MapPinOff,
  MapPin,
  Phone,
  UserRound,
  UserX,
} from 'lucide-react';
import Avatar from '../common/Avatar';
import StatusBadge from './StatusBadge';
import { PERIOD_LABELS, formatAge, formatPhone } from '../../utils/formatters';
import { getEffectiveStatus } from '../../services/childrenService';
import { ABSENCE_LABELS } from '../../services/absencesService';

/**
 * Card de criança na lista "Minha turma".
 *
 * A REGRA DA LISTA: título curto, tudo que o tio precisa pra AGIR, e o resto
 * atrás de "ver mais".
 *
 * O título é nome + idade + escola, porque é isso que ele usa pra saber com
 * quem está falando na porta e pra distinguir dois irmãos. O endereço, os
 * nomes do pai e da mãe e o telefone ficam recolhidos — são consulta, não
 * varredura.
 *
 * A AUSÊNCIA DO DIA aparece em destaque no título. Antes ela só existia na
 * tela de rota, então o tio olhava a lista e não sabia quem ia faltar hoje —
 * a informação mais perecível de todas ficava no lugar mais escondido.
 *
 * DOIS ALVOS DE TOQUE, DUAS INTENÇÕES
 * O cartão inteiro abria a ficha completa. Só que abrir a ficha é sair da
 * lista — perder a rolagem, o filtro e a busca — e na maior parte das vezes
 * o tio só queria conferir um endereço ou um telefone. O toque mais provável
 * levava ao resultado mais caro.
 *
 * Agora o cartão tem alvos separados: a FOTO abre a ficha completa (é o
 * retrato da criança, o alvo mais "pessoal" do cartão, e ganha um distintivo
 * de seta pra dizer que sai daqui); o RESTO DA LINHA abre e fecha o detalhe
 * ali mesmo. Quem descobriu o detalhe primeiro ainda acha a ficha: o painel
 * aberto termina com "Ver ficha completa".
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
 *   - onClick:  abre a ficha completa
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
  const [expanded, setExpanded] = useState(false);

  const status = getEffectiveStatus(child);
  const pendingInvite = child.inviteStatus === 'pending';
  // Salva sem coordenada (endereço que o mapa não conhece). Cobre também as
  // crianças cadastradas antes do campo existir: lat/lng ausente conta igual.
  const geoPending =
    child.geoPending === true || child.lat == null || child.lng == null;

  const age = formatAge(child.birthDate);
  const absenceLabel = absence ? ABSENCE_LABELS[absence.type] : null;

  // Os dois responsáveis, quando existem — é o que ele liga quando a criança
  // não está na porta.
  const parents = [
    child.parentName && { name: child.parentName, phone: child.parentPhone },
    child.parent2Name && { name: child.parent2Name, phone: child.parent2Phone },
  ].filter(Boolean);

  return (
    <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
      <div className="p-4 flex items-center gap-3">
        {/* A FOTO é a porta pra ficha completa — e o único alvo que sai da
          * lista. O distintivo de seta é o aviso de que sai. */}
        <button
          type="button"
          onClick={onClick}
          aria-label={`Abrir a ficha completa de ${child.name}`}
          className="tap relative shrink-0 rounded-full ring-2 ring-primary/15"
        >
          <Avatar
            photoURL={child.photoURL}
            gender={child.gender}
            seed={child.id}
            kind="child"
            size="md"
          />
          <span
            aria-hidden
            className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-white bg-primary text-white"
          >
            <ArrowUpRight size={10} strokeWidth={3} />
          </span>
        </button>

        {/* O RESTO abre o detalhe aqui mesmo, sem trocar de tela. */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="tap flex-1 min-w-0 text-left"
        >
          {/* Linha 1: nome + idade — o que identifica a criança.
            * Caixas separadas: só o nome corta (ver comentário do topo). */}
          <h3 className="flex items-baseline gap-1 leading-tight">
            <span className="min-w-0 truncate font-bold text-text">
              {child.name}
            </span>
            {age && (
              <span className="shrink-0 text-xs font-normal text-textMuted">
                · {age}
              </span>
            )}
          </h3>

          {/* Linha 2: escola e período */}
          <p className="text-xs text-textMuted flex items-center gap-1 mt-0.5 truncate">
            <GraduationCap size={12} className="shrink-0" />
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
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                <UserX size={10} />
                {absenceLabel}
              </span>
            )}
            <StatusBadge status={status} />
            {pendingInvite && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                <AlertTriangle size={10} />
                Convite pendente
              </span>
            )}
            {geoPending && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 bg-sky-100 px-2 py-0.5 rounded-full">
                <MapPinOff size={10} />
                Sem local
              </span>
            )}
          </div>
        </button>
        <ChevronDown
          size={18}
          aria-hidden
          className={`text-textMuted shrink-0 transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </div>

      {/* AVANÇAR O STATUS DAQUI, num toque.
        *
        * O status da criança só podia ser mudado na tela de rota. Mas a
        * lista é onde o tio já está quando encontra a criança na porta —
        * obrigá-lo a trocar de tela pra registrar o embarque é o atrito
        * que faz o status nunca ser atualizado, e é o status que o pai
        * está esperando ver mudar.
        *
        * Não aparece pra quem faltou: não há o que avançar. */}
      {action && onAdvance && !absence && (
        <div className="px-4 pb-3">
          <button
            type="button"
            disabled={advancing}
            onClick={() => onAdvance(action.nextStatus)}
            className="tap w-full h-12 rounded-xl bg-primary text-white text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <CheckCircle2 size={17} />
            {action.label}
          </button>
        </div>
      )}

      {/* "Ver mais" abre AQUI, sem sair da lista: o tio consulta um endereço
        * e continua de onde parou, em vez de navegar e voltar. */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="tap w-full px-4 pb-3 -mt-1 flex items-center gap-1 text-xs font-semibold text-primary"
      >
        {expanded ? 'Ver menos' : 'Ver mais'}
        <ChevronDown
          size={14}
          className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-2.5">
          <Detail icon={MapPin} label="Onde mora">
            {child.address || 'Endereço não informado'}
          </Detail>

          {parents.length > 0 ? (
            parents.map((p, i) => (
              <Detail key={i} icon={UserRound} label={i === 0 ? 'Responsável' : '2º responsável'}>
                <span className="block">{p.name}</span>
                {p.phone && (
                  <a
                    href={`tel:${p.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="tap inline-flex items-center gap-1 text-primary font-semibold mt-0.5"
                  >
                    <Phone size={12} />
                    {formatPhone(p.phone)}
                  </a>
                )}
              </Detail>
            ))
          ) : (
            <Detail icon={UserRound} label="Responsável">
              Não informado
            </Detail>
          )}

          {child.schoolAddress && (
            <Detail icon={GraduationCap} label="Endereço da escola">
              {child.schoolAddress}
            </Detail>
          )}

          {/* A SEGUNDA PORTA PRA FICHA COMPLETA.
            * O distintivo na foto é discreto de propósito; quem não reparou
            * nele chega aqui pelo caminho que já conhece — abriu o detalhe,
            * quer mais, e o "mais" está no fim do que ele acabou de ler. */}
          <button
            type="button"
            onClick={onClick}
            className="tap mt-1 inline-flex items-center gap-1 text-xs font-bold text-primary"
          >
            Ver ficha completa
            <ArrowUpRight size={13} strokeWidth={2.6} />
          </button>
        </div>
      )}
    </div>
  );
}

function Detail({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={13} className="text-textMuted shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-textMuted">
          {label}
        </p>
        <p className="text-xs text-text leading-snug break-words">{children}</p>
      </div>
    </div>
  );
}
