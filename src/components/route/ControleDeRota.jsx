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
export default function ControleDeRota({ onIniciar, direcao = null }) {
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
      /* A ÂNCORA DO TUTORIAL MORA AQUI, e o passo aponta pra cá de novo.
       *
       * Ela já tinha sido removida uma vez, corretamente: nenhum passo a
       * referenciava, porque o passo "Começar a viagem" tinha sido repontado
       * pra âncora `hero`. Só que o `hero` é o cartão da PRÓXIMA VIAGEM, na
       * rolagem da página, e este botão é uma barra FIXA no topo — coisas
       * diferentes. O tutorial iluminava o cartão da hora enquanto o texto
       * dizia "este mesmo quadro vira o botão de iniciar a rota", que nunca
       * foi verdade.
       *
       * Órfã ela era sintoma, não causa: o problema era o passo apontando pro
       * elemento errado. */
      <button
        type="button"
        data-tour="start-route"
        onClick={iniciar}
        className="tap w-full rounded-2xl bg-primary text-white font-extrabold text-base flex items-center justify-center gap-2 shadow-focus"
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
    <div className="rounded-2xl border border-primaryBorder bg-primarySoft p-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center shrink-0">
        {semSinal ? <CircleAlert size={17} /> : <Satellite size={17} />}
      </div>
      {/* O NOME DO MODO, ESCRITO.
        *
        * "Rota ativa" descreve o GPS, não a tela. E a tela inteira acabou de
        * trocar de papel: some a saudação, some o índice do cadastro, aparece
        * a operação da rota. Quem abre o app no meio da tarde não acompanhou
        * essa transição — precisa ler onde está antes de tocar em qualquer
        * coisa.
        *
        * A DIREÇÃO importa mais que o modo: às 12h o motorista faz as duas
        * viagens com uma hora de diferença, e "levando" ou "trazendo" muda o
        * que ele espera ver na lista. Sem `direcao`, degrada pra "MODO ROTA"
        * seco — nunca fica pela metade. */}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-primary leading-tight">
          modo rota
          {direcao === 'ida' && ' · levando pra escola'}
          {direcao === 'volta' && ' · trazendo pra casa'}
        </p>
        <p className="text-[11px] text-primary/75 mt-0.5">
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
            : 'bg-card border border-primaryBorder text-primary'
        }`}
      >
        <Square size={13} />
        {confirmandoParada ? 'Confirmar' : 'Encerrar'}
      </button>
    </div>
  );
}
