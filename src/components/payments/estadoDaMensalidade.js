import {
  Check,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  Hourglass,
  CalendarClock,
} from 'lucide-react';

/**
 * AS QUATRO CORES DA MENSALIDADE, num lugar só.
 *
 * O texto continua vindo de `dominio/cobranca/paymentVocabulary` (ele sabe
 * falar com cada papel). Aqui mora só a APARÊNCIA, e ela mora junta porque
 * três peças a desenham — o chip da linha, a folhinha de vencimento e a
 * barra do mês. Separadas, a primeira mudança de tom deixaria a folhinha
 * dizendo "atrasada" em vermelho ao lado de um chip que já virou outra coisa.
 *
 * O conjunto é o D5 do design system (docs/design-system.md):
 *   paga       verde       primaryChip + accentText
 *   avisou     âmbar       warningChip + warningText — é o motorista que confere
 *   pendente   cinza       neutro + textMuted
 *   atrasada   vermelho    dangerChip + dangerText
 *
 * ⚠️ ÂMBAR E VERMELHO SEMPRE COM ÍCONE. Para quem não distingue as duas cores
 * (e são muitos homens de 40+, que é quem dirige a perua), a cor sozinha
 * não diz nada — o ícone é o que separa "conferir" de "cobrar".
 */
export const TOM = {
  ok: {
    chip: 'bg-primaryChip text-accentText',
    folha: 'bg-primaryChip text-accentText',
    borda: 'border-border',
    Icon: CheckCircle2,
  },
  wait: {
    chip: 'bg-warningChip text-warningText',
    folha: 'bg-warningChip text-warningText',
    borda: 'border-border',
    Icon: Hourglass,
  },
  late: {
    chip: 'bg-dangerChip text-dangerText',
    folha: 'bg-dangerChip text-dangerText',
    borda: 'border-dangerChip',
    Icon: AlertCircle,
  },
  // Entrou, mas depois do vencimento. Lê como "resolvido" à distância e como
  // "houve atrito" de perto — ver PAGO_ATRASADO no vocabulário.
  'late-ok': {
    chip: 'bg-warningSoft text-warningText ring-1 ring-warningBorder',
    folha: 'bg-warningSoft text-warningText',
    borda: 'border-warningBorder',
    Icon: Clock,
  },
  neutral: {
    chip: 'bg-neutro text-textMuted',
    folha: 'bg-neutro text-textMuted',
    borda: 'border-border',
    Icon: null,
  },
};

/**
 * Os quatro estados como a BARRA DO MÊS os conta, na ordem em que o dinheiro
 * anda: o que entrou, o que está para conferir, o que ainda não venceu, o que
 * venceu.
 *
 * ⚠️ "PAGA" É O VERDE-ESCURO, NÃO O LIMÃO. O limão (`accent`) ao lado do
 * âmbar some para quem tem deuteranopia — as duas fatias viram o mesmo
 * amarelo-esverdeado. O verde-escuro contra o âmbar se separa pela
 * LUMINOSIDADE, que é o que sobra quando a cor falha. E cada linha da
 * legenda leva o ícone, pelo mesmo motivo do chip.
 */
export const ESTADOS_DO_MES = [
  {
    chave: 'paid',
    rotulo: 'Pagas',
    barra: 'bg-primary',
    marca: 'bg-primary text-white',
    Icon: Check,
  },
  {
    chave: 'claimed',
    rotulo: 'Avisaram que pagaram',
    barra: 'bg-warning',
    marca: 'bg-warning text-onAccent',
    Icon: Hourglass,
  },
  {
    chave: 'pending',
    rotulo: 'Pendentes',
    barra: 'bg-borderStrong',
    marca: 'bg-borderStrong text-text',
    Icon: CalendarClock,
  },
  {
    chave: 'overdue',
    rotulo: 'Atrasadas',
    barra: 'bg-dangerText',
    marca: 'bg-dangerText text-white',
    Icon: AlertTriangle,
  },
];

/** "2026-10" → "outubro". O ano já está no seletor de mês logo acima. */
export function nomeDoMes(monthKey) {
  const [ano, mes] = String(monthKey || '').split('-').map(Number);
  if (!ano || !mes) return '';
  return new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(
    new Date(ano, mes - 1, 1)
  );
}
