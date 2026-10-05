import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useMarcosDoApp } from '../../hooks/useMarcosDoApp';
import { Home, Wallet } from 'lucide-react';
import BottomNav from '../../components/layout/BottomNav';
import { indiceDaAba } from '../../compartilhado/abaAtiva';
import InstallPrompt from '../../components/common/InstallPrompt';
import ConvitePush from '../../components/tio/ConvitePush';
import InteractiveTour from '../../components/tutorial/InteractiveTour';
import AvisoDaPlataforma from '../../components/tio/AvisoDaPlataforma';
import AvisoDoTrial from '../../components/tio/AvisoDoTrial';
import AvisoDoEncerramento from '../../components/tio/AvisoDoEncerramento';
import OfertaDoFechamento from '../../components/tio/OfertaDoFechamento';
import {
  recusarOferta,
  aceitarOferta,
} from '../../services/associadoService';
import { useAuth } from '../../hooks/useAuth';
import { NotificacoesProvider } from '../../context/NotificacoesContext';
import { AvisosDoCabecalhoProvider } from '../../context/AvisosDoCabecalhoContext';
import { useAutoBilling } from '../../hooks/useAutoBilling';
import { useFaturaPlataforma } from '../../hooks/useFaturaPlataforma';
import { useCobrancaLigada, useModuloDeCobranca } from '../../hooks/useCobrancaLigada';
import { useActiveCallsForAdmin } from '../../hooks/usePendingCall';
import { useChildren } from '../../hooks/useChildren';
import { useLiveLocation } from '../../hooks/useLiveLocation';
import OutgoingCallPanel from '../../components/call/OutgoingCallPanel';
import GuardaDoFinanceiro from '../../components/financeiro/GuardaDoFinanceiro';
import BirthdayModal from '../../components/festive/BirthdayModal';
import { faltaCompletarCadastro } from '../../dominio/identidade/cadastroDoMotorista.js';
import { isTracking } from '../../services/locationService';
import { useTrancaDoFinanceiro } from '../../hooks/useTrancaDoFinanceiro';
import {
  getTodaysBirthdayChildren,
  shouldShowBirthdayModal,
  markBirthdayModalShown,
} from '../../services/birthdayService';

/**
 * DUAS ABAS, E A REGRA QUE DECIDE QUAIS.
 *
 * Uma aba é um lugar onde ele MORA. Um botão é um lugar que ele VISITA.
 *
 * O motorista faz duas coisas todo dia: levar e trazer criança, e receber por
 * isso. Tudo o mais — cadastrar criança, cadastrar escola, ajustar horário,
 * avisar que não tem aula — ele faz algumas vezes por mês, quase sempre
 * parado. O rodapé é o espaço mais caro do aparelho (sempre visível, onde o
 * polegar descansa), e metade dele estava com o trabalho mais raro.
 *
 * "Rota" saiu do rodapé fixo e VOLTOU como aba que só existe enquanto a
 * rota roda (03/10/2026 — ver `ABA_DA_ROTA` abaixo).
 * "Crianças" saiu porque virou uma linha escrita na home.
 *
 * TIRAR DA ABA NÃO É ESCONDER. `/tio/children` e `/tio/route/now` continuam
 * respondendo, com as mesmas telas. Muda só como se chega: por uma linha com
 * nome escrito, em vez de um ícone permanente. O custo é um toque a mais — e
 * só quando ele está em OUTRA tela. Durante a rota, que é quando um toque a
 * mais dói, ele já está no Início.
 */
const NAV_ITEMS = [
  { to: '/tio', label: 'Início', icon: Home, end: true, tour: 'nav-home' },
  {
    to: '/tio/finance',
    label: 'Central',
    icon: Wallet,
    tour: 'nav-finance',
  },
];

/**
 * ⚠️ NA ROTA, A CENTRAL É A TELA DA ROTA (04/10/2026, simulação "Rota e
 * Central" aprovada pelo dono).
 *
 * O rodapé tem SEMPRE duas abas: Início · Central. Fora da rota a Central é a
 * do motorista (o caixa, atrás da senha). Com a rota rodando, a MESMA aba leva
 * à tela da rota, que vira a Central da auxiliar: sem senha, sem valor
 * nenhum. A bolinha verde (`ponto`) avisa que a rota está rodando.
 *
 * Era uma terceira aba, "Rota", que aparecia no meio só durante a rota. Saiu
 * porque a auxiliar e o motorista passaram a ter UM lugar cada, e o lugar da
 * auxiliar é a rota.
 *
 * Quem diz se a rota está aberta é `liveLocation/{uid}.routeActive` — o mesmo
 * documento que as famílias leem —, e não o GPS deste aparelho: se o app
 * recarregar no meio da rota, a aba continua lá e o GPS religa sozinho
 * (`ControleDeRota`).
 */
