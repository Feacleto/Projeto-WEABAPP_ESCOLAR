import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bus,
  ChevronDown,
  CircleX,
  CreditCard,
  Lock,
  Mail,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Sheet from '../components/common/Sheet';
import Logo from '../components/common/Logo';
import GoogleIcon from '../components/common/GoogleIcon';
import { useAuth } from '../hooks/useAuth';
import { painelDe } from '../dominio/identidade/papeis';
import { CENA_ENTRADA, travessar } from '../marca/travessia';
import { veioDaFamilia, frenteDoCaminho, FRENTE_FAMILIA } from '../dominio/vitrine/frentes';
import { SITE_INSTITUCIONAL } from '../config/vitrine';
import { resetPassword, loginComGoogle } from '../services/authService';
import OpenInBrowser from '../components/auth/OpenInBrowser';
import Reveal from '../components/common/Reveal';
import { canUseGoogleSignIn, isInAppBrowser } from '../compartilhado/browserEnv';
import { mensagemDeAuth } from '../dominio/identidade/authErrors';

/**
 * A ÚNICA PORTA DE ENTRADA — motorista, responsável e dono.
 *
 * DESDE 04/10/2026 ELA É UMA TELA LIMPA NO VERDE (modelo C, escolhido pelo
 * dono): a marca, uma frase e os botões. Era duas colunas com quatro
 * benefícios, a frase da família, cartões de exemplo do app e uma
 * apresentação animada na primeira visita — informação demais para uma porta
 * de entrar. O que o app faz foi para a folha "Conhecer o app".
 *
 * NO CELULAR A MARCA NÃO SOME: a mãe que abre o link do WhatsApp num
 * aparelho barato é justamente quem mais precisa reconhecer onde está antes
 * de digitar e-mail e senha.
 *
 * NINGUÉM ESCOLHE PAPEL AQUI, e isso é decisão. O papel já está na conta, e
 * `painelDe()` resolve o destino depois do login. Tela de "sou motorista / sou
 * responsável" antes de autenticar obriga a pessoa a saber como o sistema é
 * organizado por dentro — e erra com quem é os dois.
 */
