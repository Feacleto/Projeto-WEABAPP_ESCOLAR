import { useEffect, useMemo, useRef, useState } from 'react';
import ReviewNudge from '../../components/feedback/ReviewNudge';
import {
  MapPin,
  Calendar,
  Bell,
  HelpCircle,
  ChevronRight,
  CalendarX2,
  Map as MapIcon,
  CircleAlert,
  CheckCircle2,
  Home,
  Bus,
  School,
  Star,
  UserCheck,
} from 'lucide-react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import toast from 'react-hot-toast';
import Header from '../../components/layout/Header';
import Skeleton from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import Avatar from '../../components/common/Avatar';
import AbsenceSheet from '../../components/absences/AbsenceSheet';
import AvisoRapido from '../../components/absences/AvisoRapido';
import AvisosFuturos from '../../components/absences/AvisosFuturos';
import RouteTracker from '../../components/dashboard/RouteTracker';
import { ChildDetailSheet } from '../ChildDetail';
import HorarioDoDia from '../../components/dashboard/HorarioDoDia';
import { useRide } from '../../hooks/useRide';
import ChildSwitcher from '../../components/children/ChildSwitcher';
import AbsenceCounts from '../../components/dashboard/AbsenceCounts';
import AltPickupSheet from '../../components/altpickup/AltPickupSheet';
import { maskPhone } from '../../utils/masks';
import { useAuth } from '../../hooks/useAuth';
import { useActiveChild } from '../../hooks/useActiveChild';
import { useLiveLocation } from '../../hooks/useLiveLocation';
import { usePaymentsByParent } from '../../hooks/usePayments';
import { useAbsenceForChild, useChildAbsenceHistory } from '../../hooks/useAbsences';
import { useDailyAltPickup } from '../../hooks/useAltPickup';
import { haversineDistance } from '../../utils/haversine';
import { describeRoutePresence, PRESENCE } from '../../utils/routePresence';
import { formatCurrency } from '../../utils/formatters';
import { getEffectiveStatus } from '../../services/childrenService';
import { ABSENCE_LABELS, ABSENCE_TYPES } from '../../services/absencesService';
import { getDateKey } from '../../services/horariosService';
import { playSound } from '../../services/soundService';
import FestiveBadge from '../../components/festive/FestiveBadge';
import PaiNotebookFAB from '../../components/agenda/PaiNotebookFAB';

const NEAR_KM = 2;
const ARRIVED_KM = 0.4;
const VIBRATE_PATTERN = [220, 100, 220, 100, 220];

const STATUS_GRADIENTS = {
  home: 'from-slate-500 via-slate-600 to-slate-700',
  onboard: 'from-blue-500 via-indigo-600 to-violet-700',
  atSchool: 'from-purple-500 via-fuchsia-600 to-pink-600',
  delivered: 'from-emerald-500 via-emerald-600 to-green-700',
};

/**
 * Frase humana que descreve o estado do filho em UMA linha — adapta pra
 * status + horário. Substitui badges/timelines complexos.
 */
function statusPhrase(status, routeActive, hour) {
  if (status === 'onboard' && routeActive) {
    return hour < 12 ? 'Tá na perua · indo pra escola' : 'Tá na perua · voltando pra casa';
  }
  if (status === 'onboard') return 'Tá na perua';
  if (status === 'atSchool') return 'Já chegou na escola';
  if (status === 'delivered') return 'Tá em casa · chegou em segurança';
  return hour < 11 ? 'Tá em casa · ainda não saiu' : 'Tá em casa';
}

function daysUntil(date) {
  if (!date) return null;
  const d = date?.toDate?.() || new Date(date);
  if (isNaN(d)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - today) / (1000 * 60 * 60 * 24));
}

