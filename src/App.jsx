import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';

/**
 * O QUE VEM NO PRIMEIRO DOWNLOAD, E O QUE VEM QUANDO PRECISA.
 *
 * O app tinha 37 telas num arquivo só, de 1,47 MB. Quem abria o link do
 * WhatsApp pra ver uma mensalidade baixava o mapa, o gerador de QR, as
 * telas de impressão e o painel do dono junto — tudo antes da primeira
 * pintura, em dado móvel, num aparelho de rua.
 *
 * ADIANTADO fica só o caminho de quem chega de fora: a home, o convite, o
 * login e o primeiro acesso. É o que precisa pintar rápido, porque é onde o
 * responsável decide se o app presta.
 *
 * SOB DEMANDA vai o resto — os dois painéis, o mapa, os relatórios, as
 * telas legais e o painel do dono. Quem entra num painel já está logado e
 * já esperou uma navegação; um instante ali não custa a primeira impressão.
 *
 * O <Suspense> fica no topo das rotas com o MESMO loader de tela cheia que
 * o PrivateRoute já usa — a espera parece com a espera que o app já tinha,
 * e não com uma tela nova aparecendo do nada.
 */
import Familia from './pages/Familia';
import Invite from './pages/Invite';
import Login from './pages/Login';
import FirstAccess from './pages/FirstAccess';

import AuthAction from './pages/AuthAction';

// `Welcome` era o UNICO import adiantado sem justificativa, e nenhuma tela do
// app aponta pra ele: e rota de link antigo (ver o redirecionamento la
// embaixo). Sao 171 linhas na primeira pintura de TODO MUNDO, inclusive da
// mae abrindo o convite no WhatsApp em dado movel.
/* PREGUIÇOSA DE PROPÓSITO, mesmo sendo caminho de quem chega de fora.
 *
 * O convite é eager porque é o caminho de TODA família. Este é o de uma
 * pessoa por dia, numa tarde — pôr esta tela no pacote de entrada cobraria o
 * download dela de todo mundo que abre o app pra ver a rota. O `Respiro`
 * cobre os 300ms dela, e é exatamente pra isso que ele existe. */
const Acompanhar = lazy(() => import('./pages/Acompanhar'));
const Welcome = lazy(() => import('./pages/Welcome'));
const Comecar = lazy(() => import('./pages/Comecar'));
const DriverSignup = lazy(() => import('./pages/DriverSignup'));
const FirstAdmin = lazy(() => import('./pages/FirstAdmin'));
const AdminPanel = lazy(() => import('./pages/admin/AdminPanel'));

const TioLayout = lazy(() => import('./pages/tio/TioLayout'));
const GuardaDaConta = lazy(() => import('./components/tio/GuardaDaConta'));
const PrimeiroAcesso = lazy(() => import('./pages/tio/PrimeiroAcesso'));
const TioDashboard = lazy(() => import('./pages/tio/TioDashboard'));
const TioChildren = lazy(() => import('./pages/tio/TioChildren'));
const TioEscolas = lazy(() => import('./pages/tio/TioEscolas'));
const TioRouteNow = lazy(() => import('./pages/tio/TioRouteNow'));
const TioHorarios = lazy(() => import('./pages/tio/TioHorarios'));
const TioSemana = lazy(() => import('./pages/tio/TioSemana'));
const TioFinance = lazy(() => import('./pages/tio/TioFinance'));
const TioFinanceReport = lazy(() => import('./pages/tio/TioFinanceReport'));
const TioChildStatement = lazy(() => import('./pages/tio/TioChildStatement'));
const TioExpenses = lazy(() => import('./pages/tio/TioExpenses'));
const TioContract = lazy(() => import('./pages/tio/TioContract'));
const TioPixConfig = lazy(() => import('./pages/tio/TioPixConfig'));
const TioAgenda = lazy(() => import('./pages/tio/TioAgenda'));
const TioContratoAssociacao = lazy(() => import('./pages/tio/TioContratoAssociacao'));
const TioTaxa = lazy(() => import('./pages/tio/TioTaxa'));
const TioPlanos = lazy(() => import('./pages/tio/TioPlanos'));
const TioSelo = lazy(() => import('./pages/tio/TioSelo'));
const TioIndicar = lazy(() => import('./pages/tio/TioIndicar'));
const ChildForm = lazy(() => import('./components/children/ChildForm'));

