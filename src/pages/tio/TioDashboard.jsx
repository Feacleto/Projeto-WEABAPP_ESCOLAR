import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { onSnapshot, doc } from 'firebase/firestore';
import {
  Clock,
  Users,
  School,
  Megaphone,
  ListOrdered,
  Notebook,
  HelpCircle,
  History,
  CircleAlert,
  AlertTriangle,
  ChevronRight,
  CheckCircle2,
  CalendarDays,
  Eye,
  EyeOff,
  MailWarning,
} from 'lucide-react';
import ReviewNudge from '../../components/feedback/ReviewNudge';
import BonusNudge from '../../components/associado/BonusNudge';
import { ENTRY_BONUS_ENABLED } from '../../config/capabilities';
import Header from '../../components/layout/Header';
import Avatar from '../../components/common/Avatar';
import Skeleton from '../../components/common/Skeleton';
import SchoolBroadcastSheet from '../../components/broadcasts/SchoolBroadcastSheet';
import AbsenceListSheet from '../../components/dashboard/AbsenceListSheet';
import OperacaoDaRota from '../../components/route/OperacaoDaRota';
import ControleDeRota from '../../components/route/ControleDeRota';
import { useAuth } from '../../hooks/useAuth';
import { useChildren } from '../../hooks/useChildren';
import { useEscolas } from '../../hooks/useEscolas';
import { usePaymentsByMonth } from '../../hooks/usePayments';
import { useAbsences } from '../../hooks/useAbsences';
import { db } from '../../firebase/config';
import { formatCurrency, getCurrentMonthKey } from '../../utils/formatters';
import {
  getDateKey,
  diaCompleto,
  blocoDoMomento,
  horaCurta,
  deMinutos,
  precisaDaPerua,
  semHorarioCombinado,
  ROTULO_ESTADO,
  formataEspera,
} from '../../services/horariosService';
import {
  statusNaDirecao,
  getActionForStatus,
} from '../../services/routeStatusService';
import { publicarOrdemDoDia } from '../../services/ridesService';
import { greet } from '../../utils/greeting';
import { ChildDetailSheet } from '../ChildDetail';
import { useRelogio } from '../../hooks/useRelogio';
import FestiveBadge from '../../components/festive/FestiveBadge';

/**
 * O INÍCIO — a única tela em que o motorista trabalha.
 *
 * POR QUE ELA MUDOU DE FORMA
 * Ele tem quarenta anos e não cresceu com aplicativo. Cada troca de tela cobra
 * um pedágio: some a rolagem, some o filtro, e ele gasta dois segundos
 * procurando onde está. A rota morava numa aba separada, então o trabalho de
 * todo dia começava com esse pedágio.
 *
 * A home passou a hospedar a operação inteira. Mas juntar quatro abas numa
 * tela é o caminho mais curto pra uma rolagem infinita, que é PIOR que
 * navegar — então ela não mostra tudo: mostra o que serve AGORA.
 *
 * TRÊS CARAS, E O RELÓGIO ESCOLHE
 *
 *   ANTES     — falta menos de uma hora pra próxima viagem. Um botão domina a
 *               tela: "iniciar rota". Embaixo, quem ele vai pegar.
 *   DIRIGINDO — a home VIRA a operação. O cadastro some inteiro: ele está com
 *               o veículo em movimento e não vai cadastrar escola.
 *   ENTRE     — o intervalo entre as viagens é a única janela em que ele
 *               resolve pendência. Então é a pendência que aparece.
 *
 * O QUE SAIU, E POR QUÊ
 * A gaveta "Mais opções" escondia turma, rota padrão e aviso de escola atrás
 * de um toque. Gaveta esconde justamente de quem tem medo de procurar — as
 * quatro ações viraram linhas escritas e visíveis.
 *
 * Os quatro cartões de contagem (Crianças / Ausentes / Manhã / Tarde) também
 * saíram. Eles diziam QUANTOS; a lista da viagem diz QUEM, na ordem, com quem
 * faltou já em cinza. É o mesmo dado fazendo trabalho em vez de decorar.
 */