const ITENS_EM_ROTA = [
  NAV_ITEMS[0],
  { to: '/tio/route/now', label: 'Central', icon: Wallet, tour: 'nav-rota', ponto: true },
];

/**
 * Layout do painel do Tio: <Outlet /> + BottomNav fixo.
 * Notificações e perfil ficam no Header (sino + ícone à direita).
 */
export default function TioLayout() {
  const { user, profile, refreshProfile } = useAuth();
  const { trancar } = useTrancaDoFinanceiro();
  const location = useLocation();
  const navigate = useNavigate();
  // null | 'first' (primeiro acesso) | 'review' (pediu pra rever no perfil)
  const [tour, setTour] = useState(null);
  // Abre sozinho UMA vez por sessão: o profile é refetchado em vários
  // momentos, e sem isso o tour reabriria por cima de quem acabou de
  // fechá-lo. Quem pulou reencontra o tour no próximo login.
  const autoOpened = useRef(false);
  const [birthdayOpen, setBirthdayOpen] = useState(false);

  useAutoBilling(profile?.role);
  // Grava, uma vez, que o app foi instalado na tela de início (docs/niveis.md).
  useMarcosDoApp();

  // Chamadas que o Tio disparou — pop-up flutuante mostra status em tempo real
  const activeCalls = useActiveCallsForAdmin(user?.uid);

  // Aniversariantes do dia — só dispara o modal 1x por dia (localStorage)
  const { children } = useChildren();
  const birthdayChildren = useMemo(
    () => getTodaysBirthdayChildren(children),
    [children]
  );

  // Primeiro acesso: o tour abre sozinho e volta a cada login enquanto o Tio
  // não chegar no último passo. Pular é permitido; concluir é o que desliga.
  useEffect(() => {
    if (autoOpened.current) return;
    // Enquanto o card do primeiro acesso estiver por cima, o tour espera: os
    // dois disputariam a mesma tela, e o tour iluminaria um app inerte.
    if (faltaCompletarCadastro(profile)) return;
    if (profile && profile.tutorialDone !== true) {
      autoOpened.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTour('first');
    }
  }, [profile?.tutorialDone, profile]);

  // "Ver tutorial de novo" no perfil manda pra cá com esse state: o tour
  // precisa da tela inicial embaixo pra ter o que iluminar.
  useEffect(() => {
    if (location.state?.openTour) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTour('review');
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    if (birthdayChildren.length > 0 && shouldShowBirthdayModal()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBirthdayOpen(true);
    }
  }, [birthdayChildren.length]);

  const onCloseBirthday = () => {
    setBirthdayOpen(false);
    markBirthdayModalShown();
  };

  // Usado pelo "Como usar o app" do painel
  const openTutorial = () => setTour('review');

  /* ⚠️ T0 E T2 SÃO A MESMA REGRA, e é isso que faz a cadência ser simples:
   * a folha abre sempre que `ofertaEstado` está `pendente` e esta tela monta.
   *
   * No fim da primeira rota o service grava `pendente` e o perfil recarrega —
   * a folha abre ali mesmo (T0). Na próxima vez que ele abrir o app, o campo
   * ainda está `pendente` e ela abre de novo (T2). Dois momentos, um
   * mecanismo, nenhuma data guardada em lugar nenhum.
   *
   * UMA VEZ POR SESSÃO, como o tutorial ao lado e pelo mesmo motivo: sem o
   * `ref`, trocar de aba dentro do /tio reabriria a folha por cima de quem
   * acabou de fechá-la.
   *
   * ⚠️ E FECHAR NÃO GRAVA NADA. É o que separa "vi e sigo trabalhando" de
   * "não quero" — o segundo tem botão escrito, e é ele que encerra a
   * cadência. */
  const [ofertaAberta, setOfertaAberta] = useState(false);
  const ofertaJaAbriu = useRef(false);
  // A CHAVE ÚNICA DA COBRANÇA (02/10/2026). Desligada, este layout não fala de
  // dinheiro da plataforma: sem oferta, sem contagem do teste, sem fatura, sem
  // aviso de encerramento. Só a suspensão manual continua aparecendo.
  // Ver `dominio/associacao/cobrancaLigada.js`.
  const cobranca = useCobrancaLigada();
  // A oferta é do MÓDULO da escada de desconto (que exige a mestra ligada).
  const escada = useModuloDeCobranca('escada');

  useEffect(() => {
    if (!escada) return;
    if (ofertaJaAbriu.current) return;
    if (profile?.ofertaEstado !== 'pendente') return;
    ofertaJaAbriu.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOfertaAberta(true);
  }, [profile?.ofertaEstado, escada]);

  const responderOferta = async (fn) => {
    setOfertaAberta(false);
    try {
      await fn(user?.uid);
      await refreshProfile();
    } catch (err) {
      console.error('[oferta] não deu pra responder:', err);
    }
  };

  // A COBRANÇA DA PLATAFORMA — e a única tela onde ela não aparece.
  //
  // O aviso mora no layout porque atraso não é assunto de uma tela: ele
  // precisa alcançar o motorista onde quer que ele esteja. Suspenso, o cartão
  // vira sobreposição fixa por cima de tudo.
  //
  // POR CIMA DE TUDO MENOS DE `/tio/taxa`, que é justamente pra onde o botão
  // dele manda. Sem esta exceção o suspenso tocaria "Pagar com PIX", chegaria
  // na tela certa e encontraria o mesmo cartão cobrindo o QR Code — uma
  // cobrança que impede o pagamento é a única falha que este aviso não pode
  // ter. `startsWith` e não igualdade: qualquer coisa que venha a pendurar
  // sob esse caminho continua alcançável.
  // ⚠️ ESTA CHECAGEM É MORTA HOJE, E ELA FICA — COM O AVISO.
  //
  // `/tio/taxa`, `/tio/planos` e `/tio/contrato-plataforma` saíram de dentro
  // deste layout em `App.jsx` (ficam FORA do `GuardaDaConta`, senão o botão
  // "Ver planos" navegava e a tela não mudava). Então `location.pathname`
  // nunca começa com `/tio/taxa` aqui dentro, e quem omite os dois avisos na
  // tela de pagamento é a ROTA, não esta linha.
  //
  // O CLAUDE.md atribuía a omissão a esta checagem, e quem lesse aquilo
  // confiaria numa proteção que não roda. Ela continua por ser barata e por
  // ser a rede se a rota voltar para cá — mas a garantia é da rota.
  const naTelaDaTaxa = location.pathname.startsWith('/tio/taxa');
  const { fatura: faturaAberta } = useFaturaPlataforma(user?.uid);
  // Desligada, a fatura antiga que ainda estiver `aberta` no banco não vira
  // cartão de dívida. O `AvisoDaPlataforma` sem fatura só aparece para o
  // suspenso — que é decisão manual e continua valendo.
  const fatura = cobranca ? faturaAberta : null;

  const { location: minhaRota, loading: carregandoRota } = useLiveLocation(user?.uid);
  // ⚠️ O GPS DESTE APARELHO TAMBÉM CONTA (03/10/2026). Ao tocar em INICIAR
  // ROTA o app abre a tela da rota na hora, mas `routeActive` só chega ao
  // banco com o PRIMEIRO ponto do GPS — segundos depois, ou mais sem sinal.
  // Nesse meio-tempo o efeito abaixo lia "sem rota" e devolvia o motorista ao
  // Início: ele tocava em iniciar e não ia para a rota. O rastreamento já
  // ligado aqui é a prova de que a rota começou.
  const emRota = !!minhaRota?.routeActive || isTracking();
  const itens = emRota ? ITENS_EM_ROTA : NAV_ITEMS;
  const naTelaDaRota = location.pathname.startsWith('/tio/route/now');
  // Encerrou com a tela da rota aberta: a Central volta a ser do motorista
  // (`/tio/finance`, que pede a senha). Só depois de ler o documento — durante
  // a leitura "sem rota" é desconhecido, não falso.
  useEffect(() => {
    if (!carregandoRota && !emRota && naTelaDaRota) navigate('/tio/finance', { replace: true });
  }, [carregandoRota, emRota, naTelaDaRota, navigate]);

  // ⚠️ A ROTA TRANCA O DINHEIRO. Com a rota rodando, quem segura o celular
  // pode ser a auxiliar: se o Financeiro tivesse ficado destravado antes, ela
  // entraria nele sem senha. Trancar ao ver a rota começar fecha essa porta.
  useEffect(() => {
    if (emRota) trancar();
  }, [emRota, trancar]);

  /* ⚠️ OS AVISOS MORAM ABAIXO DO CABEÇALHO DA TELA (03/10/2026, auditoria de
   * UX) — ver `AvisosDoCabecalhoContext`. Eles eram desenhados aqui, acima do
   * <Outlet />, e por isso ficavam EM CIMA do cabeçalho de cada tela: o canto
   * superior esquerdo, onde o olho procura "onde estou", virava um cartão de
   * cobrança.
   *
   * O layout continua dono deles (sabe de fatura, de cobrança ligada e de em
   * que tela está) e entrega ao `Header`, que desenha logo abaixo de si. Tela
   * sem `Header` não se registra, e aí eles voltam a sair aqui no topo.
   *
   * ⚠️ NA TELA DA ROTA NENHUM DELES APARECE: o motorista está dirigindo, e a
   * faixa verde da viagem é a primeira coisa que ele precisa ler. A cortina
   * da suspensão continua (ela não passa por aqui). */
  const suspenso = profile?.suspenso === true;
  const avisosDoTopo = naTelaDaRota ? null : (
    <>
      {!naTelaDaTaxa && !suspenso && (
        <AvisoDaPlataforma
          fatura={fatura}
          criancas={children?.length || 0}
          // No caixa, uma linha âmbar sem botão verde: lá o verde é receber
          // a mensalidade (item 19, ver AvisoDaPlataforma).
          compacto={location.pathname.startsWith('/tio/finance')}
        />
      )}
      {/* O aviso do teste fica ABAIXO do da plataforma, e some sozinho quando
        * o outro importa: quem já tem fatura passou do trial, e avisoDoTrial
        * devolve null pra quem tem contrato. Duas cobranças na mesma tela
        * seria o app falando de dinheiro duas vezes antes de o motorista ver
        * a rota do dia. */}
      {cobranca && !naTelaDaTaxa && <AvisoDoTrial temContrato={!!fatura} />}

      {/* ⚠️ ELE APARECE INCLUSIVE NA TELA DA TAXA, ao contrário do aviso do
        * teste e do da plataforma. Aqueles são cobrança, e cobrança que cobre
        * a própria tela de pagar não deixa ninguém pagar. Este é o oposto: diz
        * que a conta vai PARAR, e a tela do dinheiro é justamente onde ele
        * está quando decide se continua. */}
      {cobranca && <AvisoDoEncerramento />}

      {/* ⚠️ O CONVITE DE PUSH SÓ APARECE QUANDO NÃO HÁ COBRANÇA NA TELA.
        *
        * Ele vive aqui, e não no perfil, porque `enablePush` só era chamada de
        * `/tio/perfil` — quem nunca abriu aquela tela nunca ligou o push, e
        * push desligado desliga o canal inteiro: os avisos de degrau, de
        * fatura e de conta pausada viram documentos que ninguém vê.
        *
        * Mas ele cede a vez para dinheiro. Pedir permissão de notificação em
        * cima de um aviso de fatura em aberto é competir com a coisa que o
        * motorista precisa resolver — e a permissão negada por pressa é
        * definitiva no navegador. */}
      {!naTelaDaTaxa && !fatura && <ConvitePush />}
    </>
  );
  // Quais cabeçalhos estão montados. O primeiro desenha os avisos.
  const [cabecalhos, setCabecalhos] = useState([]);
  const registrarCabecalho = useCallback((id) => {
    setCabecalhos((l) => [...l, id]);
    return () => setCabecalhos((l) => l.filter((x) => x !== id));
  }, []);
  const avisosNoCabecalho = {
    avisos: avisosDoTopo,
    registrar: registrarCabecalho,
    dono: cabecalhos[0] ?? null,
  };

  const abaAtiva = indiceDaAba(location.pathname, itens);
  /* `motion-reduce:animate-none` porque quem pediu menos movimento ao sistema
     não pediu telas deslizando. A informação continua toda lá — o desenho
     nunca dependeu da animação para ser entendido. */
  const entradaDaTela = `motion-reduce:animate-none ${
    abaAtiva < 0
      ? 'animate-entra-plano'
      : abaAtiva === 0
        ? 'animate-entra-esq'
        : 'animate-entra-dir'
  }`;

  return (
    /* ⚠️ A ESCUTA DO SINO MORA AQUI, UMA VEZ (03/10/2026): o layout fica de pé
     * enquanto ele anda pelas telas; o `Header` de cada tela, não. */
    <NotificacoesProvider>
    <div
      className="min-h-screen"
      style={{ paddingBottom: 'calc(8rem + env(safe-area-inset-bottom, 0px))' }}
    >
      {/* A SUSPENSÃO é cortina fixa por cima de tudo, e mora AQUI: dentro da
        * tela (que anima com `transform`) o `fixed` deixaria de ser relativo
        * à janela. Os outros avisos vão para baixo do cabeçalho; sem nenhum
        * cabeçalho registrado, saem aqui, como antes. */}
      {!naTelaDaTaxa && suspenso && (
        <AvisoDaPlataforma fatura={fatura} criancas={children?.length || 0} />
      )}
      {cabecalhos.length === 0 && avisosDoTopo}

      <OfertaDoFechamento
        aberta={!!escada && ofertaAberta}
        motorista={profile}
        criancas={(children || []).filter((c) => c.active !== false).length}
        onFechar={() => setOfertaAberta(false)}
        onRecusar={() => responderOferta(recusarOferta)}
        onAceitar={() => responderOferta(aceitarOferta)}
      />
      {/* ⚠️ A TELA ENTRA PELO LADO DA PRÓPRIA ABA, e a `key` é o ÍNDICE, não
        * o caminho.
        *
        * Pelo caminho, navegar de uma criança para outra remontaria a mesma
        * tela e ela piscaria — e isso não é troca de aba, é navegação dentro
        * dela. Pelo índice, a animação toca exatamente quando o rodapé muda de
        * lugar, que é o movimento que ela existe para explicar.
        *
        * O lado sai do índice: 0 é o Início (mora à esquerda), 1 é o
        * Financeiro (à direita). Quem não é aba entra sem direção — inventar
        * um lado ensinaria uma geografia que não existe. */}
      <div key={abaAtiva} className={entradaDaTela} >
        {/* ⚠️ O GUARDA DO FINANCEIRO ENVOLVE O OUTLET INTEIRO (03/10/2026) e
          * decide pelo CAMINHO: só age em `/tio/finance…`. Assim toda tela
          * nova pendurada ali nasce atrás da senha, sem ninguém lembrar de
          * embrulhá-la no App.jsx. Ver GuardaDoFinanceiro.jsx. */}
        <AvisosDoCabecalhoProvider value={avisosNoCabecalho}>
          <GuardaDoFinanceiro>
            <Outlet context={{ openTutorial }} />
          </GuardaDoFinanceiro>
        </AvisosDoCabecalhoProvider>
      </div>
      {/* ⚠️ O CADASTRO DA CRIANÇA NÃO TEM A BARRA DE BAIXO (02/10/2026).
        * Ele é um passo a passo com "Cancelar" e "Avançar" próprios, num
        * rodapé fixo. A tela mora dentro do `div` da animação de entrada, e
        * animação (transform/opacidade) cria um contexto de empilhamento: o
        * `z-40` do rodapé dele vale só lá dentro, e esta barra, que está fora,
        * ficava POR CIMA do "Avançar" — o motorista não saía do passo 1.
        * Achado do teste no navegador (M3). Num passo a passo a barra também
        * é a saída que perde o que ele digitou. */}
      {!location.pathname.startsWith('/tio/children/new') && <BottomNav items={itens} />}
      <InstallPrompt />
      <InteractiveTour
        open={!!tour}
        mode={tour || 'review'}
        onClose={() => setTour(null)}
      />
      <OutgoingCallPanel calls={activeCalls} />
      {birthdayOpen && (
        <BirthdayModal
          children={birthdayChildren}
          role="tio"
          onClose={onCloseBirthday}
        />
      )}
    </div>
    </NotificacoesProvider>
  );
}
