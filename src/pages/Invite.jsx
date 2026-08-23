import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Mail, Lock, Bus, HeartHandshake } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Spinner from '../components/common/Spinner';
import GoogleIcon from '../components/common/GoogleIcon';
import LegalAcceptCheckbox from '../components/legal/LegalAcceptCheckbox';
import { useAuth } from '../hooks/useAuth';
import { lookupInvite, normalizeInviteCode } from '../services/inviteCodeService';
import {
  signupWithInvite,
  signupWithGoogleInvite,
  redeemInvite,
} from '../services/authService';

/**
 * Convite por link — /convite/:codigo
 *
 * É o caminho principal do responsável. O código vem na URL (o tio manda
 * o link pelo WhatsApp), então ele não digita nada além de email e senha —
 * ou nada, se usar Google.
 *
 * Substitui a jornada antiga: escolher "sou pai ou mãe" → escolher a aba
 * "primeira vez aqui" → digitar TN4582 → nome → email → senha → confirmar
 * senha → aceitar termos → gate de termos → gate de contrato.
 *
 * Três estados:
 *   - carregando o convite
 *   - convite inválido (código errado ou já usado)
 *   - convite válido → criar acesso, OU vincular a uma conta já logada
 */
export default function Invite() {
  const { codigo } = useParams();
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();

  const code = normalizeInviteCode(codigo);
  const [preview, setPreview] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let alive = true;
    lookupInvite(code)
      .then((data) => alive && setPreview(data))
      .catch((err) => alive && setLoadError(err.message));
    return () => {
      alive = false;
    };
  }, [code]);

  // Admin logado não deve virar responsável — manda pro painel dele.
  useEffect(() => {
    if (!authLoading && profile?.role === 'admin') {
      toast.error('Você está logado como motorista. Saia da conta pra usar um convite.');
      navigate('/tio', { replace: true });
    }
  }, [authLoading, profile, navigate]);

  if (loadError) {
    return <InviteBroken message={loadError} />;
  }

  if (!preview || authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <Spinner size={30} className="text-primary" />
        <p className="text-sm text-textMuted">Conferindo o convite...</p>
      </div>
    );
  }

  const driverLabel =
    preview.companyName || (preview.driverFirstName ? `Tio ${preview.driverFirstName}` : 'seu motorista');

  // Pai já logado: não recria conta, só adiciona a criança à conta existente.
  if (user && profile?.role === 'parent') {
    return (
      <LinkToExistingAccount
        code={code}
        preview={preview}
        driverLabel={driverLabel}
        onDone={async () => {
          await refreshProfile();
          navigate('/pai', { replace: true });
        }}
      />
    );
  }

  return (
    <CreateAccess
      code={code}
      preview={preview}
      driverLabel={driverLabel}
      onDone={async () => {
        await refreshProfile();
        navigate('/pai', { replace: true });
      }}
    />
  );
}

/* ─────────────── Cabeçalho compartilhado ─────────────── */

function InviteHeader({ preview, driverLabel }) {
  const initial = (preview.childFirstName || '?')[0].toUpperCase();
  return (
    <div className="text-center space-y-3">
      <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-emerald-500 to-primary text-white text-3xl font-bold flex items-center justify-center shadow-lg shadow-emerald-500/25">
        {initial}
      </div>
      <div>
        <h1 className="text-2xl font-bold text-text leading-tight">
          Você é responsável pelo {preview.childFirstName}?
        </h1>
        <p className="text-sm text-textMuted mt-1.5 inline-flex items-center gap-1.5">
          <Bus size={14} />
          Convite de {driverLabel}
        </p>
      </div>
    </div>
  );
}

/* ─────────────── Convite inválido ─────────────── */

function InviteBroken({ message }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-4">
      <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center">
        <HeartHandshake size={30} className="text-amber-700" />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-xl font-bold text-text">Este convite não vale mais</h1>
        <p className="text-sm text-textMuted max-w-xs">{message}</p>
        <p className="text-sm text-textMuted max-w-xs">
          Peça um link novo pro motorista — ele gera na hora, na ficha da criança.
        </p>
      </div>
      <Link
        to="/login"
        className="text-sm font-semibold text-primary underline"
      >
        Já tenho conta, quero entrar
      </Link>
    </div>
  );
}

/* ─────────────── Pai já logado: adicionar filho ─────────────── */