const PaiLayout = lazy(() => import('./pages/pai/PaiLayout'));
const PaiDashboard = lazy(() => import('./pages/pai/PaiDashboard'));
const PaiFinance = lazy(() => import('./pages/pai/PaiFinance'));
const PaiFinanceReport = lazy(() => import('./pages/pai/PaiFinanceReport'));
const PaiMap = lazy(() => import('./pages/pai/PaiMap'));
const AddChild = lazy(() => import('./pages/pai/AddChild'));
const PaiContract = lazy(() => import('./pages/pai/PaiContract'));
const PaiFaltas = lazy(() => import('./pages/pai/PaiFaltas'));

const Notifications = lazy(() => import('./pages/Notifications'));
const Profile = lazy(() => import('./pages/Profile'));
const ChildDetail = lazy(() => import('./pages/ChildDetail'));
const Terms = lazy(() => import('./pages/legal/Terms'));
const Privacy = lazy(() => import('./pages/legal/Privacy'));
import TermsAcceptanceGate from './components/legal/TermsAcceptanceGate';
import ContractAcceptanceGate from './components/contract/ContractAcceptanceGate';
import CookieBanner from './components/legal/CookieBanner';
import { useAuth } from './hooks/useAuth';
import { faltaCompletarCadastro } from './dominio/identidade/cadastroDoMotorista.js';
import FalhaAoLerConta from './components/common/FalhaAoLerConta';
import { useActiveChild } from './hooks/useActiveChild';
import { hasAcceptedCurrentTerms } from './services/consentService';
import { dadosDaContratadaFaltando } from './services/contractService';
import { useAdminProfile } from './hooks/useAdminProfile';
import { hasAcceptedContract } from './services/contractService';
import Respiro from './components/common/Respiro';
import { SITE_INSTITUCIONAL } from './config/vitrine';
import Travessia from './components/common/Travessia';
import ErrorBoundary from './components/common/ErrorBoundary';
import { useGlobalClickSound } from './hooks/useGlobalClickSound';
import { painelDe, ehDono } from './dominio/identidade/papeis';
import {
  frenteDoCaminho,
  estadoDaFrente,
  portaDaFrente,
  frenteLembrada,
} from './dominio/vitrine/frentes';

/**
 * A espera de tela cheia — a MESMA nos dois usos, como já era.
 *
 * Era um spinner nu. Virou a marca com as ondas emitindo, e com um atraso de
 * 300 ms antes de aparecer: se o pedaço da rota chegar antes, ninguém vê
 * nada. Ver o cabeçalho do Respiro — o atraso é o ponto inteiro, não um
 * detalhe de gosto.
 */
function FullScreenLoader() {
  return <Respiro />;
}

/**
 * Protege rotas autenticadas.
 *   - Não autenticado → /login (preservando origem em state.from).
 *   - Autenticado mas com role errado → painel correto.
 *   - Profile ainda não carregado (logo após signup) → loader.
 */
/**
 * URL que não existe — e para onde ela devolve a pessoa.
 *
 * Era `<Navigate to="/" />` fixo: link velho, endereço digitado errado ou rota
 * renomeada jogavam QUALQUER pessoa na página que vende associação, inclusive
 * o responsável.
 *
 * A ordem das perguntas é a das certezas: quem tem sessão vai pro painel dele
 * (é a informação mais forte); quem não tem, mas errou dentro da área da
 * família, volta pra porta da família; o resto está conhecendo a plataforma.
 */
