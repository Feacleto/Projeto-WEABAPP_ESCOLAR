import { useEffect, useState } from 'react';
import {
  Bus,
  CheckCircle2,
  AlertCircle,
  Activity,
  Users,
} from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { onSnapshot, doc } from 'firebase/firestore';
import Header from '../../components/layout/Header';
import Card from '../../components/common/Card';
import Skeleton from '../../components/common/Skeleton';
import { useAuth } from '../../hooks/useAuth';
import { useChildren } from '../../hooks/useChildren';
import { getEffectiveStatus } from '../../services/childrenService';
import { db } from '../../firebase/config';

export default function TioDashboard() {
  const { profile } = useAuth();
  // openTutorial mantido pra futuros usos; logout/help migraram pro perfil
  // eslint-disable-next-line no-unused-vars
  const { openTutorial } = useOutletContext() || {};
  const { children, loading } = useChildren();
  const [routeActive, setRouteActive] = useState(false);

  // Live status da rota — escuta liveLocation/current. ETAPA 4 vai escrever aqui.
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'liveLocation', 'current'),
      (snap) => {
        setRouteActive(snap.exists() ? !!snap.data().routeActive : false);
      },
      () => setRouteActive(false)
    );
    return unsub;
  }, []);

  // Usa effective status (reseta automaticamente em virada de dia)
  const total = children.length;
  const onVan = children.filter(
    (c) => getEffectiveStatus(c) === 'onboard'
  ).length;
  const delivered = children.filter(
    (c) => getEffectiveStatus(c) === 'delivered'
  ).length;

  const firstName = profile?.name?.split(' ')[0] || 'Tio';

  return (
    <>
      <Header title={`Olá, ${firstName}`} />

      <div className="p-4 space-y-3">
        <Card
          className={`flex items-center gap-4 ${
            routeActive ? 'bg-success/10' : ''
          }`}
        >
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
              routeActive ? 'bg-success/20' : 'bg-gray-100'
            }`}
          >
            <Activity
              size={22}
              className={routeActive ? 'text-success' : 'text-textMuted'}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-textMuted">Status da rota</p>
            <p className="font-semibold text-text">
              {routeActive ? 'Ativa' : 'Inativa'}
            </p>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={Users}
            label="Crianças ativas"
            value={loading ? null : total}
            color="text-primary"
          />
          <StatCard
            icon={Bus}
            label="Na perua agora"
            value={loading ? null : onVan}
            color="text-primaryDark"
          />
          <StatCard
            icon={CheckCircle2}
            label="Entregues hoje"
            value={loading ? null : delivered}
            color="text-success"
          />
          <StatCard
            icon={AlertCircle}
            label="Pagamentos"
            value="—"
            hint="Em breve"
            color="text-warning"
          />
        </div>
      </div>
    </>
  );
}

function StatCard({ icon: Icon, label, value, color, hint }) {
  return (
    <Card className="flex flex-col gap-2">
      <div className={color}>
        <Icon size={20} />
      </div>
      <p className="text-xs text-textMuted">{label}</p>
      {value === null ? (
        <Skeleton className="h-7 w-12" />
      ) : (
        <p className="text-2xl font-bold text-text leading-none">{value}</p>
      )}
      {hint && <p className="text-[10px] text-textMuted">{hint}</p>}
    </Card>
  );
}
