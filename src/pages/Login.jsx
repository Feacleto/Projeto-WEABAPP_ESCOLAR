import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import GoogleIcon from '../components/common/GoogleIcon';
import Logo from '../components/common/Logo';
import { useAuth } from '../hooks/useAuth';
import { painelDe } from '../dominio/identidade/papeis';
import { CENA_ENTRADA, travessar } from '../marca/travessia';
import { veioDaFamilia, frenteDoCaminho, FRENTE_FAMILIA } from '../dominio/vitrine/frentes';
import { SITE_INSTITUCIONAL } from '../config/vitrine';
import {
  resetPassword,
  loginComGoogle,
} from '../services/authService';
import { adminExists } from '../services/inviteCodeService';
import OpenInBrowser from '../components/auth/OpenInBrowser';
import { canUseGoogleSignIn, isInAppBrowser } from '../compartilhado/browserEnv';
import { mensagemDeAuth } from '../dominio/identidade/authErrors';

/**
 * A ÚNICA PORTA DE ENTRADA — motorista, responsável e dono.
 *
 * POR QUE ELA VIROU DUAS COLUNAS EM 06/09/2026
 * Até aqui esta tela era um formulário centrado numa página em branco, e o
 * contexto vinha da home do motorista, que ficava atrás dela. Essa home foi
 * apagada: a apresentação da plataforma mudou de domínio e virou a landing
 * estática. Quem chega aqui acabou de clicar em "Entrar" num site com marca,
 * e caía num formulário sem nenhuma.
 *
 * A faixa da esquerda é essa continuidade. Ela não vende nada e não tem
 * botão — carrega a marca e uma frase, e é o que impede a tela de parecer o
 * login genérico de qualquer sistema logo depois de a pessoa ter clicado num
 * botão de marca.
 *
 * NO CELULAR ELA NÃO SOME, ENCOLHE. Some seria voltar ao problema: a mãe que
 * abre o link do WhatsApp num aparelho barato é justamente quem mais precisa
 * reconhecer onde está antes de digitar e-mail e senha.
 *
 * NINGUÉM ESCOLHE PAPEL AQUI, e isso é decisão. O papel já está na conta, e
 * `painelDe()` resolve o destino depois do login. Tela de "sou motorista / sou
 * responsável" antes de autenticar obriga a pessoa a saber como o sistema é
 * organizado por dentro — e erra com quem é os dois.
 */
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
  //
  // A cortina sobe ANTES da navegação, sobre esta tela, e não desmonta na
  // troca de rota — então o painel nunca pisca antes de ser coberto.
  useEffect(() => {
    if (!authLoading && profile?.role) {
      const target = painelDe(profile);
      travessar(CENA_ENTRADA, profile.role);
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
      toast.error(mensagemDeAuth(err, 'entrar'));
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Login com Google — para quem já tem conta E para quem está chegando.
   *
   * O serviço parou de apagar a conta órfã, então "sem perfil" deixou de ser
   * erro e virou um estado do produto: sessão válida, papel ainda não
   * escolhido. Quem cai nisso vai pra sala de espera.
   *
   * A CONTA NÃO NASCE COMO MOTORISTA, e essa é a decisão que evita o pior
   * caso: a mãe que ignora o link do convite e toca aqui viraria motorista,
   * e o `redeemInvite` recusaria o convite dela depois — ele já barra conta
   * de motorista virando responsável. Ela ficaria presa, sem saída no app.
   */
  const onGoogleLogin = async () => {
    setGoogleSubmitting(true);
    try {
      const { profile: userProfile } = await loginComGoogle();
      if (userProfile) {
        await refreshProfile();
        toast.success(`Bem-vindo, ${userProfile.name || 'Tio'}!`);
        return;
      }
      // SEM PERFIL NÃO É ERRO — é gente chegando.
      //
      // O serviço parou de apagar a conta órfã, então este caso deixou de
      // ser lixo e virou o começo do cadastro. Quem veio da porta da
      // família vai direto pro convite: o caminho dela já foi declarado, e
      // perguntar de novo seria fingir que o app não sabe.
      navigate(daFamilia ? '/first-access' : '/comecar', { replace: true });
    } catch (err) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        toast.error(mensagemDeAuth(err, 'entrar'));
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
      toast.error(mensagemDeAuth(err, 'entrar'));
    } finally {
      setResetting(false);
    }
  };

  /**
   * O "voltar" tem dois destinos, e um deles sai do app.
   *
   * Quem veio da `/familia` volta pra ela — é rota daqui. Quem chegou sem
   * contexto veio da landing, que é OUTRO domínio: `<Link>` montaria caminho
   * relativo e devolveria a pessoa pra esta mesma tela.
   */
  const voltarPara = daFamilia ? '/familia' : SITE_INSTITUCIONAL;
  const VoltarTag = daFamilia ? Link : 'a';
  const voltarProps = daFamilia ? { to: voltarPara } : { href: voltarPara };

  return (
    <div className="min-h-screen md:grid md:grid-cols-[5fr_6fr]">
      {/* ── A faixa da marca ─────────────────────────────────────────── */}
      <div className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-primary to-primaryDark px-6 py-7 md:px-12 md:py-12">
        {/* Um halo só, e atrás de tudo. A porta não é lugar de enfeite. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -right-28 h-80 w-80 rounded-full bg-accent/10"
        />

        <VoltarTag
          {...voltarProps}
          className="tap relative z-10 -ml-1 inline-flex w-fit items-center gap-1 p-1 text-sm text-onNightMuted hover:text-onNight"
        >
          <ArrowLeft size={16} /> Voltar
        </VoltarTag>

        <div className="relative z-10 mt-6 md:mt-0">
          <Logo variant="lockup" tone="onDark" height={38} className="md:hidden" />
          <Logo variant="lockup" tone="onDark" height={52} className="hidden md:block" />
          {/* O logo já diz o nome em desenho. O h1 continua existindo pra
            * leitor de tela não perder o cabeçalho da página. */}
          <h1 className="sr-only">Alô Buzinou</h1>

          {/* A frase quebra em duas alturas de propósito: a primeira diz o
            * que é, a segunda diz o que faz. O peso separa as duas funções
            * sem precisar de dois tamanhos de fonte. */}
          <p className="mt-4 max-w-[26ch] text-lg font-semibold leading-snug text-onNight md:mt-8 md:text-3xl">
            O app do transporte escolar.
            <br />
            <span className="text-onNightMuted">
              Um ambiente que avisa, cobra e organiza.
            </span>
          </p>
        </div>

        <div className="relative z-10 hidden text-xs text-onNightMuted md:block">
          alobuzinou.com.br
        </div>
      </div>

      {/* ── O cartão ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 items-center justify-center bg-bg px-5 py-8 md:px-8">
        <div className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-6 shadow-rest md:p-7">
          <div>
            <h2 className="text-xl font-bold text-text">Entrar</h2>
            <p className="mt-0.5 text-sm text-textMuted">
              Motorista, responsável ou administração.
            </p>
          </div>

          {showBridge && (
            <OpenInBrowser onContinueHere={() => setBridgeDismissed(true)} />
          )}

          {/* Google em destaque — opção principal pra reduzir fricção
            * (não precisa digitar email/senha). Email/senha vem depois. */}
          {!showBridge && googleWorks && (
            <>
              <Button
                loading={googleSubmitting}
                onClick={onGoogleLogin}
                variant="secondary"
                className="!border-borderStrong"
              >
                {!googleSubmitting && <GoogleIcon size={20} />}
                Continuar com Google
              </Button>

              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-card px-3 text-textMuted">
                    ou com email e senha
                  </span>
                </div>
              </div>
            </>
          )}

          <form
            onSubmit={onSubmit}
            className={`space-y-3 ${showBridge ? 'hidden' : ''}`}
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

            {/* Antes do botão, e alinhado à direita: quem chegou aqui e não
              * lembra a senha precisa achar isto ANTES de errar três vezes. */}
            <button
              type="button"
              onClick={onForgotPassword}
              disabled={resetting}
              className="tap ml-auto block text-sm font-semibold text-primary disabled:opacity-50"
            >
              {resetting ? 'Enviando...' : 'Esqueci minha senha'}
            </button>

            <Button type="submit" loading={submitting}>
              Entrar
            </Button>
          </form>

          {/* ── Cadastrar ────────────────────────────────────────────
            * O rodapé do cartão serve a MINORIA: quem chega no login quase
            * sempre já tem conta. Por isso é linha, não botão — destaque
            * igual ao do "Entrar" competiria com ele por nada.
            *
            * As duas saídas de trás dele (motorista e convite) chegam na
            * fase 3; hoje o link leva ao caminho do motorista, que é o
            * único que funciona sem Cloud Function. */}
          {!showBridge && (
            <div className="border-t border-border pt-4 text-center text-sm text-textMuted">
              {daFamilia ? (
                <>
                  Recebeu um convite?{' '}
                  <Link
                    to="/first-access"
                    className="font-semibold text-primary hover:underline"
                  >
                    Usar meu código
                  </Link>
                </>
              ) : (
                <>
                  Ainda não tem conta?{' '}
                  <Link
                    to="/quero-fazer-parte"
                    className="font-semibold text-primary hover:underline"
                  >
                    Cadastrar
                  </Link>
                </>
              )}
            </div>
          )}

          {/* O bootstrap do dono só aparece enquanto NÃO existe admin — e a
            * rule fecha a janela junto. Some sozinho depois do primeiro. */}
          {!hasAdmin && !daFamilia && (
            <Link
              to="/first-admin"
              className="block text-center text-xs text-textMuted underline"
            >
              Configurar primeiro administrador
            </Link>
          )}

          <div className="flex items-center justify-center gap-3 text-[11px] text-textMuted">
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
