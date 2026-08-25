import { useEffect, useRef, useState } from 'react';
import { Play, Square, Satellite, CircleAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useLiveLocation } from '../../hooks/useLiveLocation';
import { playSound } from '../../services/soundService';

/**
 * Iniciar e encerrar a rota — o interruptor do GPS.
 *
 * POR QUE ELE MUDOU DE TELA
 * Ficava no Kanban dos seis turnos, que era uma tela de planejamento. O
 * motorista tinha que passar por ela pra ligar o rastreamento e só depois ir
 * operar. Com o fim dos turnos, o Kanban saiu — e este controle é a única
 * coisa dele que a operação não pode perder: sem rastreamento, o painel do
 * responsável fica com "a rota de hoje ainda não começou" o dia inteiro.
 *
 * ENCERRAR PEDE DOIS TOQUES
 * Não é diálogo de confirmação: é o mesmo botão mudando de rótulo por quatro
 * segundos. Encerrar por engano no meio da rota apaga a perua do mapa de todo
 * mundo, e um diálogo modal no celular em movimento é mais fácil de confirmar
 * sem ler do que um botão que muda de cara.
 */
export default function ControleDeRota({ onIniciar }) {
  const { user } = useAuth();
  const { watching, position, error, stopping, start, stop } = useGeolocation();
  const { location: liveLocation } = useLiveLocation();

  const [confirmandoParada, setConfirmandoParada] = useState(false);
  const ultimoErroRef = useRef(null);

  // Só avisa quando o erro MUDA, senão o GPS com sinal ruim enche a tela de
  // toasts idênticos enquanto ele dirige.
  useEffect(() => {
    if (!error) {
      ultimoErroRef.current = null;
      return;
    }
    const codigo = error?.code ?? error?.message;
    if (codigo === ultimoErroRef.current) return;
    ultimoErroRef.current = codigo;

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

  function iniciar() {
    if (!user?.uid) {
      toast.error('Sessão expirada. Entre de novo.');
      return;
    }
    start(user.uid);
    toast.success('Rota começou! GPS ligado.');
    // Quem sabe a fila é a tela de rota, não este botão. Ela publica a posição
    // de cada criança no dia — o responsável não consegue calcular isso
    // sozinho, porque a fila é feita das outras crianças, que ele não lê.
    onIniciar?.();
  }

  async function encerrar() {
    if (!confirmandoParada) {
      playSound('click');
      setConfirmandoParada(true);
      setTimeout(() => setConfirmandoParada(false), 4000);
      return;
    }
    setConfirmandoParada(false);
    await stop();
    toast.success('Rota encerrada.');
  }

  if (!watching) {
    return (
      /* `data-tour` é a âncora do tutorial guiado. Ela morava no Kanban e ficou
       * órfã quando aquela tela saiu: o passo "começar a viagem" apontava pra
       * um elemento que não existia mais, e o holofote não acendia. */
      <button
        type="button"
        onClick={iniciar}
        data-tour="start-route"
        className="tap w-full rounded-2xl bg-emerald-600 text-white font-extrabold text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25"
        style={{ height: 56 }}
      >
        <Play size={20} />
        INICIAR ROTA
      </button>
    );
  }

  const precisao = position?.coords?.accuracy ?? liveLocation?.accuracy;
  const semSinal = precisao == null;

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
        {semSinal ? <CircleAlert size={17} /> : <Satellite size={17} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-emerald-900 leading-tight">
          Rota ativa
        </p>
        <p className="text-[11px] text-emerald-900/70">
          {semSinal
            ? 'procurando sinal de GPS…'
            : `o responsável está te vendo · precisão ${Math.round(precisao)} m`}
        </p>
      </div>
      <button
        type="button"
        onClick={encerrar}
        disabled={stopping}
        className={`tap shrink-0 h-10 px-3 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-60 ${
          confirmandoParada
            ? 'bg-danger text-white'
            : 'bg-card border border-emerald-200 text-emerald-900'
        }`}
      >
        <Square size={13} />
        {confirmandoParada ? 'Confirmar' : 'Encerrar'}
      </button>
    </div>
  );
}
