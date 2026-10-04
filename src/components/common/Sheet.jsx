import { useEffect } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import Spinner from './Spinner';
import { useArrastarPraFechar } from '../../hooks/useArrastarPraFechar';
import { useVoltarFechaFolha } from '../../hooks/useVoltarFechaFolha';

/**
 * Folha modal — sobe de baixo no celular, centraliza no desktop.
 *
 * POR QUE FOLHA E NÃO PÁGINA
 * Na home, "Entrar" e "Entrar na lista" tiravam o visitante da página: ele
 * perdia o lugar na rolagem e, se desistisse, tinha que achar o caminho de
 * volta. Como folha, o contexto continua atrás — fecha e ele está exatamente
 * onde estava, no mesmo bloco. As páginas /login e /quero-fazer-parte
 * continuam existindo pra link direto (convite, WhatsApp, favorito).
 *
 * A FOLHA É BRANCA, DA TAMPA AO FUNDO (03/10/2026, design system)
 * Ela tinha uma TAMPA ESCURA — o fundo noturno da home antiga, com brilho
 * que derivava sem parar e uma malha por cima — sobre um corpo claro. A ideia
 * era a marca se apresentando em cada folha. O design system
 * ([docs/design-system.md](../../../docs/design-system.md)) desfez isso por
 * dois motivos:
 *
 *   - a superfície escura ficou SÓ NO SITE. Dentro do app ela fazia a folha
 *     parecer outro produto, que é exatamente a separação que o sistema veio
 *     fechar — e a home escura que ela imitava nem existe mais no app;
 *   - o brilho rodava em loop enquanto a folha estivesse aberta. A regra de
 *     movimento é "responde a um toque ou a um dado, menos de meio segundo,
 *     uma vez, e para": animação contínua sem nada acontecendo só gasta
 *     bateria no celular barato e puxa o olho para longe do campo.
 *
 * O que separa a folha da tela agora é o VÉU (`night` a 45%) e a sombra
 * `float` — a mesma do resto do que flutua. A alça cinza, o título em
 * Bricolage e o X num quadradinho neutro são a mesma folha da referência
 * aprovada, e a mesma do `AppSheet`: duas cascas com o mesmo rosto.
 *
 * ARRASTAR PRA BAIXO FECHA — e a alça já prometia isso.
 *
 * O tracinho no topo é o sinal universal de "me puxa", e ele estava desenhado
 * sem estar ligado: a pessoa arrastava, nada acontecia, e ela concluía que o
 * gesto não existe neste app. Affordance desenhada e morta é pior que
 * affordance ausente, porque ensina o contrário do que é verdade.
 *
 * O ARRASTO PEGA SÓ NO CABEÇALHO (alça e título), e isso não é limitação — é o que impede o
 * gesto de brigar com a rolagem do corpo. Numa folha comprida (a lista de
 * notificações, o formulário da associação) qualquer arrasto pra baixo dentro
 * do conteúdo é intenção de rolar; fechar ali faria a folha fugir da mão de
 * quem só queria ler o resto.
 *
 * Props: open, onClose, onBack, title, subtitle, icon, eyebrow, children
 */

