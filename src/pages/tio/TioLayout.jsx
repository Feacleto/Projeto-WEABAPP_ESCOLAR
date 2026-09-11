import { useEffect, useMemo, useState, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Home, DollarSign } from 'lucide-react';
import BottomNav from '../../components/layout/BottomNav';
import { indiceDaAba } from '../../compartilhado/abaAtiva';
import InstallPrompt from '../../components/common/InstallPrompt';
import ConvitePush from '../../components/tio/ConvitePush';
import InteractiveTour from '../../components/tutorial/InteractiveTour';
import AvisoDaPlataforma from '../../components/tio/AvisoDaPlataforma';
import AvisoDoTrial from '../../components/tio/AvisoDoTrial';
import OfertaDoFechamento from '../../components/tio/OfertaDoFechamento';
import {
  recusarOferta,
  aceitarOferta,
} from '../../services/associadoService';
import { useAuth } from '../../hooks/useAuth';
import { useAutoBilling } from '../../hooks/useAutoBilling';
import { useFaturaPlataforma } from '../../hooks/useFaturaPlataforma';
import { useActiveCallsForAdmin } from '../../hooks/usePendingCall';
import { useChildren } from '../../hooks/useChildren';
import OutgoingCallPanel from '../../components/call/OutgoingCallPanel';
import BirthdayModal from '../../components/festive/BirthdayModal';
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
 * "Rota" saiu porque virou o Início: a operação inteira mora lá agora.
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
    label: 'Financeiro',
    icon: DollarSign,
    tour: 'nav-finance',
  },
];

/**
 * Layout do painel do Tio: <Outlet /> + BottomNav fixo.
 * Notificações e perfil ficam no Header (sino + ícone à direita).
 */
export default function TioLayout() {
  const { user, profile, refreshProfile } = useAuth();
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

  useEffect(() => {
    if (ofertaJaAbriu.current) return;
    if (profile?.ofertaEstado !== 'pendente') return;
    ofertaJaAbriu.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOfertaAberta(true);
  }, [profile?.ofertaEstado]);

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
  const { fatura } = useFaturaPlataforma(user?.uid);

  const abaAtiva = indiceDaAba(location.pathname, NAV_ITEMS);
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
    <div className="min-h-screen pb-28">
      {!naTelaDaTaxa && (
        <AvisoDaPlataforma fatura={fatura} criancas={children?.length || 0} />
      )}
      {/* O aviso do teste fica ABAIXO do da plataforma, e some sozinho quando
        * o outro importa: quem já tem fatura passou do trial, e avisoDoTrial
        * devolve null pra quem tem contrato. Duas cobranças na mesma tela
        * seria o app falando de dinheiro duas vezes antes de o motorista ver
        * a rota do dia. */}
      {!naTelaDaTaxa && <AvisoDoTrial temContrato={!!fatura} />}

      <OfertaDoFechamento
        aberta={ofertaAberta}
        motorista={profile}
        criancas={(children || []).filter((c) => c.active !== false).length}
        onFechar={() => setOfertaAberta(false)}
        onRecusar={() => responderOferta(recusarOferta)}
        onAceitar={() => responderOferta(aceitarOferta)}
      />
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
        <Outlet context={{ openTutorial }} />
      </div>
      <BottomNav items={NAV_ITEMS} />
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
  );
}
