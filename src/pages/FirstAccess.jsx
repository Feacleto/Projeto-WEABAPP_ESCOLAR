import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Ticket, Mail, Lock, ArrowLeft, User, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import GoogleIcon from '../components/common/GoogleIcon';
import LegalAcceptCheckbox from '../components/legal/LegalAcceptCheckbox';
import {
  signupWithInvite,
  signupWithGoogleInvite,
  resetPassword,
  loginWithGoogle,
  getUserDoc,
  logout,
} from '../services/authService';
import { acceptTerms } from '../services/consentService';
import { useAuth } from '../hooks/useAuth';
import { isValidEmail, maskInviteCode, isValidInviteCode } from '../utils/masks';

/**
 * Fluxo de Pai/Mãe — entrada única com 2 abas:
 *   1. "Já tenho conta": email/senha ou Google (login direto)
 *   2. "Primeira vez aqui": código de convite + criar conta
 *
 * O pai que clica "Sou pai ou mãe" no /welcome cai aqui.
 * Se já está autenticado, redireciona pelo role no useEffect inicial.
 */
export default function FirstAccess() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, profile, loading: authLoading, refreshProfile } = useAuth();

  // Estado de aba (default: já tenho conta — mais comum em sessões repetidas)
  const [tab, setTab] = useState('login');

  // Redireciona se já autenticado
  useEffect(() => {
    if (!authLoading && profile?.role) {
      const target = profile.role === 'admin' ? '/tio' : '/pai';
      navigate(location.state?.from || target, { replace: true });
    }
  }, [authLoading, profile, navigate, location.state]);

  return (
    <div className="min-h-screen flex flex-col px-6 py-6">
      <Link
        to="/welcome"
        className="inline-flex items-center gap-1 text-sm text-textMuted mb-4 tap"
      >
        <ArrowLeft size={16} /> Voltar
      </Link>

      <div className="text-center mb-5">
        <Link
          to="/conheca"
          aria-label="Conhecer o Tio Nino Digital"
          className="tap inline-block"
        >
          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-600 to-violet-700 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Users size={28} className="text-white" />
          </div>
        </Link>
        <h1 className="text-2xl font-bold text-text">Pai / Mãe</h1>
        <p className="text-sm text-textMuted mt-1">
          Entre ou crie sua conta
        </p>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 rounded-2xl mb-5">
        <button
          onClick={() => setTab('login')}
          className={`tap py-2.5 text-sm font-semibold rounded-xl transition-colors ${
            tab === 'login'
              ? 'bg-card text-text shadow-sm'
              : 'text-textMuted'
          }`}
        >
          Já tenho conta
        </button>
        <button
          onClick={() => setTab('signup')}
          className={`tap py-2.5 text-sm font-semibold rounded-xl transition-colors ${
            tab === 'signup'
              ? 'bg-card text-text shadow-sm'
              : 'text-textMuted'
          }`}
        >
          Primeira vez aqui
        </button>
      </div>

      {tab === 'login' ? <LoginPane login={login} /> : <SignupPane refreshProfile={refreshProfile} />}

      <div className="text-[11px] text-textMuted flex items-center justify-center gap-3 pt-6 mt-auto">
        <Link to="/termos" className="hover:underline">
          Termos de Uso
        </Link>
        <span aria-hidden>·</span>
        <Link to="/privacidade" className="hover:underline">
          Política de Privacidade
        </Link>
      </div>
    </div>
  );
}

// ============================================================================
// Aba "Já tenho conta" — email/senha + Google
// ============================================================================
function LoginPane({ login }) {
  const { refreshProfile } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Preencha email e senha.');
      return;
    }
    setSubmitting(true);
    try {
      await login(email, password);
      // Redirect ocorre via useEffect no componente pai quando profile chega
    } catch (err) {
      toast.error(mapAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const onGoogleLogin = async () => {
    setGoogleSubmitting(true);
    try {
      const user = await loginWithGoogle();
      const userProfile = await getUserDoc(user.uid);
      if (!userProfile) {
        await logout();
        toast.error(
          'Conta Google não cadastrada. Use "Primeira vez aqui" com seu código de convite.',
          { duration: 6000 }
        );
        return;
      }
      await refreshProfile();
      toast.success(`Bem-vindo, ${userProfile.name?.split(' ')[0] || ''}!`);
    } catch (err) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        toast.error(mapAuthError(err));
      }
    } finally {
      setGoogleSubmitting(false);
    }
  };

  const onForgotPassword = async () => {
    if (!email) {
      toast.error('Digite seu email primeiro.');
      return;
    }
    setResetting(true);
    try {
      await resetPassword(email);
      toast.success(
        'Enviamos um link pra redefinir sua senha. Confira sua caixa de entrada (e o spam).',
        { duration: 6000 }
      );
    } catch (err) {
      toast.error(mapAuthError(err));
    } finally {
      setResetting(false);
    }
  };

  return (
    <>
      {/* Google em destaque — opção principal pra reduzir fricção
        * (não precisa digitar email/senha). Email/senha vem depois. */}
      <Button
        loading={googleSubmitting}
        onClick={onGoogleLogin}
        className="!bg-white !text-text !border-2 !border-gray-300 hover:!bg-gray-50 !h-14 !text-base shadow-md"
      >
        {!googleSubmitting && <GoogleIcon size={22} />}
        Entrar com Google
      </Button>

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-bg px-3 text-textMuted">ou com email e senha</span>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          type="email"
          inputMode="email"
          label="Email"
          placeholder="seu@email.com"
          icon={Mail}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <Input
          type="password"
          revealable
          label="Senha"
          placeholder="sua senha"
          icon={Lock}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        <Button type="submit" variant="secondary" loading={submitting}>
          Entrar
        </Button>
        <button
          type="button"
          onClick={onForgotPassword}
          disabled={resetting}
          className="block w-full text-sm text-textMuted hover:text-text disabled:opacity-50"
        >
          {resetting ? 'Enviando...' : 'Esqueci minha senha'}
        </button>
      </form>
    </>
  );
}

