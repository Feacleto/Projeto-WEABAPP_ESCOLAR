import { useEffect, useState, useRef } from 'react';
import {
  Play,
  Square,
  AlertTriangle,
  Activity,
  MapPin,
  Clock,
  Gauge,
  Compass,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../components/layout/Header';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { useAuth } from '../../hooks/useAuth';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useLiveLocation } from '../../hooks/useLiveLocation';
import { formatDateTime } from '../../utils/formatters';
import RouteKanban from '../../components/route/RouteKanban';

/**
 * Tela do Tio para iniciar/encerrar a rota.
 *
 * Observação UX: o botão "Encerrar rota" usa confirmação em duas etapas
 * (toque pra mudar pra vermelho, toque de novo pra confirmar) pra evitar
 * encerrar a rota acidentalmente em pleno trânsito.
 */
export default function TioRoute() {
  const { user } = useAuth();
  const { watching, position, error, stopping, start, stop } = useGeolocation();
  const { location: liveLocation } = useLiveLocation();

  const [confirmStop, setConfirmStop] = useState(false);
  const lastErrorCodeRef = useRef(null);

  // Só dispara toast quando o erro MUDA, pra não floodar tela de toasts
  useEffect(() => {
    if (!error) {
      lastErrorCodeRef.current = null;
      return;
    }
    const code = error?.code ?? error?.message;
    if (code === lastErrorCodeRef.current) return;
    lastErrorCodeRef.current = code;

    if (error.code === 1) {
      toast.error('Permissão de localização negada. Habilite no navegador.');
    } else if (error.code === 2) {
      toast.error('Sinal de GPS indisponível.');
    } else if (error.code === 3) {
      toast.error('Tempo esgotado ao buscar localização.');
    } else if (error.message) {
      toast.error(error.message);
    }
  }, [error]);

  const onStart = () => {
    if (!user?.uid) {
      toast.error('Sessão expirada. Faça login novamente.');
      return;
    }
    start(user.uid);
    toast.success('Rota iniciada. GPS ativo.');
  };

  const onStop = async () => {
    if (!confirmStop) {
      setConfirmStop(true);
      // Reset automático se o usuário não confirmar em 4s
      setTimeout(() => setConfirmStop(false), 4000);
      return;
    }
    setConfirmStop(false);
    await stop();
    toast.success('Rota encerrada.');
  };

  // Última leitura — preferimos a do GPS local (mais nova) e caímos
  // pra liveLocation/Firestore quando o GPS ainda não chegou.
  const acc = position?.coords?.accuracy ?? liveLocation?.accuracy;
  const speed = position?.coords?.speed ?? liveLocation?.speed;
  const heading = position?.coords?.heading ?? liveLocation?.heading;
  const lastUpdate = position
    ? new Date(position.timestamp)
    : liveLocation?.updatedAt;

  return (
    <>
      <Header title="Rota em tempo real" />

      <div className="p-4 space-y-4">
        <Card
          className={`flex items-center gap-4 ${
            watching ? 'bg-success/10' : ''
          }`}
        >
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
              watching ? 'bg-success/20' : 'bg-gray-100'
            }`}
          >
            <Activity
              size={22}
              className={watching ? 'text-success' : 'text-textMuted'}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-textMuted">Status</p>
            <p className="font-semibold text-text">
              {watching ? 'Rota em andamento' : 'Sem rota ativa'}
            </p>
          </div>
        </Card>

        {watching && (
          <div className="flex items-start gap-2 bg-warning/10 text-amber-800 rounded-xl p-3 text-xs leading-relaxed">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <p>
              <strong className="block">Mantenha o app aberto.</strong>
              O navegador pausa o GPS em segundo plano. Você pode trocar de aba
              dentro do app — o tracking continua.
            </p>
          </div>
        )}

        {watching ? (
          <Button
            variant={confirmStop ? 'danger' : 'secondary'}
            icon={Square}
            loading={stopping}
            onClick={onStop}
          >
            {confirmStop ? 'Toque novamente para confirmar' : 'Encerrar rota'}
          </Button>
        ) : (
          <Button variant="success" icon={Play} onClick={onStart}>
            Iniciar rota
          </Button>
        )}

        {watching && (
          <Card className="space-y-3">
            <h2 className="text-sm font-semibold text-text">Telemetria</h2>
            <Row
              icon={MapPin}
              label="Posição"
              value={
                position
                  ? `${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`
                  : 'Aguardando GPS...'
              }
            />
            <Row
              icon={Gauge}
              label="Precisão"
              value={acc != null ? `±${Math.round(acc)} m` : '—'}
            />
            <Row
              icon={Activity}
              label="Velocidade"
              value={
                speed != null && !isNaN(speed)
                  ? `${(speed * 3.6).toFixed(1)} km/h`
                  : '—'
              }
            />
            <Row
              icon={Compass}
              label="Direção"
              value={heading != null && !isNaN(heading) ? `${Math.round(heading)}°` : '—'}
            />
            <Row icon={Clock} label="Atualizado" value={formatDateTime(lastUpdate)} />
            <p className="text-[11px] text-textMuted pt-2 border-t border-gray-100">
              Salvamos no servidor a cada 30s para economizar bateria e dados —
              os pais veem com esse intervalo.
            </p>
          </Card>
        )}

        {!watching && liveLocation?.lat && liveLocation?.lng && (
          <Card className="text-xs text-textMuted">
            <p className="font-medium text-text mb-1">Última rota encerrada</p>
            <p className="font-mono">
              {Number(liveLocation.lat).toFixed(5)},{' '}
              {Number(liveLocation.lng).toFixed(5)}
            </p>
            <p>{formatDateTime(liveLocation.updatedAt)}</p>
          </Card>
        )}

        {/* Kanban de planejamento da rota — abaixo do GPS */}
        <div className="pt-2">
          <h2 className="text-sm font-bold text-text mb-2">
            Planejamento de hoje
          </h2>
          <p className="text-xs text-textMuted mb-3">
            Arraste pra reordenar. Toque em "Faltou" pra marcar ausência.
          </p>
          <RouteKanban />
        </div>
      </div>
    </>
  );
}

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-xs text-textMuted">
        <Icon size={14} />
        {label}
      </span>
      <span className="text-sm font-medium text-text font-mono text-right">
        {value}
      </span>
    </div>
  );
}