export default function Sheet({
  open,
  onClose,
  onBack,
  title,
  subtitle,
  eyebrow,
  icon: Icon,
  children,
}) {
  const { alcaProps, estilo, arrastando } = useArrastarPraFechar(onClose);
  // O voltar do celular fecha a folha, em vez de sair da tela (03/10/2026).
  useVoltarFechaFolha(open, onClose);

  // Fecha com ESC — mesmo contrato do ConfirmDialog.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="animate-sheet-fade fixed inset-0 z-50 flex items-end justify-center bg-night/45 sm:items-center sm:px-4 sm:py-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={estilo}
        className={`relative flex max-h-[92svh] w-full max-w-mobile flex-col overflow-hidden rounded-t-3xl bg-card shadow-float sm:rounded-3xl ${
          // A animação de entrada sai de cena durante o arrasto: as duas
          // mexem no mesmo `transform`, e juntas a folha treme.
          arrastando ? '' : 'animate-sheet-up transition-transform duration-estado ease-freio'
        }`}
      >
        {/* ── cabeçalho: alça + título. É onde o arrasto pega. ── */}
        <div
          {...alcaProps}
          className={`relative shrink-0 px-5 pb-3 pt-2.5 ${alcaProps.className}`}
        >
          {/* A alça: 40 x 5, cinza forte. No desktop a folha centraliza e
            * não se arrasta de baixo, então ela some lá. */}
          <span
            aria-hidden
            className="mx-auto mb-3 block h-[5px] w-10 rounded-full bg-borderStrong sm:hidden"
          />

          {/* VOLTAR: UM PASSO ATRÁS, NÃO A SAÍDA
            * O X fecha a folha inteira e joga o visitante de volta na página.
            * Quem está no meio de uma sequência (as telas da associação, o
            * formulário) quase nunca quer isso: quer o passo anterior. Sem
            * este alvo, a única saída de "cliquei sem querer" era fechar tudo
            * e recomeçar — e no celular ainda por cima com o gesto de voltar
            * do sistema, que sai do site.
            *
            * Fica ACIMA do título (e não do lado do X) porque voltar e fechar
            * são intenções diferentes: colados, um acerta o outro no dedo. */}
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="tap -ml-1 mb-1.5 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-bold text-textMuted hover:text-text"
            >
              <ArrowLeft size={16} />
              Voltar
            </button>
          )}

          <div className="flex items-start gap-3">
            {Icon && (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primaryChip text-primary">
                <Icon size={20} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              {eyebrow && <p className="rotulo mb-0.5">{eyebrow}</p>}
              <h2 className="font-display text-xl font-bold leading-tight text-text">
                {title}
              </h2>
              {subtitle && (
                <p className="mt-1 text-sm leading-snug text-textMuted">
                  {subtitle}
                </p>
              )}
            </div>
            {/* O X é um quadradinho neutro de 36px, e não um ícone solto:
              * solto, o alvo era só o desenho, e o dedo errava. */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="tap flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-neutro text-textMuted hover:text-text"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── corpo: o único pedaço que rola. ── */}
        <div className="relative overflow-y-auto overscroll-contain px-5 pb-6 pt-2">
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Bloco de apoio dentro da folha. A folha agora é branca, e um cartão branco
 * com sombra em cima de branco some; por isso ele RECUA (`surface`), sem
 * borda e sem sombra — o mesmo papel do bloco do código PIX dentro de um
 * cartão.
 */
export function SheetCard({ className = '', children }) {
  return (
    <div className={`rounded-2xl bg-surface p-4 ${className}`}>
      {children}
    </div>
  );
}

/**
 * Ação principal da folha — verde da marca, com a única sombra colorida da
 * folha. É sempre o botão que o visitante veio apertar.
 *
 * O brilho que atravessava o botão a cada 4,2s saiu (design system,
 * 03/10/2026): era animação em loop sem nada acontecendo, e a regra de
 * movimento só aceita o que responde a um toque ou a um dado. O botão chama
 * pela cor e pela posição, não por piscar. Canto 14 (`xl`), o mesmo do
 * `Button`.
 */
export function SheetCTA({
  children,
  loading = false,
  icon: Icon,
  type = 'button',
  disabled,
  className = '',
  ...rest
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`tap relative inline-flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-marca text-base font-bold text-naMarca shadow-focus hover:bg-marcaEscuro focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60 ${className}`}
      {...rest}
    >
      {loading ? <Spinner size={19} /> : Icon && <Icon size={19} />}
      {children}
    </button>
  );
}

/** Ação secundária — cartão branco com borda. Nunca compete com o CTA. */
export function SheetGhost({
  children,
  loading = false,
  icon: Icon,
  type = 'button',
  disabled,
  className = '',
  ...rest
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`tap inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-border bg-card text-base font-bold text-text hover:bg-sunken focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60 ${className}`}
      {...rest}
    >
      {loading ? <Spinner size={19} /> : Icon && <Icon size={19} />}
      {children}
    </button>
  );
}

/**
 * Separador com texto no meio ("ou com email e senha"). Duas linhas e o
 * texto entre elas — sem o truque do rótulo opaco sobre a linha, que deixa
 * remendo visível quando o fundo não é chapado.
 */
export function SheetDivider({ children }) {
  return (
    <div className="my-5 flex items-center gap-3">
      <span aria-hidden className="h-px flex-1 bg-border" />
      <span className="rotulo">{children}</span>
      <span aria-hidden className="h-px flex-1 bg-border" />
    </div>
  );
}

/**
 * Cartão de escolha de papel — "sou pai/mãe" e "sou motorista escolar".
 *
 * Só aparece pra quem NÃO tem conta: quem já tem não escolhe papel nenhum,
 * o login resolve.
 *
 * ⚠️ AS DUAS PORTAS TÊM PESOS DIFERENTES (03/10/2026, design system): a do
 * motorista é CHEIA (verde) e a da família é de CONTORNO (branca, com borda).
 * O tom `indigo` era um degradê azul→violeta — azul é "fato neutro" e violeta
 * é a ESCOLA, duas cores com dono; e nenhuma tela da família usa índigo. O
 * nome da prop ficou para não quebrar quem chama.
 *
 * A sombra é a `rest`, e não a `focus`: são DOIS cartões lado a lado, mais o
 * botão principal da folha, e a regra é uma sombra colorida por tela — três
 * chamando é nenhuma chamando.
 */
export function RoleCard({
  icon: Icon,
  title,
  detail,
  tone = 'emerald',
  onClick,
}) {
  const contorno = tone === 'indigo';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tap group w-full overflow-hidden rounded-2xl p-4 text-left ${
        contorno ? 'border-2 border-border bg-card text-text' : 'bg-primary text-white shadow-rest'
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
            contorno ? 'bg-primaryChip text-primary' : 'bg-white/15 text-onNightAccent'
          }`}
        >
          <Icon size={24} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-base font-bold leading-tight">
            {title}
          </span>
          <span className={`mt-0.5 block text-sm leading-snug ${contorno ? 'text-textMuted' : 'text-primaryChip'}`}>
            {detail}
          </span>
        </span>
      </div>
    </button>
  );
}
