import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cookie } from 'lucide-react';
import {
  getCookieConsent,
  setCookieConsent,
} from '../../services/consentService';

/**
 * Banner de consentimento de cookies (LGPD).
 *
 * - Aparece SOMENTE se o usuário ainda não respondeu (localStorage vazio).
 * - "Aceitar todos" → analytics=true. "Apenas essenciais" → analytics=false.
 * - Decisão fica em localStorage; banner não reaparece.
 *
 * Regra de produto:
 *   - Cookies essenciais (sessão Firebase, preferências) sempre ativos.
 *   - Cookies analíticos (Analytics) só se aceitar.
 */
export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    // Pequeno delay pra não competir com toasts/loading na primeira visita
    const mostrar = () => setVisible(!getCookieConsent());
    // ⚠️ O TEATRO DO LOGIN É A PRIMEIRA VISITA TAMBÉM — e o banner cobria a
    // metade de baixo da apresentação inteira. Enquanto ele roda, o banner
    // espera o fim (ver `useTeatroDoLogin`).
    const aoFimDoTeatro = () => mostrar();
    const t = setTimeout(() => {
      if (document.documentElement.dataset.teatro === 'rodando') {
        window.addEventListener('alobuzinou:teatro-fim', aoFimDoTeatro, { once: true });
      } else {
        mostrar();
      }
    }, 500);
    return () => {
      clearTimeout(t);
      window.removeEventListener('alobuzinou:teatro-fim', aoFimDoTeatro);
    };
  }, []);

  const persist = (consent) => {
    setCookieConsent(consent);
    // Notifica firebase/config.js pra ativar Analytics se aceito (sem reload)
    if (consent.analytics && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('tn-analytics-consent'));
    }
    setVisible(false);
  };

  const onAcceptAll = () => persist({ analytics: true });
  const onEssentialsOnly = () => persist({ analytics: false });
  const onSaveCustom = () => persist({ analytics });

  if (!visible) return null;

  return <CaixaDeCookies {...{ showCustom, setShowCustom, analytics, setAnalytics, onAcceptAll, onEssentialsOnly, onSaveCustom }} />;
}

/**
 * O DESENHO DO AVISO, e por que ele é BAIXO E SEM BOTÃO CHEIO (02/10/2026).
 *
 * O teste no navegador (M1) pegou o aviso duas vezes no caminho do motorista
 * novo: no fim da apresentação do login, o "Aceitar todos" verde cheio
 * competia com o "Entrar com Google" que a apresentação acabou de destacar; e
 * no cadastro ele cobria o botão "Criar minha conta e entrar". Quem não
 * fechasse o aviso não achava o botão de criar a conta.
 *
 * Três decisões:
 *  1. As três escolhas continuam (a LGPD pede a escolha), na MESMA linha e
 *     com o mesmo peso de contorno — nenhuma delas é o botão principal da
 *     tela, porque o principal da tela é o que a pessoa veio fazer.
 *  2. Uma frase só, e o "Saiba mais" leva o resto.
 *  3. Enquanto ele está aberto, a página ganha um espaço do tamanho dele no
 *     fim (`padding-bottom` no body): o que estiver embaixo dá para rolar até
 *     acima do aviso, em vez de ficar escondido atrás dele.
 */
function CaixaDeCookies({ showCustom, setShowCustom, analytics, setAnalytics, onAcceptAll, onEssentialsOnly, onSaveCustom }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const antes = document.body.style.paddingBottom;
    const ajustar = () => {
      document.body.style.paddingBottom = `${el.offsetHeight + 12}px`;
    };
    ajustar();
    const obs = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(ajustar) : null;
    obs?.observe(el);
    return () => {
      obs?.disconnect();
      document.body.style.paddingBottom = antes;
    };
  }, []);

  const botao =
    // 48px de altura (o piso do app) e o rótulo pode quebrar em duas linhas.
    'tap min-h-12 rounded-xl border border-borderStrong bg-card px-2 py-1 text-[13px] font-semibold leading-tight text-text';

  return (
    // ABAIXO DAS FOLHAS (z-40; as folhas são z-50). Por cima, ele cobria o
    // "entrar com email" da folha do convite — a mãe não alcançava o caminho
    // dela sem antes responder sobre cookies (teste R1, 02/10/2026). Folha que
    // a pessoa abriu ganha de aviso que pode esperar.
    <div
      ref={ref}
      role="dialog"
      aria-label="Preferências de cookies"
      className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-0 print:hidden"
    >
      {/* NO MONITOR, NO CANTO (04/10/2026, medido a 1366px): centralizado, o
        * aviso caía no meio da tela, por cima do formulário de entrar. No
        * celular ele continua na largura toda, embaixo. */}
      <div className="max-w-mobile mx-auto lg:ml-3 lg:mr-auto lg:max-w-md rounded-2xl border border-border bg-card p-3 shadow-float">
        <p className="flex items-start gap-2 text-[13px] leading-snug text-textMuted">
          <Cookie size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden />
          <span>
            Usamos cookies pra manter você logado e, se você deixar, pra medir
            o uso do app.{' '}
            <Link
              to="/privacidade"
              /* A área de toque passa de 16 para 44px de altura sem mudar a
               * linha: o preenchimento vertical é desfeito pela margem. */
              className="-my-3 inline-block py-3 font-semibold text-primary underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Saiba mais
            </Link>
          </span>
        </p>

        {showCustom && (
          <div className="mt-3 space-y-1 border-t border-neutro pt-2">
            <CookieOption
              label="Cookies essenciais"
              description="Necessários pro funcionamento (login, sessão). Não desativáveis."
              checked
              disabled
            />
            <CookieOption
              label="Cookies analíticos"
              description="Métricas anônimas pra melhorar o app."
              checked={analytics}
              onChange={(v) => setAnalytics(v)}
            />
          </div>
        )}

        {/* Abaixo de 360px "Personalizar" não cabe num terço: desce para uma
          * linha própria (04/10/2026, medido a 320px). */}
        <div className="mt-3 grid grid-cols-2 gap-2 min-[360px]:grid-cols-3">
          {showCustom ? (
            <>
              <button type="button" onClick={() => setShowCustom(false)} className={botao}>
                Voltar
              </button>
              <button type="button" onClick={onSaveCustom} className={`${botao} col-span-1 min-[360px]:col-span-2`}>
                Salvar preferências
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={onEssentialsOnly} className={botao}>
                Apenas essenciais
              </button>
              <button type="button" onClick={onAcceptAll} className={botao}>
                Aceitar todos
              </button>
              <button type="button" onClick={() => setShowCustom(true)} className={`${botao} col-span-2 min-[360px]:col-span-1`}>
                Personalizar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CookieOption({ label, description, checked, disabled, onChange }) {
  return (
    <label
      className={`flex min-h-11 items-start gap-3 p-2 rounded-lg ${
        disabled ? 'opacity-60' : 'cursor-pointer'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        className="mt-0.5 h-5 w-5 accent-primary"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text">{label}</p>
        <p className="text-xs text-textMuted leading-snug">{description}</p>
      </div>
    </label>
  );
}