function LinkToExistingAccount({ code, preview, driverLabel, onDone }) {
  const [submitting, setSubmitting] = useState(false);

  const onLink = async () => {
    setSubmitting(true);
    try {
      await redeemInvite({ inviteCode: code });
      toast.success(`${preview.childFirstName} foi adicionado à sua conta!`);
      await onDone();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col px-6 py-8 justify-center gap-6">
      <InviteHeader preview={preview} driverLabel={driverLabel} />
      <div className="bg-card border border-gray-200 rounded-2xl p-4 text-sm text-text">
        Você já está logado. Podemos adicionar {preview.childFirstName} à sua
        conta — você troca entre as crianças na tela de início.
      </div>
      <div className="space-y-2">
        <Button loading={submitting} onClick={onLink}>
          Sim, adicionar {preview.childFirstName}
        </Button>
        <Link
          to="/pai"
          className="block text-center text-sm text-textMuted py-2"
        >
          Agora não
        </Link>
      </div>
    </div>
  );
}

/* ─────────────── Criar acesso ─────────────── */

function CreateAccess({ code, preview, driverLabel, onDone }) {
  const [accepted, setAccepted] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const requireAccept = () => {
    if (accepted) return true;
    setErrors({ legal: 'Precisa aceitar os termos pra continuar.' });
    toast.error('Aceite os termos pra continuar.');
    return false;
  };

  const onGoogle = async () => {
    if (!requireAccept()) return;
    setGoogleSubmitting(true);
    try {
      await signupWithGoogleInvite({ inviteCode: code });
      toast.success('Acesso criado!');
      await onDone();
    } catch (err) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        toast.error(err.message || 'Não foi possível criar o acesso.');
      }
    } finally {
      setGoogleSubmitting(false);
    }
  };

  const onEmailSubmit = async (e) => {
    e.preventDefault();
    if (!requireAccept()) return;
    const errs = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Email não parece válido.';
    }
    if (password.length < 6) errs.password = 'Mínimo 6 caracteres.';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSubmitting(true);
    try {
      await signupWithInvite({ inviteCode: code, email, password, name: '' });
      toast.success('Acesso criado!');
      await onDone();
    } catch (err) {
      toast.error(err.message || 'Não foi possível criar o acesso.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col px-6 py-8 gap-5">
      <InviteHeader preview={preview} driverLabel={driverLabel} />

      {/* Um aceite só cobre termos + privacidade. O contrato de transporte
        * vem depois, na primeira entrada, porque o texto é do motorista e
        * precisa ser lido — não cabe numa linha de checkbox. */}
      <LegalAcceptCheckbox
        checked={accepted}
        onChange={(v) => {
          setAccepted(v);
          setErrors((p) => ({ ...p, legal: undefined }));
        }}
        error={errors.legal}
      />

      <div className="space-y-2">
        <Button
          loading={googleSubmitting}
          onClick={onGoogle}
          className="!bg-white !text-text !border-2 !border-gray-300 hover:!bg-gray-50 shadow-md"
        >
          {!googleSubmitting && <GoogleIcon size={22} />}
          Continuar com Google
        </Button>
        <p className="text-[11px] text-textMuted text-center">
          Jeito mais rápido — nada pra digitar.
        </p>
      </div>

      {!showEmailForm ? (
        <button
          type="button"
          onClick={() => setShowEmailForm(true)}
          className="text-sm text-textMuted underline py-2"
        >
          Prefiro criar com email e senha
        </button>
      ) : (
        <form onSubmit={onEmailSubmit} className="space-y-4">
          <Input
            type="email"
            inputMode="email"
            label="Seu email"
            placeholder="seu@email.com"
            icon={Mail}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            error={errors.email}
            required
          />
          <Input
            type="password"
            revealable
            label="Crie uma senha"
            placeholder="Mínimo 6 caracteres"
            icon={Lock}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            autoComplete="new-password"
            error={errors.password}
            hint="Toque no olho pra conferir o que digitou."
            required
          />
          <Button type="submit" loading={submitting}>
            Criar meu acesso
          </Button>
        </form>
      )}

      <div className="mt-auto pt-4 text-center space-y-2">
        <p className="text-xs text-textMuted">
          Não é você? Fale com {driverLabel} — o convite é pessoal.
        </p>
        <Link to="/login" className="block text-sm font-semibold text-primary underline">
          Já tenho conta
        </Link>
      </div>
    </div>
  );
}
