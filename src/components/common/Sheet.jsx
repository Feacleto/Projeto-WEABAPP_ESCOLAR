import { useEffect } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import Spinner from './Spinner';
import { useArrastarPraFechar } from '../../hooks/useArrastarPraFechar';

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
 * A REGRA DE SUPERFÍCIE: TAMPA ESCURA, CORPO CLARO
 * A primeira versão era clara demais (parecia diálogo do sistema); a segunda
 * era escura igual à home — e aí não parecia mais uma folha, parecia que a
 * página tinha trocado. A resposta é usar as DUAS superfícies com papéis
 * definidos, e essa regra vale pra toda porta de entrada do produto:
 *
 *   TAMPA ESCURA (#0B1210 + brilho + malha)  = a marca falando. Mesmo
 *   material da home, então a folha é claramente a mesma casa.
 *
 *   CORPO CLARO (bg do app)                  = o produto. É onde ficam os
 *   campos, e é a cor que o usuário vai encontrar depois de entrar.
 *
 * Além de amarrar as duas linguagens, o corpo claro é o que faz a folha
 * LER como camada: claro sobre escuro tem separação que escuro sobre escuro
 * não tem, por mais sombra que se ponha. E campo claro é mais legível no
 * celular barato sob sol — o cenário real do pai no portão da escola e do
 * motorista dentro da van.
 *
 * ARRASTAR PRA BAIXO FECHA — e a alça já prometia isso.
 *
 * O tracinho no topo é o sinal universal de "me puxa", e ele estava desenhado
 * sem estar ligado: a pessoa arrastava, nada acontecia, e ela concluía que o
 * gesto não existe neste app. Affordance desenhada e morta é pior que
 * affordance ausente, porque ensina o contrário do que é verdade.
 *
 * O ARRASTO PEGA SÓ NA TAMPA, e isso não é limitação — é o que impede o
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
      className="animate-sheet-fade fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-md sm:items-center sm:px-4 sm:py-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={estilo}
        className={`relative flex max-h-[92svh] w-full max-w-mobile flex-col overflow-hidden rounded-t-3xl bg-bg shadow-[0_-24px_70px_rgba(0,0,0,0.55)] sm:rounded-3xl ${
          // A animação de entrada sai de cena durante o arrasto: as duas
          // mexem no mesmo `transform`, e juntas a folha treme.
          arrastando ? '' : 'animate-sheet-up transition-transform duration-200'
        }`}
      >
        {/* ── tampa: a marca, com o mesmo fundo da home ── */}
        <div
          {...alcaProps}
          className={`relative shrink-0 overflow-hidden bg-[#0B1210] px-5 pb-5 pt-3 text-white ${alcaProps.className}`}
        >
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div
              className="absolute inset-0 opacity-80 animate-glow-drift"
              style={{
                background:
                  'radial-gradient(110% 90% at 0% 0%, rgba(31,95,63,.65) 0%, rgba(11,18,16,0) 62%)',
              }}
            />
            <div
              className="absolute inset-0 opacity-60 animate-glow-drift-slow"
              style={{
                background:
                  'radial-gradient(90% 80% at 100% 0%, rgba(82,196,26,.2) 0%, rgba(11,18,16,0) 58%)',
              }}
            />
            <div
              className="absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
                backgroundSize: '44px 44px',
              }}
            />
          </div>

          <span
            aria-hidden
            className="relative mx-auto mb-3 block h-1 w-10 rounded-full bg-white/40 sm:hidden"
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
              className="tap relative -ml-1 mb-1.5 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-bold text-white/65 hover:text-white"
            >
              <ArrowLeft size={15} />
              Voltar
            </button>
          )}

          <div className="relative flex items-start gap-3">
            {Icon && (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/15 text-primary">
                <Icon size={19} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              {eyebrow && (
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary/70">
                  {eyebrow}
                </p>
              )}
              <h2 className="text-xl font-extrabold leading-tight tracking-tight">
                {title}
              </h2>
              {subtitle && (
                <p className="mt-1 text-xs leading-snug text-white/60">
                  {subtitle}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="tap -mr-1 shrink-0 rounded-lg p-1 text-white/60 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Costura entre a marca e o produto — 2px de esmeralda. */}
        <div
          aria-hidden
          className="h-[2px] shrink-0 bg-gradient-to-r from-primary via-accent to-primary"
        />

        {/* ── corpo: o produto. Único pedaço que rola. ── */}
        <div className="relative overflow-y-auto overscroll-contain px-5 pb-6 pt-5">
          {children}
        </div>
      </div>
    </div>
  );
}

/** Cartão de apoio dentro da folha — mesma peça dos cartões do app. */
export function SheetCard({ className = '', children }) {
  return (
    <div
      className={`rounded-2xl border border-border bg-card p-4 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Ação principal da folha — verde da marca, com o brilho atravessando. É
 * sempre o botão que o visitante veio apertar.
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
      className={`tap cta-shine-white relative inline-flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-primary text-base font-bold text-white shadow-focus hover:bg-primaryDark focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60 ${className}`}
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
      className={`tap inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-border bg-card text-base font-bold text-text hover:bg-sunken focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60 ${className}`}
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
      <span className="text-[11px] uppercase tracking-wider text-textMuted">
        {children}
      </span>
      <span aria-hidden className="h-px flex-1 bg-border" />
    </div>
  );
}

/**
 * Cartão de escolha de papel — "sou pai/mãe" e "sou motorista escolar".
 *
 * Só aparece pra quem NÃO tem conta: quem já tem não escolhe papel nenhum,
 * o login resolve. As duas cores são as do app (índigo = responsável,
 * esmeralda = motorista), então o papel escolhido aqui é a mesma cor que a
 * pessoa vai encontrar nas telas dela.
 */
export function RoleCard({
  icon: Icon,
  title,
  detail,
  tone = 'emerald',
  onClick,
}) {
  const skin =
    tone === 'indigo'
      ? 'from-info via-info to-escola shadow-focus'
      : 'from-primary via-primary to-primary shadow-focus';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tap group w-full overflow-hidden rounded-2xl bg-gradient-to-br ${skin} p-4 text-left text-white shadow-lg`}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/20">
          <Icon size={24} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-extrabold leading-tight tracking-tight">
            {title}
          </span>
          <span className="mt-0.5 block text-xs leading-snug text-white/80">
            {detail}
          </span>
        </span>
      </div>
    </button>
  );
}
