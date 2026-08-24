import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Bus,
  ChevronDown,
  LogIn,
  Lock,
  Mail,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Input from '../common/Input';
import GoogleIcon from '../common/GoogleIcon';
import Sheet, {
  RoleCard,
  SheetCard,
  SheetGhost,
} from '../common/Sheet';
import OpenInBrowser from '../auth/OpenInBrowser';
import { useAuth } from '../../hooks/useAuth';
import {
  loginWithGoogleExistingOnly,
  resetPassword,
} from '../../services/authService';
import { canUseGoogleSignIn, isInAppBrowser } from '../../utils/browserEnv';

/**
 * Folha de entrada — uma porta só, sem pedir papel.
 *
 * QUEM JÁ TEM CONTA NÃO ESCOLHE PAPEL
 * O papel (motorista ou responsável) mora em `users/{uid}.role`, gravado no
 * cadastro. Então entrar é entrar: o app descobre quem é a pessoa depois do
 * login e a Home manda pro painel certo. Perguntar "você é pai ou
 * motorista?" antes do login é pedir pro usuário repetir uma informação que
 * o sistema já tem — e, pior, deixa ele errar a porta e achar que a senha
 * está errada.
 *
 * QUEM NÃO TEM CONTA É QUEM PRECISA SER PERGUNTADO
 * Aí sim: os dois caminhos são diferentes de verdade.
 *   - Responsável entra por CONVITE do motorista (o vínculo com a criança
 *     tem que existir antes da conta).
 *   - Motorista entra por LISTA DE PARCEIROS (não há autocadastro: cada
 *     parceiro é liberado por nós — ver a nota de arquitetura no README do
 *     fluxo).
 * Por isso a segunda etapa desta folha é a escolha de papel, e não um
 * formulário de cadastro.
 *
 * Dentro do navegador embutido do WhatsApp/Instagram, nada disso aparece
 * antes da ponte: o OAuth do Google recusa a webview e a sessão criada lá
 * fica presa nela.
 */
