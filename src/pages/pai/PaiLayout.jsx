import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Home, DollarSign } from 'lucide-react';
import BottomNav from '../../components/layout/BottomNav';
import InstallPrompt from '../../components/common/InstallPrompt';
import InteractiveTour from '../../components/tutorial/InteractiveTour';
import { useAuth } from '../../hooks/useAuth';
import { useActiveCallForParent } from '../../hooks/usePendingCall';
import { useAdminProfile } from '../../hooks/useAdminProfile';
import { useActiveChild } from '../../hooks/useActiveChild';
import IncomingCallModal from '../../components/call/IncomingCallModal';
import BirthdayModal from '../../components/festive/BirthdayModal';
import {
  isBirthdayToday,
  shouldShowBirthdayModal,
  markBirthdayModalShown,
} from '../../services/birthdayService';

const NAV_ITEMS = [
  { to: '/pai', label: 'Início', icon: Home, end: true, tour: 'nav-home' },
  {
    to: '/pai/finance',
    label: 'Financeiro',
    icon: DollarSign,
    tour: 'nav-finance',
  },
];

/**
 * Layout do painel do Pai: <Outlet /> + BottomNav fixo.
 * Notificações e perfil ficam no Header (sino + ícone à direita).
 */
export default function PaiLayout() {
  const { user, profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  // null | 'first' (primeiro acesso) | 'review' (pediu pra rever no perfil)
  const [tour, setTour] = useState(null);
  const [birthdayOpen, setBirthdayOpen] = useState(false);

  // Chamada ativa do Tio pro Pai (modal fullscreen com ringtone)
  const activeCall = useActiveCallForParent(user?.uid);
  const { admin } = useAdminProfile();
  const { child } = useActiveChild();
  const childBirthdayToday = child && isBirthdayToday(child.birthDate);

  // Primeiro acesso: o tour abre sozinho e volta a cada login enquanto o
  // responsável não chegar no último passo. Pular é permitido; concluir é o
  // que desliga.
  useEffect(() => {
    if (profile && profile.tutorialDone !== true) {
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
    if (childBirthdayToday && shouldShowBirthdayModal()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBirthdayOpen(true);
    }
  }, [childBirthdayToday]);

  const onCloseBirthday = () => {
    setBirthdayOpen(false);
    markBirthdayModalShown();
  };

  // Usado pelo "Como usar o app" do painel
  const openTutorial = () => setTour('review');

  return (
    <div className="min-h-screen pb-28">
      <Outlet context={{ openTutorial }} />
      <BottomNav items={NAV_ITEMS} />

      {/* Sem um ícone na tela de início, o link do WhatsApp continua sendo
        * o único caminho do pai pro app — pra sempre. Este convite troca
        * "achar a conversa certa" por "tocar no ícone". */}
      <InstallPrompt />
      <InteractiveTour
        open={!!tour}
        mode={tour || 'review'}
        onClose={() => setTour(null)}
      />

      {/* Modal de chamada — bloqueia tudo quando o Tio liga */}
      {activeCall && (
        <IncomingCallModal call={activeCall} adminName={admin?.name} />
      )}

      {birthdayOpen && child && (
        <BirthdayModal
          children={[child]}
          role="pai"
          onClose={onCloseBirthday}
        />
      )}
    </div>
  );
}
