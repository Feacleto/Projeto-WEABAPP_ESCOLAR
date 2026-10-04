import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Bus,
  CircleX,
  CreditCard,
  Lock,
  Mail,
  Plus,
  Route,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import GoogleIcon from '../components/common/GoogleIcon';
import Logo from '../components/common/Logo';
import { useAuth } from '../hooks/useAuth';
import { painelDe } from '../dominio/identidade/papeis';
import FundoDoLogin, {
  TexturaDoFundo,
  TiraDoLogin,
} from '../components/auth/FundoDoLogin';
import { CENA_ENTRADA, travessar } from '../marca/travessia';
import { veioDaFamilia, frenteDoCaminho, FRENTE_FAMILIA } from '../dominio/vitrine/frentes';
import { SITE_INSTITUCIONAL } from '../config/vitrine';
import { resetPassword, loginComGoogle } from '../services/authService';
import OpenInBrowser from '../components/auth/OpenInBrowser';
import Reveal from '../components/common/Reveal';
import { canUseGoogleSignIn, isInAppBrowser } from '../compartilhado/browserEnv';
import { mensagemDeAuth } from '../dominio/identidade/authErrors';
import useTeatroDoLogin, { PASSO } from '../components/auth/useTeatroDoLogin';

/**
 * O QUE O APP TIRA DO OMBRO DELE — as quatro linhas do painel.
 *
 * ⚠️ CADA UMA FALA DO DIA DELE, NÃO DO SOFTWARE. "A família sabe que você
 * chegou", nunca "sistema de notificações". Quem lê esta tela está decidindo
 * se troca o caderninho por um aplicativo, e nome de recurso não responde isso.
 *
 * ⚠️ E NÃO HÁ PRAZO, PREÇO NEM ESCASSEZ AQUI. Sem "3 meses", sem "grátis", sem
 * contador de vagas. A tela convida a ver funcionando; o pedágio é ter conta, e
 * quem diz isso é o subtítulo do cartão.
 *
 * "O dinheiro vai direto pra você" é a ÚNICA linha de negócio da lista, e ela
 * está lá porque a objeção nº 1 de quem nunca usou app é achar que a plataforma
 * fica com um percentual. Ela TIRA uma dúvida, não vende.
 *
 * "não gasta combustível pra buscar quem não vai" é o argumento mais forte da
 * lista: é dinheiro no bolso dele, e caderninho nenhum entrega isso.
 */
const BENEFICIOS = [
  {
    icone: Route,
    titulo: 'A rota do dia já montada',
    texto:
      'Você cadastra a sua turma e a rota aparece na ordem dos horários combinados.',
  },
  {
    icone: Bell,
    titulo: 'A família sabe que você chegou',
    texto:
      'O celular dela toca quando a perua está chegando. Você não fica esperando na porta.',
  },
  {
    icone: CircleX,
    titulo: 'A falta avisada antes',
    texto:
      'Quando a criança não vai, você sabe antes de sair — e não gasta combustível pra buscar quem não vai.',
  },
  {
    icone: CreditCard,
    titulo: 'A mensalidade cobrada sozinha',
    texto:
      'Quem pagou, quem está aberto, e o seu PIX pronto pra usar. O dinheiro vai direto pra você.',
  },
];

/** "A rota do dia já montada" → "Rota do dia já montada": a grade 2×2 do
 * celular não tem largura pro artigo. */
const tituloCurto = (t) => {
  const sem = t.replace(/^A /, '');
  return sem.charAt(0).toUpperCase() + sem.slice(1);
};

/**
 * O PAINEL TROCA DE ARGUMENTO QUANDO A ABA TROCA (só no monitor).
 *
 * São dois estados mentais. Em "já tenho conta" a maioria é usuário voltando, e
 * o painel é lembrete de valor. Em "criar conta" a pessoa já se interessou e
 * precisa SE RECONHECER — daí o caderninho, a planilha e as cobranças no
 * WhatsApp, que é o que ela faz hoje.
 */
const CAIXAS = [
  { titulo: 'A rota do dia', texto: 'Pronta antes de você sair da garagem.' },
  {
    titulo: 'O aviso de chegada',
    texto: 'Toca no celular da família pra ela se preparar pra sua chegada.',
  },
  {
    titulo: 'A mensalidade',
    texto: 'Quem pagou, quem falta, e o seu PIX pronto pra receber.',
  },
  {
    titulo: 'O contrato',
    texto: 'Assinado no app e guardado pra consultar a qualquer momento.',
  },
];