export default function LoginSheet({ open, onClose, onWantPartner }) {
  const { login } = useAuth();
  const navigate = useNavigate();

  // 'login' (o padrão, quem já tem conta) ou 'novo' (quem é você?).
  const [step, setStep] = useState('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [bridgeDismissed, setBridgeDismissed] = useState(false);

  const showBridge = isInAppBrowser() && !bridgeDismissed;
  const googleWorks = canUseGoogleSignIn();

  // Email e senha começam escondidos — a folha abre com uma porta só. Onde
  // o Google não funciona (webview, navegador antigo) o formulário JÁ vem
  // aberto: ali ele não é alternativa, é a única entrada.
  const [mostrarForm, setMostrarForm] = useState(!googleWorks);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Preencha email e senha.');
      return;
    }
    setSubmitting(true);
    try {
      await login(email, password);
      // A Home redireciona quando o profile carregar — o role vem de lá.
    } catch (err) {
      toast.error(mapAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Login com Google: só vale pra quem JÁ tem cadastro.
   *
   * A checagem e a LIMPEZA moram no serviço (`loginWithGoogleExistingOnly`):
   * o login social cria o usuário no Auth antes de qualquer verificação
   * nossa, então uma conta sem perfil é apagada na hora, ali dentro. Antes
   * cada tela de login repetia esse cuidado — e a terceira ia esquecer.
   *
   * Aqui só resta o que é de interface: quem não tem acesso vai pra escolha
   * de papel, com a mensagem que o serviço já escreveu.
   */
  const onGoogleLogin = async () => {
    setGoogleSubmitting(true);
    try {
      const { profile: userProfile } = await loginWithGoogleExistingOnly();
      toast.success(`Bem-vindo, ${userProfile.name || 'Tio'}!`);
    } catch (err) {
      if (err?.code === 'app/no-profile') {
        setStep('novo');
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

  const fechar = () => {
    setStep('login');
    // A folha volta ao estado simples: quem reabre encontra a mesma porta
    // única da primeira vez, e não o formulário que ele abriu ontem.
    setMostrarForm(!googleWorks);
    onClose?.();
  };

  /* ─── etapa 2: quem não tem conta ─── */
  if (step === 'novo') {
    return (
      <Sheet
        open={open}
        onClose={fechar}
        icon={Users}
        eyebrow="primeira vez aqui"
        title="Quem é você?"
        subtitle="Os dois caminhos são diferentes — depois disso, entrar é só entrar."
      >
        <div className="space-y-3">
          <RoleCard
            tone="indigo"
            icon={Users}
            title="Sou pai ou mãe"
            detail="Recebi (ou vou receber) o convite do motorista"
            onClick={() => navigate('/first-access')}
          />
          <RoleCard
            tone="emerald"
            icon={Bus}
            title="Sou motorista escolar"
            detail="Quero ser associado e usar o app na minha rota"
            onClick={() => {
              if (onWantPartner) {
                setStep('login');
                onWantPartner();
              } else {
                navigate('/quero-fazer-parte');
              }
            }}
          />

          <SheetCard>
            <p className="text-sm font-bold text-text">
              Como o app te reconhece
            </p>
            <p className="mt-1 text-xs leading-relaxed text-textMuted">
              Depois que sua conta existe, você não escolhe mais nada: o app
              sabe se você é responsável ou motorista e abre a sua tela.
            </p>
          </SheetCard>

          <button
            type="button"
            onClick={() => setStep('login')}
            className="tap inline-flex w-full items-center justify-center gap-1.5 py-2 text-sm font-semibold text-textMuted hover:text-text"
          >
            <ArrowLeft size={15} />
            Já tenho conta
          </button>
        </div>
      </Sheet>
    );
  }

  /* ─── etapa 1: entrar ─── */
  return (
    <Sheet
      open={open}
      onClose={fechar}
      icon={LogIn}
      eyebrow="quem já tem conta"
      title="Entrar"
      subtitle="Motorista ou responsável — o app reconhece você pelo login."
    >
      {showBridge ? (
        <OpenInBrowser onContinueHere={() => setBridgeDismissed(true)} />
      ) : (
        <>
          {googleWorks && (
            <>
              <button
                type="button"
                onClick={onGoogleLogin}
                disabled={googleSubmitting}
                className="tap relative inline-flex h-14 w-full items-center justify-center gap-2.5 overflow-hidden rounded-2xl border-2 border-gray-300 bg-card text-base font-bold text-text shadow-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
              >
                <GoogleIcon size={22} />
                {googleSubmitting ? 'Entrando…' : 'Entrar com Google'}
              </button>
              <p className="mt-2 text-center text-[11px] text-textMuted">
                sem digitar nada
              </p>
            </>
          )}

          {/* O FORMULÁRIO É UMA GAVETA — ABRE E FECHA NO MESMO ALVO
            * Com o Google em cima e email + senha embaixo, a folha abria com
            * dois campos e quatro decisões pra uma tarefa que, pra quase todo
            * mundo, é UM toque. Agora ela abre com uma porta só.
            *
            * O mesmo botão abre e fecha (`aria-expanded` + seta que gira):
            * quem tocou por curiosidade não fica preso com dois campos na
            * cara, e quem tocou de propósito acha os campos onde esperava.
            * O "esqueci minha senha" vive DENTRO da gaveta porque ele precisa
            * do email digitado ali pra mandar o link de redefinição.
            *
            * Quem não pode usar o Google (webview, navegador antigo) abre
            * direto com o formulário e SEM o alvo de fechar: ali ele não é
            * alternativa, é a única entrada — e esconder a única porta é
            * trancar a casa. */}
          {googleWorks && (
            <button
              type="button"
              onClick={() => setMostrarForm((v) => !v)}
              aria-expanded={mostrarForm}
              className="tap mt-4 inline-flex w-full items-center justify-center gap-1.5 py-2 text-sm font-semibold text-textMuted hover:text-text"
            >
              <Lock size={14} />
              Entrar com email e senha
              <ChevronDown
                size={15}
                className={`transition-transform duration-300 ${
                  mostrarForm ? 'rotate-180' : ''
                }`}
              />
            </button>
          )}

          {mostrarForm && (
            <div className="animate-step-in">
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
                  autoFocus={googleWorks}
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
                <SheetGhost type="submit" loading={submitting}>
                  Entrar
                  <ArrowRight size={17} />
                </SheetGhost>

                <button
                  type="button"
                  onClick={onForgotPassword}
                  disabled={resetting}
                  className="block w-full text-sm text-textMuted hover:text-text disabled:opacity-50"
                >
                  {resetting ? 'Enviando…' : 'Esqueci minha senha'}
                </button>
              </form>
            </div>
          )}

          {/* A porta de quem ainda não tem conta — discreta, porque a maioria
            * de quem abre esta folha já é cadastrada. */}
          <button
            type="button"
            onClick={() => setStep('novo')}
            className="tap mt-6 flex w-full items-center gap-3 rounded-2xl border border-dashed border-gray-300 p-4 text-left hover:bg-card"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Users size={17} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-text">
                Criar cadastro
              </span>
              <span className="block text-xs text-textMuted">
                Primeira vez aqui — responsável ou motorista.
              </span>
            </span>
            <ArrowRight size={16} className="shrink-0 text-textMuted" />
          </button>
        </>
      )}
    </Sheet>
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