export default function Login() {
  const { login, user, profile, loading: authLoading, refreshProfile } = useAuth();
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

  // O E-MAIL PODE CHEGAR PRONTO de quem acabou de redefinir a senha.
  //
  // `AuthAction` termina em "Entrar com a senha nova" e manda o endereço pelo
  // `state`. Antes ela caía aqui com os dois campos vazios — e o e-mail é
  // justamente o campo que ela pode não lembrar qual usou.
  const [email, setEmail] = useState(location.state?.email || '');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  // Assumimos que admin existe até confirmar — evita "flicker" do link de bootstrap

  // ── A ABA, E POR QUE ELA PODE VIR DA URL ──────────────────────────
  //
  // A landing mora em OUTRO domínio, então ela não tem como passar `state`
  // na navegação: o botão "criar conta" de lá só consegue mandar um endereço.
  // `?criar=1` é esse endereço. Sem ele, quem clica em "criar conta" no site
  // cai na aba de entrar e precisa descobrir a segunda aba sozinho — que é
  // exatamente o passo perdido que este trabalho veio consertar.
  const [aba, setAba] = useState(() =>
    new URLSearchParams(location.search || '').get('criar') ? 'criar' : 'entrar'
  );

  // Mesmo tratamento da folha de convite: dentro do navegador embutido do
  // WhatsApp/Instagram, o Google recusa o OAuth e a sessão criada aqui fica
  // presa no armazenamento da webview. Então a ponte pro navegador de
  // verdade vem antes, e o Google nem aparece.
  const inApp = isInAppBrowser();
  const googleWorks = canUseGoogleSignIn();
  const [bridgeDismissed, setBridgeDismissed] = useState(false);
  const showBridge = inApp && !bridgeDismissed;

  /* EMAIL E SENHA ATRÁS DE UM TOQUE, E NÃO LADO A LADO COM O GOOGLE.
   *
   * Não é preferência de layout: lado a lado, as duas portas parecem
   * equivalentes, e a que pede menos AGORA (digitar dois campos que ela acha
   * que lembra) cobra mais DEPOIS — senha é usada raramente, e por isso é
   * esquecida; a recuperação sai por email, que boa parte das famílias não
   * lê. O Google não tem esse custo: quem cuida da lembrança é o Google.
   *
   * O `AuthSheet` do convite já fazia exatamente isto, com o rótulo "Não uso
   * Google — entrar com email". Aqui o rótulo encurtou para "Usar email"
   * (02/10/2026, pedido do dono): o botão do Google ficou cheio e verde, e o
   * link embaixo dele só precisa existir, não argumentar. Desde 03/10/2026
   * os dois são peças comuns (`BotaoDoGoogle` e `LinkDoEmail`), com UM nome
   * em toda tela: "Entrar com Google" e "Entrar com e-mail".
   *
   * ⚠️ QUANDO O GOOGLE NÃO FUNCIONA, O FORMULÁRIO APARECE SOZINHO. Dentro da
   * webview do WhatsApp o Google recusa OAuth, então ali email e senha não é
   * a exceção — é a única porta que existe. Esconder atrás de um link uma
   * porta que é a única seria trancar quem não conseguiu sair pro navegador. */
  const [mostrarEmail, setMostrarEmail] = useState(false);

  // Email e senha aparecem no lugar dos botões quando ela pede, e sozinhos
  // quando o Google não funciona (webview) — ali eles são a única porta.
  const formularioAberto = showBridge || !googleWorks || mostrarEmail;
  const [conhecer, setConhecer] = useState(false);

  // Já logado? Redireciona pelo role.
  //
  // A cortina sobe ANTES da navegação, sobre esta tela, e não desmonta na
  // troca de rota — então o painel nunca pisca antes de ser coberto.
  //
  // ⚠️ SESSÃO SEM DOCUMENTO EM `users` TAMBÉM É DESTINO, E ANTES ERA UM POÇO.
  //
  // A condição era `profile?.role`, ou seja: quem entrava com e-mail e senha
  // e não tinha documento em `users` não navegava para lugar nenhum — o
  // efeito não disparava, o `catch` do submit não era acionado, e a tela
  // ficava IDÊNTICA. A pessoa concluía que a senha estava errada e ia
  // redefinir uma senha que estava certa.
  //
  // Isso não é caso de borda: é o estado de quem teve o cadastro recusado
  // pelas rules no meio do caminho (a conta do Auth nasce antes do
  // documento), e é a `/comecar` que existe justamente para resolvê-lo.
  //
  // `painelDe()` já responde `/comecar` para perfil sem papel, e é o que o
  // `PrivateRoute` e o login com Google fazem. Esta tela era a única que
  // tratava "sem perfil" como condição de ESPERA em vez de destino.
  useEffect(() => {
    if (authLoading || !user) return;

    if (profile?.role) {
      const target = painelDe(profile);
      travessar(CENA_ENTRADA, profile.role);
      navigate(location.state?.from || target, { replace: true });
      return;
    }

    // Autenticado e sem papel: a sala de espera pergunta o que ele FEZ
    // (recebi convite / tenho uma perua) em vez de tentar adivinhar.
    navigate('/comecar', { replace: true });
  }, [authLoading, user, profile, navigate, location.state]);

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
      // ⚠️ CONTEXTO `reset`, NÃO `entrar`.
      //
      // `ENTRAR` responde "Email ou senha incorretos." a `user-not-found` — e
      // aqui ela não digitou senha nenhuma. Ela lia uma frase sobre senha,
      // voltava ao formulário e tentava de novo, em laço. `reset` tem frase
      // própria, discreta (não confirma se a conta existe) e cobre os códigos
      // de configuração, que antes vazavam em inglês.
      toast.error(mensagemDeAuth(err, 'reset'));
    } finally {
      setResetting(false);
    }
  };

  return (
    /**
     * ESTA TELA SAI DO CONTÊINER DO APP, E POR DOIS CAMINHOS.
     *
     * O #root tem teto de 480px porque o app é de bolso. A porta é outra
     * coisa: quem chega nela veio de um site de largura cheia.
     *
     * 1. `data-painel="web"` solta o teto pela regra `:has()` do index.css,
     *    que é o mecanismo que o painel do dono já usa.
     * 2. `w-screen` com `left-1/2` e `-translate-x-1/2` é a GARANTIA: ocupa a
     *    largura da janela mesmo se a regra de cima não pegar.
     *
     * O `overflow-x: clip` do #root, que já existe como rede contra rolagem
     * lateral, é o que impede o 100vw de arrastar a página de lado.
     */
    <div data-painel="web" className="relative left-1/2 w-screen -translate-x-1/2">
      {/* ── A TELA LIMPA (modelo C, 04/10/2026, escolhido pelo dono) ─────
        *
        * Era duas colunas: a faixa verde com quatro benefícios e uma frase
        * da família, e do outro lado o cartão, com cartões de exemplo do app
        * em volta — informação demais para uma porta de entrar, e quem só
        * queria entrar se perdia. Agora a tela inteira é verde, com a marca,
        * a frase e os botões perto do polegar. O que o app faz mora na folha
        * "Conhecer o app", para quem tocar.
        *
        * Os mesmos botões no celular e no computador: no monitor a coluna
        * só fica no meio. */}
      <div className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-gradient-to-br from-primary to-primaryDark px-6 pb-6 pt-5 text-white">
        {/* O disco e a onda da marca, apagados: dizem de que marca é a porta
          * sem competir com a frase. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-24 h-[26rem] w-[26rem] rounded-full bg-primaryDark/50"
        />
        <svg
          aria-hidden
          viewBox="0 0 200 200"
          className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 text-accent/25"
        >
          <path d="M40 190A150 150 0 0 1 190 40" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <path d="M78 192A114 114 0 0 1 192 78" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>

        <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col lg:max-w-3xl">
          <div className="flex items-center justify-between gap-3">
            {/* O LOGO É A PORTA DE SAÍDA PRA VITRINE, e é sempre a mesma: a
              * casa da marca é a landing, venha a pessoa de onde vier. `<a>` e
              * não `<Link>`: é outro domínio. */}
            <a
              href={SITE_INSTITUCIONAL}
              aria-label="Conhecer o Alô Buzinou"
              className="tap -my-2 block w-fit max-w-full rounded-lg py-2"
            >
              <Logo variant="lockup" tone="onDark" height={34} className="max-w-full" />
            </a>
            {/* Quem veio da `/familia` tem o "Voltar" (pra ela é um passo
              * atrás). Os outros já têm a saída pro site: o logo e o "Ver o
              * site" no fim da folha. */}
            {daFamilia && (
              <Link
                to="/familia"
                className="tap inline-flex min-h-12 items-center gap-1 px-1 text-base font-semibold text-primaryChip hover:text-white"
              >
                <ArrowLeft size={18} /> Voltar
              </Link>
            )}
          </div>
          <h1 className="sr-only">Alô Buzinou</h1>

          <div className="flex flex-1 flex-col justify-center py-10 lg:items-center lg:text-center">
            <p className="text-balance font-display text-[34px] font-extrabold leading-[1.05] tracking-[-0.035em] text-white lg:text-[44px]">
              Você faz seu transporte.
              <span className="block text-primaryBorder">O app avisa, cobra e organiza.</span>
            </p>
          </div>

          <div className="space-y-3 lg:mx-auto lg:w-full lg:max-w-md">
            {aba === 'criar' ? (
              <CartaoBranco>
                <CriarConta navigate={navigate} showBridge={showBridge} />
                <button
                  type="button"
                  onClick={() => setAba('entrar')}
                  className="tap flex min-h-12 w-full items-center justify-center text-base font-semibold text-textBody"
                >
                  Já tenho conta
                </button>
              </CartaoBranco>
            ) : formularioAberto ? (
              <CartaoBranco>
                {showBridge && <OpenInBrowser onContinueHere={() => setBridgeDismissed(true)} />}
                <form onSubmit={onSubmit} className={`space-y-3 ${showBridge ? 'hidden' : ''}`}>
                  <Input semSalvar
                    type="email"
                    inputMode="email"
                    label="Email"
                    placeholder="Digite aqui"
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
                    placeholder="Digite aqui"
                    icon={Lock}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  {/* Antes do botão: quem não lembra a senha precisa achar
                    * isto ANTES de errar três vezes. */}
                  <button
                    type="button"
                    onClick={onForgotPassword}
                    disabled={resetting}
                    className="tap ml-auto block min-h-12 whitespace-nowrap text-base font-semibold text-primary disabled:opacity-50"
                  >
                    {resetting ? 'Enviando...' : 'Esqueci minha senha'}
                  </button>
                  <Button type="submit" loading={submitting}>
                    Entrar
                  </Button>
                </form>
                {googleWorks && !showBridge && (
                  <button
                    type="button"
                    onClick={() => setMostrarEmail(false)}
                    className="tap flex min-h-12 w-full items-center justify-center text-base font-semibold text-textBody"
                  >
                    Voltar
                  </button>
                )}
              </CartaoBranco>
            ) : (
              <>
                {/* ⚠️ O ÚNICO BOTÃO CHEIO DA TELA, e branco porque está sobre o
                  * verde. "Começar" e não "Entrar": quem chega é, na maioria,
                  * gente nova, e o Google serve aos dois (a conta nasce no
                  * primeiro toque). A família, que veio pelo convite, lê
                  * "Entrar". */}
                <BotaoGoogleBranco
                  loading={googleSubmitting}
                  onClick={onGoogleLogin}
                  rotulo={daFamilia ? 'Entrar com Google' : 'Começar com Google'}
                />
                {/* ⚠️ QUEM NÃO USA O GOOGLE TAMBÉM CRIA CONTA DAQUI (04/10/2026).
                  * "Usar email" só ENTRAVA: quem chegava sem conta e sem Google
                  * não tinha caminho. A família continua com o "Usar email" —
                  * a conta dela nasce pelo link do convite. */}
                {daFamilia ? (
                  <button
                    type="button"
                    onClick={() => setMostrarEmail(true)}
                    className="tap flex min-h-12 w-full items-center justify-center text-base font-semibold text-white"
                  >
                    Usar email
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => navigate('/quero-fazer-parte', { state: { de: 'login' } })}
                      className="tap flex min-h-12 w-full items-center justify-center text-base font-semibold text-white"
                    >
                      Criar conta com e-mail
                    </button>
                    <button
                      type="button"
                      onClick={() => setMostrarEmail(true)}
                      className="tap flex min-h-12 w-full items-center justify-center text-base font-semibold text-primaryChip"
                    >
                      Já tenho conta
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setConhecer(true)}
                  aria-haspopup="dialog"
                  className="tap mx-auto flex min-h-12 items-center justify-center gap-1.5 rounded-full border border-white/30 bg-white/[0.08] px-5 text-base font-bold text-white"
                >
                  Conhecer o app <ChevronDown size={18} aria-hidden />
                </button>
              </>
            )}

            <div className="flex flex-wrap items-center justify-center gap-x-3 text-sm text-primaryChip">
              {/* `py-3`: 44px de altura de toque. */}
              <Link to="/termos" className="py-3 hover:underline">
                Termos de Uso
              </Link>
              <span aria-hidden>·</span>
              <Link to="/privacidade" className="py-3 hover:underline">
                Política de Privacidade
              </Link>
            </div>
          </div>
        </div>
      </div>

      <ConhecerOApp
        open={conhecer}
        onClose={() => setConhecer(false)}
        loading={googleSubmitting}
        onGoogle={() => {
          setConhecer(false);
          onGoogleLogin();
        }}
        googleWorks={googleWorks && !showBridge}
        rotulo={daFamilia ? 'Entrar com Google' : 'Começar com Google'}
      />
    </div>
  );
}

