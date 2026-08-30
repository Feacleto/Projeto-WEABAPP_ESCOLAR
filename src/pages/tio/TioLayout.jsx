import { useEffect, useMemo, useState, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Home, DollarSign } from 'lucide-react';
import BottomNav from '../../components/layout/BottomNav';
import InstallPrompt from '../../components/common/InstallPrompt';
import InteractiveTour from '../../components/tutorial/InteractiveTour';
import AvisoDaPlataforma from '../../components/tio/AvisoDaPlataforma';
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
  const { user, profile } = useAuth();
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
  const naTelaDaTaxa = location.pathname.startsWith('/tio/taxa');
  const { fatura } = useFaturaPlataforma(user?.uid);

  return (
    <div className="min-h-screen pb-28">
      {!naTelaDaTaxa && (
        <AvisoDaPlataforma fatura={fatura} criancas={children?.length || 0} />
      )}
      <Outlet context={{ openTutorial }} />
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
