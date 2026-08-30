import { useEffect, useRef, useState, useMemo } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import {
  ArrowRight,
  ChevronDown,
  Gift,
  Check,
  Mail,
  MapPin,
  Phone,
  Star,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import Reveal from '../components/common/Reveal';
import Logo from '../components/common/Logo';
import PhoneDemo from '../components/landing/PhoneDemo';
import ReviewsBlock from '../components/landing/ReviewsBlock';
import QuestionsBlock from '../components/landing/QuestionsBlock';
import ConsultorButton from '../components/landing/ConsultorButton';
import StepsSequence from '../components/landing/StepsSequence';
import LoginSheet from '../components/landing/LoginSheet';
import WaitlistSheet from '../components/landing/WaitlistSheet';
import {
  ArtBadge,
  ArtRoad,
  ArtScreens,
  ArtSeats,
  ArtSteps,
} from '../components/landing/BlockArt';
import { functions } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { painelDe } from '../utils/papeis';
import { comPiso } from '../config/vitrine';
import { frenteLembrada, lembrarFrente, FRENTE_FAMILIA } from '../utils/frentes';
import {
  listPublicTestimonials,
  getPublicRatingStats,
} from '../services/feedbackService';
import {
  DEV_CITY,
  DEV_CNPJ,
  DEV_EMAIL,
  DEV_PHONE_DISPLAY,
  devMailLink,
  devWhatsAppLink,
} from '../config/developer';
import { frasesDaRodada } from '../config/rodada';
import { APP_VERSION } from '../version';

/**
 * Home pública do Alô Buzinou — a porta da rua.
 *
 * PRA QUEM ELA FALA
 * Pro MOTORISTA ESCOLAR, do primeiro ao último bloco. O pai também cai aqui
 * (o link do convite passa por essa porta), e ele entende tudo — mas a
 * comunicação não é dividida ao meio: cada bloco existe pra convencer o tio
 * a virar associado. Até o que o PAI ganha é
 * argumento pro tio ("a família para de te ligar"), e não uma seção à parte.
 * Quem já tem conta resolve no "Entrar" do hero; quem quer o app pra ele tem
 * o convite sempre à mão, na barra flutuante.
 *
 * UM BLOCO POR VEZ (scroll-snap)
 * A home não é um texto corrido: é uma sequência de respostas. Cada bloco
 * ocupa a tela inteira e o scroll ancora nele (`snap-y snap-mandatory` no
 * container, `snap-start` em cada seção). As três perguntas que o tio ouve
 * todo dia são TRÊS blocos, um por gesto de rolagem: pergunta e resposta
 * juntas na tela, sem parágrafo. Quem dirige o dia inteiro não lê ensaio.
 *
 * O container é um scroller PRÓPRIO (h-[100svh] overflow-y-auto), não o
 * body — snap no body briga com a barra de endereço que aparece e desaparece
 * no Chrome do Android, e o bloco fica sempre 60px fora de lugar.
 *
 * UM FUNDO SÓ, PRA TODOS OS BLOCOS
 * O fundo escuro com os brilhos esmeralda e a malha é um único layer FIXO
 * atrás de tudo (não uma cópia por seção): assim cada bloco chega com
 * exatamente o mesmo fundo do hero, sem costura na troca e sem pintar oito
 * gradientes grandes de uma vez. Em cima dele, cartão é vidro (branco a
 * 5,5% + borda a 10%), nunca branco sólido.
 *
 * MOVIMENTO
 * Cada bloco abre com uma arte animada em CSS (BlockArt.jsx) que diz do que
 * ele trata antes da primeira palavra. Cada seção é um <Reveal once={false}>,
 * então SOBE de novo toda vez que entra na tela; dentro dela, os filhos
 * `.rise` sobem escalonados por `--d` — um observer, vários elementos.
 *
 * DECISÕES DE CREDIBILIDADE
 * Todo número aqui vem do banco: famílias atendidas, nota média e
 * depoimentos reais. Nada de "+1000 clientes" ou selo inventado — com um
 * parceiro e dezoito famílias, a honestidade é o argumento mais forte que
 * existe. As telas do demo, ao contrário, são mock em CSS com dados
 * fictícios: print de tela real vazaria nome e endereço de criança.
 */

/**
 * Logo do único associado de hoje.
 *
 * Está fixo aqui de propósito, e com data de validade: enquanto o parceiro
 * não subir a marca dele (e enquanto a home rodar sem backend, no ambiente
 * local), a seção ficava com uma caixa tracejada dizendo "estamos começando"
 * — pior que a verdade, porque já existe um associado e ele tem marca.
 *
 * A VITRINE NÃO USA MAIS A FOTO DE PERFIL, E ISSO NÃO É DETALHE.
 * O `getShowcase` devolve o `photoURL` do motorista pra QUALQUER visitante
 * (é callable com Admin SDK, roda sem login), e esta tela renderizava esse
 * campo. Ou seja: o rosto que ele subiu numa tela de perfil — que sempre foi
 * privada — aparecia na internet, e ninguém nunca lhe perguntou. É a mesma
 * forma do bug do `allowPhoto` no depoimento: publicar imagem de pessoa sem
 * um "sim" explícito pra ESSE uso.
 *
 * Então a vitrine só mostra MARCA: o logo do parceiro, ou o nome desenhado
 * como marca. Quando existir um campo de imagem de marca com consentimento
 * (a camada de parceiro em desenho prevê `brandImageURL` + `brandKind`), a
 * vitrine passa a ler ELE — nunca o avatar do perfil.
 */
const LOGO_ASSOCIADO = '/parceiros/tio-nino.webp';
const NOME_ASSOCIADO = 'Tio Nino Digital';

// Cartão de vidro — o único jeito de um cartão existir sobre o fundo escuro.
const GLASS = 'bg-white/[0.055] border border-white/10 rounded-3xl';
// Folga no pé do bloco pra barra flutuante do convite não cobrir conteúdo.
const CLEAR_CTA = 'pb-32';

/**
 * O CONVITE: uma frase só, em todas as telas.
 *
 * POR QUE NÃO VARIA MAIS POR BLOCO
 * A barra flutuante chega sozinha em cima do conteúdo, sem texto em volta pra
 * explicar o que ela é. Botão que muda de frase a cada tela fica bonito, mas
 * o visitante nunca aprende PRA ONDE ele vai se tocar. Com a frase fixa, na
 * segunda tela ele já reconhece o objeto: mesma cor, mesma posição, mesma
 * promessa, mesmo destino. O que muda de tela pra tela é o conteúdo do bloco
 * — o botão é a constante da página, não a variável.
 *
 * POR QUE "LISTA" E NÃO "ASSOCIADO"
 * "Quero ser associado" soa em assinar contrato; "garanta seu nome na lista"
 * soa em não perder o bonde. Quem está em dúvida toca numa e não toca na
 * outra — e a folha que abre é a mesma.
 *
 * SOBRE A URGÊNCIA: SÓ A VERDADEIRA
 * A escassez sai de src/config/rodada.js e se corrige sozinha na virada do
 * mês. Prazo inventado ("só até hoje às 18h") e contador que reinicia não
 * entram: além de ser propaganda enganosa (CDC art. 37), é o truque que um
 * motorista reconhece de longe — e leva a credibilidade da página junto.
 */
const CONVITE_LABEL = 'Garanta seu nome na lista';

export default function Home() {
  const { profile, loading } = useAuth();

  // Qual folha está aberta: 'lista' (parceiros), 'login' ou nenhuma. As
  // duas ações da home são popup e não página — quem fecha volta pro mesmo
  // bloco de rolagem em que estava, sem perder o lugar.
  const [sheet, setSheet] = useState(null);

  const [showcase, setShowcase] = useState(null);
  const [testimonials, setTestimonials] = useState([]);
  const [vozesLoaded, setVozesLoaded] = useState(false);
  const [rating, setRating] = useState(null);

  /**
   * PARA ONDE ESTA PESSOA DEVERIA IR — antes de desenhar a vitrine.
   *
   * Duas correções sobre a versão anterior, que só reencaminhava quem tinha
   * sessão:
   *
   * 1. O ATALHO INSTALADO. O manifesto tem um `start_url` só, `/`. O
   *    responsável instala pela `/familia` e o atalho abria aqui; sem sessão
   *    ele ficava na página que vende associação. `frenteLembrada()` é a porta
   *    que ele usou por último — dica, não etiqueta: quem digitar `/` continua
   *    vendo `/`, e a sessão ativa sempre vence.
   *
   * 2. O PISCAR. O redirecionamento morava num efeito, então a vitrine do
   *    motorista pintava um quadro antes de sumir. Decidir no render e
   *    devolver `<Navigate>` corta esse quadro.
   */
  // `?atalho=1` vem do `start_url` do manifesto: só quem abriu pelo ícone
  // instalado tem esse sinal. Quem digitou `/` não tem, e por isso continua
  // vendo `/` — a última porta é dica de atalho, não decisão sobre a pessoa.
  const veioDoAtalho = new URLSearchParams(window.location.search).has('atalho');

  const destino = useMemo(() => {
    if (loading) return null;
    if (profile?.role) return painelDe(profile);
    if (veioDoAtalho && frenteLembrada() === FRENTE_FAMILIA) return '/familia';
    return null;
  }, [loading, profile, veioDoAtalho]);

  // Chegar aqui de propósito É a porta do motorista, e isso vale como resposta
  // à mesma pergunta que a `/familia` responde do outro lado. Sem esta linha,
  // uma visita antiga à `/familia` ficaria valendo pra sempre no atalho.
  useEffect(() => {
    if (!veioDoAtalho) lembrarFrente(null);
  }, [veioDoAtalho]);

  useEffect(() => {
    let alive = true;
    httpsCallable(functions, 'getShowcase')()
      .then((res) => alive && setShowcase(res.data))
      .catch(() => alive && setShowcase({ drivers: [] }));

    // Depoimentos e nota são públicos por regra (só quem autorizou). O
    // filtro por 'admin' é o que faz a home mostrar apenas MOTORISTA — a
    // avaliação do pai é coletada, mas vira métrica no painel, não vitrine.
    listPublicTestimonials(8, { role: 'admin' })
      .then((list) => alive && setTestimonials(list))
      .finally(() => alive && setVozesLoaded(true));
    getPublicRatingStats({ role: 'admin' }).then((s) => alive && setRating(s));
    return () => {
      alive = false;
    };
  }, []);

  const driver = showcase?.drivers?.[0] || null;

  // CRIANÇAS ATIVAS — o tamanho da operação, que é o que "família atendida"
  // quer dizer aqui. Não é a mesma conta que a porta da família exibe: lá são
  // RESPONSÁVEIS COM LOGIN, sempre menos (a mãe de dois irmãos é um
  // responsável e duas crianças). Os dois números dividem o piso e mais nada.
  //
  // `comPiso` devolve null enquanto a vitrine não respondeu, e é isso que
  // mantém o bloco escondido em vez de nascer com o piso na tela.
  const families = comPiso(showcase ? driver?.families : null);

  // Ordem dos blocos + o nome que o leitor de tela anuncia em cada bolinha.
  // A ORDEM SEGUE A DECISÃO, NÃO O CATÁLOGO.
  //
  // Era: o que faz → como começa → quem já é → avaliações → a vaga. Duas
  // coisas estavam fora de lugar. A PROVA vinha depois da instrução — quem
  // ainda não acreditou não lê passo a passo —, e estava partida em dois
  // blocos que respondiam a mesma pergunta ("isso é de verdade?"), o que faz
  // pouca prova parecer ainda menos.
  //
  // Agora: o que faz → por que confiar → como começa → a vaga. Seis bolinhas
  // em vez de sete, e a rolagem inteira anda numa direção só.
  const secoes = [
    ['inicio', 'Início'],
    ['perguntas', 'As três perguntas'],
    ['telas', 'As telas do app'],
    ['prova', 'Quem já usa'],
    ['como', 'Como começa'],
    ['motorista', 'Vaga de associado'],
  ];

  const { scrollerRef, active, goTo } = useSnapSections(
    secoes.map(([id]) => id).join(',')
  );

  // A barra do convite acompanha o visitante nos blocos do meio. Sai de cena
  // no HERO (onde a ação já é o botão principal, dentro da narrativa) e no
  // ÚLTIMO bloco (onde ela é o conteúdo da tela): dizer a mesma coisa duas
  // vezes na mesma tela não é insistência, é ruído.
  const ctaVisivel = active !== 'motorista' && active !== 'inicio';

  // A escassez que o convite mostra. Calculada no render (e não no módulo)
  // porque a página pode ficar aberta na virada do mês — e aí a frase certa
  // é a do mês novo, não a que o navegador carregou ontem.
  const rodada = frasesDaRodada();

  // O bloco seguinte ao que está na tela. No último não há próximo — é por
  // isso que a dica de rolagem desaparece lá em vez de mentir.
  const iAtual = secoes.findIndex(([id]) => id === active);
  const proximaSecao =
    iAtual >= 0 && iAtual < secoes.length - 1 ? secoes[iAtual + 1][0] : null;

  // Sai antes de desenhar qualquer coisa. Este `return` fica depois dos hooks
  // de propósito — sair antes deles mudaria a contagem entre renders.
  if (destino) return <Navigate to={destino} replace />;

  return (
    <>
      <div
        ref={scrollerRef}
        // Com a folha aberta, o scroller da home congela (overflow-hidden
        // preserva o scrollTop): sem isso, rolar dentro do formulário
        // arrastava os blocos atrás e o snap puxava pro bloco seguinte.
        className={`relative h-[100svh] snap-y snap-mandatory scrollbar-hide overscroll-y-contain bg-[#0B1210] text-white ${
          sheet ? 'overflow-hidden' : 'overflow-y-auto'
        }`}
      >
        {/* ───────────── FUNDO ÚNICO (fixo, atrás de todos os blocos) ─────────────
          * Os brilhos vagam devagar e a malha desliza: a tela parece ligada
          * mesmo parada. Fica dentro da moldura mobile (repete o max-w-mobile
          * do #root) pra não vazar pros lados no desktop. */}
        <div
          aria-hidden
          className="fixed inset-y-0 left-0 right-0 max-w-mobile mx-auto pointer-events-none z-0 overflow-hidden"
        >
          <div
            className="absolute inset-0 opacity-80 animate-glow-drift"
            style={{
              background:
                'radial-gradient(120% 80% at 15% 0%, rgba(31,95,63,.55) 0%, rgba(11,18,16,0) 60%)',
            }}
          />
          <div
            className="absolute inset-0 opacity-70 animate-glow-drift-slow"
            style={{
              background:
                'radial-gradient(90% 60% at 100% 15%, rgba(82,196,26,.24) 0%, rgba(11,18,16,0) 55%)',
            }}
          />
          <div
            className="absolute inset-0 opacity-60 animate-glow-drift"
            style={{
              background:
                'radial-gradient(80% 50% at 0% 100%, rgba(31,95,63,.35) 0%, rgba(11,18,16,0) 60%)',
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.07] animate-grid-drift"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
              backgroundSize: '44px 44px',
            }}
          />
        </div>

        {/* ───────────── MARCA, EM TODOS OS BLOCOS ─────────────
        * Com snap, cada bloco é uma "tela" — e uma tela sem marca é uma tela
        * órfã: o visitante que chegou por um print, ou que voltou depois de
        * abrir outra aba, não tem como saber de quem é a página que está
        * lendo. Então a marca sai do fluxo do hero e vira barra fixa, com a
        * porta de quem já tem conta do lado.
        *
        * O fundo é um degradê que morre em transparente (e não uma barra com
        * borda): assim ela segura a leitura do texto que passa por baixo sem
        * cortar a página em duas. */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-40 mx-auto max-w-mobile">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[#0B1210] via-[#0B1210]/85 to-transparent" />
        <div className="relative flex items-center justify-between gap-3 px-6 pb-2 pt-3">
          <button
            type="button"
            onClick={() => goTo('inicio')}
            aria-label="Voltar ao começo da página"
            className="tap pointer-events-auto"
          >
            <Logo tone="onDark" height={26} />
          </button>
          <button
            type="button"
            onClick={() => setSheet('login')}
            className="tap group pointer-events-auto inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-white/25 bg-white/[0.07] px-3.5 text-xs font-bold text-white/85 backdrop-blur hover:bg-white/[0.14]"
          >
            Entrar
            <ArrowRight
              size={14}
              className="transition-transform duration-300 group-hover:translate-x-0.5 group-active:translate-x-1"
            />
          </button>
        </div>
      </div>

      {/* Bolinhas de progresso — mostram quantos blocos existem e levam a
          * qualquer um deles. */}
        <nav
          aria-label="Seções da página"
          className="fixed inset-y-0 left-0 right-0 max-w-mobile mx-auto pointer-events-none z-30"
        >
          <ul className="absolute right-1.5 top-1/2 -translate-y-1/2 flex flex-col gap-2 pointer-events-auto">
            {secoes.map(([id, nome]) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => goTo(id)}
                  aria-label={`Ir para: ${nome}`}
                  aria-current={active === id}
                  className={`block w-1.5 rounded-full transition-all duration-300 ${
                    active === id
                      ? 'h-5 bg-emerald-300'
                      : 'h-1.5 bg-white/25 hover:bg-white/50'
                  }`}
                />
              </li>
            ))}
          </ul>
        </nav>

        {/* ───────────── CONVITE FLUTUANTE ─────────────
          * O objetivo da página inteira, sempre a um toque — em qualquer bloco,
          * sem o tio ter que rolar até o fim pra achar onde se inscreve. */}
        <div
          className={`fixed inset-x-0 bottom-0 max-w-mobile mx-auto z-40 px-5 pb-5 transition-all duration-300 ${
            ctaVisivel
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-6 pointer-events-none'
          }`}
        >
          <button
            type="button"
            tabIndex={ctaVisivel ? 0 : -1}
            aria-hidden={!ctaVisivel}
            onClick={() => setSheet('lista')}
            className="tap cta-shine relative w-full overflow-hidden rounded-3xl bg-emerald-400 px-4 py-2.5 text-[#0B1210] shadow-2xl shadow-black/50"
          >
            <span className="flex items-center justify-center gap-2 text-sm font-extrabold">
              <Sparkles size={15} />
              {CONVITE_LABEL}
              <ArrowRight size={16} />
            </span>
            <span className="mt-0.5 block text-center text-[10px] font-bold uppercase tracking-wider text-[#0B1210]/60">
              {rodada.curta}
            </span>
          </button>
        </div>

        {/* ───────────── DICA DE ROLAGEM (em todos os blocos) ─────────────
        * Com snap obrigatório, o visitante nunca vê o bloco seguinte
        * "espiando" no rodapé — a tela é sempre um bloco inteiro. Sem dica,
        * ele não tem como saber que existe mais. Então ela acompanha a página
        * toda, logo acima da barra do convite, e é CLICÁVEL: quem não quer
        * rolar toca e vai. */}
      {proximaSecao && (
        <div
          className={`pointer-events-none fixed inset-x-0 z-40 mx-auto flex max-w-mobile justify-center transition-all duration-300 ${
            ctaVisivel ? 'bottom-[4.75rem]' : 'bottom-5'
          }`}
        >
          <button
            type="button"
            onClick={() => goTo(proximaSecao)}
            className="tap pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-[#0B1210]/70 px-3.5 py-2 text-[11px] font-bold text-white/85 backdrop-blur"
          >
            role pra ver mais
            <ChevronDown
              size={15}
              className="animate-hint-bounce text-emerald-300"
            />
          </button>
        </div>
      )}

      {/* ───────────── 1. HERO ─────────────
        * A ARQUITETURA DESTE BLOCO SEGUE O OLHO, NÃO A LISTA DE FEATURES.
        *
        * Ele é o primeiro contato com um futuro associado, e o olho percorre
        * de cima pra baixo, começando pela esquerda. Então cada elemento
        * ocupa a posição do seu PAPEL na história, e cada um responde uma
        * pergunta na ordem em que ela nasce:
        *
        *   marca + "Entrar"       quem é isso? (e a porta de quem já é de casa)
        *   chapéu                 é pra mim?
        *   promessa (h1)          o que eu ganho?
        *   a estradinha           como é isso?
        *   tradução prática       o que muda no meu dia?
        *   números reais          é verdade?
        *   "Quero ser associado"  o que eu faço agora?
        *   vaga + estrutura      por que a vaga é contada?
        *   "role pra ver mais"    tem mais?
        *
        * DUAS CORREÇÕES DE HIERARQUIA QUE ESTE BLOCO TINHA ERRADAS
        * 1. O botão mais forte era "Entrar" — que serve pra quem JÁ é
        *    cliente, uma minoria em primeiro contato. Ele virou pastilha
        *    pequena no topo à direita (onde todo site põe login, e onde não
        *    disputa a leitura), e o lugar de destaque passou pra ação que é o
        *    objetivo da página.
        * 2. A ação principal vivia só na barra flutuante, desconectada do
        *    texto que a justifica. Agora ela fecha a narrativa aqui dentro, e
        *    a barra flutuante SAI DE CENA neste bloco: dizer a mesma coisa
        *    duas vezes na mesma tela não é insistência, é ruído. */}
        <Snap id="inicio" className={CLEAR_CTA}>
          <Reveal once={false} className="px-6 pb-10 pt-16">
            {/* A marca e o "Entrar" agora vivem na barra fixa do topo, que
              * acompanha todos os blocos — aqui o hero começa direto na
              * conversa. */}
            <p
              className="font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-300/80 rise"
              style={{ '--d': '80ms' }}
            >
              app pra transporte escolar
            </p>

            <h1
              className="mt-2 text-[2rem] leading-[1.1] font-extrabold tracking-tight rise"
              style={{ '--d': '160ms' }}
            >
              Você faz seu transporte.{' '}
              <span className="text-emerald-300">
                O app avisa, cobra e organiza
              </span>
              .
            </h1>

            {/* A promessa em imagem, colada na promessa em texto: casa, van,
              * escola. Antes ela ficava entre o texto e o botão, cortando o
              * caminho da leitura justo antes da ação. */}
            <div className="mt-5 rise" style={{ '--d': '220ms' }}>
              <ArtRoad />
            </div>

            <p
              className="mt-5 text-white/70 leading-relaxed rise"
              style={{ '--d': '280ms' }}
            >
              Menos WhatsApp, menos caderninho, menos cobrança na mão.
            </p>

            {/* Prova antes do pedido. Sem dado, o bloco não aparece.
              *
              * ATENÇÃO AO QUE ESTE COMENTÁRIO DIZIA ANTES: "número inventado
              * não existe aqui". Deixou de ser verdade em 29/08/2026 — a
              * contagem de famílias passou a ter PISO (`src/config/vitrine.js`),
              * e abaixo dele a tela mostra o piso, não o real.
              *
              * A NOTA AO LADO CONTINUA SEM PISO, e a diferença é de natureza:
              * tamanho de operação é um número sobre o negócio, e o piso o
              * arredonda. Média de avaliação é OPINIÃO DE TERCEIRO — cada
              * ponto ali foi escrito por um motorista sobre a experiência
              * dele. Pôr piso nisso não seria arredondar, seria falsificar
              * depoimento. Se o piso um dia encostar em `rating`, é bug. */}
            {(families > 0 || rating?.count > 0) && (
              <div
                className="mt-5 flex items-center gap-6 border-t border-white/10 pt-4 rise"
                style={{ '--d': '340ms' }}
              >
                {families > 0 && (
                  <Metric
                    value={families}
                    countUp
                    label={
                      families === 1 ? 'família atendida' : 'famílias atendidas'
                    }
                  />
                )}
                {rating?.count > 0 && (
                  <Metric
                    value={rating.average.toFixed(1).replace('.', ',')}
                    label={`de nota · ${rating.count} ${rating.count === 1 ? 'avaliação' : 'avaliações'}`}
                    icon={Star}
                  />
                )}
              </div>
            )}

            {/* A ação que a página existe pra provocar. Embaixo dela, o
              * contexto que responde "por que agora?" e "onde eu entro?". */}
            <div className="mt-6 rise" style={{ '--d': '400ms' }}>
              <AssociarButton onClick={() => setSheet('lista')} />
              <p className="mt-2.5 flex items-center justify-center gap-1.5 text-[11px] text-white/45">
                <Users size={12} className="text-emerald-300/70" />
                {rodada.comPrazo}
              </p>
            </div>
          </Reveal>
        </Snap>

        {/* ───────────── 2. AS TRÊS PERGUNTAS ─────────────
        * As perguntas que o tio ouve todo dia. Ficam num bloco só, avançando
        * pro lado no botão: em três blocos de rolagem, o visitante gastava
        * três gestos aqui e chegava cansado no resto da página. */}
      <Snap id="perguntas" className={CLEAR_CTA}>
        <Reveal once={false} className="px-6 pb-10 pt-16">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-emerald-300/70 rise">
            o que você ouve todo dia
          </p>
          <h2
            className="text-2xl font-extrabold tracking-tight mt-1 mb-5 rise"
            style={{ '--d': '80ms' }}
          >
            Três perguntas, sempre respondidas
          </h2>
          <div className="rise" style={{ '--d': '160ms' }}>
            <QuestionsBlock onFinish={() => goTo('telas')} />
          </div>
        </Reveal>
      </Snap>

      {/* ───────────── 5. AS TELAS (demo clicável) ─────────────
          * O tio quer ver o app, não ler sobre o app. */}
        <Snap id="telas" className={CLEAR_CTA}>
          <Reveal once={false} className="px-6 pb-8 pt-16">
            <div className="rise">
              <ArtScreens />
            </div>
            <p
              className="mt-2 font-mono text-[11px] uppercase tracking-[0.18em] text-emerald-300/70 rise"
              style={{ '--d': '80ms' }}
            >
              como é por dentro
            </p>
            <h2
              className="text-2xl font-extrabold tracking-tight mt-1 rise"
              style={{ '--d': '140ms' }}
            >
              Toque e veja o app funcionando
            </h2>

            <div className="mt-4 rise" style={{ '--d': '200ms' }}>
              <PhoneDemo />
            </div>
          </Reveal>
        </Snap>

        {/* ───────────── 6. COMO COMEÇA ─────────────
          * Numerado porque É uma sequência, e curto porque a promessa é
          * justamente que começar não dá trabalho. */}
        {/* ───────────── 7. A PROVA, NUM BLOCO SÓ ─────────────
          *
          * Eram DOIS blocos — "quem já é associado" e "avaliações" — e os
          * dois respondiam a MESMA pergunta: isso é de verdade? Com um
          * associado e poucos depoimentos, dividir a prova em dois gestos de
          * rolagem faz a escassez de prova parecer maior do que ela é: a
          * pessoa vê uma tela com um logo, rola, e vê outra tela quase vazia.
          * Junto, o mesmo material lê como um bloco cheio.
          *
          * E ele SOBE, pra antes do "como começa": quem ainda não acreditou
          * não lê passo a passo. Prova vem antes de instrução.
          *
          * A `ArtStars` saiu — ela desenhava a nota ao lado do `ReviewsBlock`,
          * que já mostra a nota de verdade. Arte que repete o dado ao lado
          * dele ocupa altura sem acrescentar.
          *
          * O tile do logo é o único elemento BRANCO da página escura: logo de
          * marca é desenhado pra fundo claro, e vidro escuro comeria o dele.
          * Só marca — nunca o avatar do perfil (ver LOGO_ASSOCIADO). */}
        <Snap id="prova" className={CLEAR_CTA}>
          <Reveal once={false} className="px-6 pb-10 pt-16">
            <div className="rise">
              <ArtBadge />
            </div>
            <h2
              className="text-2xl font-extrabold tracking-tight leading-tight mt-2 rise"
              style={{ '--d': '80ms' }}
            >
              Somos o seu principal parceiro pra{' '}
              <span className="text-emerald-300">facilitar o seu dia a dia</span>.
            </h2>
            <p
              className="text-sm text-white/70 leading-relaxed mt-3 rise"
              style={{ '--d': '140ms' }}
            >
              Rota, recado e mensalidade num lugar só — e alguém do outro lado
              quando você precisar.
            </p>

            <p
              className="font-mono text-[11px] uppercase tracking-[0.18em] text-emerald-300/70 mt-7 rise"
              style={{ '--d': '200ms' }}
            >
              quem já é associado
            </p>

            <div className="mt-3 rise" style={{ '--d': '260ms' }}>
              {/* Lista de um item de propósito: quando o segundo associado
                * entrar, a tela não muda de forma — ganha um logo ao lado.
                * O tile é BRANCO, o único da página escura: logo de marca é
                * desenhado pra fundo claro, e vidro escuro comeria o dele. */}
              <ul className="flex flex-wrap gap-3">
                <li className="flex min-w-[10rem] flex-1 items-center justify-center rounded-3xl bg-white p-5 shadow-lg shadow-black/20">
                  {/* Só marca — nunca o avatar do perfil. Ver a nota em
                    * LOGO_ASSOCIADO: foto de rosto aqui seria publicar a
                    * imagem de uma pessoa sem ela ter dito sim pra isso. */}
                  <img
                    src={LOGO_ASSOCIADO}
                    alt={driver?.name || NOME_ASSOCIADO}
                    className="h-20 w-auto max-w-full object-contain"
                    loading="lazy"
                    decoding="async"
                  />
                </li>
              </ul>
            </div>

            <p
              className="mt-3 text-xs leading-relaxed text-white/50 rise"
              style={{ '--d': '320ms' }}
            >
              Já é cliente de um associado? Peça o link de convite — sua conta
              se cria por ali, sem código pra digitar.
            </p>
          
          <p
            className="mt-2 font-mono text-[11px] uppercase tracking-[0.18em] text-emerald-300/70 rise"
            style={{ '--d': '80ms' }}
          >
            quem usa, recomenda
          </p>
          <h2
            className="text-2xl font-extrabold tracking-tight mt-1 rise"
            style={{ '--d': '140ms' }}
          >
            O que os motoristas andam falando
          </h2>

          <div className="mt-5 rise" style={{ '--d': '200ms' }}>
            <ReviewsBlock
              items={testimonials}
              stats={rating}
              loaded={vozesLoaded}
            />
          </div>

          <p
            className="mt-4 text-[11px] leading-relaxed text-white/40 rise"
            style={{ '--d': '260ms' }}
          >
            Quem avalia é quem usa: a nota e o depoimento vêm de dentro do
            app, e só aparecem aqui com autorização do parceiro.
          </p>
                  </Reveal>
        </Snap>

        <Snap id="como" className={CLEAR_CTA}>
          <Reveal once={false} className="px-6 pb-10 pt-16">
            <div className="rise">
              <ArtSteps />
            </div>
            <div className={`${GLASS} p-6 space-y-5 mt-2 rise`}>
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-emerald-300/70">
                  começar é simples
                </p>
                <h2 className="text-xl font-extrabold tracking-tight mt-1">
                  Do caderno pro app em 3 passos
                </h2>
              </div>

              <StepsSequence />
            </div>

            {/* A dúvida que o texto não responde é "quanto fica na MINHA
              * mensalidade?". Ela não cabe em parágrafo — cabe em conversa. */}
            <div className="mt-4 rise" style={{ '--d': '420ms' }}>
              <ConsultorButton assunto="como começar como associado" />
            </div>
          </Reveal>
        </Snap>

      {/* ───────────── 9. A LISTA + RODAPÉ ─────────────
          * O destino de tudo. Aqui a barra flutuante sai de cena e o botão é o
          * conteúdo. O rodapé vem junto no mesmo bloco porque, com snap
          * obrigatório, rodapé curto sozinho no fim briga com o limite de
          * scroll do container. */}
        <Snap id="motorista" className="justify-between">
          <Reveal once={false} className="px-6 pt-16">
            <div className={`${GLASS} relative overflow-hidden p-6 rise`}>
              <div
                aria-hidden
                className="absolute inset-0 opacity-70 animate-glow-drift"
                style={{
                  background:
                    'radial-gradient(100% 80% at 100% 0%, rgba(82,196,26,.28) 0%, rgba(11,18,16,0) 60%)',
                }}
              />
              <div className="relative space-y-3">
                <ArtSeats />
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-white/10 border border-white/15 rounded-full px-2.5 py-1">
                  <Sparkles size={12} />
                  {rodada.contada}
                </span>
                <h2 className="text-xl font-extrabold tracking-tight leading-tight">
                  Sua vaga de associado
                </h2>
                <p className="text-sm text-white/70 leading-relaxed">
                  Cada associado gera administração financeira e técnica: banco
                  de dados, backup, suporte e conferência de pagamento. A gente
                  abre vaga na velocidade que consegue sustentar — pra o seu
                  espaço de trabalho digital funcionar de verdade.
                </p>

                {/* A FRASE MAIS FORTE QUE ESTA PÁGINA PODE TER, e ela não
                  * estava em lugar nenhum.
                  *
                  * O motorista que lê "plataforma" pensa em aplicativo que
                  * fica com um percentual do que ele recebe — é o que todo
                  * app de intermediação faz, e é a objeção silenciosa de quem
                  * lê isto às 22h e não vai tocar no botão do consultor.
                  *
                  * Dizer que não é o caso não é falar de preço: é dizer a
                  * FORMA do dinheiro. E é verdade verificável no produto — a
                  * mensalidade é `payments`, PIX direto entre pai e motorista,
                  * e a taxa vive noutra coleção e noutra tela (`/tio/taxa`,
                  * fora do `/tio/finance`) exatamente por isso. É o que
                  * sustenta o item 7 dos Termos de Uso.
                  *
                  * QUANTO CUSTA CONTINUA FORA DA PÁGINA. Número solto numa
                  * vitrine vira âncora antes de existir proposta, e cada
                  * operação tem um tamanho — a conversa com o consultor é
                  * onde isso se resolve, e ela já é prometida no pitch. */}
                <p className="rounded-xl border border-emerald-300/25 bg-emerald-400/10 p-3.5 text-[13px] leading-relaxed text-white/85">
                  <strong className="font-bold text-white">
                    A mensalidade das suas famílias é sua.
                  </strong>{' '}
                  PIX, dinheiro ou maquininha, direto com quem paga — a
                  plataforma não entra no caminho desse dinheiro e não fica
                  com percentual nenhum dele.
                </p>
                <button
                  type="button"
                  onClick={() => setSheet('lista')}
                  className="tap group w-full h-12 rounded-xl bg-white text-[#0B1210] text-sm font-bold inline-flex items-center justify-center gap-2 mt-1"
                >
                  Garanta seu nome na lista
                  <ArrowRight
                    size={16}
                    className="transition-transform duration-300 group-hover:translate-x-1"
                  />
                </button>
                <p className="text-[11px] text-white/50 text-center">
                  Entrar na fila é grátis. Ficar de fora custa o mês inteiro.
                </p>

                {/* A condição de entrada é real e vale a pena estar aqui: é o
                  * argumento de "por que agora" que não depende de prazo
                  * inventado. O sorteio acontece no primeiro acesso, dentro
                  * do app — nunca numa página pública. */}
                <p className="flex items-center justify-center gap-1.5 rounded-xl border border-warningBorder/25 bg-warning/10 px-3 py-2 text-[11px] font-semibold text-warningBorder">
                  <Gift size={13} />
                  {rodada.brinde}
                </p>

                <div className="pt-1">
                  <ConsultorButton assunto="a vaga de associado" />
                </div>
              </div>
            </div>
          </Reveal>

          <footer className="px-6 py-8 mt-8 border-t border-white/10 space-y-5">
            <div className="flex items-start gap-2.5">
              <ShieldCheck
                size={16}
                className="text-emerald-300 shrink-0 mt-0.5"
              />
              <p className="text-xs text-white/60 leading-relaxed">
                Todos os dados são tratados conforme a LGPD. Endereço e
                localização só aparecem pra quem tem vínculo.
              </p>
            </div>

            {/* Assinatura de quem desenvolveu, com CNPJ e contato: é o cartão
              * de visita da Desenvolva Algo, e também o que dá segurança pro
              * tio de que existe empresa (e gente) atrás do app. */}
            <div className="space-y-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40 text-center">
                sistema desenvolvido por
              </p>
              <DesenvolvaAlgoLogo />

              <div className="text-[11px] text-white/55 space-y-1.5 pt-1">
                <a
                  href={devWhatsAppLink(
                    'Olá! Vi o Alô Buzinou e quero saber mais sobre o app pro meu transporte escolar.'
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-white"
                >
                  <Phone size={13} className="shrink-0 text-emerald-300" />
                  <span className="font-semibold">{DEV_PHONE_DISPLAY}</span>
                </a>
                <a
                  href={devMailLink('Quero o Alô Buzinou pro meu transporte')}
                  className="flex items-center gap-2 hover:text-white"
                >
                  <Mail size={13} className="shrink-0 text-emerald-300" />
                  <span className="font-semibold break-all">{DEV_EMAIL}</span>
                </a>
                <p className="flex items-center gap-2">
                  <MapPin size={13} className="shrink-0 text-emerald-300" />
                  {DEV_CITY}
                </p>
                <p className="flex items-center gap-2">
                  <Check size={13} className="shrink-0 text-emerald-300" />
                  <span className="font-mono">CNPJ {DEV_CNPJ}</span>
                </p>
              </div>
            </div>

            <div className="text-center space-y-2">
              <div className="text-[11px] text-white/50 flex items-center justify-center gap-3">
                <Link to="/termos" className="hover:underline">
                  Termos de Uso
                </Link>
                <span aria-hidden>·</span>
                <Link to="/privacidade" className="hover:underline">
                  Privacidade
                </Link>
              </div>
              <p className="font-mono text-[10px] text-white/30">v{APP_VERSION}</p>
            </div>
          </footer>
        </Snap>
      </div>

      {/* As folhas vivem FORA do scroller: dentro dele, o snap-mandatory
        * disputaria o scroll do formulário. As páginas /login e
        * /quero-fazer-parte continuam de pé pra link direto. */}
      {/* Duas portas pra mesma folha: 'lista' vem dos botões da página (e
        * abre na explicação), 'listaForm' vem de quem já respondeu "sou
        * motorista" na folha de login — esse cai direto nos campos. */}
      <WaitlistSheet
        open={sheet === 'lista' || sheet === 'listaForm'}
        pularPitch={sheet === 'listaForm'}
        onClose={() => setSheet(null)}
        associados={showcase?.drivers?.length || 1}
      />
      {/* onWantPartner: se o visitante disser "sou motorista" na etapa de
        * primeira vez, a folha de login passa a bola pra folha da lista em
        * vez de mandar ele pra outra página. */}
      <LoginSheet
        open={sheet === 'login'}
        onClose={() => setSheet(null)}
        onWantPartner={() => setSheet('listaForm')}
      />
    </>
  );
}

/* ─────────────── scroll-snap ─────────────── */

/**
 * Descobre em qual bloco o visitante está e sabe levar até outro.
 *
 * Recebe os ids em UMA string (e não array) de propósito: array literal muda
 * de identidade a cada render e reinstalaria o observer sem parar.
 */
function useSnapSections(idsKey) {
  const scrollerRef = useRef(null);
  const [active, setActive] = useState('inicio');

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;
    const nodes = root.querySelectorAll('[data-snap]');
    if (!nodes.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.dataset.snap);
        }
      },
      // A régua é uma FAIXA FINA no meio da tela (root encolhido 45% em cima
      // e embaixo): o bloco que cruza o meio é o ativo.
      //
      // A versão anterior usava `threshold: 0.55` e tinha um bug silencioso:
      // um bloco mais ALTO que a tela nunca chega a 55% de si mesmo visível
      // — o último bloco (oferta + rodapé) passa de duas telas de altura, e
      // por isso ele NUNCA ficava ativo. Resultado: a bolinha não acendia e a
      // dica de rolagem continuava aparecendo (por cima do CNPJ) mesmo no fim
      // da página. Com a faixa, a altura do bloco deixa de importar.
      { root, rootMargin: '-45% 0px -45% 0px', threshold: 0 }
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [idsKey]);

  const goTo = (id) => {
    const el = scrollerRef.current?.querySelector(`[data-snap="${id}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return { scrollerRef, active, goTo };
}

function Snap({ id, className = '', children }) {
  return (
    <section
      data-snap={id}
      className={`snap-start snap-always min-h-[100svh] relative z-10 flex flex-col justify-center ${className}`}
    >
      {children}
    </section>
  );
}

/* ─────────────── peças ─────────────── */

/**
 * "Quero ser associado" — a ação que a página existe pra provocar.
 *
 * O destaque (e as microinterações) mudou de dono: era o "Entrar" que tinha
 * anel pulsando e brilho, e ele fala com quem JÁ é cliente. Quem carrega
 * isso agora é a ação de virar associado, no mesmo verde que ela tem em
 * todos os blocos — mesma cor, mesma promessa, em qualquer lugar da página.
 *
 * Três microinterações somadas: dois anéis que pulsam saindo da borda
 * (chamam o olho sem piscar), um brilho que atravessa o botão a cada 4s
 * (parece vidro, não banner) e a seta que avança no toque/hover enquanto o
 * botão afunda. Tudo em CSS — nenhuma roda JS por frame, e todas desaparecem
 * em prefers-reduced-motion.
 */
function AssociarButton({ onClick }) {
  return (
    <div className="relative">
      <span
        aria-hidden
        className="cta-ring absolute inset-0 rounded-2xl border border-emerald-300/60"
      />
      <span
        aria-hidden
        className="cta-ring cta-ring-2 absolute inset-0 rounded-2xl border border-emerald-300/40"
      />
      <button
        type="button"
        onClick={onClick}
        className="tap group cta-shine-white relative h-14 w-full overflow-hidden rounded-2xl bg-emerald-400 text-base font-extrabold text-[#0B1210] shadow-xl shadow-emerald-500/25 focus:outline-none focus:ring-2 focus:ring-emerald-300/60"
      >
        <span className="relative z-10 inline-flex w-full items-center justify-center gap-2">
          <Sparkles size={17} />
          Garanta seu nome na lista
          <ArrowRight
            size={18}
            className="transition-transform duration-300 group-hover:translate-x-1.5 group-active:translate-x-2"
          />
        </span>
      </button>
    </div>
  );
}

function Metric({ value, label, icon: Icon, countUp }) {
  const shown = useCountUp(countUp ? value : null);
  return (
    <div className="min-w-0">
      <p className="text-2xl font-extrabold tracking-tight tabular-nums inline-flex items-center gap-1">
        {Icon && <Icon size={16} className="text-estrela fill-estrela" />}
        {countUp ? shown : value}
      </p>
      <p className="text-[11px] text-white/50 leading-tight">{label}</p>
    </div>
  );
}

/**
 * Número que sobe de 0 até o valor real quando a home carrega.
 *
 * Vale a pena aqui e só aqui: o número de famílias é o dado mais frágil da
 * página (é pequeno), e vê-lo CONTANDO faz o visitante ler "isso vem de um
 * sistema" em vez de "isso é um texto escrito à mão".
 */
function useCountUp(target, duration = 900) {
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!target) return;

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setN(target);
      return;
    }

    let raf;
    let t0;
    const step = (t) => {
      if (t0 === undefined) t0 = t;
      const p = Math.min(1, (t - t0) / duration);
      // ease-out cúbico: rápido no começo, freia no número final
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return n;
}

/**
 * Assinatura da Desenvolva Algo — quem desenvolveu o sistema.
 *
 * O SVG da marca é uma prancha quadrada de 1500x1500 com o logotipo
 * desenhado no meio (x 202→1301, y 661→839). Renderizar o arquivo inteiro
 * num rodapé deixaria ~190px de vazio em volta, então a janela abaixo
 * RECORTA exatamente o retângulo do logotipo: a imagem entra com 273px de
 * lado (1099/1500 · 273 ≈ 200px de logotipo) e é deslocada pra que o canto
 * do desenho encoste no canto da janela. Se o arquivo do logo mudar de
 * enquadramento, estes quatro números mudam junto.
 */
function DesenvolvaAlgoLogo() {
  return (
    <span className="relative block mx-auto w-[200px] h-[33px] overflow-hidden">
      <img
        src="/logoDesenvolvalago.svg"
        alt="Desenvolva Algo"
        className="absolute w-[273px] h-[273px] max-w-none"
        style={{ left: '-37px', top: '-120px' }}
        loading="lazy"
      />
    </span>
  );
}