/** O cartão branco que aparece no lugar dos botões (email, criar conta). */
function CartaoBranco({ children }) {
  return <div className="space-y-3 rounded-2xl bg-card p-5 text-text shadow-float">{children}</div>;
}

/** O Google sobre o verde: branco, letra verde, o ícone numa pastilha. */
function BotaoGoogleBranco({ loading = false, onClick, rotulo }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="tap flex min-h-14 w-full items-center justify-center gap-3 whitespace-nowrap rounded-2xl bg-card px-4 text-lg font-bold text-primary shadow-float disabled:opacity-70"
    >
      {loading ? (
        'Entrando...'
      ) : (
        <>
          <span className="flex h-[28px] w-[28px] items-center justify-center rounded-full bg-bg">
            <GoogleIcon size={17} />
          </span>
          {rotulo}
        </>
      )}
    </button>
  );
}

/**
 * O QUE O APP FAZ — a folha "Conhecer o app" (04/10/2026, texto aprovado pelo
 * dono). Na ordem de importância para o motorista e para a família: a
 * mensalidade primeiro. Cada item é um título que já diz tudo e UMA linha:
 * quem chega lê a primeira frase de cada bloco e pula o resto.
 *
 * ⚠️ NENHUMA LINHA PROMETE O QUE O APP NÃO FAZ. "Direto pra você" é verdade
 * (a mensalidade é PIX do pai para o motorista, a plataforma não entra no
 * caminho) e é o argumento de confiança mais forte da tela. Sem preço, prazo
 * nem escassez: a folha apresenta, não vende.
 */
