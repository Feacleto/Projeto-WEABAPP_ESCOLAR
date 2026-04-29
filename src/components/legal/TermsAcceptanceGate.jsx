import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../common/Button';
import { useAuth } from '../../hooks/useAuth';
import { acceptTerms } from '../../services/consentService';

/**
 * Bloqueia o app pra usuários logados que ainda não aceitaram a versão
 * corrente dos termos. Renderiza um overlay full-screen com checkboxes
 * e botão "Aceitar e continuar".
 *
 * Usado dentro de PrivateRoute. Se profile.termsVersion != LEGAL_VERSION,
 * renderiza esse gate em vez de children.
 */
export default function TermsAcceptanceGate() {
  const { user, refreshProfile, logout } = useAuth();
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = acceptedTerms && acceptedPrivacy;

  const onSubmit = async () => {
    if (!canSubmit || !user?.uid) return;
    setSubmitting(true);
    try {
      await acceptTerms(user.uid);
      await refreshProfile();
      toast.success('Termos aceitos. Bom uso!');
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível registrar o aceite. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const onDecline = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen flex flex-col px-6 py-8 bg-bg">
      <div className="flex-1 flex flex-col justify-center max-w-mobile mx-auto w-full">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mx-auto mb-4">
          <ShieldCheck size={32} className="text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-text text-center">
          Atualização dos termos
        </h1>
        <p className="text-sm text-textMuted text-center mt-2 mb-6 leading-relaxed">
          Atualizamos os Termos de Uso e a Política de Privacidade. Pra
          continuar usando o app, precisamos do seu aceite.
        </p>

        <div className="bg-card rounded-2xl p-4 space-y-3 shadow-sm">
          <CheckRow
            checked={acceptedTerms}
            onChange={setAcceptedTerms}
            label={
              <>
                Li e aceito os{' '}
                <Link
                  to="/termos"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary font-semibold underline inline-flex items-center gap-0.5"
                >
                  Termos de Uso
                  <ExternalLink size={12} />
                </Link>
              </>
            }
          />
          <CheckRow
            checked={acceptedPrivacy}
            onChange={setAcceptedPrivacy}
            label={
              <>
                Li e aceito a{' '}
                <Link
                  to="/privacidade"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary font-semibold underline inline-flex items-center gap-0.5"
                >
                  Política de Privacidade
                  <ExternalLink size={12} />
                </Link>
              </>
            }
          />
        </div>

        <div className="mt-6 space-y-2">
          <Button
            disabled={!canSubmit}
            loading={submitting}
            onClick={onSubmit}
          >
            Aceitar e continuar
          </Button>
          <Button variant="ghost" onClick={onDecline} disabled={submitting}>
            Não aceito (sair da conta)
          </Button>
        </div>
      </div>
    </div>
  );
}

function CheckRow({ checked, onChange, label }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-5 h-5 accent-primary shrink-0"
      />
      <span className="text-sm text-text leading-snug">{label}</span>
    </label>
  );
}
