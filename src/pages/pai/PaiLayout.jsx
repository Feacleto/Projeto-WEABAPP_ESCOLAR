import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Home, DollarSign } from 'lucide-react';
import BottomNav from '../../components/layout/BottomNav';
import Tutorial from '../../components/tutorial/Tutorial';
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
  { to: '/pai', label: 'Início', icon: Home, end: true },
  { to: '/pai/finance', label: 'Financeiro', icon: DollarSign },
];

/**
 * Layout do painel do Pai: <Outlet /> + BottomNav fixo.
 * Notificações e perfil ficam no Header (sino + ícone à direita).
 */
export default function PaiLayout() {
  const { user, profile } = useAuth();
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [birthdayOpen, setBirthdayOpen] = useState(false);

  // Chamada ativa do Tio pro Pai (modal fullscreen com ringtone)
  const activeCall = useActiveCallForParent(user?.uid);
  const { admin } = useAdminProfile();
  const { child } = useActiveChild();
  const childBirthdayToday = child && isBirthdayToday(child.birthDate);

  useEffect(() => {
    if (profile && profile.tutorialDone !== true) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWelcomeOpen(true);
    }
  }, [profile?.tutorialDone, profile]);

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

  const openTutorial = (opts = {}) => {
    if (opts.floating) setTourOpen(true);
    else setWelcomeOpen(true);
  };

  return (
    <div className="min-h-screen pb-28">
      <Outlet context={{ openTutorial }} />
      <BottomNav items={NAV_ITEMS} />
      {welcomeOpen && <Tutorial onClose={() => setWelcomeOpen(false)} />}
      <InteractiveTour open={tourOpen} onClose={() => setTourOpen(false)} />

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