export default function PaiDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { openTutorial } = useOutletContext() || {};
  const { child, loading: childLoading } = useActiveChild();
  const { location: liveLocation } = useLiveLocation(child?.adminUid);
  const { payments } = usePaymentsByParent(user?.uid);
  const todayKey = getDateKey();
  // Ausência, histórico e responsável alternativo são POR CRIANÇA: têm que
  // seguir o filho selecionado, senão o pai de dois filhos vê a falta de um
  // na tela do outro.
  const { absence } = useAbsenceForChild(todayKey, child?.id);
  // Amanhã. O pai que descobre na terça à noite que na quarta tem consulta
  // não tinha o que fazer além de lembrar de avisar na quarta de manhã — que
  // é o minuto em que ele está mais ocupado.
  const amanhaKey = getDateKey(
    new Date(new Date().setDate(new Date().getDate() + 1))
  );
  const { absence: absenceAmanha } = useAbsenceForChild(amanhaKey, child?.id);
  const { history: absenceHistory } = useChildAbsenceHistory(child?.id);
  const { pickup: altPickup } = useDailyAltPickup(todayKey, child?.id);
  // Hora real de cada etapa e posição na fila — nenhuma das duas o
  // responsável consegue derivar do que ele pode ler.
  const { ride } = useRide(child?.id, todayKey);

  // A ficha abre POR CIMA do painel.
  //
  // O motorista já tinha isso na lista dele; o responsável — que é quem menos
  // convive com app — era o único ejetado da tela pra ver o perfil do próprio
  // filho, e voltava perdendo a rolagem. Tocar num cartão pra "dar uma olhada"
  // não deveria custar o lugar onde ele estava.
  const [fichaAberta, setFichaAberta] = useState(false);
  const [absenceOpen, setAbsenceOpen] = useState(false);
  const [altPickupOpen, setAltPickupOpen] = useState(false);

  const home =
    child?.lat && child?.lng ? { lat: child.lat, lng: child.lng } : null;
  const routeActive = !!liveLocation?.routeActive;
  const van =
    routeActive && liveLocation?.lat && liveLocation?.lng
      ? { lat: liveLocation.lat, lng: liveLocation.lng }
      : null;
  const distanceKm =
    van && home ? haversineDistance(home.lat, home.lng, van.lat, van.lng) : null;

  // Estado honesto da perua. Recalcula a cada tick pra o selo de frescor não
  // congelar em "agora" enquanto a posição envelhece sem chegar nada novo.
  const [presenceTick, setPresenceTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPresenceTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);
  const presence = useMemo(
    () => describeRoutePresence({ liveLocation, distanceKm }),
    // presenceTick força o recálculo do "há quanto tempo" no relógio
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [liveLocation, distanceKm, presenceTick]
  );

  // Alertas de proximidade — só dispara em transição de zona
  const lastZoneRef = useRef(null);
  useEffect(() => {
    if (!routeActive || presence.isStale) {
      // Posição velha não gera "chegou!". Avisar com dado que o app não
      // confirmou é justamente o que queima a confiança do pai.
      lastZoneRef.current = null;
      return;
    }
    if (distanceKm == null) return;

    const zone =
      distanceKm > NEAR_KM
        ? 'far'
        : distanceKm > ARRIVED_KM
        ? 'near'
        : 'arrived';
    const prev = lastZoneRef.current;
    if (zone === prev) return;
    lastZoneRef.current = zone;
    if (prev == null) return;

    if (zone === 'far') toast('Tio Nino em rota', { icon: '🚐' });
    else if (zone === 'near') {
      toast('Tio Nino chega em uns 5 minutos', { icon: '🚐', duration: 6000 });
      // Buzina curta — sinaliza aproximação
      playSound('horn_short');
    } else if (zone === 'arrived') {
      toast.success('Tio Nino chegou!', { duration: 10000 });
      // Buzina longa — Tio chegou na porta
      playSound('horn_long');
      if ('vibrate' in navigator) {
        try {
          navigator.vibrate(VIBRATE_PATTERN);
        } catch {
          /* alguns browsers exigem gesto */
        }
      }
    }
  }, [distanceKm, routeActive, presence.isStale]);

  const nextPayment = useMemo(() => {
    if (!payments?.length) return null;
    const pending = payments
      .filter((p) => p.status === 'pending' || p.status === 'claimed')
      .map((p) => ({
        ...p,
        _due: p.dueDate?.toDate?.() || (p.dueDate ? new Date(p.dueDate) : null),
      }))
      .filter((p) => p._due)
      .sort((a, b) => a._due - b._due);
    return pending[0] || null;
  }, [payments]);

  if (childLoading) {
    return (
      <>
        <Header title="Início" marca />
        <div className="p-5 space-y-3">
          <Skeleton className="h-48" />
          <Skeleton className="h-24" />
        </div>
      </>
    );
  }

  if (!child) {
    return (
      <>
        <Header title="Início" marca />
        <EmptyState
          icon={MapPin}
          title="Cadastro não encontrado"
          description="Sua conta ainda não está vinculada a uma criança. Peça o link de convite pro motorista."
        />
      </>
    );
  }


  /**
   * QUAL DAS TRÊS CARAS — o espelho da home do motorista.
   *
   * A home do responsável empilhava dez blocos: herói, horários, tracker,
   * falta, quem busca, presença, pagamento, contagem de faltas, convite pra
   * avaliar e a gaveta "Mais opções". Todos ao mesmo tempo, o dia inteiro — e
   * a pergunta dele muda três vezes por dia.
   *
   *   ESPERANDO    — a perua não saiu. "Que horas eu preciso estar na porta?"
   *   ACOMPANHANDO — ela está andando, ou o filho está dentro dela.
   *                  "Onde ele está agora?"
   *   ENCERRADO    — chegou, ou não vai hoje. "Está tudo certo?" — e aí sim
   *                  cabe falar de mensalidade, histórico e avaliação.
   *
   * A ordem das perguntas importa: ter chegado em casa vence estar em rota,
   * porque a perua continua rodando pra outras famílias depois de entregar
   * esta — e pra este pai o dia já acabou.
   */
  // AS TRÊS LINHAS ABAIXO VÊM ANTES DO `estadoDoDia`, E A ORDEM NÃO É ESTILO.
  //
  // `estadoDoDia` LÊ `status`. Com a declaração depois, `const` não sofre
  // hoisting de valor: a leitura cai na zona morta temporal e lança
  // `ReferenceError: Cannot access 'status' before initialization` no
  // primeiro render. O painel inteiro do responsável não abria — tela branca.
  //
  // Ficou assim por cinco dias sem ninguém ver, e o motivo é o mesmo que
  // esconde qualquer defeito deste lado do app: sem Cloud Functions no ar,
  // `redeemInvite` não roda e NENHUMA conta de responsável consegue nascer.
  // Ninguém abriu a tela porque ninguém consegue entrar nela.
  //
  // Lint, build e os 92 testes passavam: nada disso executa o componente.
  const status = getEffectiveStatus(child);
  const phrase = statusPhrase(status, routeActive, new Date().getHours());
  const estadoDoDia =
    status === 'delivered' || absence?.type === ABSENCE_TYPES.FULL
      ? 'encerrado'
      : routeActive || status === 'onboard'
      ? 'acompanhando'
      : 'esperando';

  return (
    <>
      <Header title="Início" marca />

      <div className="p-5 space-y-5">
        {/* Só aparece a partir do segundo filho — quem tem um vê a tela
          * igual a antes. */}
        <ChildSwitcher />

        {/* A SAUDAÇÃO SAIU.
          *
          * Ele mora no app o dia inteiro e a cortesia cabe; ela fica vinte
          * segundos e a linha empurrava a HORA pra baixo da dobra em 320px.
          * O `FestiveBadge` foi pro cartão, ao lado da criança — é lá que ele
          * faz sentido, porque o aniversário é dela. */}

        {/* O CARTÃO DE HOJE — rosto, hora e a perua, numa superfície só. É a
          * âncora do tutorial e o lugar onde ela olha primeiro. */}
        <div data-tour="hero">
          <CartaoDeHoje
            child={child}
            status={status}
            phrase={phrase}
            estadoDoDia={estadoDoDia}
            absence={absence}
            ride={ride}
            presence={estadoDoDia === 'esperando' ? presence : null}
            onTap={() => setFichaAberta(true)}
            onMapa={() => navigate('/pai/map')}
          />
        </div>

        {/* ───────── ESPERANDO — "que horas eu preciso estar na porta?" ───────── */}
        {estadoDoDia === 'esperando' && (
          <>
            {/* Três respostas escritas na tela, um toque envia.
              * Antes era um botão que abria uma folha pra depois escolher —
              * dois toques e uma tela no meio, no minuto em que o responsável
              * está atrasado com a criança doente do lado. */}
            <div data-tour="absence">
              <AvisoRapido
                child={child}
                absenceHoje={absence}
                absenceAmanha={absenceAmanha}
                onDetalhes={() => setAbsenceOpen(true)}
                onOutraPessoa={() => setAltPickupOpen(true)}
                altPickup={altPickup}
              />
            </div>

            {/* O que ele já prometeu, de volta na tela.
              * Sem isto, um aviso feito semana passada nunca mais é
              * reencontrado — e no dia o motorista não passa na porta. */}
            <AvisosFuturos child={child} historico={absenceHistory} />

          </>
        )}

        {/* ───────── ACOMPANHANDO — "onde ele está agora?" ───────── */}
        {estadoDoDia === 'acompanhando' && (
          <>
            <RouteTracker status={status} ride={ride} />
          </>
        )}

        {/* O CARTÃO SEPARADO DE "QUEM PEGA HOJE" SAIU.
          *
          * Ele virou a quarta pastilha do bloco de avisar, porque "não vai",
          * "eu levo", "eu busco" e "a avó busca" são quatro respostas da MESMA
          * pergunta — quem encosta na criança hoje. Em dois cartões de cores
          * diferentes, ela descobria a quarta rolando.
          *
          * DURANTE A ROTA o bloco de avisar não existe (a perua já passou na
          * porta dela), e é por isso que a indicação continua alcançável aqui
          * nesse estado: "não consigo buscar hoje" quase nunca é decisão da
          * manhã — é o chefe segurando às 16h. */}
        {estadoDoDia === 'acompanhando' && (
          <AltPickupCTA
            pickup={altPickup}
            onClick={() => setAltPickupOpen(true)}
          />
        )}

        {/* O PAINEL DA PERUA SÓ ONDE ELE TEM O QUE DIZER.
          *
          * No `esperando` ele repetia "a rota ainda não começou" num bloco
          * inteiro, e virou a linha do pé do cartão. Aqui ele fica pros dois
          * estados em que a posição muda de fato.
          *
          * A âncora `map` do tutorial mora AQUI e no pé do cartão: nos três
          * estados existe um alvo, que é o que o teste de âncoras exige. */}
        {estadoDoDia !== 'esperando' && (
          <div data-tour="map">
            <PresencePanel
              presence={presence}
              onOpenMap={() => navigate('/pai/map')}
            />
          </div>
        )}

        {/* O "falar com o motorista" SUBIU PRO CABEÇALHO.
          *
          * Era um bloco no meio da rolagem, e desabilitava quando o motorista
          * não tinha telefone. Emergência não pode rolar, não pode mudar de
          * lugar conforme o estado do dia, e não pode ser um botão apagado —
          * ver `FalarComOMotorista` em `Header.jsx`. */}


        {/* Pagamento pendente aparece já na espera: é a única pendência que
          * não deve esperar o fim do dia pra ser vista. */}
        {estadoDoDia === 'esperando' && nextPayment && (
          <PaymentBanner
            payment={nextPayment}
            onClick={() => navigate('/pai/finance')}
          />
        )}

        {/* ───────── ENCERRADO — o dia acabou, dá pra tratar do resto ───────── */}
        {estadoDoDia === 'encerrado' && (
          <>
            <RouteTracker status={status} ride={ride} />

            {absence && (
              <div data-tour="absence">
                <AbsenceStatus
                  absence={absence}
                  onClick={() => setAbsenceOpen(true)}
                />
              </div>
            )}

            {nextPayment && (
              <PaymentBanner
                payment={nextPayment}
                onClick={() => navigate('/pai/finance')}
              />
            )}

            {absenceHistory.length > 0 && (
              <AbsenceCounts history={absenceHistory} />
            )}

            {/* A PORTA DO HISTÓRICO — e ela aparece mesmo sem falta nenhuma.
              *
              * O bloco acima some quando o histórico está vazio, e faz
              * sentido: contador zerado não informa nada. Mas a tela de
              * histórico precisa existir antes da primeira falta, senão o
              * caminho pra ela só nasce no dia em que já se precisou dele. */}
            <button
              type="button"
              onClick={() => navigate('/pai/faltas')}
              className="tap flex w-full items-center gap-3 rounded-2xl bg-card px-4 py-3 text-left shadow-sm"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CalendarX2 size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-text">
                  Faltas
                </span>
                <span className="block text-[11px] text-textMuted">
                  Meses anteriores e avisar uma nova
                </span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-textMuted" />
            </button>

            {/* Convite pra avaliar — a resposta não vai pra home, vira
              * métrica: é o único jeito de saber se o app serve a ponta que
              * não paga pela ferramenta. Fica no estado calmo, que é quando
              * ele tem paciência pra responder. */}
            <ReviewNudge />

            {/* A gaveta "Mais opções" saiu. Ela escondia quatro linhas atrás
              * de um toque, e gaveta esconde justamente de quem tem medo de
              * procurar. */}
            <div className="bg-card rounded-3xl shadow-sm overflow-hidden divide-y divide-gray-100">
              <OptionRow
                icon={Calendar}
                title="Histórico de pagamentos"
                subtitle="Mês a mês"
                onClick={() => navigate('/pai/finance')}
              />
              <OptionRow
                icon={Bell}
                title="Notificações"
                subtitle="Avisos recentes"
                onClick={() => navigate('/pai/notifications')}
              />
              <OptionRow
                icon={HelpCircle}
                title="Como usar o app"
                onClick={() => openTutorial?.()}
              />
            </div>
          </>
        )}
      </div>

      {/* Caderno digital — botão flutuante na tela inicial do Pai */}
      <PaiNotebookFAB />

      <ChildDetailSheet
        open={fichaAberta}
        childId={child.id}
        onClose={() => setFichaAberta(false)}
      />

      <AbsenceSheet
        open={absenceOpen}
        onClose={() => setAbsenceOpen(false)}
        child={{
          id: child.id,
          name: child.name,
          parentUid: child.parentUid || user?.uid,
          // Sem o adminUid a declaração nasce sem dono e o motorista dela
          // não consegue ler a própria falta.
          adminUid: child.adminUid || null,
        }}
        declaredBy="parent"
        currentAbsence={absence}
        dateKey={todayKey}
        status={status}
      />

      <AltPickupSheet
        open={altPickupOpen}
        onClose={() => setAltPickupOpen(false)}
        child={child}
        parentUid={user?.uid}
        dateKey={todayKey}
        currentPickup={altPickup}
      />
    </>
  );
}