function NaoEncontrado() {
  const { profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;
  if (profile?.role) return <Navigate to={painelDe(profile)} replace />;

  const frente = frenteDoCaminho(location.pathname) || frenteLembrada();
  return <Navigate to={portaDaFrente(frente)} replace />;
}

function PrivateRoute({ children, requireRole }) {
  const { user, profile, loading, perfilIndisponivel } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;
  if (!user) {
    // A FRENTE VIAJA JUNTO COM O `from`.
    //
    // Aqui o perfil já não existe (é este o caso: sem sessão), então o papel
    // não pode dizer de que lado a pessoa está. A URL pode: quem foi barrado
    // em `/pai/finance` é responsável, e o login precisa saber disso pra não
    // oferecer a ele "Sou motorista e quero fazer parte" nem devolvê-lo à
    // vitrine de associação no botão Voltar.
    //
    // Toda expiração de sessão de responsável passa por aqui — era o caminho
    // de maior alcance dos seis.
    return (
      <Navigate
        to="/login"
        state={{
          from: location.pathname,
          ...estadoDaFrente(frenteDoCaminho(location.pathname)),
        }}
        replace
      />
    );
  }
  // LOGADO, SEM DOCUMENTO DE USUÁRIO: a sala de espera, não um loader.
  //
  // `loading` só vira false DEPOIS do await de `getUserDoc` (ver
  // AuthContext), então aqui "sem perfil" é conclusivo e não transitório.
  // Enquanto a conta órfã do Google era apagada, este caso não existia e
  // o loader eterno passava despercebido; sem a limpeza, ele seria uma
  // tela travada para todo mundo que entra pela primeira vez.
  //
  // ⚠️ MAS SÓ É CONCLUSIVO QUANDO A LEITURA DEU CERTO, e este parágrafo
  // afirmava mais do que sabia. `getUserDoc` que LEVANTA — rede caindo no
  // meio-fio, Firestore fora do ar, regra recusando — produzia o mesmo
  // `profile == null`, e mandava um motorista de meses pra tela que diz
  // "Falta ligar sua conta / Nada foi criado ainda". `perfilIndisponivel`
  // separa as duas coisas; ver `FalhaAoLerConta`.
  if (perfilIndisponivel) return <FalhaAoLerConta />;
  if (!profile) return <Navigate to="/comecar" replace />;
  // O DONO NÃO ENTRA EM PAINEL DE OPERAÇÃO, nem que o papel dele deixasse.
  //
  // A checagem de `ehDono` vem junto de propósito. Conta antiga de dono foi
  // criada como MOTORISTA com `superAdmin: true` por cima — porque na época
  // as leituras do painel exigiam papel de motorista. Numa conta dessas
  // `profile.role === 'admin'` é verdadeiro, então só comparar o papel
  // deixava o dono entrar no /tio e mexer na operação de um parceiro: abrir
  // rota, editar criança, dar baixa em pagamento. Nada disso é dele.
  //
  // Corrigir só o documento no banco não bastaria: a regra agora proíbe
  // escrever `role` pelo cliente (foi assim que a auto-promoção foi fechada),
  // então contas antigas continuam com o papel velho até alguém migrar na
  // mão. A trava tem que estar aqui, no caminho, e não depender da migração.
  if (requireRole && (profile.role !== requireRole || ehDono(profile))) {
    return <Navigate to={painelDe(profile)} replace />;
  }
  // Bloqueia acesso ao app até aceitar a versão corrente dos termos.
  // Acontece com usuários antigos quando bumpamos LEGAL_VERSION.
  if (!hasAcceptedCurrentTerms(profile)) {
    return <TermsAcceptanceGate />;
  }
  // Gate de contrato — só pra Pai, antes de acessar o app
  if (profile.role === 'parent') {
    return <ParentContractGate>{children}</ParentContractGate>;
  }
  return children;
}

/**
 * Painel do dono da plataforma.
 *
 * ISTO DEIXOU DE SER SÓ GATE DE PRODUTO.
 * O comentário anterior avisava, com razão, que esconder a rota não protegia
 * nada: qualquer motorista já podia ler users, children, payments e feedbacks
 * pelas rules, então o /admin escondia a tela e não o dado.
 *
 * Agora as rules têm `isOwner()`, e a fila de parceiros e a moderação de
 * depoimento exigem esse papel — um motorista não alcança nem pela tela nem
 * pelo banco. O que ele continua lendo é a operação DELE, que é dele mesmo.
 *
 * O que falta pra fechar de vez: `isOwner()` ainda lê o documento do usuário,
 * então depende de nenhuma regra futura reabrir a escrita de `role`. Em custom
 * claim o privilégio viveria no token, fora do alcance do cliente. Está no
 * backlog.
 */
function SuperAdminRoute({ children }) {
  const { user, profile, loading, perfilIndisponivel } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;
  if (!user) {
    // A FRENTE VIAJA JUNTO COM O `from`.
    //
    // Aqui o perfil já não existe (é este o caso: sem sessão), então o papel
    // não pode dizer de que lado a pessoa está. A URL pode: quem foi barrado
    // em `/pai/finance` é responsável, e o login precisa saber disso pra não
    // oferecer a ele "Sou motorista e quero fazer parte" nem devolvê-lo à
    // vitrine de associação no botão Voltar.
    //
    // Toda expiração de sessão de responsável passa por aqui — era o caminho
    // de maior alcance dos seis.
    return (
      <Navigate
        to="/login"
        state={{
          from: location.pathname,
          ...estadoDaFrente(frenteDoCaminho(location.pathname)),
        }}
        replace
      />
    );
  }
  // LOGADO, SEM DOCUMENTO DE USUÁRIO: a sala de espera, não um loader.
  //
  // `loading` só vira false DEPOIS do await de `getUserDoc` (ver
  // AuthContext), então aqui "sem perfil" é conclusivo e não transitório.
  // Enquanto a conta órfã do Google era apagada, este caso não existia e
  // o loader eterno passava despercebido; sem a limpeza, ele seria uma
  // tela travada para todo mundo que entra pela primeira vez.
  //
  // ⚠️ MAS SÓ É CONCLUSIVO QUANDO A LEITURA DEU CERTO, e este parágrafo
  // afirmava mais do que sabia. `getUserDoc` que LEVANTA — rede caindo no
  // meio-fio, Firestore fora do ar, regra recusando — produzia o mesmo
  // `profile == null`, e mandava um motorista de meses pra tela que diz
  // "Falta ligar sua conta / Nada foi criado ainda". `perfilIndisponivel`
  // separa as duas coisas; ver `FalhaAoLerConta`.
  if (perfilIndisponivel) return <FalhaAoLerConta />;
  if (!profile) return <Navigate to="/comecar" replace />;
  if (!ehDono(profile)) {
    return <Navigate to={painelDe(profile)} replace />;
  }
  // ⚠️ O DONO TAMBÉM ACEITA OS TERMOS — E ANTES ERA O ÚNICO QUE NÃO.
  //
  // `PrivateRoute` bloqueia motorista e responsável em
  // `hasAcceptedCurrentTerms`, e este guarda não tinha a checagem. Quando
  // `LEGAL_VERSION` sobe, todo mundo reaceita menos a conta que responde pela
  // plataforma — ou seja, o registro de aceite tem um buraco exatamente onde
  // ele mais precisa existir.
  if (!hasAcceptedCurrentTerms(profile)) {
    return <TermsAcceptanceGate />;
  }
  return children;
}

/**
 * Sub-gate específico do Pai: bloqueia até aceitar o contrato.
 *
 * ⚠️ ELE PRECISA SABER SE HÁ CONTRATO A MONTAR, e não só se foi aceito.
 *
 * `buildContractData` devolve `null` quando o motorista não preencheu os dados
 * da parte contratada — nome, CPF ou CNPJ e cidade. Antes de 06/09/2026 isso
 * nunca acontecia porque havia um placeholder fictício, e o contrato saía com
 * uma empresa que não existe e CNPJ zerado. O placeholder foi removido.
 *
 * Sem esta checagem aqui, o `ContractAcceptanceGate` recebia `contractData`
 * nulo e caía num esqueleto cinza PERMANENTE: a mãe terminava o cadastro, era
 * levada ao `/pai` e via dois retângulos, sem texto, sem botão e sem sair da
 * conta — o gate bloqueia 100% do app por desenho, então não havia navegação
 * por baixo.
 *
 * Ela passa. Bloquear a mãe por um formulário que o MOTORISTA não preencheu é
 * punir quem não tem como consertar — e quem é avisado do que falta é ele, na
 * tela de contrato dele.
 */
/**
 * O PRIMEIRO ACESSO DO MOTORISTA — o resto do cadastro, antes do app.
 *
 * ⚠️ ELE FICA POR FORA DO `GuardaDaConta`, E A ORDEM IMPORTA. O guarda da
 * conta trata de dinheiro (teste vencido, suspensão) e a sua saída é
 * `/tio/planos` — mandar para lá quem ainda não tem NOME cadastrado produz um
 * contrato com a parte em branco. Completar o cadastro vem antes de qualquer
 * conversa sobre pagar.
 *
 * ⚠️ E ELE NÃO É UMA ROTA, é um DESVIO. Rota própria seria endereço que a
 * pessoa pode pular digitando outro na barra — e os três campos que ele cobra
 * são partes de um contrato. Como desvio, ele cobre `/tio` inteiro enquanto
 * faltar.
 *
 * Quem decide é `faltaCompletarCadastro`, pura e fora da tela
 * (`dominio/identidade/cadastroDoMotorista.js`).
 */
function PrimeiroAcessoGate({ children }) {
  const { profile, loading } = useAuth();

  // Perfil ainda carregando não é perfil incompleto. Sem esta linha, todo
  // motorista veria o formulário piscar no primeiro quadro de cada abertura.
  if (loading) return <FullScreenLoader />;
  if (!faltaCompletarCadastro(profile)) return children;
  return <PrimeiroAcesso />;
}

function ParentContractGate({ children }) {
  const { child, loading } = useActiveChild();
  const { admin, loading: adminLoading } = useAdminProfile(child?.adminUid);

  if (loading) return <FullScreenLoader />;
  // Se não tem child vinculado, deixa entrar — o próprio dashboard mostra erro
  if (!child) return children;
  if (adminLoading) return <FullScreenLoader />;
  // Sem os dados da contratada não há documento a assinar. Ver acima.
  if (dadosDaContratadaFaltando(admin).length > 0) return children;
  if (!hasAcceptedContract(child)) {
    return <ContractAcceptanceGate />;
  }
  return children;
}

/**
 * A RAIZ SABE COM QUEM ESTÁ FALANDO.
 *
 * `/` é a home do MOTORISTA: vende associação, fala de taxa, vaga e
 * credibilidade de negócio. É a página certa pra quem decide entrar como
 * parceiro — e a errada pra um responsável.
 *
 * Três caminhos jogavam o responsável ali: sair da conta, errar a URL (o
 * catch-all manda tudo pra `/`) e um botão "ver na home" depois de
 * avaliar. Ele não ficava preso, porque a home tem "Entrar" no topo — mas
 * lia uma página escrita pra outra pessoa. E é justamente quem menos vai
 * insistir: o responsável não decora endereço de site, ele volta pelo
 * link do WhatsApp.
 *
 * Logado, a própria Home já manda cada um pro seu painel. O que faltava
 * era o caso DESLOGADO, em que o app não sabe com quem fala. A migalha do
 * aparelho resolve: se aquele celular já foi de um responsável, a raiz
 * abre a porta da família.
 *
 * Errar pra que lado? Pra mostrar a home. Um responsável na home tem
 * "Entrar" e resolve; e quem nunca usou o app não tem migalha nenhuma,
 * então visitante novo sempre cai na home — que é o que a gente quer.
 */
/**
 * Sai do app e vai pro site institucional.
 *
 * Precisa existir porque a landing mora em OUTRO DOMÍNIO
 * (`alobuzinou.com.br`; o app é `alobuzinou.com`), e o <Navigate> do
 * react-router só alcança rotas deste bundle — ele montaria um caminho
 * relativo e devolveria a pessoa pra cá.
 *
 * `replace` em vez de `href`: quem veio de um link velho não deve ganhar
 * uma parada a mais no histórico do "voltar".
 */
function ParaOSite() {
  useEffect(() => {
    window.location.replace(SITE_INSTITUCIONAL);
  }, []);
  return <Respiro />;
}

export default function App() {
  // Som global de clique em qualquer elemento .tap — desabilitável no Profile
  useGlobalClickSound();

  return (
    <>
      {/* A cortina de entrar e sair. Fica FORA do Suspense e acima das
        * rotas: ela chega na mesma renderização que a tela de destino, então
        * o destino nunca pisca antes de ser coberto. Ver Travessia.jsx. */}
      <Travessia />

      <Suspense fallback={<FullScreenLoader />}>
        {/* Boundary DENTRO do Suspense: é aqui que a rejeição do lazy()
          * chega quando um chunk sumiu depois de um deploy. Fica mais perto
          * do erro que o boundary do main.jsx, e por isso é o que atende
          * quase sempre. Ver ErrorBoundary.jsx. */}
        <ErrorBoundary>
        <Routes>
        {/* Rotas públicas */}
        {/* A APRESENTAÇÃO DA PLATAFORMA SAIU DO APP.
          *
          * Até 06/09/2026 `/` era `pages/Home.jsx` — 1090 linhas de página
          * de vendas, carregadas de forma EAGER por todo visitante, inclusive
          * pela mãe que abre o link do convite em dado móvel.
          *
          * Ela foi apagada: a landing estática em `landing/` (outro domínio,
          * outro site do Hosting) faz o mesmo trabalho sem passar pelo bundle
          * do app. Quem chega em `alobuzinou.com` está entrando, não
          * conhecendo — e o que ele precisa é do login.
          *
          * O redirecionamento é INTERNO de propósito: mandar quem digitou o
          * endereço do app para a landing seria devolvê-lo à porta de onde ele
          * acabou de sair. */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        {/* A porta da família — a home do responsável. Mesmo sistema
          * visual da home do motorista, porque é o mesmo produto e ele
          * precisa reconhecer onde está; conteúdo completamente outro,
          * porque ele não está comprando nada. Ver Familia.jsx. */}
        <Route path="/familia" element={<Familia />} />
        {/* O convite é o caminho principal do responsável: o código vem na
          * URL, então ele não digita nada além de email e senha. */}
        <Route path="/convite/:codigo" element={<Invite />} />
        {/* O LINK DO DIA — quem vai pegar a criança hoje acompanha a entrega
          * sem ter conta. Público de propósito: a avó não vai criar login
          * pra uma tarde. O que ela vê é decidido no servidor, campo a
          * campo (`functions/lib/reguaDoAcompanhamento.js`), e o link morre
          * à meia-noite. */}
        <Route path="/acompanhar/:token" element={<Acompanhar />} />
        <Route path="/quero-fazer-parte" element={<DriverSignup />} />
        {/* /conheca — o folheto verde antigo. Link velho, QR impresso e
          * favorito continuam funcionando; hoje eles chegam na landing.
          *
          * Este é o ÚNICO redirecionamento que sai do app, e por isso não é
          * <Navigate>: quem pediu "conheça" quer a apresentação, e ela mudou
          * de domínio. Mandar pro `/` interno cairia no login — a tela que
          * responde "quem é você", não "o que é isto". */}
        <Route path="/conheca" element={<ParaOSite />} />
        <Route path="/welcome" element={<Welcome />} />
        {/* A sala de espera de quem tem sessão e ainda não tem papel. Não é
          * pública: exige estar logado, e é para onde `painelDe` manda quem
          * não tem documento de usuário. */}
        <Route path="/comecar" element={<Comecar />} />
        <Route path="/login" element={<Login />} />
        <Route path="/first-access" element={<FirstAccess />} />
        <Route path="/first-admin" element={<FirstAdmin />} />
        <Route path="/auth-action" element={<AuthAction />} />
        <Route path="/termos" element={<Terms />} />
        <Route path="/privacidade" element={<Privacy />} />

      {/* Painel do dono do produto — fora do /tio de propósito: são dois
        * papéis diferentes na mesma pessoa hoje, e vão ser duas pessoas
        * quando houver o segundo parceiro. */}
      <Route
        path="/admin"
        element={
          <SuperAdminRoute>
            <AdminPanel />
          </SuperAdminRoute>
        }
      />
      {/* A FILA VOLTOU PRA DENTRO DO PAINEL — aba "Fila".
        *
        * Eram duas telas de dono lendo a MESMA coleção (`waitlistDrivers`): a
        * aba mostrava a lista com o funil de quatro estados, e esta rota
        * mostrava a mesma lista com um liga-desliga. A ficha da Visão geral
        * levava pra cá, atravessando o painel pra chegar no que já estava
        * dentro dele.
        *
        * O caminho continua respondendo em vez de virar 404: ele foi divulgado
        * como link e está escrito em comentário de outra tela. Redireciona
        * pro painel, que é onde a fila mora agora. */}
      <Route
        path="/admin/parceiros"
        element={<Navigate to="/admin" replace />}
      />

      {/* Painel do Tio (admin) — rotas aninhadas com layout compartilhado */}
      <Route
        path="/tio"
        element={
          <PrivateRoute requireRole="admin">
            {/* O guarda envolve o layout de fora, e não de dentro: o
              * TioLayout assina crianças, chamadas e faturas no topo, e hook
              * não pode ser condicional. Um cartão de conta inativa lá
              * dentro chegaria DEPOIS de todo o dado ter sido carregado —
              * e desfoque sobre dado carregado é CSS, não proteção. */}
            <PrimeiroAcessoGate>
              <GuardaDaConta>
                <TioLayout />
              </GuardaDaConta>
            </PrimeiroAcessoGate>
          </PrivateRoute>
        }
      >
        <Route index element={<TioDashboard />} />
        <Route path="children" element={<TioChildren />} />
        <Route path="children/new" element={<ChildForm />} />
        <Route path="children/escolas" element={<TioEscolas />} />
        <Route path="children/:id" element={<ChildDetail />} />
        <Route path="children/:id/contract" element={<TioContract />} />
        <Route
          path="children/:id/extrato"
          element={<TioChildStatement />}
        />
        {/* O Kanban dos seis turnos foi removido junto com os turnos.
          * `route` continua respondendo pra não quebrar link salvo — e
          * manter duas telas de rota, uma no modelo velho, seria pior:
          * a falta marcada numa não aparecia na outra. */}
        <Route path="route" element={<TioRouteNow />} />
        <Route path="route/now" element={<TioRouteNow />} />
        {/* "Planejar rota padrão" virou "Horários": a ordem deixou de ser
          * arrastada à mão e passou a cair do horário que ele definiu pra cada
          * responsável. O caminho antigo continua respondendo pra não
          * quebrar link salvo nem o botão de alguma tela ainda não migrada. */}
        <Route path="horarios" element={<TioHorarios />} />
        <Route path="semana" element={<TioSemana />} />
        <Route path="route/plan" element={<TioHorarios />} />
        <Route path="finance" element={<TioFinance />} />
        <Route path="finance/report" element={<TioFinanceReport />} />
        <Route path="finance/expenses" element={<TioExpenses />} />
        <Route path="pix" element={<TioPixConfig />} />
        <Route path="agenda" element={<TioAgenda />} />
        {/* O selo fica DENTRO do guarda: quem está bloqueado não precisa de
          * adesivo, precisa de voltar a operar. As três telas de voltar a
          * pagar são as únicas de fora, e o motivo está logo abaixo. */}
        <Route path="selo" element={<TioSelo />} />
        <Route path="indicar" element={<TioIndicar />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      {/* Painel do Pai (parent) — rotas aninhadas com layout compartilhado */}
      {/* ⚠️ AS TRÊS TELAS DE VOLTAR A PAGAR FICAM FORA DO GUARDA (06/09/2026).
        *
        * Elas moravam dentro do `TioLayout`, que o `GuardaDaConta` envolve por
        * fora. Quando a conta inativa, o guarda substitui o layout inteiro —
        * e o `<Outlet />` some junto. O botão "Ver planos" da tela de conta
        * inativa navegava e a tela NÃO MUDAVA: o mesmo bloqueio de novo.
        *
        * Beco sem saída, e do pior tipo: quem quer pagar não consegue chegar
        * na tela de pagar. É o gêmeo, na interface, do respiro que as rules
        * ganharam em `temPapelDeMotorista()` — e as duas metades precisavam
        * existir, senão a tranca prendia quem estava tentando sair.
        *
        * Elas não perdem nada fora do layout: as três já são de tela cheia,
        * com o próprio "Voltar". O que elas perdem é a barra de navegação da
        * operação, que é exatamente o que a conta inativa não tem. */}
      <Route
        path="/tio/planos"
        element={
          <PrivateRoute requireRole="admin">
            <TioPlanos />
          </PrivateRoute>
        }
      />
      <Route
        path="/tio/taxa"
        element={
          <PrivateRoute requireRole="admin">
            <TioTaxa />
          </PrivateRoute>
        }
      />
      <Route
        path="/tio/contrato-plataforma"
        element={
          <PrivateRoute requireRole="admin">
            <TioContratoAssociacao />
          </PrivateRoute>
        }
      />

      <Route
        path="/pai"
        element={
          <PrivateRoute requireRole="parent">
            <PaiLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<PaiDashboard />} />
        {/* O histórico de faltas, mês a mês. O painel responde "esta semana
          * e este mês"; aqui ele olha pra trás, que é o que a conversa com a
          * escola e a conferência da mensalidade pedem. */}
        <Route path="faltas" element={<PaiFaltas />} />
        <Route path="finance" element={<PaiFinance />} />
        <Route path="finance/report" element={<PaiFinanceReport />} />
        <Route path="map" element={<PaiMap />} />
        <Route path="child" element={<ChildDetail />} />
        <Route path="adicionar-filho" element={<AddChild />} />
        <Route path="contrato" element={<PaiContract />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="profile" element={<Profile />} />
      </Route>

        {/* A escolha "sou pai / sou motorista" saiu do caminho: o papel vem
          * do doc users. /welcome segue existindo pra links antigos. */}
        <Route path="*" element={<NaoEncontrado />} />
        </Routes>
        </ErrorBoundary>
      </Suspense>

      {/* Banner global de cookies — aparece só na primeira visita */}
      <CookieBanner />
    </>
  );
}
