import { useEffect, useRef, useState } from 'react';
import { Play, Square, Satellite, CircleAlert, MapPin, MapPinOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { setCompartilharLocalizacao } from '../../services/userService';
import { useGeolocation } from '../../hooks/useGeolocation';
import { ofertarPelaPrimeiraRota } from '../../services/associadoService';
import { podeOferecer } from '../../dominio/associacao/ofertaDaPrimeiraRota';
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
export default function ControleDeRota({ onIniciar, direcao = null, alvos = [] }) {
  const { user, profile, updateProfile, refreshProfile } = useAuth();
  // AUSENTE É LIGADO — ver `setCompartilharLocalizacao`.
  const compartilha = profile?.compartilhaLocalizacao !== false;
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
    start(user.uid, { alvos, compartilha });
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
    // O uid vai adiante: quem encerra a rota é quem sabe de quem ela é, e
    // `avisarQuemFicou` precisa dele pra achar a turma.
    await stop(user?.uid);
    toast.success('Rota encerrada.');

    /* ⚠️ A OFERTA NASCE AQUI — no fim da PRIMEIRA rota, não no começo.
     *
     * `trialInicio` grava quando o GPS liga; o momento da PROVA é este: ele
     * acabou de ver o laço inteiro do produto fechar. E antes disso o app
     * ficava mudo sobre preço por 60 dias, enquanto o desconto de 30% vencia
     * sozinho.
     *
     * Só na primeira: `ofertaEstado` ausente é "nunca ofereci". Quem já
     * recebeu, recusou ou contratou não passa por `podeOferecer`.
     *
     * Sem `await` e sem bloquear — encerrar a rota não espera por oferta
     * nenhuma. Quem abre a folha é o `TioLayout`, ao ver o perfil mudar. */
    if (user?.uid && !profile?.ofertaEstado && podeOferecer({ motorista: profile }).ok) {
      ofertarPelaPrimeiraRota(user.uid).then(() => refreshProfile());
    }
  }

  /**
   * A CHAVE DO MAPA — e ela mora AQUI porque este é o instante do ato.
   *
   * Ela esteve pra ir numa folha de ajustes. O dono decidiu que fica no
   * início da rota, e está certo por três motivos: é o momento em que o
   * compartilhamento começa; é a tela que ele abre todo dia; e é a única que
   * continua na mão dele enquanto dirige — numa folha de ajustes, a chave
   * sumiria exatamente no minuto em que ele quisesse desligá-la.
   *
   * GRUDADA, não por dia: ele liga uma vez e fica, até desligar. Perguntar
   * toda manhã transformaria uma decisão em pedágio diário.
   */
  async function trocarCompartilhamento() {
    const novo = !compartilha;
    // Otimista: a chave responde ao toque e o banco acompanha. Errar aqui
    // custa uma chave que volta sozinha, não uma rota parada.
    updateProfile?.({ compartilhaLocalizacao: novo });
    try {
      await setCompartilharLocalizacao(user?.uid, novo);
    } catch {
      updateProfile?.({ compartilhaLocalizacao: compartilha });
      toast.error('Não deu pra salvar. Tente de novo.');
    }
  }

  const ChaveDoMapa = (
    <button
      type="button"
      onClick={trocarCompartilhamento}
      aria-pressed={compartilha}
      className="tap mt-2 flex w-full items-start gap-2.5 rounded-xl border border-border bg-card p-3 text-left"
    >
      <span
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          compartilha ? 'bg-primaryChip text-primary' : 'bg-neutro text-textMuted'
        }`}
      >
        {compartilha ? <MapPin size={16} /> : <MapPinOff size={16} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold text-text">
          {compartilha
            ? 'As famílias veem sua perua no mapa'
            : 'Sua perua não aparece no mapa'}
        </span>
        {/* ⚠️ AS DUAS FRASES QUE A CHAVE PRECISA DIZER, E ELAS NÃO SÃO ENFEITE.
          *
          * 1. O GPS CONTINUA LIGADO. Ele desligou o compartilhamento, não o
          *    aparelho — o celular segue medindo pra poder avisar as famílias
          *    que ele está chegando. Sem esta frase ele descobre depois e
          *    sente que foi enganado.
          * 2. O MAPA É REFERÊNCIA. A posição publicada é encaixada numa
          *    grade de 150 m: mostra a quadra, nunca a porta. */}
        <span className="mt-0.5 block text-[11px] leading-relaxed text-textMuted">
          {compartilha
            ? 'Posição aproximada, por referência — não mostra o ponto exato. Toque para desligar.'
            : 'O GPS continua ligado: elas seguem recebendo o aviso de que você está chegando. Toque para mostrar no mapa.'}
        </span>
      </span>
    </button>
  );

  if (!watching) {
    return (
      <>
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
      {ChaveDoMapa}
      </>
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