/* ─────────────── O CARTÃO DE HOJE ─────────────── */

/**
 * UM CARTÃO SÓ, no lugar de dois blocos.
 *
 * O herói e o horário eram cartões separados, e no estado `esperando` o herói
 * informava ZERO: "Tá em casa · ainda não saiu", dito sobre uma criança que
 * está de pijama do lado dela. Custava ~200px do topo pra contar o óbvio e
 * empurrava a HORA — a única coisa que ela precisa ler de longe, com a
 * criança no colo — pra baixo da dobra num aparelho de 320px.
 *
 * Agora o rosto e a hora são a mesma superfície: o topo diz de quem é o dia,
 * o corpo diz a que horas, e o pé diz onde a perua está.
 *
 * A TARJA DO MOMENTO é o conserto de "a tela mudou sozinha e nada disse".
 * O Início dela troca de cara três vezes por dia — some a saudação, entra o
 * rastreio — e quem abre o app às 12h20 não acompanhou a transição. É o mesmo
 * conserto que o "MODO ROTA" fez no painel do motorista, pelo mesmo motivo:
 * a pessoa precisa ler onde está antes de tocar em qualquer coisa.
 *
 * A HIERARQUIA SE INVERTE POR ESTADO. Em `esperando` a frase de status é
 * apoio e os números são os protagonistas; em `acompanhando` a frase sobe,
 * porque a pergunta virou "onde ele está agora".
 */
