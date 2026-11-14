import { useId, useState } from 'react';
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
  const { user, profile, refreshProfile, logout } = useAuth();
  // ⚠️ CONTA NOVA NÃO É "ATUALIZAÇÃO" (02/10/2026). O cadastro não pede o
  // aceite, então este portão é a PRIMEIRA tela de toda conta nova — e ela
  // dizia "Atualizamos os Termos" a quem nunca tinha aceitado nada. Achado
  // do teste no navegador (M1). Sem aceite anterior, o texto é de começo.
  const primeiraVez = !profile?.termsVersion;
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
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primaryChip mx-auto mb-4">
          <ShieldCheck size={32} className="text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-text text-center">
          {primeiraVez ? 'Antes de começar' : 'Atualização dos termos'}
        </h1>
        <p className="text-sm text-textMuted text-center mt-2 mb-6 leading-relaxed">
          {primeiraVez
            ? 'Pra usar o app, leia e aceite os Termos de Uso e a Política de Privacidade.'
            : 'Atualizamos os Termos de Uso e a Política de Privacidade. Pra continuar usando o app, precisamos do seu aceite.'}
        </p>

        <div className="bg-card rounded-2xl p-4 space-y-3 shadow-sm">
          <CheckRow
            checked={acceptedTerms}
            onChange={setAcceptedTerms}
            label={
              <>
                Li e aceito os <strong className="font-semibold">Termos de Uso</strong>
              </>
            }
            leitura={{ to: '/termos', nome: 'os Termos de Uso' }}
          />
          <CheckRow
            checked={acceptedPrivacy}
            onChange={setAcceptedPrivacy}
            label={
              <>
                Li e aceito a <strong className="font-semibold">Política de Privacidade</strong>
              </>
            }
            leitura={{ to: '/privacidade', nome: 'a Política de Privacidade' }}
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
          {/* O botão apagado precisa dizer por quê — sem isto a pessoa toca
            * nele, nada acontece, e ela acha que o app travou. */}
          {!canSubmit && (
            <p className="text-center text-sm text-textMuted">
              Marque as duas caixas acima para continuar.
            </p>
          )}
          <Button variant="ghost" onClick={onDecline} disabled={submitting}>
            Não aceito (sair da conta)
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * UMA LINHA DO ACEITE: a caixa e a frase marcam, o link só LÊ.
 *
 * ⚠️ O LINK NÃO PODE MORAR DENTRO DO `<label>` (11/2026). Estava: a frase
 * inteira era "Li e aceito os [Termos de Uso]" e o nome do documento era o link,
 * então quem tocava no meio da frase — onde está o texto, e onde um dedo de
 * quem tem 40+ cai — abria os Termos em outra aba e NÃO marcava nada. Link
 * dentro de label não repassa o toque à caixa. Visto no navegador a 360x640:
 * na linha da Política, a frase quase toda era link.
 *
 * Agora são dois alvos separados, cada um com 48px de altura (o piso do app,
 * acima dos 44px): o `<label>` (caixa + frase, ligado ao campo por `htmlFor`,
 * e a caixa continua dentro dele para o toque nela também marcar) e, ao lado,
 * o link "Ler", com ícone, sublinhado e `target="_blank"`. O texto jurídico
 * não mudou — só quem recebe o toque.
 */
function CheckRow({ checked, onChange, label, leitura }) {
  const id = useId();
  return (
    <div className="flex items-center gap-1">
      <label
        htmlFor={id}
        className="flex min-h-12 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl px-1 py-1"
      >
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="h-6 w-6 shrink-0 accent-primary"
        />
        <span className="text-[15px] leading-snug text-text">{label}</span>
      </label>
      <Link
        to={leitura.to}
        target="_blank"
        rel="noopener noreferrer"
        className="tap inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center gap-1 rounded-xl px-2 text-sm font-semibold text-primary underline"
      >
        Ler
        <ExternalLink size={14} aria-hidden="true" />
        <span className="sr-only"> {leitura.nome} (abre em outra aba)</span>
      </Link>
    </div>
  );
}
