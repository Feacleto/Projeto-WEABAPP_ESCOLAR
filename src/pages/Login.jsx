import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import GoogleIcon from '../components/common/GoogleIcon';
import Logo from '../components/common/Logo';
import { useAuth } from '../hooks/useAuth';
import { painelDe } from '../utils/papeis';
import { veioDaFamilia, frenteDoCaminho, FRENTE_FAMILIA } from '../utils/frentes';
import {
  resetPassword,
  loginWithGoogleExistingOnly,
} from '../services/authService';
import { adminExists } from '../services/inviteCodeService';
import OpenInBrowser from '../components/auth/OpenInBrowser';
import { canUseGoogleSignIn, isInAppBrowser } from '../utils/browserEnv';

export default function Login() {
  const { login, profile, loading: authLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // A frente vem da NAVEGAÇÃO, não do aparelho: uma pessoa pode ser
  // responsável e motorista, e marcar o celular travaria ela no último
  // papel usado. Sem contexto, o padrão é a frente do motorista — quem
  // chega sem histórico está conhecendo a plataforma.
  // A frente vem de duas fontes, e as duas importam.
  //
  // `veioDaFamilia` cobre quem clicou em Entrar na `/familia`. Mas quem
  // chega por sessão expirada não clicou em nada: foi empurrado pra cá pelo
  // guarda de rota, e o que ele traz é o `from`. Sem a segunda leitura, todo
  // responsável que voltasse depois do prazo via as portas do motorista.
  const daFamilia =
    veioDaFamilia(location) ||
    frenteDoCaminho(location?.state?.from) === FRENTE_FAMILIA;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  // Assumimos que admin existe até confirmar — evita "flicker" do link de bootstrap
  const [hasAdmin, setHasAdmin] = useState(true);

  // Mesmo tratamento da folha de convite: dentro do navegador embutido do
  // WhatsApp/Instagram, o Google recusa o OAuth e a sessão criada aqui fica
  // presa no armazenamento da webview. Então a ponte pro navegador de
  // verdade vem antes, e o Google nem aparece.
  const inApp = isInAppBrowser();
  const googleWorks = canUseGoogleSignIn();
  const [bridgeDismissed, setBridgeDismissed] = useState(false);
  const showBridge = inApp && !bridgeDismissed;

  useEffect(() => {
    adminExists()
      .then(setHasAdmin)
      .catch(() => setHasAdmin(true));
  }, []);

  // Já logado? Redireciona pelo role.
  useEffect(() => {
    if (!authLoading && profile?.role) {
      const target = painelDe(profile);
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
      // A limpeza de conta orfa vive no servico: duas telas fazem este
      // login, e deixar a checagem em cada uma garante que a terceira
      // esquece.
      const { profile: userProfile } = await loginWithGoogleExistingOnly();
      await refreshProfile();
      toast.success(`Bem-vindo, ${userProfile.name || 'Tio'}!`);
    } catch (err) {
      if (err?.code === 'app/no-profile') {
        toast.error(err.message, { duration: 7000 });
      } else if (err?.code !== 'auth/popup-closed-by-user') {
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
    <div className="min-h-screen flex flex-col px-6 py-6">
      {/* Volta pra frente de onde a pessoa veio. */}
      <Link
        to={daFamilia ? '/familia' : '/'}
        className="inline-flex items-center gap-1 text-sm text-textMuted mb-4 tap"
      >
        <ArrowLeft size={16} /> Voltar
      </Link>

      <div className="flex-1 flex flex-col justify-center">
        <div className="text-center mb-6">
          <Link
            to={daFamilia ? '/familia' : '/'}
            aria-label="Voltar"
            className="tap inline-block"
          >
            <Logo variant="stacked" height={104} className="mx-auto" />
          </Link>
          {/* O logo já diz o nome em desenho. O h1 continua existindo pra
            * leitor de tela não perder o cabeçalho da página. */}
          <h1 className="sr-only">Alô Buzinou</h1>
          <p className="text-sm text-textMuted mt-3">
            Entre com sua conta
          </p>
        </div>

        {showBridge && (
          <div className="mb-5">
            <OpenInBrowser onContinueHere={() => setBridgeDismissed(true)} />
          </div>
        )}

        {/* Google em destaque — opção principal pra reduzir fricção
          * (não precisa digitar email/senha). Email/senha vem depois. */}
        {!showBridge && googleWorks && (
          <>
            <Button
              loading={googleSubmitting}
              onClick={onGoogleLogin}
              className="!bg-white !text-text !border-2 !border-borderStrong hover:!bg-sunken !h-14 !text-base shadow-md"
            >
              {!googleSubmitting && <GoogleIcon size={22} />}
              Entrar com Google
            </Button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-bg px-3 text-textMuted">
                  ou com email e senha
                </span>
              </div>
            </div>
          </>
        )}

        <form
          onSubmit={onSubmit}
          className={`space-y-4 ${showBridge ? 'hidden' : ''}`}
        >
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

        <div className="mt-8 pt-6 border-t border-border text-center space-y-3">
          {/* Pai de primeira viagem não escolhe papel nem digita código: ele
            * abre o link que o motorista mandou. Aqui só explicamos isso. */}
          <div className="text-left bg-sunken border border-border rounded-xl px-4 py-3 space-y-1">
            <p className="text-sm font-semibold text-text">
              Recebeu um convite do seu motorista?
            </p>
            <p className="text-xs text-textMuted">
              Abra o link que ele mandou — sua conta se cria por lá.
            </p>
            {/* Plano B pra quem recebeu o convite ditado por telefone e não
              * tem o link. Deliberadamente discreto: o link é o caminho. */}
            <Link
              to="/first-access"
              className="inline-block text-xs font-semibold text-primary underline pt-1"
            >
              Só tenho o código, sem o link
            </Link>
          </div>

          {/* AS DUAS PORTAS DO MOTORISTA, escondidas de quem é responsável.
            *
            * Esta tela é compartilhada, e num aparelho de responsável ela
            * oferecia o cadastro de parceiro e — pior — o "configurar
            * primeiro administrador", que é o bootstrap do dono do sistema.
            * As rules impedem o segundo de funcionar depois que existe um
            * admin, então não era brecha de acesso; era um responsável
            * olhando uma porta que não é dele e podendo achar que errou de
            * app.
            *
            * A assimetria é intencional: o motorista PODE ver coisa de
            * responsável, o responsável NÃO pode ver coisa de motorista. */}
          {!daFamilia && (
            <>
              <Link
                to="/quero-fazer-parte"
                className="block text-sm font-semibold text-primary hover:underline"
              >
                Sou motorista e quero fazer parte →
              </Link>
              {!hasAdmin && (
                <Link
                  to="/first-admin"
                  className="block text-xs text-textMuted underline"
                >
                  Configurar primeiro administrador
                </Link>
              )}
            </>
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