const TARJA = {
  esperando: 'hoje',
  acompanhando: 'ao vivo',
  encerrado: 'dia encerrado',
};

function CartaoDeHoje({
  child,
  status,
  phrase,
  estadoDoDia,
  absence,
  ride,
  presence,
  onTap,
  onMapa,
}) {
  const gradient = STATUS_GRADIENTS[status] || STATUS_GRADIENTS.home;
  const isLive = estadoDoDia === 'acompanhando';
  const destaqueFrase = isLive ? 'text-[19px]' : 'text-2xl';

  return (
    <div className="rounded-3xl overflow-hidden shadow-xl shadow-indigo-500/15 bg-card">
      <button
        onClick={onTap}
        className={`tap w-full text-left bg-gradient-to-br ${gradient} text-white p-6 relative overflow-hidden block`}
      >
        {/* Ilustração animada de fundo — muda com o estado da criança */}
        <StateIllustration status={status} />

        <div className="relative flex items-center gap-4">
          <div className="rounded-full overflow-hidden border-2 border-white/30 bg-white/20 backdrop-blur-sm shrink-0">
            <Avatar
              photoURL={child.photoURL}
              gender={child.gender}
              seed={child.id}
              kind="child"
              size="lg"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {/* A TARJA DIZ QUAL DOS TRÊS MOMENTOS É — ver o cabeçalho. */}
              <span className="rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest">
                {isLive && (
                  <span className="relative mr-1 inline-flex align-middle">
                    <span className="absolute inline-flex h-1.5 w-1.5 rounded-full bg-white opacity-75 animate-ping" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                  </span>
                )}
                {TARJA[estadoDoDia]}
              </span>
              <p className="truncate text-xs font-semibold uppercase tracking-widest text-white/80">
                {child.name?.split(' ')[0]}
              </p>
            </div>
            <p className={`${destaqueFrase} font-bold leading-tight mt-1.5`}>
              {phrase.split(' · ')[0]}
            </p>
            {phrase.includes(' · ') && (
              <p className="text-white/85 text-sm mt-1">
                {phrase.split(' · ')[1]}
              </p>
            )}
          </div>
          {/* O ANIVERSÁRIO É DA CRIANÇA, então o badge mora ao lado dela e
            * não ao lado da saudação, que saiu. */}
          <span className="shrink-0">
            <FestiveBadge />
          </span>
          <ChevronRight size={18} className="shrink-0 text-white/70" />
        </div>

      </button>

      {/* O CORPO: a hora, que é o motivo de ela abrir o app.
        * `semCasca` porque quem desenha a superfície agora é este cartão. */}
      <HorarioDoDia child={child} absence={absence} ride={ride} semCasca />

      {/* O PÉ: onde a perua está, em UMA linha.
        *
        * No `esperando` o painel da perua dizia sempre a mesma coisa — "a
        * rota ainda não começou" — num bloco inteiro. Bloco cujo conteúdo é
        * "nada aconteceu" ensina a pular blocos. A frase cabe numa linha, e
        * tocar leva pro mapa. */}
      {presence && (
        <button
          type="button"
          onClick={onMapa}
          className="tap flex w-full items-center gap-2.5 border-t border-gray-100 bg-surface px-5 py-3 text-left"
        >
          <MapPin size={15} className="shrink-0 text-textMuted" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold text-text">
              {presence.title}
            </span>
            {presence.detail && (
              <span className="block truncate text-[11px] text-textMuted">
                {presence.detail}
              </span>
            )}
          </span>
          <ChevronRight size={15} className="shrink-0 text-textMuted" />
        </button>
      )}
    </div>
  );
}