/** As duas abas do cartão, na ordem em que aparecem. */
const ABAS = [
  { id: 'entrar', rotulo: 'Já tenho conta' },
  { id: 'criar', rotulo: 'Criar conta' },
];

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
  const ehEntrar = aba === 'entrar';

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
   * link embaixo dele só precisa existir, não argumentar.
   *
   * ⚠️ QUANDO O GOOGLE NÃO FUNCIONA, O FORMULÁRIO APARECE SOZINHO. Dentro da
   * webview do WhatsApp o Google recusa OAuth, então ali email e senha não é
   * a exceção — é a única porta que existe. Esconder atrás de um link uma
   * porta que é a única seria trancar quem não conseguiu sair pro navegador. */
  const [mostrarEmail, setMostrarEmail] = useState(false);

  // ── O TEATRO DO CELULAR ───────────────────────────────────────────
  //
  // O cartão do MOTORISTA no celular ganhou uma apresentação de primeira
  // visita e um cartão próprio (sem abas, título de ação, "Criar conta
  // grátis" no topo). A família continua com o cartão de abas: ela chega
  // pelo link do motorista e não precisa ser convencida de nada.
  //
  // `celular` é lido uma vez: girar o aparelho no meio não troca o cartão.
  const [celular] = useState(
    () =>
      typeof window !== 'undefined' &&
      !!window.matchMedia?.('(max-width: 1023.98px)').matches
  );
  const cartaoDoMotorista = celular && ehEntrar && !daFamilia;
  const cartaoRef = useRef(null);
  const tiraRef = useRef(null);
  const teatro = useTeatroDoLogin({
    ativo: cartaoDoMotorista,
    // Quem chega com contexto está VOLTANDO (sessão expirada, senha nova):
    // essa pessoa quer entrar, não assistir.
    apresentar: !location.state?.from && !location.state?.email && !inApp,
    cartaoRef,
    tiraRef,
  });
  /** Classe de entrada de um passo: invisível até o teatro chegar nele. */
  const surge = (p) =>
    `transition-[opacity,transform] duration-entrada ease-freio motion-reduce:transition-none ${
      teatro.visto(p) ? '' : 'translate-y-3 opacity-0'
    }`;
  const criarContaDeMotorista = () =>
    navigate('/quero-fazer-parte', { state: { de: 'login' } });

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
    // (recebi convite / tenho uma van) em vez de tentar adivinhar.
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
    /**
     * ESTA TELA SAI DO CONTÊINER DO APP, E POR DOIS CAMINHOS.
     *
     * O #root tem teto de 480px porque o app é de bolso — motorista e
     * responsável usam o produto na rua, com uma mão. A porta é outra coisa:
     * quem chega nela veio de um site de largura cheia.
     *
     * 1. `data-painel="web"` solta o teto pela regra `:has()` do index.css,
     *    que é o mecanismo que o painel do dono já usa.
     * 2. `w-screen` com `left-1/2` e `-translate-x-1/2` é a GARANTIA: ocupa a
     *    largura da janela mesmo se a regra de cima não pegar. Sem ela o modo
     *    de falhar é o pior possível — as classes `lg:` ativam (breakpoint
     *    olha a VIEWPORT, não o contêiner) e espremem duas colunas em 480px,
     *    o que fica pior que a versão empilhada.
     *
     * O `overflow-x: clip` do #root, que já existe como rede contra rolagem
     * lateral, é o que impede o 100vw de arrastar a página de lado.
     */
    <div
      data-painel="web"
      className="relative left-1/2 w-screen -translate-x-1/2"
    >
      {/* Duas colunas só a partir de lg (1024px). Em md, um cartão de 380px
        * dividindo 768px deixaria a faixa da marca com menos de 340px — e
        * empilhada é melhor que uma coluna apertada. */}
      <div className="flex min-h-screen flex-col lg:grid lg:grid-cols-[minmax(0,46fr)_minmax(0,54fr)]">

        {/* ── A faixa da marca ───────────────────────────────────────── */}
        <div className="relative flex flex-col overflow-hidden rounded-b-3xl bg-gradient-to-br from-primary to-primaryDark px-6 pb-24 pt-6 lg:justify-between lg:rounded-none lg:px-14 lg:py-12">
          {/* DUAS FORMAS, E NENHUMA DELAS DISPUTA COM O TEXTO.
            *
            * O disco embaixo à esquerda ancora a faixa — sem ele o verde é um
            * retângulo chapado, e a coluna toda parece um placeholder. O arco
            * fino em cima à direita é a onda da marca, e é o único traço com
            * desenho: ele diz de que marca é a porta sem repetir o logotipo,
            * que já está no meio.
            *
            * Os dois vivem a 8% e 24%. É pouco de propósito: a porta não é
            * lugar de enfeite, e qualquer contraste a mais aqui competiria
            * com a única frase que a pessoa precisa ler. */}
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-32 -left-24 h-[26rem] w-[26rem] rounded-full bg-primaryDark/50"
          />
          <svg
            aria-hidden
            viewBox="0 0 200 200"
            className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 text-accent/25"
          >
            <path
              d="M40 190A150 150 0 0 1 190 40"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="M78 192A114 114 0 0 1 192 78"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>

          {/* "VER O SITE" NO LUGAR DO "VOLTAR", para quem veio do site.
            * "Voltar" numa porta de entrada soava como "você entrou no lugar
            * errado". No celular ele vira uma pílula no canto, ao lado da
            * marca, e libera a linha que ocupava. Quem veio da `/familia`
            * continua com o "Voltar": pra ela é mesmo um passo atrás. */}
          <VoltarTag
            {...voltarProps}
            className={`tap z-10 inline-flex w-fit items-center gap-1 text-primaryChip hover:text-white lg:relative lg:-ml-1 lg:min-h-12 lg:px-1 lg:text-sm ${
              daFamilia
                ? 'relative -ml-1 min-h-12 px-1 text-sm'
                : 'absolute right-4 top-[18px] min-h-11 whitespace-nowrap rounded-full border border-white/30 bg-white/[0.06] px-3.5 text-[13px] font-semibold lg:border-0 lg:bg-transparent lg:font-normal'
            } ${surge(PASSO.site)}`}
          >
            {daFamilia ? (
              <>
                <ArrowLeft size={16} /> Voltar
              </>
            ) : (
              <>
                Ver o site <ArrowUpRight size={14} />
              </>
            )}
          </VoltarTag>

          <div className={`relative z-10 lg:mt-0 ${daFamilia ? 'mt-5' : 'mt-0'}`}>
            {/* O LOGO É A PORTA DE SAÍDA PRA VITRINE, e é sempre a mesma.
              *
              * Clicar na marca pra voltar ao site é gesto de web que a pessoa
              * já traz de fora — e aqui ela veio de fora, de um site com esta
              * marca no canto. Sem isso a marca era enfeite: a única saída era
              * o "Voltar", que fica no alto e não parece um caminho.
              *
              * DESTINO ÚNICO, diferente do "Voltar" ali em cima, que tem dois:
              * ele desfaz o passo que a pessoa deu (volta pra `/familia` se foi
              * de lá), enquanto o logo é a marca — e a casa da marca é a
              * landing, venha ela de onde vier. `<a>` e não `<Link>`: é outro
              * domínio, e o roteador montaria caminho relativo.
              *
              * Teto em volta do logo: ele é vetor e escala, mas sem limite de
              * largura ele é CORTADO quando a faixa aperta — foi o que
              * aconteceu enquanto esta tela vivia dentro dos 480px. */}
            <a
              href={SITE_INSTITUCIONAL}
              aria-label="Conhecer o Alô Buzinou"
              // -my-2 py-2: a área de toque do logo passa de 34 para 50px sem
              // mexer no desenho (04/10/2026, medido).
              className={`tap -my-2 block w-fit max-w-full rounded-lg py-2 ${surge(PASSO.logo)}`}
            >
              <Logo
                variant="lockup"
                tone="onDark"
                height={34}
                className="max-w-full lg:hidden"
              />
              <Logo
                variant="lockup"
                tone="onDark"
                height={50}
                className="hidden max-w-full lg:block"
              />
            </a>
            {/* O logo já diz o nome em desenho. O h1 continua existindo pra
              * leitor de tela não perder o cabeçalho da página. */}
            <h1 className="sr-only">Alô Buzinou</h1>

            {/* ⚠️ ESTA TELA É MAIS ACESSADA QUE A LANDING, e por muito tempo
              * usou 46% de um monitor para dizer uma frase, com 400px de vazio
              * no meio. Era o espaço de marca mais visto do produto, e estava
              * mudo.
              *
              * O trabalho dele agora é APRESENTAR O APP. Sem preço, prazo nem
              * escassez: o convite é mostrar o que sai do ombro do motorista,
              * e o pedágio para ver funcionando é ter conta — quem diz isso é
              * o subtítulo do cartão, não este painel.
              *
              * ── POR QUE DUAS VERSÕES DO MIOLO
              * No monitor ele troca com a aba (lembrete de valor × se
              * reconhecer). No CELULAR ele é sempre a lista, porque ali ele
              * também precisa COLAPSAR — e um painel que troca de conteúdo E
              * de altura ao mesmo tempo é duas coisas se explicando de uma
              * vez. */}

            {/* ══ CELULAR ══════════════════════════════════════════════ */}
            <div className="lg:hidden">
              <p className="mt-4 font-display text-[21px] font-extrabold leading-[1.12] tracking-[-0.03em] text-white">
                <span className={`block ${surge(PASSO.frase1)}`}>
                  Você faz seu transporte.
                </span>
                <span className={`block text-primaryBorder ${surge(PASSO.frase2)}`}>
                  O app avisa, cobra e organiza.
                </span>
              </p>

              {/* ⚠️ GRADE 2×2, SÓ TÍTULOS — e o "Ver tudo o que tem dentro"
                * saiu em 02/10/2026.
                *
                * A lista em linhas, mais o botão de expandir, empurrava o
                * cartão de entrar pra baixo e fazia dele mais uma coisa na
                * tela, quando ele é A coisa. Em grade os quatro cabem em metade
                * da altura e o cartão sobe por cima do verde. As descrições
                * continuam no monitor, onde há espaço.
                *
                * No teatro os quatro entram um por vez (passos 5 a 8). */}
              <ul className="mt-4 grid grid-cols-2 gap-2">
                {BENEFICIOS.map((b, i) => (
                  <li
                    key={b.titulo}
                    className={`flex items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.07] px-2.5 py-2 ${surge(
                      PASSO.beneficio + i
                    )}`}
                  >
                    <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg bg-primaryBorder/15 text-primaryBorder">
                      <b.icone size={15} />
                    </span>
                    <span className="min-w-0 text-[12.5px] font-semibold leading-tight text-white">
                      {tituloCurto(b.titulo)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* ══ MONITOR ══════════════════════════════════════════════ */}
            <div className="hidden lg:block">
              {ehEntrar ? (
                <>
                  {/* Sem teto de largura: a coluna já limita, e um `max-w` em `ch` num
                    * corpo de 42px quebrava "Você faz seu transporte." em duas
                    * linhas num monitor de 1280 — quatro linhas de título onde
                    * cabem três. */}
                  <p className="mt-8 font-display text-[42px] font-extrabold leading-[1.06] tracking-[-0.03em] text-white">
                    Você faz seu transporte.
                    <br />
                    <span className="text-primaryBorder">
                      O app avisa, cobra e organiza.
                    </span>
                  </p>

                  <ul className="mt-8 max-w-[34rem]">
                    {BENEFICIOS.map((b, i) => (
                      <li
                        key={b.titulo}
                        className={`flex gap-4 border-t border-white/[0.14] py-4 ${
                          i === BENEFICIOS.length - 1 ? 'border-b' : ''
                        }`}
                      >
                        <span className="mt-0.5 flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-xl bg-primaryBorder/15 text-primaryBorder">
                          <b.icone size={18} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[16.5px] font-bold leading-snug text-white">
                            {b.titulo}
                          </span>
                          <span className="mt-1 block text-sm leading-relaxed text-primaryChip">
                            {b.texto}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>

                  <p className="mt-6 max-w-[52ch] text-[14.5px] leading-relaxed text-primaryChip">
                    E do outro lado, a família avisa quando a criança não vai e
                    vê as mensalidades —{' '}
                    <strong className="font-semibold text-white">
                      no app que leva o seu logo e o seu nome
                    </strong>
                    .
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-8 max-w-[18ch] text-balance font-display text-[42px] font-extrabold leading-[1.06] tracking-[-0.03em] text-white">
                    O caderninho, a planilha e as cobranças no WhatsApp.
                    <br />
                    <span className="text-primaryBorder">
                      Faça tudo nesse app.
                    </span>
                  </p>

                  <div className="mt-8 grid max-w-[540px] grid-cols-2 gap-3">
                    {CAIXAS.map((c) => (
                      <div
                        key={c.titulo}
                        className="rounded-2xl border border-white/[0.13] bg-white/[0.08] p-4"
                      >
                        <p className="text-[15.5px] font-bold leading-snug text-white">
                          {c.titulo}
                        </p>
                        <p className="mt-1 text-[13.5px] leading-relaxed text-primaryChip">
                          {c.texto}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* ⚠️ A ÚNICA LINHA DE RESPEITO PROFISSIONAL DA TELA, e ela
                    * existe porque o medo dele não é tecnologia — é parecer
                    * que entregou o controle do próprio negócio a um
                    * aplicativo. */}
                  <p className="mt-6 max-w-[50ch] text-[15.5px] leading-relaxed text-white">
                    A gente não vem te ensinar a dirigir nem a cuidar de
                    criança.{' '}
                    <strong className="font-bold text-primaryBorder">
                      Nisso você já é bom.
                    </strong>{' '}
                    A gente vem tirar o resto do seu ombro.
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="relative z-10 hidden text-xs text-primaryChip lg:block">
            alobuzinou.com.br
          </div>
        </div>

        {/* ── O cartão ───────────────────────────────────────────────────
          * ⚠️ O LADO DO CARTÃO É CLARO, e antes era escuro com fundo animado.
          *
          * Cartão branco sobre fundo escuro põe a superfície de MAIOR contraste
          * da tela ao lado da faixa da marca, que também é escura: duas áreas
          * densas competindo, e o olho não sabe qual é o assunto. Sobre o cinza
          * claro, o cartão é a única coisa acesa da metade direita — ele deixa
          * de ser um retângulo flutuando e passa a ser a folha onde se
          * preenche.
          *
          * O `FundoNoturno` saiu daqui junto — e em 03/10/2026 saiu também das
          * duas telas de cadastro: o dono decidiu que dentro do app não existe
          * tela escura (ela ficou só no site), e o sistema só permite
          * movimento contínuo no "ao vivo". */}
        {/* ── A COLUNA DIREITA, E O FUNDO QUE MOSTRA O APP ───────────
          *
          * Ela era uma superfície branca com um cartão no meio — e como o
          * login é a tela MAIS ACESSADA do produto (mais que a landing),
          * aquele vazio era o maior espaço de produto do app sem nada dentro.
          * O que entrou está em
          * [FundoDoLogin](../components/auth/FundoDoLogin.jsx): três cartões
          * que mostram o app rodando e TROCAM DE ASSUNTO com a aba.
          *
          * ⚠️ O CARTÃO FICA CENTRADO. A primeira versão encostava ele à
          * direita para abrir a faixa do fundo — e isso funcionava em 1340px
          * e ficava errado acima: numa tela de 1900 o formulário ia para a
          * borda e sobrava um buraco de ~320px no meio. Agora os cartões de
          * fundo penduram na ESQUERDA do card (`right: calc(50% + …)`), então
          * a distância entre os dois é a mesma em qualquer largura.
          *
          * O preço é a largura mínima: com o card no centro, o espaço à
          * esquerda dele é metade do que sobra, e o fundo só cabe a partir de
          * **1800px**. A conta está no cabeçalho do componente. */}
        <div className="relative flex flex-1 items-start justify-center bg-bg px-4 pb-8 sm:px-6 lg:items-center lg:px-10 lg:py-8">
          {/* A textura vale em TODA largura — inclusive no celular, onde ela
            * é a única peça do fundo que cabe. Custa duas `div`. */}
          <TexturaDoFundo />
          <FundoDoLogin
            assunto={aba}
            assuntos={['entrar', 'criar']}
            desde={1800}
            largura={380}
          />
          {/* O ENVELOPE existe pela TIRA. A coluna é um flex que centra,
            * então a tira solta ficaria AO LADO do formulário; dentro do
            * envelope ela fica embaixo, na largura dele. */}
          {/* No celular o envelope SOBE 80px por cima do verde: o cartão de
            * entrar é a maior coisa da tela e começa ainda dentro da marca.
            * No foco do teatro ele passa por cima do escuro (z 40). */}
          <div
            className="relative z-10 w-full max-w-[380px] -mt-20 lg:mt-0"
            style={teatro.escuro ? { zIndex: 40 } : undefined}
          >
            <div
              ref={cartaoRef}
              className={`space-y-4 rounded-2xl bg-card p-6 shadow-float transition-[opacity,transform] duration-entrada ease-freio motion-reduce:transition-none sm:p-7 ${
                teatro.visto(PASSO.cartao) ? '' : 'translate-y-14 scale-[.96] opacity-0'
              }`}
            >
            {/* ⚠️ O CARTÃO DO MOTORISTA NO CELULAR NÃO TEM ABAS (02/10/2026).
              * No lugar delas, um selo "Criar conta grátis" que leva direto ao
              * cadastro do motorista. As abas continuam no monitor, para a
              * família, e para quem chega por `?criar=1` — que precisa do
              * caminho de volta para "Já tenho conta". */}
            {cartaoDoMotorista && (
              <button
                type="button"
                onClick={criarContaDeMotorista}
                className="tap inline-flex items-center gap-1.5 rounded-full border border-primaryBorder bg-primarySoft px-3.5 py-2.5 text-[13px] font-semibold text-primary"
              >
                <Plus size={14} /> Criar conta grátis
              </button>
            )}
            {/* ── DUAS ABAS, UMA TELA ─────────────────────────────────
              * "Cadastrar" era um link no rodapé do cartão que levava pra
              * `/comecar` — e `/comecar` devolve pro login quem não tem
              * sessão. Quem clicava sem estar logado voltava pra esta mesma
              * tela sem nada ter acontecido: a saída do cadastro só existia
              * DEPOIS do Google, que é justamente o passo que a pessoa ainda
              * não deu.
              *
              * Aba em vez de rota porque as duas são a mesma conversa com
              * dois começos, e trocar de tela pra descobrir que era a tela
              * errada cobra o pedágio duas vezes. Trocar de aba não cria
              * sessão nenhuma: só o botão cria.
              */}
            {/* ⚠️ ELAS VIRARAM UM CONTROLE SEGMENTADO em 08/09/2026, e antes
              * eram duas abas sublinhadas.
              *
              * O sublinhado é o padrão de aba de CONTEÚDO — o que muda embaixo
              * dele é informação da mesma natureza. Aqui as duas metades são
              * ações OPOSTAS: uma devolve quem já tem conta, a outra cria uma.
              * A pastilha é o padrão de escolha entre dois estados, e ela
              * mostra o estado atual como um objeto sólido em vez de um traço.
              *
              * O QUE ISTO DESFAZ: as duas letras verdes em negrito que o dono
              * pediu no dia 07. A cor da marca saiu da letra e voltou para o
              * estado — a pastilha branca é o que anuncia onde a pessoa está,
              * e duas letras iguais em cima de uma pastilha resolvem sozinhas.
              * O texto ativo é `text` (15,6:1) e o inativo `textMuted`
              * (6,4:1 sobre o trilho), então nenhuma das duas depende de cor
              * de marca para ser legível. */}
            {!cartaoDoMotorista && (
            <div
              role="tablist"
              aria-label="Entrar ou criar conta"
              className="grid grid-cols-2 gap-1 rounded-xl bg-neutro p-1"
            >
              {ABAS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="tab"
                  id={`aba-${a.id}`}
                  aria-selected={aba === a.id}
                  aria-controls="painel-conta"
                  onClick={() => setAba(a.id)}
                  /* AS DUAS ABAS SÃO VERDES E EM NEGRITO — é a marca na porta,
                   * e a porta é a primeira coisa que qualquer pessoa vê.
                   *
                   * ⚠️ MAS O VERDE DA LETRA NÃO É O #52C41A DO LOGOTIPO.
                   * Aquele é o verde das ondas sobre o fundo ESCURO; aqui o
                   * cartão é branco, e ele daria 2,3:1 — o próprio logotipo
                   * troca de tom em fundo claro (`TONES.color` em Logo.jsx)
                   * pelo mesmo motivo. `accentText` é o verde da marca quando
                   * ele precisa ser PALAVRA: 7,1:1 sobre o cartão.
                   *
                   * O #52C41A continua aqui, no SUBLINHADO — ali ele é massa,
                   * não letra, e é onde ele pode ser ele mesmo. É a regra 2 da
                   * cor (tailwind.config.js), e este par está em
                   * `npm run testar:contraste`.
                   *
                   * O QUE SEPARA A ABA ATIVA passou a ser o sublinhado, já que
                   * a cor da letra agora é a mesma nas duas. Por isso ele
                   * engrossou e ganhou o verde-limão: com duas letras iguais,
                   * um traço fino em verde-escuro não anunciaria nada.
                   *
                   * ⚠️ E A INATIVA NÃO LEVA `opacity`. A tentação era apagar a
                   * aba de trás com 70% — só que opacidade sobre texto é
                   * mistura com o fundo: o mesmo `accentText` cairia de 7,1:1
                   * para 3,5:1 e reprovaria. É o erro que as seis opacidades
                   * de branco do rodapé já custaram aqui (ver `onNightMuted`
                   * no tailwind.config.js). O sublinhado carrega o estado
                   * sozinho — e ele não é a única pista: o painel de baixo
                   * troca junto. */
                  className={`tap rounded-lg px-2 py-2 text-[13px] font-bold transition-colors ${
                    aba === a.id
                      ? 'bg-card text-text shadow-rest'
                      : 'text-textMuted hover:text-text'
                  }`}
                >
                  {a.rotulo}
                </button>
              ))}
            </div>
            )}

            {showBridge && (
              <OpenInBrowser onContinueHere={() => setBridgeDismissed(true)} />
            )}

            <div
              id="painel-conta"
              role="tabpanel"
              aria-labelledby={cartaoDoMotorista ? undefined : `aba-${aba}`}
              aria-label={cartaoDoMotorista ? 'Entrar' : undefined}
              className="space-y-4"
            >
              {ehEntrar ? (
                <>
                  {cartaoDoMotorista ? (
                    /* ⚠️ O TÍTULO É UM CONVITE À AÇÃO, não o nome da tela.
                     * "Entrar" é rótulo de sistema e ninguém lê. A parte que
                     * importa leva o marca-texto, e a seta embaixo da van
                     * aponta pro botão: o olho vai do título direto pra ele. */
                    <h2 className="relative min-h-[84px] pr-24 text-[30px] font-extrabold leading-[1.04] tracking-[-0.035em] text-text">
                      <span className="mb-0.5 block text-[17px] font-bold tracking-[-0.01em] text-textMuted">
                        Comece a
                      </span>
                      <span
                        className={`marca-texto ${
                          teatro.visto(PASSO.cartao) ? '' : 'marca-texto-apagado'
                        }`}
                      >
                        facilitar seu trampo
                      </span>
                      <VanDaPorta fora={!teatro.visto(PASSO.cartao)} />
                    </h2>
                  ) : (
                    <div>
                      <h2 className="text-xl font-bold text-text">Entrar</h2>
                      <p className="mt-0.5 text-sm text-textMuted">
                        Motorista ou família — a entrada é a mesma.
                      </p>
                    </div>
                  )}

                  {/* Google em destaque — opção principal pra reduzir fricção
                    * (não precisa digitar email/senha). Email/senha vem depois.
                    *
                    * `whitespace-nowrap`: o rótulo quebrava em TRÊS linhas
                    * quando o cartão apertava, e botão de três linhas não lê
                    * como botão. */}
                  {!showBridge && googleWorks && (
                    <>
                      {/* CHEIO E VERDE: é o único botão cheio do cartão, e é
                        * ele que o teatro aponta, pulsa e deixa aceso. */}
                      <Button
                        loading={googleSubmitting}
                        onClick={() => {
                          teatro.pararPulso();
                          teatro.apagarEscuro();
                          onGoogleLogin();
                        }}
                        className={`pulso-google !whitespace-nowrap !font-bold ${
                          teatro.pulsando
                            ? 'pulso-sempre'
                            : teatro.visto(PASSO.pulso) && teatro.passo < PASSO.foco
                              ? 'pulso-2x'
                              : ''
                        }`}
                      >
                        {!googleSubmitting && (
                          <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-card">
                            <GoogleIcon size={16} />
                          </span>
                        )}
                        Entrar com Google
                      </Button>

                      {!mostrarEmail && (
                        <button
                          type="button"
                          onClick={() => setMostrarEmail(true)}
                          className="tap w-full py-2 text-center text-sm font-semibold text-textMuted hover:text-text"
                        >
                          Usar email
                        </button>
                      )}
                    </>
                  )}

                  <form
                    onSubmit={onSubmit}
                    className={`space-y-3 ${
                      showBridge || (googleWorks && !mostrarEmail) ? 'hidden' : ''
                    }`}
                  >
                    <Input
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

                    {/* Antes do botão, e alinhado à direita: quem chegou aqui e
                      * não lembra a senha precisa achar isto ANTES de errar
                      * três vezes. */}
                    <button
                      type="button"
                      onClick={onForgotPassword}
                      disabled={resetting}
                      className="tap ml-auto block whitespace-nowrap text-sm font-semibold text-primary disabled:opacity-50"
                    >
                      {resetting ? 'Enviando...' : 'Esqueci minha senha'}
                    </button>

                    <Button type="submit" loading={submitting}>
                      Entrar
                    </Button>
                  </form>
                </>
              ) : (
                /* ── CRIAR CONTA — SÓ A PERGUNTA ────────────────────────
                 * ESTA ABA JÁ PEDIU O CÓDIGO DO CONVITE, E ERA UM ERRO.
                 * O código é coisa de responsável, e o motorista é o usuário
                 * principal do produto: ele abria "Criar conta", via um campo
                 * de código como primeira coisa da tela e concluía que
                 * precisava de um código pra se cadastrar. Não precisa — a
                 * conta dele nasce de um formulário, não de um convite.
                 *
                 * Então a aba não cadastra ninguém: ela FAZ A PERGUNTA e
                 * manda cada um pra tela que é dele. Cada porta diz o que
                 * acontece depois, porque "motorista" e "responsável" são
                 * rótulos do sistema, e o que a pessoa reconhece é o que ela
                 * tem na mão: uma van, ou um convite.
                 *
                 * PESOS DIFERENTES, DE PROPÓSITO. A porta do motorista é
                 * cheia e vem primeiro; a da família é de contorno. Ele paga
                 * e usa o dia inteiro, ela chega pelo link dele em 9 de 10
                 * casos — duas portas do mesmo peso mentiriam sobre isso.
                 *
                 * O `state` diz de onde a pessoa veio, e é o que faz o
                 * "Voltar" das duas telas retornar pra cá em vez de jogar
                 * pra fora do app quem estava escolhendo.
                 */
                <>
                  <div>
                    <h2 className="text-xl font-bold text-text">Criar conta</h2>
                    <p className="mt-0.5 text-sm text-textMuted">
                      {/* ⚠️ É AQUI QUE A TELA DIZ O PEDÁGIO, e sem prometer
                        * prazo: para ver o app com a turma DELE, ele precisa de
                        * conta. O painel ao lado apresenta; esta linha explica
                        * por que existe um formulário no caminho. */}
                      Pra ver o app funcionando com a sua turma, ele precisa
                      saber quem é você. Primeiro, quem você é?
                    </p>
                  </div>

                  {/* ⚠️ O TEXTO CHEGA EM DOIS TEMPOS, e o motivo é que texto
                    * estático não é lido.
                    *
                    * As duas portas traziam, cada uma, uma frase de catorze
                    * palavras — e as quatro linhas juntas viravam um bloco que
                    * o olho pula inteiro para achar o botão. A informação é
                    * necessária (ela é o que separa "tenho uma van" de "recebi
                    * um link"), então o conserto não é apagar: é fazer com que
                    * ela CHEGUE.
                    *
                    * Primeiro tempo: o rótulo e o título das duas portas. É a
                    * resposta à pergunta do topo, e cabe num relance.
                    * Segundo tempo: a linha que confirma quem é você, e o
                    * botão. Movimento puxa o olho — o que aparece é lido, o
                    * que já estava lá é pulado.
                    *
                    * O MECANISMO JÁ EXISTIA E ESTAVA SEM USO: `Reveal` é o
                    * gatilho (um IntersectionObserver, que dispara de imediato
                    * porque o cartão já está na tela) e `.rise` escalona os
                    * filhos por `--d`. Um observer, N elementos.
                    *
                    * `prefers-reduced-motion` mostra tudo de uma vez — o
                    * `Reveal` cuida disso, e a informação nunca depende da
                    * animação para existir. */}
                  {/* ⚠️ A PORTA DO MOTORISTA ERA UM CARTÃO QUASE-PRETO, e virou
                    * VERDE em 03/10/2026. O escuro dizia "ele está comprando";
                    * o dono revogou isso — dentro do app não existe superfície
                    * escura, ela ficou só no site. O verde da marca mantém o
                    * peso de porta principal, e o limão continua sendo o botão
                    * porque ali ele está sobre verde (com a letra `onAccent`).
                    * A barra do rodapé seguiu a mesma troca. */}
                  {!showBridge && (
                    <Reveal className="space-y-3">
                      <button
                        type="button"
                        onClick={() =>
                          navigate('/quero-fazer-parte', {
                            state: { de: 'escolha' },
                          })
                        }
                        className="tap relative block w-full overflow-hidden rounded-2xl bg-primary p-4 text-left transition-colors duration-estado hover:bg-primaryDark"
                      >
                        <Bus
                          size={92}
                          aria-hidden
                          className="pointer-events-none absolute -bottom-4 -right-3 text-white/[0.07]"
                        />
                        <span className="rotulo relative block text-menta">
                          quem dirige a perua
                        </span>
                        {/* "EU DIRIJO A PERUA" e não "Sou motorista ou
                          * operador". A pessoa não se apresenta por cargo
                          * quando está escolhendo uma porta — ela se reconhece
                          * pelo que FAZ. E "operador" é palavra de cadastro,
                          * não de quem dirige. */}
                        <span className="relative mt-2 block text-base font-extrabold tracking-tight text-white">
                          Eu dirijo a perua
                        </span>
                        {/* QUATRO PALAVRAS EM VEZ DE UMA FRASE. Os quatro
                          * substantivos ERAM o conteúdo — o resto da frase só
                          * os embalava. Como lista, eles se leem num relance;
                          * como prosa, eram catorze palavras que ninguém
                          * termina. */}
                        <span
                          className="rise relative mt-1 block text-sm leading-snug text-primaryChip"
                          style={{ '--d': '160ms' }}
                        >
                          Você organiza rota, avisos, contrato e
                          mensalidade num lugar só.
                        </span>
                        {/* ⚠️ AQUI É BOTÃO CHEIO, e do outro lado é link.
                          * As duas portas continuam com pesos diferentes de
                          * propósito — ele paga e usa o dia inteiro, ela chega
                          * pelo link dele em 9 de 10 casos. O que mudou é a
                          * distância entre os dois pesos: um `<span>` com seta
                          * ao lado de outro `<span>` com seta não dizia qual
                          * era a porta principal. */}
                        <span
                          className="rise relative mt-4 flex h-11 items-center justify-center gap-1.5 rounded-xl bg-accent text-sm font-bold text-onAccent"
                          style={{ '--d': '260ms' }}
                        >
                          Criar minha conta <ArrowRight size={15} />
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          navigate('/first-access', {
                            state: { de: 'escolha' },
                          })
                        }
                        className="tap relative block w-full overflow-hidden rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary"
                      >
                        <span className="rotulo block text-primary">
                          quem recebe o convite
                        </span>
                        <span className="mt-2 block text-base font-extrabold tracking-tight text-text">
                          Meu filho anda na perua
                        </span>
                        {/* A porta da família chega DEPOIS da do motorista,
                          * e a ordem é a mesma dos pesos: ele paga e usa o dia
                          * inteiro, ela chega pelo link dele em 9 de 10 casos.
                          *
                          * ⚠️ ELA DIZIA "um link ou um código", e o código
                          * saiu do destino em 09/09/2026 — o `/first-access`
                          * não tem mais campo pra digitar. Prometer aqui uma
                          * entrada que a próxima tela não oferece é o defeito
                          * mais barato de criar e o mais caro de descobrir:
                          * quem chega com o código na mão procura o campo,
                          * não acha, e conclui que errou de tela. */}
                        <span
                          className="rise mt-1 block text-sm leading-snug text-textMuted"
                          style={{ '--d': '340ms' }}
                        >
                          Você recebeu um link do motorista — ou ainda vai
                          pedir um pra ele.
                        </span>
                        <span
                          className="rise mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
                          style={{ '--d': '420ms' }}
                        >
                          Entrar pelo convite <ArrowRight size={15} />
                        </span>
                      </button>
                    </Reveal>
                  )}
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-3 text-xs text-textMuted">
              {/* `py-3`: 44px de altura de toque num link de 12px. */}
              <Link to="/termos" className="py-3 hover:underline">
                Termos de Uso
              </Link>
              <span aria-hidden>·</span>
              <Link to="/privacidade" className="py-3 hover:underline">
                Política de Privacidade
              </Link>
            </div>
            </div>

            {/* O APP NO FIM DA TELA — só no celular. Onde o fundo
              * lateral entra (1800px), a tira sai: seriam o mesmo app
              * dito duas vezes na mesma tela. */}
            <TiraDoLogin
              ref={tiraRef}
              assunto={aba}
              ate={1800}
              moldura={cartaoDoMotorista}
              aparecidos={Math.max(0, teatro.passo - PASSO.tiraCartao + 1)}
            />
          </div>
        </div>
      </div>

      {/* ── O VÉU DO FOCO ─────────────────────────────────────────────
        * ⚠️ CLARO desde 03/10/2026 (design system): era a noite a 60%, e
        * dentro do app não existe tela escura. A areia a 80% apaga o resto
        * do mesmo jeito, sem trocar de clima no meio da primeira visita.
        * `absolute` na página inteira, e não `fixed`: o contêiner usa
        * `-translate-x-1/2`, e transform vira o referencial de `fixed`. Aqui
        * dentro ele divide o mesmo empilhamento do cartão, que passa por cima
        * com z 40. Tocar nele apaga; o Google continua pulsando. */}
      {cartaoDoMotorista && (
        <div
          aria-hidden
          onClick={teatro.apagarEscuro}
          className={`absolute inset-0 z-30 bg-bg/80 transition-opacity duration-entrada ease-freio motion-reduce:transition-none ${
            teatro.escuro ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        />
      )}

      {/* Durante o teatro, a película engole o toque e o gesto de rolar.
        * Portal pelo mesmo motivo do transform acima. */}
      {teatro.rodando &&
        createPortal(
          <div aria-hidden className="fixed inset-0 z-[70] touch-none" />,
          document.body
        )}

      {/* ── A BARRA DO RODAPÉ ─────────────────────────────────────────
        * Aparece quando o cartão de entrar SAIU DA TELA por cima — a pessoa
        * desceu até a prévia do app, que é o momento em que ela está mais
        * convencida e mais longe do botão. */}
      {cartaoDoMotorista &&
        createPortal(
          <div
            role="region"
            aria-label="Criar conta"
            className={`fixed inset-x-3 bottom-3 z-40 flex items-center gap-3 rounded-2xl bg-primary py-2.5 pl-4 pr-2.5 text-white shadow-float transition-transform duration-entrada ease-freio motion-reduce:transition-none ${
              teatro.cartaoFora ? 'translate-y-0' : 'pointer-events-none translate-y-[140%]'
            }`}
            style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <span className="min-w-0 flex-1 text-[13px] font-semibold leading-tight">
              Gostou do que viu?
              <span className="block text-xs font-normal text-primaryChip">
                Monte a sua turma no app
              </span>
            </span>
            <button
              type="button"
              onClick={criarContaDeMotorista}
              tabIndex={teatro.cartaoFora ? 0 : -1}
              className="tap shrink-0 rounded-xl bg-accent px-3.5 py-2.5 text-[13px] font-extrabold text-onAccent"
            >
              Criar conta agora
            </button>
          </div>,
          document.body
        )}
    </div>
  );
}

/**
 * A VAN DO TÍTULO — ocupa o canto direito que sobrava ao lado de "facilitar
 * seu trampo", e a seta embaixo dela aponta pro botão do Google.
 *
 * Desenho próprio, e não o `Bus` do lucide: ícone de traço a 90px vira
 * diagrama. Faixa amarela de escolar, as cores da marca.
 */
function VanDaPorta({ fora }) {
  return (
    <span aria-hidden className="pointer-events-none absolute right-0 top-1 block w-[94px]">
      <svg viewBox="0 0 96 58" className={`van-chega block w-full ${fora ? 'van-fora' : ''}`}>
        <path
          d="M6 14c0-5 4-9 9-9h46c4 0 7 2 9 5l14 16c3 3 5 6 5 10v8c0 3-2 5-5 5H11c-3 0-5-2-5-5z"
          className="fill-primary"
        />
        <path d="M6 30h85v6H6z" fill="#F5A623" />
        <rect x="13" y="11" width="15" height="13" rx="3" fill="#CFF3DA" />
        <rect x="32" y="11" width="15" height="13" rx="3" fill="#CFF3DA" />
        <path d="M51 11h11c2 0 3 1 4 2l9 11H51z" fill="#CFF3DA" />
        <rect x="84" y="38" width="6" height="4" rx="1.5" fill="#FFE29A" />
        {[25, 72].map((cx) => (
          <g key={cx} className="roda">
            <circle cx={cx} cy="48" r="8.5" fill="#0F1F17" />
            <circle cx={cx} cy="48" r="3.5" fill="#D9E1DC" />
            <path d={`M${cx} 41v3`} stroke="#D9E1DC" strokeWidth="2" />
          </g>
        ))}
      </svg>
      <svg
        viewBox="0 0 38 44"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="seta-balanca ml-auto mr-7 mt-0.5 block h-[38px] w-[32px] text-accentText"
      >
        <path d="M8 4c14 2 22 12 20 32" />
        <path d="M20 30l8 8 7-10" />
      </svg>
    </span>
  );
}
