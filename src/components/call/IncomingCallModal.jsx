import { useEffect, useRef, useState } from 'react';
import { Phone, X, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../common/Button';
import {
  acknowledgeCall,
  resolveCall,
  CALL_STATUS,
} from '../../services/pendingCallService';
import { areSoundsEnabled } from '../../services/soundService';

const RING_PATH = '/sounds/ringtone.mp3';
const RING_MAX_MS = 60_000; // 60s — depois disso o ringtone para sozinho

/**
 * Modal fullscreen que aparece pro Pai quando o Tio dispara uma chamada.
 * Bloqueia o app, toca ringtone em loop e oferece 2 ações:
 *   - "Estou indo!"     → acknowledge (ringtone para, modal fecha)
 *   - "Não posso agora" → resolve com cancel (fica registrado)
 *
 * Ringtone respeita preferência de sons (`tn_sounds_enabled` no localStorage).
 * Vibração contínua enquanto ringing (Android).
 */
export default function IncomingCallModal({ call, adminName }) {
  const [submitting, setSubmitting] = useState(false);
  const audioRef = useRef(null);
  const vibrateIntervalRef = useRef(null);

  // Helpers — declarados antes do useEffect (regra de hoisting do lint)
  const startRingtone = () => {
    if (!areSoundsEnabled()) return;
    if (!audioRef.current) {
      try {
        audioRef.current = new Audio(RING_PATH);
        audioRef.current.loop = true;
        audioRef.current.volume = 0.7;
      } catch {
        return;
      }
    }
    audioRef.current.currentTime = 0;
    const p = audioRef.current.play();
    if (p && p.catch) p.catch(() => {});
  };

  const stopRingtone = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const startVibration = () => {
    if (!('vibrate' in navigator)) return;
    try {
      navigator.vibrate([400, 200, 400, 200, 400, 600]);
    } catch {
      // ignore
    }
    vibrateIntervalRef.current = setInterval(() => {
      try {
        navigator.vibrate([400, 200, 400, 200, 400, 600]);
      } catch {
        // ignore
      }
    }, 2400);
  };

  const stopVibration = () => {
    if (vibrateIntervalRef.current) {
      clearInterval(vibrateIntervalRef.current);
      vibrateIntervalRef.current = null;
    }
    try {
      navigator.vibrate(0);
    } catch {
      // ignore
    }
  };

  // Inicia / para ringtone + vibração baseado no status da call
  useEffect(() => {
    if (!call) return;
    if (call.status !== CALL_STATUS.RINGING) {
      stopRingtone();
      stopVibration();
      return;
    }
    startRingtone();
    startVibration();

    // Auto-stop após RING_MAX_MS (não cancela a call, só silencia)
    const t = setTimeout(() => {
      stopRingtone();
      stopVibration();
    }, RING_MAX_MS);

    return () => {
      clearTimeout(t);
      stopRingtone();
      stopVibration();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call?.id, call?.status]);

  const onAck = async () => {
    if (!call?.id) return;
    setSubmitting(true);
    try {
      await acknowledgeCall(call.id);
      toast.success('Avisado! O motorista está esperando.');
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível confirmar.');
      setSubmitting(false);
    }
  };

  const onDismiss = async () => {
    if (!call?.id) return;
    setSubmitting(true);
    try {
      await resolveCall(call.id, 'parent_cancel');
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível cancelar.');
      setSubmitting(false);
    }
  };

  if (!call) return null;

  const isAcknowledged = call.status === CALL_STATUS.ACKNOWLEDGED;

  return (
    <div className="fixed inset-0 z-[60] bg-gradient-to-br from-emerald-500 via-emerald-600 to-green-700 text-white flex flex-col items-center justify-between p-8 max-w-mobile mx-auto">
      {/* Topo */}
      <div className="w-full text-center mt-8 space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest text-white/80 inline-flex items-center gap-2">
          <span className="relative inline-flex">
            <span className="absolute inline-flex h-2 w-2 rounded-full bg-white opacity-75 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
          </span>
          {adminName || 'Motorista'} está ligando
        </p>
      </div>

      {/* Centro — ícone animado + mensagem */}
      <div className="flex flex-col items-center text-center gap-6">
        <div className="w-32 h-32 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border-4 border-white/40 animate-pulse">
          <Phone size={56} className="text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold leading-tight">
            {isAcknowledged ? 'Você avisou!' : 'Estamos esperando'}
          </h1>
          <p className="text-white/90 text-lg mt-3 max-w-xs">
            {isAcknowledged
              ? 'O motorista sabe que você tá indo. Pode fechar.'
              : `O motorista chegou pra entregar ${call.childName || 'a criança'}. Pode descer?`}
          </p>
        </div>
      </div>

      {/* Botões */}
      <div className="w-full space-y-3 max-w-sm">
        {isAcknowledged ? (
          <Button
            variant="success"
            icon={CheckCircle2}
            onClick={onDismiss}
            loading={submitting}
            className="!h-16 !text-lg !bg-white !text-emerald-700 hover:!bg-white"
          >
            Fechar
          </Button>
        ) : (
          <>
            <Button
              icon={CheckCircle2}
              onClick={onAck}
              loading={submitting}
              className="!h-16 !text-lg !bg-white !text-emerald-700 hover:!bg-white shadow-2xl"
            >
              Estou indo!
            </Button>
            <Button
              variant="ghost"
              icon={X}
              onClick={onDismiss}
              loading={submitting}
              className="!text-white hover:!bg-white/10"
            >
              Não posso agora
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