/**
 * Ilustração decorativa que dá "vida" ao card baseado no status atual:
 *   - home      → casa pulsando suave (à direita)
 *   - onboard   → perua atravessando o card em loop
 *   - atSchool  → escola balançando como sino
 *   - delivered → estrela girando + brilho
 *
 * Tudo em opacity baixa pra não competir com o texto, mas suficiente
 * pra o pai sentir o estado emocional do momento.
 */
function StateIllustration({ status }) {
  if (status === 'onboard') {
    return (
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-3 pointer-events-none animate-van-drive"
      >
        <Bus
          size={56}
          strokeWidth={1.5}
          className="text-white/25 mx-auto"
        />
      </div>
    );
  }
  if (status === 'atSchool') {
    return (
      <div
        aria-hidden
        className="absolute -bottom-2 -right-2 pointer-events-none animate-school-sway"
      >
        <School size={88} strokeWidth={1.3} className="text-white/15" />
      </div>
    );
  }
  if (status === 'delivered') {
    return (
      <div
        aria-hidden
        className="absolute -top-2 -right-2 pointer-events-none animate-celebrate"
      >
        <Star
          size={72}
          strokeWidth={1.4}
          fill="currentColor"
          className="text-white/20"
        />
      </div>
    );
  }
  // home (padrão)
  return (
    <div
      aria-hidden
      className="absolute -bottom-2 -right-2 pointer-events-none animate-house-rest"
    >
      <Home size={88} strokeWidth={1.3} className="text-white/15" />
    </div>
  );
}