const WEEK_DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function formatLongDate(d = new Date()) {
  return `${WEEK_DAYS[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

/**
 * A partir de quantos minutos antes a viagem vira "vou sair agora".
 *
 * Uma hora é folga suficiente pra ele se preparar e curta o bastante pra o
 * botão gigante de "iniciar rota" não ficar piscando o dia inteiro — botão
 * grande que está sempre lá deixa de ser chamado à ação e vira paisagem.
 */
const JANELA_DE_PARTIDA = 60;

export default function TioDashboard() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const { openTutorial } = useOutletContext() || {};
  const { children, loading: carregandoCriancas } = useChildren();
  const { mapa: escolasPorId, escolas } = useEscolas();
  const { payments } = usePaymentsByMonth(getCurrentMonthKey());
  const todayKey = getDateKey();
  const { absences, byChildId: declaracoes } = useAbsences(todayKey);

  // A hora do cabeçalho, andando de minuto em minuto.
  const agora = useRelogio();
  const horaAgora = agora.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Qual criança está com a ficha aberta. `null` = nenhuma.
  const [fichaDe, setFichaDe] = useState(null);

  const [rotaAtiva, setRotaAtiva] = useState(false);
  const [mostrarReceber, setMostrarReceber] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [listaAusentesOpen, setListaAusentesOpen] = useState(false);

  // O relógio anda. Sem isto a home fica presa na cara da manhã a tarde
  // inteira, porque nada mais dispararia um novo render.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  // A rota ativa é a DELE. Enquanto `liveLocation` era um doc só pra
  // plataforma toda, este estado acendia quando QUALQUER motorista estivesse
  // rodando — e o daqui apagava quando outro encerrasse a dele.
  const meuUid = user?.uid;
  useEffect(() => {
    if (!meuUid) return undefined;
    return onSnapshot(
      doc(db, 'liveLocation', meuUid),
      (snap) => setRotaAtiva(snap.exists() ? !!snap.data().routeActive : false),
      () => setRotaAtiva(false)
    );
  }, [meuUid]);

  const blocos = useMemo(
    () => diaCompleto(children, { declaracoes, escolasPorId }),
    [children, declaracoes, escolasPorId]
  );

  /**
   * Quem ainda depende da perua NUM BLOCO QUALQUER — considera falta E status.
   *
   * Precisa vir antes da escolha do bloco, e não depois: quem decide qual é a
   * viagem atual tem que poder perguntar isso de todas elas. Na versão
   * anterior o cálculo só existia para o bloco já escolhido, o que tornava a
   * pergunta circular — e foi por isso que a escolha ficou só com o relógio.
   */
  const paradasPendentes = useCallback(
    (b) => {
      if (!b) return [];
      const dir = b.direcao === 'ida' ? 'pickup' : 'dropoff';
      return b.paradas.filter((p) => {
        if (!precisaDaPerua(p.estado)) return false;
        const st = statusNaDirecao(p.child, declaracoes?.[p.child.id], dir);
        return !!getActionForStatus(st, dir);
      });
    },
    [declaracoes]
  );
  const temPendencia = useCallback(
    (b) => paradasPendentes(b).length > 0,
    [paradasPendentes]
  );

  const bloco = useMemo(
    // A pendência entra aqui pelo mesmo motivo da tela de operação: sem ela,
    // um minuto depois da última porta o Início anunciava "você está entre
    // viagens" com a fila ainda cheia.
    () => blocoDoMomento(blocos, new Date(), temPendencia),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [blocos, tick, temPendencia]
  );

  const pendentes = useMemo(() => paradasPendentes(bloco), [bloco, paradasPendentes]);

  const minutosAgora = new Date().getHours() * 60 + new Date().getMinutes();
  const faltamMin = bloco ? bloco.inicio - minutosAgora : null;

  /**
   * Qual das três caras. A ordem das perguntas importa: dirigir vence tudo.
   */
  const estado = useMemo(() => {
    if (rotaAtiva) return 'dirigindo';
    if (carregandoCriancas) return 'carregando';
    if (!blocos.length) return 'vazio';
    if (!bloco || !pendentes.length) return 'entre';
    return faltamMin != null && faltamMin <= JANELA_DE_PARTIDA ? 'antes' : 'entre';
  }, [rotaAtiva, carregandoCriancas, blocos.length, bloco, pendentes.length, faltamMin]);

  const { aReceber, atrasados, marcados } = useMemo(() => {
    let receber = 0;
    let atraso = 0;
    let claimed = 0;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    for (const p of payments) {
      if (p.status === 'paid') continue;
      receber += Number(p.amount) || 0;
      if (p.status === 'claimed') claimed++;
      const venc = p.dueDate?.toDate?.() || (p.dueDate ? new Date(p.dueDate) : null);
      if (venc && venc < hoje && p.status !== 'claimed') atraso++;
    }
    return { aReceber: receber, atrasados: atraso, marcados: claimed };
  }, [payments]);

  const semHorario = useMemo(() => semHorarioCombinado(children), [children]);
  const convitesAbertos = useMemo(
    () => children.filter((c) => c.inviteStatus === 'pending').length,
    [children]
  );

  /**
   * Publica a posição de cada criança no dia ao iniciar a rota.
   *
   * O responsável não consegue calcular isso: lê só o doc do próprio filho, e
   * a fila é feita das outras crianças. Quem sabe publica — uma vez, aqui.
   */
  async function publicarOrdem() {
    try {
      const contexto = {};
      for (const b of blocos) {
        for (const p of b.paradas) contexto[p.child.id] = { adminUid: user?.uid };
      }
      await publicarOrdemDoDia(blocos, todayKey, contexto);
    } catch (err) {
      // Não trava a saída: ele precisa sair, e posição na fila é conforto do
      // responsável, não requisito da operação.
      console.error('Falha ao publicar a ordem do dia:', err);
    }
  }

  // A SAUDAÇÃO CHAMA ELE PELA MARCA, e não pelo nome da conta.
  //
  // `name` é o nome civil — o que vai no contrato e na fila do dono. Muita
  // gente do ramo é conhecida só pelo apelido, e o app cumprimentando "José
  // Ednaldo" quem o mundo chama de Tio Nino soa como carta de banco.
  //
  // Cai no primeiro nome quando a marca não foi configurada, e em "Tio" quando
  // nem o nome existe: a saudação nunca fica pela metade.
  const primeiroNome =
    profile?.marcaNome?.trim() || profile?.name?.split(' ')[0] || 'Tio';
  const proximo = pendentes[0] || null;

  return (
    <>
      <Header title="Início" marca />

      {/* INICIAR / ENCERRAR ROTA — FIXO NO TOPO, SEMPRE.
        *
        * Ele estava só no estado "antes de sair", que aparece na última hora
        * antes da viagem. Fora dessa janela — e é a maior parte do dia — não
        * havia botão nenhum: o motorista que quisesse ligar o rastreamento
        * mais cedo, ou religar depois de fechar a aba sem querer, não tinha
        * por onde.
        *
        * Fixo porque a lista da viagem rola, e o botão de encerrar não pode
        * rolar junto: encerrar é o que ele faz com a perua parada, olhando
        * rápido, e procurar botão que fugiu pra fora da tela é o oposto disso.
        *
        * `top` acompanha o cabeçalho e o recorte do aparelho: no iPhone
        * instalado como app o `env()` vale a faixa do sistema, e sem somar
        * isso a barra ficaria por baixo do relógio e da bateria. */}
      <div
        className="sticky z-10 bg-bg px-5 pt-3 pb-3 border-b border-gray-100"
        style={{ top: 'calc(3.5rem + env(safe-area-inset-top, 0px))' }}
      >
        <ControleDeRota onIniciar={publicarOrdem} />
      </div>

      <div className="pb-4">
        {/* Saudação — pequena, contexto. Durante a rota ela sai: o topo da
          * tela é caro demais pra gastar com cortesia enquanto ele dirige. */}
        {estado !== 'dirigindo' && (
          <div className="px-5 pt-5">
            {/* A HORA AO LADO DA DATA.
              *
              * O cartão de cima fala em horário ("próxima viagem 17h30") e a
              * tela não dizia que horas são. Ele conferia no relógio do
              * sistema pra saber se dava tempo — duas leituras pra uma
              * pergunta só. O relógio anda sozinho: `useRelogio` re-renderiza
              * a cada minuto, senão a hora congela na abertura do app e
              * mente com cara de informação. */}
            <p className="text-xs text-textMuted">
              <span className="capitalize">{formatLongDate()}</span>
              <span className="mx-1.5 text-textMuted/50">·</span>
              <span className="tabular-nums">{horaAgora}</span>
            </p>
            <div className="flex items-center gap-3 mt-1">
              <h1 className="text-2xl font-bold text-text leading-tight flex-1 min-w-0">
                {greet(new Date())}, {primeiroNome}!
              </h1>
              <FestiveBadge />
            </div>
          </div>
        )}

        {/* ─────────── DIRIGINDO — a home é a operação ─────────── */}
        {estado === 'dirigindo' && (
          <OperacaoDaRota mostrarRodape={false} mostrarControle={false} />
        )}

        {estado === 'carregando' && (
          <div className="px-5 pt-4 space-y-3">
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        )}

        {/* ─────────── ANTES — um botão domina ─────────── */}
        {estado === 'antes' && bloco && (
          <div className="px-5 pt-4 space-y-4">
            <div
              data-tour="hero"
              className="bg-card border-2 border-primary rounded-3xl p-4 shadow-lg shadow-emerald-600/15"
            >
              <p className="text-[11px] font-semibold uppercase tracking-widest text-textMuted">
                próxima viagem
              </p>
              <div className="flex items-baseline gap-2.5 mt-1">
                <span className="text-4xl font-extrabold text-primary tabular-nums leading-none">
                  {horaCurta(deMinutos(bloco.inicio))}
                </span>
                {/* NÃO EXISTE "ATRASADO" AQUI, e a conta que existia mentia.
                  *
                  * `faltamMin` é a distância até o horário do bloco, e quando
                  * ele já passou o número vira negativo — a tela dizia
                  * "atrasado 3h09". Só que a viagem das 17h30 não está
                  * atrasada às 20h39 de um sábado: ela é a PRÓXIMA, e o
                  * horário que aparece é o de amanhã.
                  *
                  * Mesmo dentro do dia útil o rótulo acusa quem não fez nada
                  * de errado: quem entregou todo mundo e não tocou em "iniciar
                  * rota" lia que estava atrasado. Cobrança sobre um fato que o
                  * app não sabe é o tipo de aviso que se aprende a ignorar —
                  * e aí o aviso que importa some junto.
                  *
                  * Só a contagem PRA FRENTE sobrou, que é informação de
                  * verdade: quanto falta pra sair. */}
                {faltamMin > 1 ? (
                  <span className="text-sm text-textMuted">
                    daqui a {formataEspera(faltamMin)}
                  </span>
                ) : faltamMin >= 0 ? (
                  <span className="text-sm text-textMuted">agora</span>
                ) : null}
              </div>

              {proximo && (
                <button
                  type="button"
                  onClick={() => setFichaDe(proximo.child.id)}
                  className="tap flex w-full items-center gap-3 text-left mt-3"
                >
                  <Avatar
                    photoURL={proximo.child.photoURL}
                    gender={proximo.child.gender}
                    seed={proximo.child.id}
                    kind="child"
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-text text-sm leading-tight truncate">
                      {proximo.child.name}
                    </p>
                    <p className="text-[11px] text-textMuted truncate">
                      {bloco.direcao === 'ida'
                        ? proximo.child.address || 'Sem endereço'
                        : bloco.escolas[0]?.nome || 'Escola'}
                      {' · '}
                      {pendentes.length}{' '}
                      {pendentes.length === 1 ? 'criança' : 'crianças'}
                    </p>
                  </div>
                  <ChevronRight size={16} className="shrink-0 text-textMuted" />
                </button>
              )}

              {/* O botão de iniciar subiu pra barra fixa no topo da tela.
                * Aqui ele rolava junto com a lista da viagem — e some da vista
                * assim que ele confere quem vai pegar, que é justamente o
                * gesto que antecede a partida. */}
            </div>

            <ListaDaViagem bloco={bloco} onAbrirFicha={setFichaDe} />
            <AcoesDeCadastro
              totalCriancas={children.length}
              totalEscolas={escolas.length}
              semHorario={semHorario.length}
              onBroadcast={() => setBroadcastOpen(true)}
              navigate={navigate}
            />
          </div>
        )}

        {/* ─────────── ENTRE — a janela das pendências ─────────── */}
        {estado === 'entre' && (
          <div className="px-5 pt-4 space-y-4">
            <div
              data-tour="hero"
              className="bg-emerald-50 border border-emerald-200 rounded-3xl p-5 text-center"
            >
              <CheckCircle2 size={34} className="text-emerald-600 mx-auto" />
              <p className="font-bold text-text mt-2">
                {blocos.length && bloco ? 'Nada agora' : 'Dia livre'}
              </p>
              <p className="text-sm text-emerald-900/75 mt-1">
                {bloco && faltamMin != null && faltamMin > 0 ? (
                  <>
                    Próxima viagem às{' '}
                    <b>{horaCurta(deMinutos(bloco.inicio))}</b> · daqui a{' '}
                    {formataEspera(faltamMin)}
                  </>
                ) : (
                  'Nenhuma viagem pendente hoje.'
                )}
              </p>
            </div>

            <Pendencias
              semHorario={semHorario.length}
              convitesAbertos={convitesAbertos}
              atrasados={atrasados}
              marcados={marcados}
              ausentes={absences.length}
              onHorarios={() => navigate('/tio/horarios')}
              onCriancas={() => navigate('/tio/children')}
              onFinanceiro={() => navigate('/tio/finance')}
              onAusentes={() => setListaAusentesOpen(true)}
            />

            {ENTRY_BONUS_ENABLED && <BonusNudge />}
            <ReviewNudge />

            <AcoesDeCadastro
              totalCriancas={children.length}
              totalEscolas={escolas.length}
              semHorario={semHorario.length}
              onBroadcast={() => setBroadcastOpen(true)}
              navigate={navigate}
            />

            <ReceberRow
              amount={aReceber}
              visivel={mostrarReceber}
              onToggle={() => setMostrarReceber((v) => !v)}
              onClick={() => navigate('/tio/finance')}
            />

            <button
              type="button"
              onClick={() => openTutorial?.()}
              className="tap w-full flex items-center gap-2 text-xs text-textMuted justify-center py-2"
            >
              <HelpCircle size={14} />
              Como usar o app
            </button>
          </div>
        )}

        {/* ─────────── VAZIO — ainda não há de onde tirar rota ─────────── */}
        {estado === 'vazio' && (
          <div className="px-5 pt-4 space-y-4">
            <div
              data-tour="hero"
              className="bg-card border border-gray-200 rounded-3xl p-6 text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                <Users size={26} />
              </div>
              <p className="font-bold text-text mt-3">
                Sua turma ainda está vazia
              </p>
              <p className="text-sm text-textMuted mt-1 max-w-xs mx-auto">
                Cadastre a escola, depois as crianças e a hora que você definiu
                com cada responsável. A rota se monta a partir disso.
              </p>
              <button
                type="button"
                onClick={() => navigate('/tio/children/escolas')}
                className="tap w-full rounded-2xl bg-primary text-white font-bold mt-4 h-12 inline-flex items-center justify-center gap-2"
              >
                <School size={18} />
                Começar pela escola
              </button>
            </div>

            <AcoesDeCadastro
              totalCriancas={children.length}
              totalEscolas={escolas.length}
              semHorario={semHorario.length}
              onBroadcast={() => setBroadcastOpen(true)}
              navigate={navigate}
            />
          </div>
        )}
      </div>

      {/* A ficha da criança, por cima do painel — mesma folha que o pai usa.
        * `childId` só existe quando alguém tocou numa criança, e é o que
        * mantém a assinatura da ficha fechada enquanto ninguém pediu. */}
      <ChildDetailSheet
        open={!!fichaDe}
        childId={fichaDe}
        onClose={() => setFichaDe(null)}
      />

      <SchoolBroadcastSheet
        open={broadcastOpen}
        onClose={() => setBroadcastOpen(false)}
      />
      <AbsenceListSheet
        open={listaAusentesOpen}
        onClose={() => setListaAusentesOpen(false)}
        absences={absences}
      />
    </>
  );
}

/* ─────────────── a viagem, em prévia ─────────────── */

/**
 * Quem ele vai pegar, na ordem, com quem faltou já em cinza.
 *
 * Substitui os quatro cartões de contagem que ficavam aqui. Eles diziam
 * QUANTOS; isto diz QUEM — e "quem" é a pergunta que ele faz antes de sair.
 */
function ListaDaViagem({ bloco, onAbrirFicha }) {
  if (!bloco?.paradas?.length) return null;
  return (
    <section className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-textMuted px-1">
        {bloco.direcao === 'ida' ? 'quem você pega' : 'quem você leva pra casa'}
      </p>

      {bloco.direcao === 'volta' && bloco.escolas.length > 0 && (
        <ParadaEscola escolas={bloco.escolas} />
      )}

      {/* CADA CRIANÇA ABRE A FICHA DELA.
        *
        * O nome estava ali, com foto e horário, e não levava a lugar nenhum:
        * pra conferir endereço, telefone da mãe ou a escola, o motorista saía
        * do Início, entrava em Minha turma, procurava na lista e voltava. Três
        * telas pra ler um dado que já estava com o dedo em cima.
        *
        * A ficha abre como FOLHA por cima, e não como navegação: ele está
        * olhando a viagem do dia, e perder essa tela pra ver um telefone é o
        * pedágio que a folha existe pra não cobrar. */}
      {bloco.paradas.map((p) => {
        const fora = !precisaDaPerua(p.estado);
        return (
          <button
            type="button"
            key={p.child.id}
            onClick={() => onAbrirFicha?.(p.child.id)}
            className={`tap w-full text-left rounded-xl px-3 py-2 flex items-center gap-2.5 border ${
              fora ? 'bg-gray-50 border-gray-200 opacity-70' : 'bg-card border-gray-200'
            }`}
          >
            <span
              className={`font-mono text-xs tabular-nums w-11 shrink-0 ${
                fora ? 'text-textMuted' : 'text-text font-semibold'
              }`}
            >
              {horaCurta(p.hora)}
            </span>
            <Avatar
              photoURL={p.child.photoURL}
              gender={p.child.gender}
              seed={p.child.id}
              kind="child"
              size="sm"
            />
            <span className="flex-1 min-w-0">
              <span
                className={`block text-sm font-semibold truncate ${
                  fora ? 'text-textMuted line-through' : 'text-text'
                }`}
              >
                {p.child.name}
              </span>
              {fora && (
                <span className="block text-[11px] text-amber-700 font-medium">
                  {ROTULO_ESTADO[p.estado] || 'Fora hoje'}
                </span>
              )}
            </span>
            <ChevronRight size={16} className="shrink-0 text-textMuted" />
          </button>
        );
      })}

      {bloco.direcao === 'ida' && bloco.escolas.length > 0 && (
        <ParadaEscola escolas={bloco.escolas} />
      )}
    </section>
  );
}

function ParadaEscola({ escolas }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-violet-50 border border-violet-200">
      <span className="w-11 shrink-0 text-[10px] uppercase tracking-wide text-violet-700 font-semibold">
        depois
      </span>
      <School size={15} className="text-violet-700 shrink-0" />
      <span className="flex-1 min-w-0 text-sm font-semibold text-violet-900 truncate">
        {escolas.map((e) => e.nome).join(' · ')}
      </span>
    </div>
  );
}

/* ─────────────── pendências do intervalo ─────────────── */

/**
 * O que dá pra resolver enquanto a perua está parada.
 *
 * Só aparece o que EXISTE. Uma lista de pendências que mostra zeros é uma
 * lista que ele aprende a não ler.
 */
function Pendencias({
  semHorario, convitesAbertos, atrasados, marcados, ausentes,
  onHorarios, onCriancas, onFinanceiro, onAusentes,
}) {
  const itens = [];
  if (semHorario > 0) {
    itens.push({
      icon: Clock,
      texto: `${semHorario} ${semHorario === 1 ? 'criança sem horário confirmado' : 'crianças sem horário confirmado'}`,
      onClick: onHorarios,
    });
  }
  if (convitesAbertos > 0) {
    itens.push({
      icon: MailWarning,
      texto: `${convitesAbertos} ${convitesAbertos === 1 ? 'responsável ainda não entrou' : 'responsáveis ainda não entraram'} no app`,
      onClick: onCriancas,
    });
  }
  if (atrasados > 0) {
    itens.push({
      icon: CircleAlert,
      texto: `${atrasados} ${atrasados === 1 ? 'pagamento atrasado' : 'pagamentos atrasados'}`,
      onClick: onFinanceiro,
    });
  }
  if (marcados > 0) {
    itens.push({
      icon: AlertTriangle,
      texto: `${marcados} ${marcados === 1 ? 'pai marcou pagamento' : 'pais marcaram pagamento'} — confirmar`,
      onClick: onFinanceiro,
    });
  }
  if (ausentes > 0) {
    itens.push({
      icon: Users,
      texto: `${ausentes} ${ausentes === 1 ? 'falta declarada hoje' : 'faltas declaradas hoje'}`,
      onClick: onAusentes,
    });
  }
  if (!itens.length) return null;

  return (
    <section className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-textMuted px-1">
        enquanto isso
      </p>
      {itens.map((i) => (
        <button
          key={i.texto}
          type="button"
          onClick={i.onClick}
          className="tap w-full text-left bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 flex items-center gap-2.5"
        >
          <i.icon size={16} className="text-amber-700 shrink-0" />
          <span className="flex-1 min-w-0 text-[13px] font-semibold text-amber-900">
            {i.texto}
          </span>
          <ChevronRight size={16} className="text-amber-700 shrink-0" />
        </button>
      ))}
    </section>
  );
}

/* ─────────────── cadastro, escrito e visível ─────────────── */

/**
 * As quatro ações que viviam na gaveta "Mais opções".
 *
 * Saíram da gaveta porque gaveta esconde justamente de quem tem medo de
 * procurar — e é exatamente esse o usuário deste app. Elas não aparecem no
 * estado "dirigindo": ali ele está com o veículo em movimento.
 */
function AcoesDeCadastro({ totalCriancas, totalEscolas, semHorario, onBroadcast, navigate }) {
  return (
    <div className="space-y-4">
      {/* CADASTRO — quem anda na perua e de onde. */}
      <section className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-textMuted px-1">
          cadastro
        </p>
        <Linha
          icon={Users}
          titulo="Minha turma"
          contagem={totalCriancas}
          tour="turma"
          onClick={() => navigate('/tio/children')}
        />
        {/* A semana fica no cadastro e não nas pendências porque ele consulta
          * isso pra PLANEJAR — domingo à noite, sábado de manhã — e não só
          * quando há aviso novo. */}
        <Linha
          icon={CalendarDays}
          titulo="Faltas da semana"
          subtitulo="Quem falta em qual dia, de segunda a sexta"
          onClick={() => navigate('/tio/semana')}
        />
        <Linha
          icon={School}
          titulo="Escolas"
          contagem={totalEscolas}
          onClick={() => navigate('/tio/children/escolas')}
        />
        {/* "Horários" não dizia que ali se edita a rota.
          * O motorista pensa "minha rota padrão"; o app respondia com uma
          * palavra que, pra ele, era sobre relógio. É a mesma tela — o nome é
          * que estava falando a língua do modelo em vez da língua dele. */}
        <Linha
          icon={ListOrdered}
          tour="horarios"
          titulo="Editar rota padrão"
          subtitulo="Os horários que você definiu — é o que cada família vê"
          aviso={semHorario > 0 ? `${semHorario} a confirmar` : null}
          onClick={() => navigate('/tio/horarios')}
        />
      </section>

      {/* AVISOS — tudo que chega na agenda das famílias, junto.
        *
        * "Avisar que não tem aula" ficava solto no meio do cadastro, sem nada
        * dizendo que o recado aparece no caderno digital do responsável. Do
        * lado do motorista pareciam duas coisas diferentes; do lado do pai
        * chegam no mesmo lugar. Agora o grupo diz isso — e o "avisos
        * enviados", que só existia escondido, entra aqui. */}
      <section className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-textMuted px-1">
          avisos que vão pra agenda das famílias
        </p>
        <Linha
          icon={Megaphone}
          titulo="Avisar que não tem aula"
          subtitulo="Marca a falta e avisa quem você escolher"
          onClick={onBroadcast}
        />
        <Linha
          icon={Notebook}
          titulo="Avisos enviados"
          subtitulo="O que já foi pro caderno de cada família"
          onClick={() => navigate('/tio/agenda')}
        />
      </section>
    </div>
  );
}

function Linha({ icon: Icon, titulo, subtitulo, contagem, aviso, tour, onClick }) {
  return (
    <button
      type="button"
      data-tour={tour}
      onClick={onClick}
      className="tap w-full text-left bg-card border border-gray-200 rounded-xl px-3 py-3 flex items-center gap-3"
    >
      <div className="w-8 h-8 rounded-lg bg-gray-100 text-textMuted flex items-center justify-center shrink-0">
        <Icon size={16} />
      </div>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-text truncate">
          {titulo}
        </span>
        {subtitulo && (
          <span className="block text-[11px] text-textMuted truncate">
            {subtitulo}
          </span>
        )}
      </span>
      {aviso ? (
        <span className="text-[11px] font-semibold text-amber-700 shrink-0">
          {aviso}
        </span>
      ) : contagem != null ? (
        <span className="font-mono text-xs text-textMuted shrink-0">{contagem}</span>
      ) : null}
      <ChevronRight size={16} className="text-textMuted shrink-0" />
    </button>
  );
}

/**
 * O total a receber fica ESCONDIDO até ele tocar.
 *
 * É a única informação da home que ele não quer que apareça sem querer: o
 * celular na mão dentro da perua, com um pai olhando pela janela.
 */
function ReceberRow({ amount, visivel, onToggle, onClick }) {
  return (
    <div className="bg-card border border-gray-200 rounded-xl px-3 py-3 flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-gray-100 text-textMuted flex items-center justify-center shrink-0">
        <History size={16} />
      </div>
      <button type="button" onClick={onClick} className="tap flex-1 min-w-0 text-left">
        <span className="block text-sm font-semibold text-text">A receber no mês</span>
        <span className="block text-[11px] text-textMuted">
          {visivel ? formatCurrency(amount) : '••••••'}
        </span>
      </button>
      <button
        type="button"
        onClick={onToggle}
        aria-label={visivel ? 'Esconder valor' : 'Mostrar valor'}
        className="tap w-8 h-8 rounded-lg flex items-center justify-center text-textMuted shrink-0"
      >
        {visivel ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