// ============================================================================
// Aba "Primeira vez aqui" — invite code + criar conta
// ============================================================================
function SignupPane({ refreshProfile }) {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [acceptedLegal, setAcceptedLegal] = useState(false);

  const validate = () => {
    const errs = {};
    if (!isValidInviteCode(code)) {
      errs.code = 'Confira o código com o motorista — ele começa com TN.';
    }
    if (!name.trim()) errs.name = 'Informe seu nome.';
    if (!isValidEmail(email)) errs.email = 'Email inválido.';
    if (password.length < 6) errs.password = 'Mínimo 6 caracteres.';
    if (!acceptedLegal)
      errs.legal = 'Você precisa aceitar os termos e a política de privacidade.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      toast.error('Confira os campos destacados.');
      return;
    }

    setSubmitting(true);
    try {
      const user = await signupWithInvite({
        inviteCode: code,
        email,
        password,
        name,
      });
      try {
        await acceptTerms(user.uid);
      } catch (err) {
        console.error('Falha ao registrar aceite:', err);
      }
      await refreshProfile();
      toast.success('Conta criada! Bem-vindo(a).');
      navigate('/pai', { replace: true });
    } catch (err) {
      toast.error(err?.message || mapAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const onGoogleSignup = async () => {
    if (!isValidInviteCode(code)) {
      setErrors((prev) => ({
        ...prev,
        code: 'Informe o código de convite antes de continuar com Google.',
      }));
      toast.error('Digite o código de convite primeiro.');
      return;
    }
    if (!acceptedLegal) {
      setErrors((prev) => ({
        ...prev,
        legal: 'Você precisa aceitar os termos antes de continuar.',
      }));
      toast.error('Aceite os termos antes de continuar.');
      return;
    }
    setGoogleSubmitting(true);
    try {
      const user = await signupWithGoogleInvite({ inviteCode: code });
      try {
        await acceptTerms(user.uid);
      } catch (err) {
        console.error('Falha ao registrar aceite:', err);
      }
      await refreshProfile();
      toast.success('Conta criada com Google!');
      navigate('/pai', { replace: true });
    } catch (err) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        toast.error(err?.message || mapAuthError(err));
      }
    } finally {
      setGoogleSubmitting(false);
    }
  };

  return (
    <>
      <p className="text-xs text-textMuted mb-3 px-1">
        O motorista te entregou um código? Digite abaixo e crie sua conta.
      </p>

      <Input
        label="Código de convite"
        placeholder="TN2K9F4B"
        icon={Ticket}
        value={code}
        onChange={(e) => setCode(maskInviteCode(e.target.value))}
        autoCapitalize="characters"
        maxLength={8}
        hint="Começa com TN. Se você tem o LINK do convite, prefira abrir o link."
        error={errors.code}
        required
      />

      <div className="mt-4">
        <LegalAcceptCheckbox
          checked={acceptedLegal}
          onChange={setAcceptedLegal}
          error={errors.legal}
        />
      </div>

      <div className="my-4">
        <Button
          variant="secondary"
          loading={googleSubmitting}
          onClick={onGoogleSignup}
        >
          {!googleSubmitting && <GoogleIcon size={18} />}
          Criar conta com Google
        </Button>
      </div>

      <div className="relative my-3">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-bg px-3 text-textMuted">ou crie com email/senha</span>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 mt-4">
        <Input
          label="Seu nome"
          placeholder="Nome completo"
          icon={User}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          error={errors.name}
          required
        />
        <Input
          type="email"
          inputMode="email"
          label="Email"
          placeholder="seu@email.com"
          icon={Mail}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          error={errors.email}
          required
        />
        {/* Um campo só: o olho de revelar substitui o "confirme a senha".
          * Digitar a senha duas vezes num teclado de celular gera mais erro
          * do que evita. */}
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
          Criar minha conta
        </Button>
      </form>
    </>
  );
}

function mapAuthError(err) {
  const code = err?.code || '';
  switch (code) {
    case 'auth/invalid-email':
      return 'Email inválido.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email ou senha incorretos.';
    case 'auth/email-already-in-use':
      return 'Este email já está em uso.';
    case 'auth/weak-password':
      return 'Senha muito fraca.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas. Aguarde alguns minutos.';
    case 'auth/network-request-failed':
      return 'Sem conexão com a internet.';
    case 'auth/popup-blocked':
      return 'Popup bloqueado pelo navegador. Habilite e tente novamente.';
    case 'auth/popup-closed-by-user':
      return 'Login cancelado.';
    case 'auth/account-exists-with-different-credential':
      return 'Já existe conta com outro método de login pra este email.';
    default:
      return err?.message || 'Erro ao entrar. Tente novamente.';
  }
}
