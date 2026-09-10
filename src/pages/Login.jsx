import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Bus,
  ChevronDown,
  ChevronUp,
  CircleX,
  CreditCard,
  FileText,
  Lock,
  Mail,
  Route,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import GoogleIcon from '../components/common/GoogleIcon';
import Logo from '../components/common/Logo';
import { useAuth } from '../hooks/useAuth';
import { painelDe } from '../dominio/identidade/papeis';
import FundoDoLogin from '../components/auth/FundoDoLogin';
import { CENA_ENTRADA, travessar } from '../marca/travessia';
import { veioDaFamilia, frenteDoCaminho, FRENTE_FAMILIA } from '../dominio/vitrine/frentes';
import { SITE_INSTITUCIONAL } from '../config/vitrine';
import { resetPassword, loginComGoogle } from '../services/authService';
import { adminExists } from '../services/inviteCodeService';
import OpenInBrowser from '../components/auth/OpenInBrowser';
import Reveal from '../components/common/Reveal';
import { canUseGoogleSignIn, isInAppBrowser } from '../compartilhado/browserEnv';
import { mensagemDeAuth } from '../dominio/identidade/authErrors';

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

/**
 * A QUINTA LINHA SÓ EXISTE ABERTA, e é de propósito.
 *
 * O contrato é o que menos pesa na decisão de quem está espiando e o que mais
 * tranquiliza quem já se interessou. Então ele é a RECOMPENSA do toque, não
 * competidor da primeira tela — onde cada linha a mais empurra o formulário
 * para fora da dobra.
 */
