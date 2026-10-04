import { useEffect, useRef, useState } from 'react';
import { Phone, X, CheckCircle2, Volume2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../common/Button';
import {
  acknowledgeCall,
  resolveCall,
  CALL_STATUS,
} from '../../services/pendingCallService';
import { areSoundsEnabled } from '../../services/soundService';
import { fraseDaBuzina } from '../../dominio/rota/buzina.js';

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
  // UM ESTADO POR BOTÃO (03/10/2026). Os dois liam o mesmo `submitting`, e
  // tocar em "Estou indo!" fazia o "Não posso agora" girar junto — ela não
  // sabia qual dos dois tinha ido.
  const [submitting, setSubmitting] = useState(false);
  const [recusando, setRecusando] = useState(false);
  // O NAVEGADOR PODE RECUSAR O SOM. Tocar áudio sem um toque antes é
  // bloqueado em muitos aparelhos (autoplay), e a tela ficava tocando em
  // silêncio sem dizer nada. Quando o `play()` é recusado, aparece o botão
  // "Toque para ouvir" — o toque dela é o gesto que o navegador exige.
  const [somBloqueado, setSomBloqueado] = useState(false);
  // O nome que ELA usa (a marca dele, "Tio Zé"), passado pelo layout. O topo,
  // a frase e a confirmação dizem o MESMO nome — eram "Fulano está ligando"
  // em cima e "O motorista sabe…" embaixo, como se fossem duas pessoas.
  const quem = String(adminName || '').trim() || 'O motorista';
  // "Fechar" depois do "Estou indo!" esconde a tela SÓ AQUI. Resolver a
  // chamada apagaria do celular do motorista o "está a caminho" que ela
  // acabou de mandar — e é por esse aviso que ele espera na porta.
  const [fechadaId, setFechadaId] = useState(null);
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
    if (p && p.then) {
      p.then(() => setSomBloqueado(false)).catch(() => setSomBloqueado(true));
    }
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
    } finally {
      // ⚠️ Só o ERRO devolvia o botão. No sucesso a tela trocava para
      // "Fechar" com `submitting` ainda ligado, e o Fechar ficava girando
      // para sempre — a tela cheia não saía mais.
      setSubmitting(false);
    }
  };

  const onDismiss = async () => {
    if (!call?.id) return;
    setRecusando(true);
    try {
      await resolveCall(call.id, 'parent_cancel');
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível cancelar.');
      setRecusando(false);
    }
  };

  if (!call || call.id === fechadaId) return null;

  const isAcknowledged = call.status === CALL_STATUS.ACKNOWLEDGED;

  return (
    <div className="fixed inset-0 z-[60] bg-gradient-to-br from-primary via-primary to-primaryDark text-white flex flex-col items-center justify-between p-8 max-w-mobile mx-auto">
      {/* Topo */}
      <div className="w-full text-center mt-8 space-y-2">
        {/* 18px: era o rótulo de 12px, e é a linha que diz QUEM chama. */}
        <p className="text-lg font-bold text-menta inline-flex items-center gap-2">
          <span className="relative inline-flex">
            <span className="absolute inline-flex h-2 w-2 rounded-full bg-white opacity-75 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
          </span>
          {quem} está ligando
        </p>
        {somBloqueado && !isAcknowledged && (
          <button
            type="button"
            onClick={startRingtone}
            className="tap mx-auto mt-2 inline-flex h-12 items-center gap-2 rounded-full bg-white/20 px-5 text-base font-semibold text-white"
          >
            <Volume2 size={20} />
            Toque para ouvir
          </button>
        )}
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
              ? `${quem} sabe que você está indo. Pode fechar.`
              : // A régua escreve "O motorista" porque o push sai do servidor
                // (espelho em `reguaDaRotaAoVivo.js`) — aqui, com o nome à
                // mão, a frase usa o mesmo nome do topo.
                fraseDaBuzina({ momento: call.momento, nomeDaCrianca: call.childName })
                  .replace(/^O motorista/, quem)}
          </p>
        </div>
      </div>

      {/* Botões */}
      <div className="w-full space-y-3 max-w-sm">
        {isAcknowledged ? (
          <Button
            variant="success"
            icon={CheckCircle2}
            onClick={() => setFechadaId(call.id)}
            className="!h-16 !text-lg !bg-accent !text-onAccent hover:!bg-accent"
          >
            Fechar
          </Button>
        ) : (
          <>
            <Button
              icon={CheckCircle2}
              onClick={onAck}
              loading={submitting}
              disabled={recusando}
              className="!h-16 !text-lg !bg-accent !text-onAccent hover:!bg-accent shadow-float"
            >
              Estou indo!
            </Button>
            <Button
              variant="ghost"
              icon={X}
              onClick={onDismiss}
              loading={recusando}
              disabled={submitting}
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
