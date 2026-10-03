import { useEffect, useRef, useState } from 'react';
import { Play, Satellite, CircleAlert, MapPin, MapPinOff, CalendarOff, ArrowRight, TriangleAlert } from 'lucide-react';
import { diaSemRota, fraseDoDiaSemRota } from '../../dominio/rota/calendario.js';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { setCompartilharLocalizacao } from '../../services/userService';
import { useGeolocation } from '../../hooks/useGeolocation';
import { ofertarPelaPrimeiraRota } from '../../services/associadoService';
import { podeOferecer } from '../../dominio/associacao/ofertaDaPrimeiraRota';
import { useLiveLocation } from '../../hooks/useLiveLocation';
import { playSound } from '../../services/soundService';
import { marcarOcorrencia } from '../../services/locationService';
import { encerrarChamadas } from '../../services/pendingCallService';
import SegurarParaEncerrar from './SegurarParaEncerrar';

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
 * ENCERRAR PEDE PARA SEGURAR (03/10/2026, design system)
 * Encerrar por engano no meio da rota apaga a perua do mapa de todo mundo.
 * Já foi um botão de dois toques (o rótulo virava "Confirmar" por quatro
 * segundos) — melhor que um diálogo modal, que no celular em movimento se
 * confirma sem ler, mas o segundo toque caía no mesmo lugar do primeiro.
 * Agora é `SegurarParaEncerrar`: 800 ms de dedo, e soltar antes desfaz.
 */