const BENEFICIO_ABERTO = {
  icone: FileText,
  titulo: 'O contrato guardado',
  texto: 'Assinado no app e guardado pra consultar a qualquer momento.',
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
  const [hasAdmin, setHasAdmin] = useState(true);

  // ── A ABA, E POR QUE ELA PODE VIR DA URL ──────────────────────────
  //
  // A landing mora em OUTRO domínio, então ela não tem como passar `state`
  // na navegação: o botão "criar conta" de lá só consegue mandar um endereço.
  // `?criar=1` é esse endereço. Sem ele, quem clica em "criar conta" no site
  // cai na aba de entrar e precisa descobrir a segunda aba sozinho — que é
  // exatamente o passo perdido que este trabalho veio consertar.
  /* A expansão do painel no celular. Nasce FECHADA: é isso que mantém o
     cartão do formulário na primeira tela — ver o comentário do painel. */
  const [aberto, setAberto] = useState(false);
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
   * Google — entrar com email". Esta tela era a última que ainda mostrava as
   * duas de frente. Mesma decisão, mesmo texto, agora nos dois lugares.
   *
   * ⚠️ QUANDO O GOOGLE NÃO FUNCIONA, O FORMULÁRIO APARECE SOZINHO. Dentro da
   * webview do WhatsApp o Google recusa OAuth, então ali email e senha não é
   * a exceção — é a única porta que existe. Esconder atrás de um link uma
   * porta que é a única seria trancar quem não conseguiu sair pro navegador. */
  const [mostrarEmail, setMostrarEmail] = useState(false);

  useEffect(() => {
    adminExists()
      .then(setHasAdmin)
      .catch(() => setHasAdmin(true));
  }, []);

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
        <div className="relative flex flex-col overflow-hidden rounded-b-[26px] bg-gradient-to-br from-primary to-primaryDark px-6 pb-7 pt-6 lg:justify-between lg:rounded-none lg:px-14 lg:py-12">
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

          <VoltarTag
            {...voltarProps}
            className="tap relative z-10 -ml-1 inline-flex w-fit items-center gap-1 p-1 text-sm text-onNightMuted hover:text-onNight"
          >
            <ArrowLeft size={16} /> Voltar
          </VoltarTag>

          <div className="relative z-10 mt-5 lg:mt-0">
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
              className="tap block w-fit max-w-full rounded-lg"
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
              <p className="mt-4 text-[21px] font-extrabold leading-[1.12] tracking-[-0.03em] text-onNight">
                Você faz seu transporte.
                <br />
                <span className="text-primaryBorder">
                  O app avisa, cobra e organiza.
                </span>
              </p>

              {/* ⚠️ O ESTADO FECHADO É ÍCONE E TÍTULO, E NADA MAIS.
                * É a única coisa que sustenta a inversão de ordem: com as
                * descrições abertas por padrão o painel passa de ~330px para
                * ~700px, o formulário nasce fora da tela, e quem só quer
                * entrar passa a pagar pedágio por uma apresentação que não
                * pediu. A promessa inteira cabe num título. */}
              <ul className="mt-5 space-y-0">
                {(aberto ? [...BENEFICIOS, BENEFICIO_ABERTO] : BENEFICIOS).map(
                  (b, i) => (
                    <li
                      key={b.titulo}
                      className={`flex gap-3 border-t border-onNight/[0.14] py-3 ${
                        i === (aberto ? BENEFICIOS.length : BENEFICIOS.length - 1)
                          ? 'border-b'
                          : ''
                      }`}
                    >
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primaryBorder/15 text-primaryBorder">
                        <b.icone size={15} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[15px] font-bold leading-snug text-onNight">
                          {b.titulo}
                        </span>
                        {/* A descrição cresce de 0fr para 1fr: é o único jeito
                          * de animar até `auto` sem medir altura no JS. */}
                        <span
                          className={`grid transition-[grid-template-rows] duration-[240ms] ease-[cubic-bezier(.22,.9,.24,1)] motion-reduce:transition-none ${
                            aberto ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                          }`}
                        >
                          <span className="overflow-hidden">
                            <span className="block pt-1 text-[13px] leading-relaxed text-primaryChip">
                              {b.texto}
                            </span>
                          </span>
                        </span>
                      </span>
                    </li>
                  )
                )}
              </ul>

              <span
                className={`grid transition-[grid-template-rows] duration-[240ms] ease-[cubic-bezier(.22,.9,.24,1)] motion-reduce:transition-none ${
                  aberto ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                }`}
              >
                <span className="overflow-hidden">
                  <span className="block pt-4 text-[13.5px] leading-relaxed text-primaryChip">
                    E do outro lado, a família avisa quando a criança não vai e
                    vê as mensalidades —{' '}
                    <strong className="font-semibold text-onNight">
                      no app que leva o seu logo e o seu nome
                    </strong>
                    .
                  </span>
                </span>
              </span>

              {/* ⚠️ O RÓTULO PROMETE CONTEÚDO, e a seta avisa que a página
                * CRESCE — então ninguém teme que o formulário desapareça.
                * "Saiba mais" e "Sobre o app" não dizem nem uma coisa nem
                * outra.
                *
                * Fechado ele tem fundo, aberto é só contorno: o convite pesa
                * mais que o recuo. E ele fica NO MESMO LUGAR nos dois estados,
                * para o caminho de volta ser onde a mão já está.
                *
                * Sem `scrollIntoView`: a pessoa está lendo de cima para baixo,
                * e mover a página sob o dedo dela é desorientador. */}
              <button
                type="button"
                onClick={() => setAberto((v) => !v)}
                aria-expanded={aberto}
                className={`tap mt-4 flex h-[46px] w-full items-center justify-center gap-2 rounded-[13px] border border-primaryBorder/30 text-[14.5px] font-bold text-primaryBorder transition-colors ${
                  aberto ? 'bg-transparent' : 'bg-primaryBorder/[0.14]'
                }`}
              >
                {aberto ? 'Ver menos' : 'Ver tudo o que tem dentro'}
                {aberto ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
              </button>
            </div>

            {/* ══ MONITOR ══════════════════════════════════════════════ */}
            <div className="hidden lg:block">
              {ehEntrar ? (
                <>
                  {/* Sem teto de largura: a coluna já limita, e um `max-w` em `ch` num
                    * corpo de 42px quebrava "Você faz seu transporte." em duas
                    * linhas num monitor de 1280 — quatro linhas de título onde
                    * cabem três. */}
                  <p className="mt-8 text-[42px] font-extrabold leading-[1.06] tracking-[-0.03em] text-onNight">
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
                        className={`flex gap-4 border-t border-onNight/[0.14] py-4 ${
                          i === BENEFICIOS.length - 1 ? 'border-b' : ''
                        }`}
                      >
                        <span className="mt-0.5 flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-xl bg-primaryBorder/15 text-primaryBorder">
                          <b.icone size={18} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[16.5px] font-bold leading-snug text-onNight">
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
                    <strong className="font-semibold text-onNight">
                      no app que leva o seu logo e o seu nome
                    </strong>
                    .
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-8 max-w-[18ch] text-balance text-[42px] font-extrabold leading-[1.06] tracking-[-0.03em] text-onNight">
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
                        className="rounded-2xl border border-onNight/[0.13] bg-onNight/[0.08] p-4"
                      >
                        <p className="text-[15.5px] font-bold leading-snug text-onNight">
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
                  <p className="mt-6 max-w-[50ch] text-[15.5px] leading-relaxed text-onNight">
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

          <div className="relative z-10 hidden text-xs text-onNightMuted lg:block">
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
          * O `FundoNoturno` saiu daqui junto. Ele continua nas duas telas de
          * cadastro, onde a faixa ocupa a tela inteira no celular e o
          * movimento tem espaço para existir. */}
        {/* ── A COLUNA DIREITA, E POR QUE O CARTÃO SAI DO CENTRO ──────
          *
          * Ela era uma superfície branca com um cartão no meio — e como o
          * login é a tela MAIS ACESSADA do produto (mais que a landing),
          * aquele vazio era o maior espaço de produto do app sem nada dentro.
          * O que entrou está em
          * [FundoDoLogin](../components/auth/FundoDoLogin.jsx): três cartões
          * que mostram o app rodando e TROCAM DE ASSUNTO com a aba.
          *
          * ⚠️ O CARTÃO ENCOSTA À DIREITA, E ISSO É GEOMETRIA, NÃO ESTÉTICA.
          * Centrado, sobram ~159px de cada lado numa tela de 1440 — e nenhum
          * cartão de fundo cabe em 159px sem ser cortado. Nenhum ajuste de
          * altura resolve, porque o problema é o eixo X. Encostado, abre uma
          * faixa livre de ~300px à esquerda, que é onde (e só onde) o fundo
          * vive.
          *
          * ⚠️ E OS DOIS ANDAM NO MESMO BREAKPOINT, de propósito. O
          * `min-[1340px]` aqui é o mesmo que liga o fundo (a conta está no
          * cabeçalho dele). Empurrar o cartão para a direita sem o fundo
          * deixaria uma faixa vazia de 300px do lado, que não lê como
          * respiro — lê como coisa que não carregou.
          *
          * O efeito colateral é bom: cartão mais perto do painel verde põe
          * marca e ação no mesmo eixo de leitura. */}
        <div className="relative flex flex-1 items-center justify-center bg-bg px-4 py-8 sm:px-6 lg:px-10 min-[1340px]:justify-end min-[1340px]:py-10 min-[1340px]:pl-10 min-[1340px]:pr-[52px]">
          <FundoDoLogin assunto={aba} assuntos={['entrar', 'criar']} desde={1340} />
          <div className="relative z-10 w-full max-w-[380px] space-y-4 rounded-2xl border border-border bg-card p-6 shadow-float sm:p-7">
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

            {showBridge && (
              <OpenInBrowser onContinueHere={() => setBridgeDismissed(true)} />
            )}

            <div
              id="painel-conta"
              role="tabpanel"
              aria-labelledby={`aba-${aba}`}
              className="space-y-4"
            >
              {ehEntrar ? (
                <>
                  <div>
                    <h2 className="text-xl font-bold text-text">Entrar</h2>
                    <p className="mt-0.5 text-sm text-textMuted">
                      Motorista ou família — a entrada é a mesma.
                    </p>
                  </div>

                  {/* Google em destaque — opção principal pra reduzir fricção
                    * (não precisa digitar email/senha). Email/senha vem depois.
                    *
                    * `whitespace-nowrap`: o rótulo quebrava em TRÊS linhas
                    * quando o cartão apertava, e botão de três linhas não lê
                    * como botão. */}
                  {!showBridge && googleWorks && (
                    <>
                      <Button
                        loading={googleSubmitting}
                        onClick={onGoogleLogin}
                        variant="secondary"
                        className="!whitespace-nowrap !border-borderStrong"
                      >
                        {!googleSubmitting && <GoogleIcon size={20} />}
                        Continuar com Google
                      </Button>

                      {!mostrarEmail && (
                        <button
                          type="button"
                          onClick={() => setMostrarEmail(true)}
                          className="tap w-full py-2 text-sm font-semibold text-primary"
                        >
                          Não uso Google — entrar com email
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
                  {!showBridge && (
                    <Reveal className="space-y-3">
                      <button
                        type="button"
                        onClick={() =>
                          navigate('/quero-fazer-parte', {
                            state: { de: 'escolha' },
                          })
                        }
                        className="tap relative block w-full overflow-hidden rounded-2xl border border-night bg-night p-4 text-left shadow-float transition-colors hover:border-onNightAccent"
                      >
                        <Bus
                          size={92}
                          strokeWidth={1.4}
                          aria-hidden
                          className="pointer-events-none absolute -bottom-4 -right-3 text-white/[0.07]"
                        />
                        <span className="relative block font-mono text-[10px] uppercase tracking-[0.18em] text-onNightAccent">
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
                          className="rise relative mt-1 block text-sm leading-snug text-onNightMuted"
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
                          className="rise relative mt-4 flex h-11 items-center justify-center gap-1.5 rounded-xl bg-accent text-sm font-bold text-[#06210A]"
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
                        <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
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

            {/* O bootstrap do dono só aparece enquanto NÃO existe admin — e a
              * rule fecha a janela junto. Some sozinho depois do primeiro. */}
            {!hasAdmin && !daFamilia && ehEntrar && (
              <Link
                to="/first-admin"
                className="block text-center text-xs text-textMuted underline"
              >
                Configurar primeiro administrador
              </Link>
            )}

            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-textMuted">
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
    </div>
  );
}
