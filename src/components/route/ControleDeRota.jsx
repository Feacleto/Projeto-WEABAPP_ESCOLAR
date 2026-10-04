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
import { marcarOcorrencia, definirCompartilhamentoDaRota } from '../../services/locationService';
import { encerrarChamadas } from '../../services/pendingCallService';
import SegurarParaEncerrar from './SegurarParaEncerrar';
import ConfirmDialog from '../common/ConfirmDialog';

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
 *
 * TRÊS LUGARES, TRÊS FORMAS (03/10/2026, auditoria de UX)
 *   destaque  no cartão verde do Início, parado: "Iniciar a rota" em limão.
 *   faixa     na faixa verde do topo da tela da rota: a chave do mapa e o
 *             "Encerrar · segure", compactos. O rodapé dessa tela passou a
 *             ser o botão da parada (EMBARQUEI/ENTREGUEI) — a ação de todo
 *             minuto onde o polegar descansa, e a de fim de viagem no topo.
 *   oculto    no Início com a rota rodando: não desenha nada, só RELIGA o GPS
 *             se o app recarregou no meio da rota. O encerrar saiu do Início
 *             porque a rota tem aba própria com ele, e dois encerrar em duas
 *             telas faziam ele perguntar qual era o de verdade.
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
  // DENTRO DA FAIXA VERDE da tela da rota (ver o cabeçalho do arquivo). A
  // faixa já diz "ROTA ATIVA" e a direção, então aqui não se repete o modo.
  faixa = false,
  // SÓ RELIGA O GPS, sem desenhar nada (o Início com a rota rodando).
  oculto = false,
  // PARADO, NO INÍCIO, O BOTÃO E A CHAVE MORAM EM LUGARES DIFERENTES
  // (03/10/2026): 'botao' só o "Iniciar a rota" (na barra de baixo, onde o
  // polegar alcança) e 'chave' só a chave do mapa (no cartão verde, junto de
  // quem vai e que horas). Ausente, os dois juntos, como sempre.
  parte = null,
  // O "Iniciar a rota" em CONTORNO — depois da última viagem do dia, quando
  // iniciar ainda é possível, mas não é a ação do momento.
  secundario = false,
}) {
  // A faixa é verde como o cartão do Início: as duas usam a forma "sobre verde".
  const sobreVerde = destaque || faixa;
  const { user, profile, updateProfile, refreshProfile } = useAuth();
  // AUSENTE É LIGADO — ver `setCompartilharLocalizacao`.
  const compartilha = profile?.compartilhaLocalizacao !== false;
  const { watching, position, error, stopping, start, stop, retomar } = useGeolocation();
  const { location: liveLocation } = useLiveLocation();

  // A ROTA ESTAVA ABERTA E O GPS NÃO: o app recarregou no meio do caminho.
  // Religa sozinho — o Início já mostra a rota, e pedir "Iniciar a rota" de
  // novo faria ele achar que a rota tinha caído (ver `retomar`).
  const retomouRef = useRef(false);
  useEffect(() => {
    // A metade 'chave' nunca religa: ela convive com a metade 'botao' na
    // mesma tela, e duas instâncias religando seriam dois avisos iguais.
    if (parte === 'chave') return;
    if (!user?.uid || watching || stopping || retomouRef.current) return;
    if (!liveLocation?.routeActive) return;
    retomouRef.current = true;
    retomar(user.uid, { alvos, compartilha });
    toast('GPS religado. A rota continua.');
  }, [user?.uid, watching, stopping, liveLocation?.routeActive, retomar, alvos, compartilha, parte]);

  // ⚠️ ENCERRAR COM CRIANÇA NA PERUA (04/10/2026, D4). O "Ainda na perua:
  // …" só aparecia ENQUANTO ele segurava, e em 800 ms a rota fechava — o
  // nome passava por baixo do dedo. Agora, com alguém pendente, segurar NÃO
  // encerra: abre a confirmação com quem ficou, e o encerrar vira escolha
  // escrita ("Encerrar mesmo assim"). Sem pendência, segurar encerra direto.
  const [confirmandoFim, setConfirmandoFim] = useState(false);
  const [rodarMesmoAssim, setRodarMesmoAssim] = useState(false);
  const ultimoErroRef = useRef(null);

  // Só avisa quando o erro MUDA, senão o GPS com sinal ruim enche a tela de
  // toasts idênticos enquanto ele dirige.
  useEffect(() => {
    // Pelo mesmo motivo, só uma das metades fala do erro do GPS.
    if (parte === 'chave') return;
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
  }, [error, parte]);

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
    // Com o mapa desligado, o "GPS ligado" de sempre fazia parecer que as
    // famílias estavam vendo a perua. O aviso diz o que elas veem.
    // ⚠️ "CANCELAR" POR 10 SEGUNDOS (04/10/2026, pedido do dono). Iniciar
    // age num toque e já avisa as famílias; o toque sem querer não tinha
    // volta a não ser encerrar. O cartão é um toast porque o Início navega
    // para a rota no mesmo instante — ele precisa sobreviver à troca de tela.
    // Cancelar encerra como o encerrar (sem a lista de quem ficou: ninguém
    // foi marcado). NÃO existe aviso de "saída cancelada" às famílias, e
    // este cartão não inventa um: o "A perua saiu" já enviado fica no sino
    // delas, e a trava da viagem impede que ele seja repetido hoje.
    const frase = compartilha
      ? 'Rota começou! GPS ligado.'
      : 'Rota começou. A perua não aparece no mapa das famílias.';
    const uid = user.uid;
    toast.custom(
      (t) => (
        <div
          role="status"
          className="flex w-[min(92vw,420px)] items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-float"
        >
          <span className="min-w-0 flex-1 text-base font-semibold text-text">{frase}</span>
          <button
            type="button"
            onClick={async () => {
              toast.dismiss(t.id);
              await stop(uid, []);
              encerrarChamadas({ adminUid: uid, motivo: 'fim_da_rota' });
              toast('Rota cancelada.');
            }}
            className="tap min-h-12 shrink-0 rounded-xl border border-dangerChip bg-card px-4 text-base font-bold text-dangerText"
          >
            Cancelar
          </button>
        </div>
      ),
      { id: 'rota-comecou', duration: 10_000, position: 'top-center' }
    );
    // Quem sabe a fila é a tela de rota, não este botão. Ela publica a posição
    // de cada criança no dia — o responsável não consegue calcular isso
    // sozinho, porque a fila é feita das outras crianças, que ele não lê.
    onIniciar?.();
  }

  function comecouASegurar() {
    playSound('click');
  }

  // O fim do segurar: com pendência, a confirmação; sem, encerra.
  function segurouAteOFim() {
    if (pendentes.length) {
      setConfirmandoFim(true);
      return;
    }
    encerrar();
  }

  async function encerrar() {
    setConfirmandoFim(false);
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
    // Com a rota rodando, vale na hora — ver `definirCompartilhamentoDaRota`.
    definirCompartilhamentoDaRota(novo);
    try {
      await setCompartilharLocalizacao(user?.uid, novo);
    } catch {
      updateProfile?.({ compartilhaLocalizacao: compartilha });
      definirCompartilhamentoDaRota(compartilha);
      toast.error('Não deu pra salvar. Tente de novo.');
    }
  }

  if (oculto) return null;

  const ChaveDoMapa = sobreVerde ? (
    <button
      type="button"
      onClick={trocarCompartilhamento}
      role="switch"
      aria-checked={compartilha}
      className="tap mt-4 flex min-h-12 w-full items-center gap-3 border-t border-white/15 pt-4 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold text-white">
          {compartilha
            ? 'As famílias veem a perua no mapa'
            : 'A perua não aparece no mapa'}
        </span>
        <span className="mt-0.5 block text-sm leading-snug text-primaryChip">
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
      className="tap mt-2 flex min-h-12 w-full items-start gap-2.5 rounded-xl border border-border bg-card p-3 text-left"
    >
      <span
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          compartilha ? 'bg-primaryChip text-primary' : 'bg-neutro text-textMuted'
        }`}
      >
        {compartilha ? <MapPin size={16} /> : <MapPinOff size={16} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold text-text">
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
        <span className="mt-0.5 block text-sm leading-relaxed text-textMuted">
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
  // A metade 'chave' é preferência, não ação: aparece em qualquer dia.
  if (parte === 'chave') return watching ? null : ChaveDoMapa;
  if (!watching && motivoSemRota && !rodarMesmoAssim) {
    if (sobreVerde) {
      return (
        <div className={`flex items-center gap-3 rounded-xl bg-white/10 p-3 ${faixa ? 'mt-3' : ''}`}>
          <CalendarOff size={20} className="shrink-0 text-menta" />
          <span className="min-w-0 flex-1">
            <span className="block text-base font-bold text-white">
              {fraseDoDiaSemRota(motivoSemRota)}
            </span>
            <span className="block text-sm text-primaryChip">Sem viagem combinada hoje.</span>
          </span>
          <button
            type="button"
            onClick={() => setRodarMesmoAssim(true)}
            className="tap min-h-12 shrink-0 rounded-xl border-2 border-white/40 px-3 text-base font-bold text-white"
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
          className="tap min-h-12 shrink-0 rounded-xl border border-primaryBorder bg-card px-3 text-base font-bold text-primary"
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
      {/* "Iniciar a rota" EM TODO LUGAR (03/10/2026): eram "INICIAR ROTA",
        * "Iniciar rota" e "Iniciar a rota" para o mesmo gesto — três nomes
        * fazem parecer três botões. */}
      {secundario ? (
        <button
          type="button"
          data-tour="start-route"
          onClick={iniciar}
          className="tap flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-white/40 text-base font-bold text-white"
        >
          <Play size={18} />
          Iniciar a rota
        </button>
      ) : sobreVerde ? (
        <button
          type="button"
          data-tour="start-route"
          onClick={iniciar}
          className={`tap flex h-16 w-full items-center justify-center gap-2 rounded-xl bg-accent text-lg font-bold text-onAccent ${
            faixa ? 'mt-3' : ''
          }`}
        >
          Iniciar a rota
          <ArrowRight size={22} />
        </button>
      ) : (
      <button
        type="button"
        data-tour="start-route"
        onClick={iniciar}
        // ⚠️ A SOMBRA COLORIDA DA TELA É DELE (04/10/2026): "Iniciar a rota"
        // é o protagonista do Início, e o cartão verde da turma desceu para
        // `shadow-rest` (uma sombra colorida por tela).
        className="tap flex h-16 w-full items-center justify-center gap-2 rounded-xl bg-primary text-lg font-extrabold text-white shadow-focus"
      >
        <Play size={22} />
        Iniciar a rota
      </button>
      )}
      {parte !== 'botao' && ChaveDoMapa}
      </>
    );
  }

  const precisao = position?.coords?.accuracy ?? liveLocation?.accuracy;
  const semSinal = precisao == null;

  const quebrou = liveLocation?.ocorrencia?.tipo === 'perua_quebrou';

  async function resolverOcorrencia() {
    try {
      await marcarOcorrencia(null);
      toast.success('Rota seguindo. As famílias voltam a ver a rota normal.');
    } catch (err) {
      console.error(err);
      toast.error('Não deu pra marcar. Tente de novo.');
    }
  }

  /* ── NA FAIXA VERDE: a chave do mapa à esquerda, o encerrar à direita ──
   *
   * O encerrar é COMPACTO e fica no canto: é o gesto do fim da viagem, feito
   * com a perua parada, e o segurar de 800 ms continua sendo a trava contra
   * o toque sem querer. A chave ocupa o resto da linha porque é ela que ele
   * pode querer mexer no meio do caminho.
   *
   * O que precisa ser LIDO (quem ainda está na perua, o problema avisado, o
   * GPS sem sinal) aparece numa pastilha branca embaixo: vermelho sobre verde
   * não se lê, e sobre branco dá o contraste que `dangerText` foi feito pra
   * dar. */
  // A CONFIRMAÇÃO DO FIM COM PENDÊNCIA — quem ficou, e duas saídas com o
  // verbo escrito. "Voltar pra rota" é o padrão seguro (fechar a folha).
  const dialogoDoFim = (
    <ConfirmDialog
      open={confirmandoFim}
      variant="danger"
      title="Ainda tem criança nesta viagem"
      description={resumoDosPendentes(pendentes)}
      confirmLabel="Encerrar mesmo assim"
      cancelLabel="Voltar pra rota"
      loading={stopping}
      onConfirm={encerrar}
      onCancel={() => setConfirmandoFim(false)}
    />
  );

  if (faixa) {
    return (
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={trocarCompartilhamento}
            role="switch"
            aria-checked={compartilha}
            className="tap flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-xl bg-white/10 px-3 py-2 text-left"
          >
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
            <span className="min-w-0 flex-1 text-base font-semibold leading-tight text-white">
              {compartilha ? 'Famílias veem a perua no mapa' : 'Perua fora do mapa'}
            </span>
          </button>
          <SegurarParaEncerrar
            compacto
            disabled={stopping}
            onComecar={comecouASegurar}
            onEncerrar={segurouAteOFim}
          />
        </div>
        {quebrou ? (
          <div className="flex items-center gap-3 rounded-xl bg-card px-3 py-2">
            <TriangleAlert size={20} className="shrink-0 text-dangerText" />
            <span className="min-w-0 flex-1 text-base font-bold text-dangerText">
              Problema na perua avisado
            </span>
            <button
              type="button"
              onClick={resolverOcorrencia}
              className="tap min-h-12 shrink-0 rounded-xl border border-primaryBorder bg-card px-3 text-base font-bold text-primary"
            >
              Resolvido
            </button>
          </div>
        ) : semSinal ? (
          <p className="flex items-center gap-2 rounded-xl bg-card px-3 py-2 text-base font-semibold text-warningText">
            <CircleAlert size={18} className="shrink-0" />
            Procurando sinal de GPS…
          </p>
        ) : (
          <p className="text-sm text-primaryChip">
            {compartilha
              ? 'Posição aproximada, num raio de 150 m. O aviso de chegada sai sempre.'
              : 'O GPS continua ligado: as famílias recebem o aviso de chegada.'}
          </p>
        )}
        {dialogoDoFim}
      </div>
    );
  }

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
          * seco — nunca fica pela metade. Na faixa da tela da rota ele não
          * aparece: a faixa verde já diz as duas coisas. */}
        <div className="min-w-0 flex-1">
          <p className="rotulo leading-tight text-primary">
            modo rota
            {direcao === 'ida' && ' · levando pra escola'}
            {direcao === 'volta' && ' · trazendo pra casa'}
          </p>
          {quebrou ? (
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-base font-bold text-dangerText">
              Problema na perua avisado
              <button
                type="button"
                onClick={resolverOcorrencia}
                className="tap min-h-12 rounded-xl border border-primaryBorder bg-card px-3 text-sm font-bold text-primary"
              >
                Resolvido
              </button>
            </p>
          ) : (
            /* A CHAVE DO MAPA TAMBÉM COM A ROTA RODANDO (03/10/2026, pedido do
             * dono). Antes ela só existia antes de iniciar, e desligar no
             * caminho exigia encerrar a rota. A frase é a própria chave: ela
             * diz o que a família vê, e o toque troca.
             *
             * ⚠️ A FRASE DIZ O QUE A FAMÍLIA VÊ DE VERDADE. Dizia "o
             * responsável está te vendo" até com o mapa DESLIGADO — a tela dele
             * mentindo sobre a escolha que ele mesmo fez. E a precisão do GPS
             * não é a que a família vê: o mapa dela é aproximado (150 m). */
            <button
              type="button"
              onClick={trocarCompartilhamento}
              role="switch"
              aria-checked={compartilha}
              className="tap mt-0.5 flex min-h-12 w-full items-center gap-3 text-left"
            >
              <span className="min-w-0 flex-1 text-base text-textBody">
                {semSinal && <span className="block font-semibold">Procurando sinal de GPS…</span>}
                {compartilha
                  ? 'As famílias veem a perua no mapa, em posição aproximada.'
                  : 'A perua não aparece no mapa. O aviso de chegada continua.'}
              </span>
              <span
                aria-hidden="true"
                className={`relative h-7 w-[46px] shrink-0 rounded-full transition-colors duration-estado ${
                  compartilha ? 'bg-primary' : 'bg-borderStrong'
                }`}
              >
                <span
                  className={`absolute left-[3px] top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow transition-transform duration-estado ease-freio ${
                    compartilha ? 'translate-x-[18px]' : ''
                  }`}
                />
              </span>
            </button>
          )}
        </div>
      </div>
      <SegurarParaEncerrar
        disabled={stopping}
        onComecar={comecouASegurar}
        onEncerrar={segurouAteOFim}
      />
      {dialogoDoFim}
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
