import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * A folha do MIOLO do app — a casca única.
 *
 * POR QUE ELA EXISTE
 * Onze arquivos tinham a mesma folha copiada à mão: AbsenceSheet,
 * AltPickupSheet, SupportSheet, SchoolBroadcastSheet, AbsenceListSheet,
 * AuthSheet, TioAgendaFAB, TioExpenses, TioFinance e
 * PaiMap. Mesmo `fixed inset-0`, mesmo `rounded-t-3xl`, mesmo puxador
 * cinza — e onze chances de divergir. Já divergiam: algumas travavam a
 * rolagem do fundo, a maioria não; algumas fechavam com ESC, a maioria
 * não; nenhuma ia pro portal, o que quebra em cima de cabeçalho grudado.
 *
 * ISTO NÃO É O Sheet.jsx
 * Aquele é a folha da VITRINE — tampa escura, brilho, malha. É a marca
 * falando com quem ainda não entrou. Aqui dentro, quem já entrou não
 * precisa da marca se apresentando de novo a cada consulta de endereço:
 * precisa de superfície clara, curta, que devolva ele pro lugar de onde
 * veio. Duas folhas, dois públicos, de propósito.
 *
 * PORTAL, SEMPRE
 * Uma folha declarada dentro do cabeçalho (`sticky z-20`) ou de um cartão
 * com z-index fica presa no teto de empilhamento do pai — e aparece POR
 * BAIXO da barra inferior, que é z-30. Não é hipótese: foi o que aconteceu
 * com o menu de perfil. Portal pro body resolve na origem, e quem usa esta
 * peça nunca mais precisa pensar nisso.
 *
 * A ROLAGEM DO FUNDO TRAVA
 * Sem isso, o dedo que passa da folha pro fundo rola a PÁGINA atrás. A
 * pessoa fecha a folha e não está mais onde estava — que é exatamente o
 * "me perdi" que estas folhas existem pra evitar.
 *
 * Props:
 *   - open, onClose
 *   - title:     string
 *   - subtitle:  string (opcional)
 *   - icon:      componente lucide (opcional)
 *   - size:      'auto' | 'tall' | 'full'
 *   - footer:    ReactNode fixo no rodapé, fora da rolagem (opcional)
 */
const SIZES = {
  // Cresce com o conteúdo até 85% da tela. Padrão: folha curta.
  auto: 'max-h-[85svh]',
  // Começa alta. Pra lista que quase sempre passa da dobra.
  tall: 'h-[85svh]',
  // Quase tela cheia. Pra formulário de vários passos, que precisa de chão.
  full: 'h-[94svh]',
};

export default function AppSheet({
  open,
  onClose,
  title,
  subtitle,
  icon: Icon,
  size = 'auto',
  footer = null,
  children,
}) {
  // ESC fecha, e o fundo para de rolar enquanto a folha está aberta.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="animate-sheet-fade fixed inset-0 z-50 mx-auto max-w-mobile bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`animate-sheet-up absolute bottom-0 left-0 right-0 flex flex-col overflow-hidden rounded-t-3xl bg-card shadow-2xl ${SIZES[size] || SIZES.auto}`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
      >
        {/* Puxador. Não é enfeite: é o que diz "isto sobe e desce", e é o
          * que separa uma folha de uma tela nova. */}
        <div className="flex shrink-0 justify-center pb-1 pt-3">
          <span className="block h-1.5 w-10 rounded-full bg-gray-300" />
        </div>

        <div className="flex shrink-0 items-start gap-3 px-5 pb-3 pt-2">
          {Icon && (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon size={19} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold leading-tight text-text">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-1 text-xs leading-snug text-textMuted">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="tap flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-textMuted"
          >
            <X size={18} />
          </button>
        </div>

        {/* Único pedaço que rola. */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
          {children}
        </div>

        {/* Rodapé fixo — o botão principal não pode fugir com a rolagem. */}
        {footer && (
          <div className="shrink-0 border-t border-gray-100 bg-card px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
