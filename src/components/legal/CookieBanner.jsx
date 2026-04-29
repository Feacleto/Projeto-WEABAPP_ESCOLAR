import { useEffect, useState } from 'react';
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
    const t = setTimeout(() => {
      const existing = getCookieConsent();
      setVisible(!existing);
    }, 500);
    return () => clearTimeout(t);
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

  return (
    <div
      role="dialog"
      aria-label="Preferências de cookies"
      className="fixed bottom-0 left-0 right-0 z-[60] p-3 sm:p-4 print:hidden"
    >
      <div className="max-w-mobile mx-auto bg-card border border-gray-200 rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-4 space-y-3">
          <div className="flex items-start gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Cookie size={20} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-text">
                Privacidade e cookies
              </p>
              <p className="text-xs text-textMuted mt-1 leading-snug">
                Usamos cookies essenciais pra manter você logado e cookies
                analíticos (opcionais) pra entender como o app é usado. Você
                pode escolher.{' '}
                <Link
                  to="/privacidade"
                  className="text-primary underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Saiba mais
                </Link>
                .
              </p>
            </div>
          </div>

          {showCustom && (
            <div className="border-t border-gray-100 pt-3 space-y-2">
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

          <div className="flex flex-col gap-2 pt-1">
            {showCustom ? (
              <>
                <button
                  type="button"
                  onClick={onSaveCustom}
                  className="w-full h-10 rounded-xl bg-primary text-white text-sm font-semibold tap"
                >
                  Salvar preferências
                </button>
                <button
                  type="button"
                  onClick={() => setShowCustom(false)}
                  className="w-full h-9 rounded-xl text-textMuted text-xs tap"
                >
                  Voltar
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onAcceptAll}
                  className="w-full h-10 rounded-xl bg-primary text-white text-sm font-semibold tap"
                >
                  Aceitar todos
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={onEssentialsOnly}
                    className="h-10 rounded-xl border border-gray-200 text-text text-xs font-semibold tap"
                  >
                    Apenas essenciais
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCustom(true)}
                    className="h-10 rounded-xl border border-gray-200 text-text text-xs font-semibold tap"
                  >
                    Personalizar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CookieOption({ label, description, checked, disabled, onChange }) {
  return (
    <label
      className={`flex items-start gap-3 p-2 rounded-lg ${
        disabled ? 'opacity-60' : 'cursor-pointer'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        className="mt-1 w-4 h-4 accent-primary"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text">{label}</p>
        <p className="text-xs text-textMuted leading-snug">{description}</p>
      </div>
    </label>
  );
}