/* ─────────────── Ausência ─────────────── */

/* O `AbsenceCTA` — o botão pontilhado que abria a folha — saiu junto com o
 * `AvisoRapido`. Ele existia pra levar a uma tela onde as opções estavam; as
 * opções agora estão na home. O `AbsenceStatus` fica: ele ainda é usado no
 * estado "encerrado", pra mostrar o que já foi declarado. */

function AbsenceStatus({ absence, onClick }) {
  return (
    <button
      onClick={onClick}
      className="tap w-full text-left rounded-2xl bg-gradient-to-br from-amber-50 to-orange-100 border border-amber-200 p-4 flex items-center gap-3"
    >
      <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
        <CheckCircle2 size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-text leading-tight">
          Ausência registrada para hoje
        </p>
        <p className="text-xs text-textMuted mt-0.5">
          {ABSENCE_LABELS[absence.type]}
        </p>
      </div>
      <ChevronRight size={18} className="text-textMuted shrink-0" />
    </button>
  );
}

/**
 * Botão "Quem busca hoje?" — adapta conforme há ou não indicação ativa.
 */
function AltPickupCTA({ pickup, onClick }) {
  if (pickup) {
    return (
      <button
        onClick={onClick}
        className="tap w-full text-left rounded-2xl bg-gradient-to-br from-violet-50 to-purple-100 border border-violet-200 p-4 flex items-center gap-3"
      >
        <div className="w-10 h-10 rounded-xl bg-violet-500 text-white flex items-center justify-center shrink-0">
          <UserCheck size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-text leading-tight">
            Hoje quem pega: {pickup.name}
          </p>
          <p className="text-xs text-textMuted mt-0.5 truncate">
            {pickup.relationship && <span>{pickup.relationship} · </span>}
            {maskPhone(pickup.phone)}
          </p>
        </div>
        <ChevronRight size={18} className="text-textMuted shrink-0" />
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      className="tap w-full text-left rounded-2xl bg-card shadow-sm p-4 flex items-center gap-3 border border-dashed border-gray-200"
    >
      <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
        <UserCheck size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-text leading-tight">
          Outro responsável vai buscar?
        </p>
        <p className="text-xs text-textMuted mt-0.5">
          Indique no app pra o motorista saber
        </p>
      </div>
      <ChevronRight size={18} className="text-textMuted shrink-0" />
    </button>
  );
}

/* ─────────────── Tracking ─────────────── */

/**
 * Painel de tracking — preserva a privacidade do Tio:
 *   - Longe (> 2 km): só mostra "Em rota — vamos te avisar quando estiver perto"
 *   - Próximo (≤ 2 km): mostra "Tá chegando!" com distância e tempo
 *   - Chegou (≤ 400 m): "Chegou! Já tá na sua porta"
 */
/**
 * Painel de presença da perua — três estados honestos em vez de dois.
 *
 * Antes existiam só "rota ativa com distância" e "sem rota". O caso do tio
 * que fecha a aba no meio do caminho caía no primeiro: routeActive ficava
 * true, a perua aparecia parada no mapa e o pai lia aquilo como verdade.
 * Agora esse caso tem nome, cor e um telefone à mão.
 */
function PresencePanel({ presence, onOpenMap }) {
  const cfg = {
    [PRESENCE.NO_ROUTE]: {
      ring: 'border-dashed border-gray-200',
      iconBg: 'bg-gray-100 text-textMuted',
      icon: MapIcon,
    },
    [PRESENCE.STALE]: {
      ring: 'border-amber-200',
      iconBg: 'bg-amber-100 text-amber-700',
      icon: CircleAlert,
    },
    [PRESENCE.MOVING]: {
      ring: 'border-gray-100',
      iconBg: 'bg-primary/10 text-primary',
      icon: Bus,
    },
  }[presence.kind];

  const Icon = cfg.icon;

  return (
    <button
      onClick={onOpenMap}
      className={`tap w-full text-left rounded-2xl bg-card shadow-sm p-4 flex items-center gap-3 border ${cfg.ring}`}
    >
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${cfg.iconBg}`}
      >
        <Icon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-text leading-tight">{presence.title}</p>
        {presence.detail && (
          <p className="text-xs text-textMuted mt-0.5 leading-snug">
            {presence.detail}
          </p>
        )}
        {/* Selo de frescor: sempre visível quando vem do GPS. É o que separa
          * "está aqui agora" de "estava aqui em algum momento". */}
        {presence.freshness && (
          <p className="text-[11px] text-textMuted mt-1">
            {presence.freshness}
            {presence.distanceKm != null &&
              ` · ${formatDistance(presence.distanceKm)} daqui`}
          </p>
        )}
      </div>
      <ChevronRight size={18} className="text-textMuted shrink-0" />
    </button>
  );
}

function formatDistance(km) {
  if (km == null) return '—';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

/* ─────────────── Pagamento ─────────────── */

function PaymentBanner({ payment, onClick }) {
  const dleft = daysUntil(payment._due);
  const overdue = dleft != null && dleft < 0;
  const urgent = dleft != null && dleft >= 0 && dleft <= 3;

  const bg = overdue
    ? 'from-red-50 to-rose-100 border-red-200'
    : urgent
    ? 'from-amber-50 to-orange-100 border-amber-200'
    : 'from-blue-50 to-indigo-100 border-blue-200';

  const headline = overdue
    ? `Atrasado há ${Math.abs(dleft)} dia${Math.abs(dleft) > 1 ? 's' : ''}`
    : dleft === 0
    ? 'Vence hoje'
    : dleft === 1
    ? 'Vence amanhã'
    : `Vence em ${dleft} dias`;

  return (
    <button
      onClick={onClick}
      className={`tap w-full text-left rounded-2xl p-4 border bg-gradient-to-br ${bg} flex items-center gap-3`}
    >
      <div className="w-11 h-11 rounded-xl bg-text/90 text-white flex items-center justify-center shrink-0">
        <Calendar size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-text leading-tight">
          Mensalidade · {formatCurrency(payment.amount)}
        </p>
        <p className="text-xs text-textMuted mt-0.5">{headline}</p>
      </div>
      <ChevronRight size={18} className="text-textMuted shrink-0" />
    </button>
  );
}

/* ─────────────── Mais opções rows ─────────────── */

function OptionRow({ icon: Icon, title, subtitle, onClick, disabled }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`tap w-full text-left p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors ${
        disabled ? 'opacity-50' : ''
      }`}
    >
      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <Icon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-text leading-tight">{title}</p>
        {subtitle && <p className="text-xs text-textMuted mt-0.5">{subtitle}</p>}
      </div>
      <ChevronRight size={18} className="text-textMuted shrink-0" />
    </button>
  );
}