export default function ControleDeRota({
  onIniciar,
  direcao = null,
  alvos = [],
  saida = null,
  pendentes = [],
  // DENTRO DO CARTÃO VERDE DO INÍCIO (`ResumoDaTurma`). Parado, o botão vira o
  // limão do design system — o único lugar em que ele é botão: sobre verde, o
  // verde-escuro some. A rota ligada continua com a barra de sempre.
  destaque = false,
  // NO RODAPÉ DA TELA DA ROTA a faixa verde de cima já diz "ROTA ATIVA" e a
  // direção — repetir "modo rota · levando pra escola" logo embaixo seria a
  // tela falando a mesma coisa duas vezes. Ausente, fica como no Início.
  rodape = false,
}) {
  const { user, profile, updateProfile, refreshProfile } = useAuth();
  // AUSENTE É LIGADO — ver `setCompartilharLocalizacao`.
  const compartilha = profile?.compartilhaLocalizacao !== false;
  const { watching, position, error, stopping, start, stop, retomar } = useGeolocation();
  const { location: liveLocation } = useLiveLocation();

  // A ROTA ESTAVA ABERTA E O GPS NÃO: o app recarregou no meio do caminho.
  // Religa sozinho — o Início já mostra a rota, e pedir "INICIAR ROTA" de
  // novo faria ele achar que a rota tinha caído (ver `retomar`).
  const retomouRef = useRef(false);
  useEffect(() => {
    if (!user?.uid || watching || stopping || retomouRef.current) return;
    if (!liveLocation?.routeActive) return;
    retomouRef.current = true;
    retomar(user.uid, { alvos, compartilha });
    toast('GPS religado. A rota continua.');
  }, [user?.uid, watching, stopping, liveLocation?.routeActive, retomar, alvos, compartilha]);

  // Quem ainda está pendente aparece ao COMEÇAR a segurar, e fica à vista um
  // tempo depois de soltar: quem aperta, lê o nome e solta não encerrou nada,
  // e precisa de tempo para ler antes de segurar de novo.
  const [mostrandoPendentes, setMostrandoPendentes] = useState(false);
  const esconderPendentesRef = useRef(null);
  useEffect(() => () => clearTimeout(esconderPendentesRef.current), []);
  const [rodarMesmoAssim, setRodarMesmoAssim] = useState(false);
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
    start(user.uid, {
      alvos,
      compartilha,
      // Quem recebe "a perua saiu": as famílias DESTA viagem, sem quem está
      // fora hoje (ver `avisarSaidaDaRota`).
      saida: saida ? { ...saida, semMapa: !compartilha } : null,
    });
    toast.success('Rota começou! GPS ligado.');
    // Quem sabe a fila é a tela de rota, não este botão. Ela publica a posição
    // de cada criança no dia — o responsável não consegue calcular isso
    // sozinho, porque a fila é feita das outras crianças, que ele não lê.
    onIniciar?.();
  }

  function comecouASegurar() {
    playSound('click');
    if (!pendentes.length) return;
    setMostrandoPendentes(true);
    clearTimeout(esconderPendentesRef.current);
    // Com criança pendente ele precisa LER a lista: oito segundos, o mesmo
    // prazo que o segundo toque do botão antigo dava.
    esconderPendentesRef.current = setTimeout(() => setMostrandoPendentes(false), 8000);
  }

  async function encerrar() {
    clearTimeout(esconderPendentesRef.current);
    setMostrandoPendentes(false);
    // O uid vai adiante: quem encerra a rota é quem sabe de quem ela é, e
    // `avisarQuemFicou` precisa dele pra achar a turma.
    await stop(user?.uid, pendentes);
    // Rota encerrada, nenhuma porta espera mais: a buzina aberta não pode
    // tocar no celular da mãe à noite.
    encerrarChamadas({ adminUid: user?.uid, motivo: 'fim_da_rota' });
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

  const ChaveDoMapa = destaque ? (
    <button
      type="button"
      onClick={trocarCompartilhamento}
      role="switch"
      aria-checked={compartilha}
      className="tap mt-4 flex w-full items-center gap-3 border-t border-white/15 pt-4 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-white">
          {compartilha
            ? 'As famílias veem a perua no mapa'
            : 'A perua não aparece no mapa'}
        </span>
        <span className="mt-0.5 block text-[13px] leading-snug text-primaryChip">
          {compartilha
            ? 'Posição aproximada, num raio de 150 m.'
            : 'O GPS continua ligado: elas recebem o aviso de chegada.'}
        </span>
      </span>
      {/* O INTERRUPTOR do design system: a bolinha desliza, o trilho acende. */}
      <span
        aria-hidden="true"
        className={`relative h-8 w-[52px] shrink-0 rounded-full transition-colors duration-estado ${
          compartilha ? 'bg-accent' : 'bg-white/25'
        }`}
      >
        <span
          className={`absolute left-[3px] top-[3px] h-[26px] w-[26px] rounded-full bg-white shadow transition-transform duration-estado ease-freio ${
            compartilha ? 'translate-x-5' : ''
          }`}
        />
      </span>
    </button>
  ) : (
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
        <span className="mt-0.5 block text-xs leading-relaxed text-textMuted">
          {compartilha
            ? 'Posição aproximada, por referência — não mostra o ponto exato. Toque para desligar.'
            : 'O GPS continua ligado: elas seguem recebendo o aviso de que você está chegando. Toque para mostrar no mapa.'}
        </span>
      </span>
    </button>
  );

  // ⚠️ DIA SEM ROTA (03/10/2026, pedido do dono): no fim de semana e no
  // feriado nacional, o lugar do botão diz QUE DIA É. "Rodar mesmo assim"
  // continua — escola com aula no sábado, reposição, passeio. Ver
  // `dominio/rota/calendario.js`.
  const motivoSemRota = diaSemRota(new Date());
  if (!watching && motivoSemRota && !rodarMesmoAssim) {
    if (destaque) {
      return (
        <div className="flex items-center gap-3 rounded-xl bg-white/10 p-3">
          <CalendarOff size={20} className="shrink-0 text-menta" />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold text-white">
              {fraseDoDiaSemRota(motivoSemRota)}
            </span>
            <span className="block text-[13px] text-primaryChip">Sem viagem combinada hoje.</span>
          </span>
          <button
            type="button"
            onClick={() => setRodarMesmoAssim(true)}
            className="tap min-h-11 shrink-0 rounded-xl border-2 border-white/40 px-3 text-sm font-bold text-white"
          >
            Rodar mesmo assim
          </button>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neutro text-textMuted">
          <CalendarOff size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-bold text-text">
            {fraseDoDiaSemRota(motivoSemRota)}
          </span>
          <span className="block text-sm text-textMuted">Sem viagem combinada hoje.</span>
        </span>
        <button
          type="button"
          onClick={() => setRodarMesmoAssim(true)}
          className="tap min-h-11 shrink-0 rounded-xl border border-primaryBorder bg-card px-3 text-sm font-bold text-primary"
        >
          Rodar mesmo assim
        </button>
      </div>
    );
  }

  if (!watching) {
    return (
      <>
      {/* A ÂNCORA DO TUTORIAL MORA AQUI, e o passo aponta pra cá de novo.
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
       * elemento errado. */}
      {destaque ? (
        <button
          type="button"
          data-tour="start-route"
          onClick={iniciar}
          className="tap flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-accent text-base font-bold text-onAccent"
        >
          Iniciar a rota
          <ArrowRight size={20} />
        </button>
      ) : (
      <button
        type="button"
        data-tour="start-route"
        onClick={iniciar}
        className="tap w-full rounded-xl bg-primary text-white font-extrabold text-base flex items-center justify-center gap-2 shadow-focus"
        style={{ height: 56 }}
      >
        <Play size={20} />
        INICIAR ROTA
      </button>
      )}
      {ChaveDoMapa}
      </>
    );
  }

  const precisao = position?.coords?.accuracy ?? liveLocation?.accuracy;
  const semSinal = precisao == null;

  const quebrou = liveLocation?.ocorrencia?.tipo === 'perua_quebrou';

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            quebrou
              ? 'bg-dangerChip text-dangerText'
              : semSinal
                ? 'bg-warningChip text-warningText'
                : 'bg-primaryChip text-primary'
          }`}
        >
          {quebrou ? (
            <TriangleAlert size={17} />
          ) : semSinal ? (
            <CircleAlert size={17} />
          ) : (
            <Satellite size={17} />
          )}
        </span>
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
          * seco — nunca fica pela metade. No rodapé da tela da rota ele sai:
          * a faixa verde de cima já diz as duas coisas. */}
        <div className="min-w-0 flex-1">
          {!rodape && (
            <p className="rotulo leading-tight text-primary">
              modo rota
              {direcao === 'ida' && ' · levando pra escola'}
              {direcao === 'volta' && ' · trazendo pra casa'}
            </p>
          )}
          {/* ⚠️ ENCERRAR COM CRIANÇA PENDENTE (03/10/2026): começar a segurar
            * diz QUEM ainda está na perua ou sem embarque, antes de a rota
            * fechar. Não impede — ele pode ter deixado a criança e não
            * marcado —, mas não deixa encerrar sem ver. */}
          {mostrandoPendentes && pendentes.length > 0 ? (
            <p className="mt-0.5 text-sm font-bold text-dangerText" role="status">
              {resumoDosPendentes(pendentes)}
            </p>
          ) : quebrou ? (
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm font-bold text-dangerText">
              Problema na perua avisado
              <button
                type="button"
                onClick={async () => {
                  try {
                    await marcarOcorrencia(null);
                    toast.success('Rota seguindo. As famílias voltam a ver a rota normal.');
                  } catch (err) {
                    console.error(err);
                    toast.error('Não deu pra marcar. Tente de novo.');
                  }
                }}
                className="tap min-h-11 rounded-xl border border-primaryBorder bg-card px-3 text-sm font-bold text-primary"
              >
                Resolvido
              </button>
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-textBody">
              {/* ⚠️ A FRASE DIZ O QUE A FAMÍLIA VÊ DE VERDADE (03/10/2026). Dizia
                * "o responsável está te vendo" até com o mapa DESLIGADO — a tela
                * dele mentindo sobre a escolha que ele mesmo fez. E a precisão do
                * GPS não é a que a família vê: o mapa dela é aproximado (150 m). */}
              {semSinal
                ? 'Procurando sinal de GPS…'
                : compartilha
                  ? 'As famílias veem a perua no mapa, em posição aproximada.'
                  : 'A perua não aparece no mapa. O aviso de chegada continua.'}
            </p>
          )}
        </div>
      </div>
      <SegurarParaEncerrar
        disabled={stopping}
        onComecar={comecouASegurar}
        onEncerrar={encerrar}
      />
    </div>
  );
}

/** "Ainda na perua: Ana, Bia · sem embarque: Caio" — os primeiros nomes. */
function resumoDosPendentes(pendentes) {
  const nomes = (lista) => lista.map((p) => String(p.name || '').split(' ')[0]).join(', ');
  const naPerua = pendentes.filter((p) => p.falta === 'entrega');
  const semEmbarque = pendentes.filter((p) => p.falta !== 'entrega');
  return [
    naPerua.length ? `Ainda na perua: ${nomes(naPerua)}` : null,
    semEmbarque.length ? `Sem embarque: ${nomes(semEmbarque)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}
