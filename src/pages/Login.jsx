import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import GoogleIcon from '../components/common/GoogleIcon';
import { useAuth } from '../hooks/useAuth';
import { resetPassword, loginWithGoogle, getUserDoc, logout } from '../services/authService';
import { adminExists } from '../services/inviteCodeService';

export default function Login() {
  const { login, profile, loading: authLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  // Assumimos que admin existe até confirmar — evita "flicker" do link de bootstrap
  const [hasAdmin, setHasAdmin] = useState(true);

  useEffect(() => {
    adminExists()
      .then(setHasAdmin)
      .catch(() => setHasAdmin(true));
  }, []);

  // Já logado? Redireciona pelo role.
  useEffect(() => {
    if (!authLoading && profile?.role) {
      const target = profile.role === 'admin' ? '/tio' : '/pai';
      navigate(location.state?.from || target, { replace: true });
    }
  }, [authLoading, profile, navigate, location.state]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Preencha email e senha.');
      return;
    }
    setSubmitting(true);
    try {
      await login(email, password);
      // O redirect acontece no useEffect acima quando o profile carregar
    } catch (err) {
      toast.error(mapAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Login com Google: só funciona pra usuários JÁ cadastrados.
   * Se o user fizer login Google sem ter doc users/{uid}, deslogamos
   * e direcionamos pro fluxo de "primeiro acesso" com invite code.
   */
  const onGoogleLogin = async () => {
    setGoogleSubmitting(true);
    try {
      const user = await loginWithGoogle();
      const userProfile = await getUserDoc(user.uid);
      if (!userProfile) {
        await logout();
        toast.error(
          'Conta Google não cadastrada. Use "Primeiro acesso" com seu código de convite.',
          { duration: 5000 }
        );
        return;
      }
      // Profile existe — força refresh no contexto e o useEffect redireciona
      await refreshProfile();
      toast.success(`Bem-vindo, ${userProfile.name || 'Tio'}!`);
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
        'Enviamos um link para redefinir sua senha. Confira sua caixa de entrada (e o spam!).',
        { duration: 6000 }
      );
    } catch (err) {
      toast.error(mapAuthError(err));
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col px-6 py-10">
      <div className="flex-1 flex flex-col justify-center">
        <div className="text-center mb-8">
          <img
            src="/logo.png"
            alt="Tio Nino Digital"
            className="w-32 h-32 mx-auto mb-4 object-contain"
          />
          <p className="text-sm text-textMuted mt-1">
            Transporte escolar em tempo real
          </p>
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
            label="Senha"
            placeholder="••••••••"
            icon={Lock}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          <Button type="submit" loading={submitting}>
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

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-bg px-3 text-textMuted">ou</span>
          </div>
        </div>

        <Button
          variant="secondary"
          loading={googleSubmitting}
          onClick={onGoogleLogin}
        >
          {!googleSubmitting && <GoogleIcon size={18} />}
          Entrar com Google
        </Button>

        <div className="mt-8 pt-6 border-t border-gray-200 text-center space-y-3">
          <Link
            to="/first-access"
            className="block text-sm text-primary font-medium tap"
          >
            Primeiro acesso (recebi um código de convite)
          </Link>
          {!hasAdmin && (
            <Link
              to="/first-admin"
              className="block text-xs text-textMuted underline"
            >
              Configurar primeiro administrador
            </Link>
          )}
          <div className="text-[11px] text-textMuted pt-2 flex items-center justify-center gap-3">
            <Link to="/termos" className="hover:underline">
              Termos de Uso
            </Link>
            <span aria-hidden>·</span>
            <Link to="/privacidade" className="hover:underline">
              Política de Privacidade
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// Traduz códigos de erro do Firebase Auth para mensagens amigáveis em PT-BR.
function mapAuthError(err) {
  const code = err?.code || '';
  switch (code) {
    case 'auth/invalid-email':
      return 'Email inválido.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email ou senha incorretos.';
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