const O_QUE_O_APP_FAZ = [
  { icone: CreditCard, titulo: 'A mensalidade organizada', texto: 'Quem pagou, quem falta, e o PIX direto pra você.' },
  { icone: CircleX, titulo: 'A falta avisada antes', texto: 'Você sabe antes de sair de casa.' },
  { icone: BadgeCheck, titulo: 'O app com a sua marca', texto: 'Seu nome, seu logo e sua cor.' },
];

function ConhecerOApp({ open, onClose, loading, onGoogle, googleWorks, rotulo }) {
  return (
    <Sheet open={open} onClose={onClose} title="Tudo na sua mão.">
      <div className="space-y-4 pb-1">
        <ul>
          {O_QUE_O_APP_FAZ.map((item, i) => (
            <li key={item.titulo} className={`flex gap-3 py-3 ${i > 0 ? 'border-t border-neutro' : ''}`}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primaryChip text-primary">
                <item.icone size={20} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-base font-bold text-text">{item.titulo}</span>
                <span className="block text-base leading-snug text-textBody">{item.texto}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="text-base leading-snug text-textBody">
          <b className="text-text">E também:</b> rota montada sozinha e lembrete da mensalidade pra família.
        </p>
        {googleWorks && (
          <Button loading={loading} onClick={onGoogle} className="!whitespace-nowrap">
            {!loading && (
              <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-card">
                <GoogleIcon size={16} />
              </span>
            )}
            {rotulo}
          </Button>
        )}
        {/* O site no fim, pequeno e discreto: quem quer mais lê lá. */}
        <a
          href={SITE_INSTITUCIONAL}
          className="tap mx-auto flex min-h-12 w-fit items-center gap-1 px-2 text-sm text-textMuted underline underline-offset-4"
        >
          Ver o site <ArrowUpRight size={14} aria-hidden />
        </a>
      </div>
    </Sheet>
  );
}

/**
 * CRIAR CONTA — SÓ A PERGUNTA (chega por `?criar=1`, o botão do site).
 *
 * A aba já pediu o código do convite, e era um erro: código é coisa de
 * responsável, e o motorista concluía que precisava de um para se cadastrar.
 * Ela não cadastra ninguém: FAZ A PERGUNTA e manda cada um pra tela que é
 * dele. PESOS DIFERENTES, DE PROPÓSITO: a porta do motorista é cheia e vem
 * primeiro; a da família é de contorno — ele paga e usa o dia inteiro, ela
 * chega pelo link dele em 9 de 10 casos.
 *
 * ⚠️ A PORTA DA FAMÍLIA DIZIA "um link ou um código", e o código saiu do
 * destino em 09/09/2026. Prometer aqui uma entrada que a próxima tela não
 * oferece é o defeito mais barato de criar e o mais caro de descobrir.
 *
 * O `state` diz de onde a pessoa veio, e é o que faz o "Voltar" das duas
 * telas retornar pra cá em vez de jogar pra fora do app.
 */
function CriarConta({ navigate, showBridge }) {
  return (
    <>
      <div>
        <h2 className="text-xl font-bold text-text">Criar conta</h2>
        <p className="mt-0.5 text-base text-textMuted">
          Pra ver o app funcionando com a sua turma, ele precisa saber quem é
          você. Primeiro, quem você é?
        </p>
      </div>
      {!showBridge && (
        <Reveal className="space-y-3">
          <button
            type="button"
            onClick={() => navigate('/quero-fazer-parte', { state: { de: 'escolha' } })}
            className="tap relative block w-full overflow-hidden rounded-2xl bg-primary p-4 text-left transition-colors duration-estado hover:bg-primaryDark"
          >
            <Bus
              size={92}
              aria-hidden
              className="pointer-events-none absolute -bottom-4 -right-3 text-white/[0.07]"
            />
            <span className="rotulo relative block text-menta">quem dirige a perua</span>
            <span className="relative mt-2 block text-base font-extrabold tracking-tight text-white">
              Eu dirijo a perua
            </span>
            <span
              className="rise relative mt-1 block text-base leading-snug text-primaryChip"
              style={{ '--d': '160ms' }}
            >
              Você organiza rota, avisos, contrato e mensalidade num lugar só.
            </span>
            <span
              className="rise relative mt-4 flex h-12 items-center justify-center gap-1.5 rounded-xl bg-accent text-base font-bold text-onAccent"
              style={{ '--d': '260ms' }}
            >
              Criar minha conta <ArrowRight size={16} />
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/first-access', { state: { de: 'escolha' } })}
            className="tap relative block w-full overflow-hidden rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary"
          >
            <span className="rotulo block text-primary">quem recebe o convite</span>
            <span className="mt-2 block text-base font-extrabold tracking-tight text-text">
              Meu filho anda na perua
            </span>
            <span
              className="rise mt-1 block text-base leading-snug text-textMuted"
              style={{ '--d': '340ms' }}
            >
              Você recebeu um link do motorista — ou ainda vai pedir um pra ele.
            </span>
            <span
              className="rise mt-3 inline-flex min-h-12 items-center gap-1.5 text-base font-semibold text-primary"
              style={{ '--d': '420ms' }}
            >
              Entrar pelo convite <ArrowRight size={16} />
            </span>
          </button>
        </Reveal>
      )}
    </>
  );
}
