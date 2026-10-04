import { useEffect, useMemo, useState } from 'react';
import AvaliacaoNoInicio from '../../components/feedback/AvaliacaoNoInicio';
import { MOMENTO, PAPEL_DA_AVALIACAO } from '../../dominio/suporte/avaliacaoRapida.js';
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
  FileText,
} from 'lucide-react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import Header from '../../components/layout/Header';
import Skeleton from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import Avatar from '../../components/common/Avatar';
import AbsenceSheet from '../../components/absences/AbsenceSheet';
import AvisoRapido from '../../components/absences/AvisoRapido';
import AvisosFuturos from '../../components/absences/AvisosFuturos';
import RouteTracker from '../../components/dashboard/RouteTracker';
// Sob demanda: a ficha traz o mapa e o QR code (ver FichaDaCriancaSobDemanda).
import ChildDetailSheet from '../../components/children/FichaDaCriancaSobDemanda';
import HorarioDoDia from '../../components/dashboard/HorarioDoDia';
import { useRide } from '../../hooks/useRide';
import ChildSwitcher from '../../components/children/ChildSwitcher';
import AvisoDeIrmao from '../../components/children/AvisoDeIrmao';
import AbsenceCounts from '../../components/dashboard/AbsenceCounts';
import AltPickupSheet from '../../components/altpickup/AltPickupSheet';
import { maskPhone } from '../../compartilhado/masks';
import { useAuth } from '../../hooks/useAuth';
import { useActiveChild } from '../../hooks/useActiveChild';
import AvisoDeMudancaNoContrato from '../../components/contract/AvisoDeMudancaNoContrato';
import ConfirmeSeuEmail from '../../components/common/ConfirmeSeuEmail';
import { useRelogio } from '../../hooks/useRelogio';
import TarjaDeAviso from '../../components/dashboard/TarjaDeAviso';
import { avisoDoMomento } from '../../dominio/rota/avisoDoMomento';
import { useLiveLocation } from '../../hooks/useLiveLocation';
import { usePaymentsByParent } from '../../hooks/usePayments';
import { useAbsenceForChild, useChildAbsenceHistory } from '../../hooks/useAbsences';
import { useDailyAltPickup } from '../../hooks/useAltPickup';
import { haversineDistance } from '../../compartilhado/haversine';
import { describeRoutePresence, PRESENCE, formatDistance } from '../../dominio/rota/routePresence';
import { formatCurrency } from '../../compartilhado/formatters';
import { getEffectiveStatus } from '../../services/childrenService';
import { ABSENCE_LABELS, ABSENCE_TYPES } from '../../services/absencesService';
import { getDateKey } from '../../dominio/rota/horarios';
import FestiveBadge from '../../components/festive/FestiveBadge';
import PaiNotebookFAB from '../../components/agenda/PaiNotebookFAB';
import { GRADIENTE_STATUS } from '../../config/paletaCategorica';
import { diaSemRota, ehDiaDeAula } from '../../dominio/rota/calendario.js';
import FaixaSemInternet from '../../components/dashboard/FaixaSemInternet';


/**
 * Frase humana que descreve o estado do filho em UMA linha — adapta pra
 * status + horário. Substitui badges/timelines complexos.
 *
 * ⚠️ A PRIMEIRA PARTE É O NOME DA ETAPA, E ELE É O MESMO DO APP INTEIRO
 * (03/10/2026): "Em casa · Na perua · Na escola · Entregue em casa" — os da
 * tela do motorista, do `RouteTracker` e do link de acompanhar. Eram três
 * vocabulários ("Tá na perua", "Já chegou na escola", "Voltou"), e a mãe lia
 * uma palavra no cartão e outra no aviso. Depois do " · " a frase é natural.
 *
 * "Chegou em segurança" SAIU: o app sabe que o motorista marcou a entrega,
 * não sabe nada sobre segurança — e a marca não promete isso (docs/marca.md).
 */
function statusPhrase(status, routeActive, hour, semRotaHoje = false) {
  if (status === 'onboard' && routeActive) {
    return hour < 12 ? 'Na perua · a caminho da escola' : 'Na perua · a caminho de casa';
  }
  if (status === 'onboard') return 'Na perua';
  if (status === 'atSchool') return 'Na escola';
  if (status === 'delivered') return 'Entregue em casa';
  if (semRotaHoje) return 'Em casa';
  return hour < 11 ? 'Em casa · ainda não embarcou' : 'Em casa';
}

/**
 * O próximo dia COM rota depois de `data` — amanhã num dia comum, a segunda
 * numa sexta, o dia seguinte ao feriado. Teto de 14 dias, o mesmo do aviso
 * de falta: o calendário nacional nunca passa disso sem aula, e as férias o
 * app não conhece.
 */
function proximoDiaDeAula(data = new Date()) {
  for (let i = 1; i <= 14; i += 1) {
    const d = new Date(data.getFullYear(), data.getMonth(), data.getDate() + i);
    if (ehDiaDeAula(d)) return d;
  }
  return new Date(data.getFullYear(), data.getMonth(), data.getDate() + 1);
}

const DIAS_DA_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
/** "na segunda, 5/10" / "no sábado, 4/10". */
function diaPorExtenso(d) {
  const prep = d.getDay() === 0 || d.getDay() === 6 ? 'no' : 'na';
  return `${prep} ${DIAS_DA_SEMANA[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}`;
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
  // O PRÓXIMO DIA DE AULA. Era sempre "amanhã" — e numa sexta "amanhã" é
  // sábado, um dia sem perua. O pai que descobre na terça à noite que na
  // quarta tem consulta não tinha o que fazer além de lembrar de avisar na
  // quarta de manhã — que é o minuto em que ele está mais ocupado.
  const proximaAula = proximoDiaDeAula(new Date());
  const proximoKey = getDateKey(proximaAula);
  const { absence: absenceProximo } = useAbsenceForChild(proximoKey, child?.id);
  const { history: absenceHistory } = useChildAbsenceHistory(
    child?.id,
    child?.adminUid
  );
  const { pickup: altPickup } = useDailyAltPickup(todayKey, child?.id);
  // Hora real de cada etapa e posição na fila — nenhuma das duas o
  // responsável consegue derivar do que ele pode ler.
  const { ride } = useRide(child?.id, todayKey);

  // O RELÓGIO ANDANDO É O QUE FAZ O AVISO DISPARAR.
  //
  // Os dois gatilhos comparam a hora combinada com AGORA. Sem re-render, o
  // app aberto às 6h10 continuaria mostrando a tela das 6h10 às 6h50 — e o
  // aviso, que existe exatamente pra esse intervalo, nunca apareceria.
  // `useRelogio` bate de minuto em minuto e para com a aba escondida.
  //
  // Fica AQUI, junto dos outros hooks: abaixo há returns antecipados
  // (carregando, sem criança), e hook atrás de return quebra a ordem.
  const agora = useRelogio();

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
  /**
   * O AVISO DE CHEGADA NÃO MORA MAIS NESTA TELA (03/10/2026).
   *
   * Ele era um toast disparado aqui, na mudança de `rides/{dia}.proximidade`,
   * e tinha três defeitos: só existia com o app aberto NO INÍCIO (no bolso,
   * nada tocava), avisava também a perua INDO EMBORA (chegou → longe dizia
   * "está a caminho"), e o mapa da família tinha um SEGUNDO alerta, com
   * "Tio Nino" escrito à mão e emoji.
   *
   * Agora o servidor lê a mesma faixa e escreve a notificação
   * (`functions/lib/avisosDaRota.js`), só quando a perua se APROXIMA e só para
   * a criança que a espera agora. Ela vira push com o app fechado e cartão com
   * o app aberto (`avisoNaTela`), em qualquer tela.
   */

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
  const estadoDoDia =
    status === 'delivered' || absence?.type === ABSENCE_TYPES.FULL
      ? 'encerrado'
      : routeActive || status === 'onboard'
      ? 'acompanhando'
      : 'esperando';
  // DIA SEM ROTA (sábado, domingo, feriado nacional — `calendario.js`). Só
  // vale enquanto nada está acontecendo: se o motorista rodou mesmo assim
  // ("Rodar mesmo assim", no Início dele), a tela acompanha como num dia
  // comum — o calendário é presunção, a rota ligada é fato.
  const motivoSemRota = diaSemRota(agora);
  const semRotaHoje = !!motivoSemRota && estadoDoDia === 'esperando';
  const phrase = statusPhrase(status, routeActive, new Date().getHours(), semRotaHoje);

  // O RÓTULO DO CARTÃO E O ANEL — e o anel só pulsa sobre dado VIVO.
  //
  // Com a posição velha (STALE: o celular dele sem sinal, a aba fechada), o
  // cartão seguia dizendo "AO VIVO" com o anel batendo. Animação viva sobre
  // dado morto é a regra que o design system proíbe pelo nome: o rótulo
  // passa a dizer de quando é o que se sabe ("Última posição há 7 minutos").
  const posicaoVelha = routeActive && presence.kind === PRESENCE.STALE;
  const dadoVivo =
    estadoDoDia === 'acompanhando' &&
    routeActive &&
    (presence.kind === PRESENCE.MOVING || presence.kind === PRESENCE.SEM_MAPA);

  const aviso = avisoDoMomento({
    child,
    status,
    presence,
    ride,
    absence,
    agora,
  });

  const semAtualizacao = aviso?.nivel === 'grave';
  const rotuloDoCartao = semAtualizacao
    ? 'Sem atualização'
    : estadoDoDia === 'acompanhando' && posicaoVelha
    ? presence.freshness
      ? presence.freshness.replace(/^atualizado/, 'Última posição')
      : 'Sem posição da perua'
    : estadoDoDia === 'acompanhando'
    ? routeActive
      ? 'Ao vivo'
      : 'Hoje'
    : semRotaHoje
    ? 'Sem rota hoje'
    : TARJA[estadoDoDia];
  const ocorrencia = routeActive && presence.kind === PRESENCE.OCORRENCIA;
  const primeiro = child.name?.split(' ')[0] || 'seu filho';

  // O CADERNO ABRE PELA MESMA PORTA DA NOTIFICAÇÃO DE RECADO: o estado
  // `abrirCaderno` da navegação (ver `PaiNotebookFAB`). O painel da perua
  // manda "veja o recado dele no caderno" — o botão leva até lá.
  const verRecado = () =>
    navigate('/pai', { replace: true, state: { abrirCaderno: true } });

  // A AÇÃO DO MOMENTO, na barra de baixo (onde o polegar está). Ela muda com
  // o dia e SOME quando não há o que fazer — barra que oferece o que não
  // existe ensina a ignorar a barra.
  //   esperando     → avisar falta ou quem busca (leva ao bloco de avisar)
  //   acompanhando  → ver a perua no mapa, SÓ se há perua para ver (MOVING);
  //                   com o mapa desligado por ele (SEM_MAPA) ou a posição
  //                   velha, o mapa não mostraria nada — sem barra;
  //                   com problema na perua, o recado dele
  //   encerrado / sem rota → nada
  const acaoDaBarra =
    estadoDoDia === 'esperando' && !semRotaHoje
      ? {
          rotulo: 'Avisar falta ou quem busca',
          Icone: CalendarX2,
          onClick: () => {
            const bloco = document.getElementById('aviso-rapido');
            bloco?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            bloco?.focus({ preventScroll: true });
          },
        }
      : estadoDoDia === 'acompanhando' && ocorrencia
      ? { rotulo: 'Ver o recado do motorista', Icone: FileText, onClick: verRecado }
      : estadoDoDia === 'acompanhando' && routeActive && presence.kind === PRESENCE.MOVING
      ? { rotulo: 'Ver a perua no mapa', Icone: MapIcon, onClick: () => navigate('/pai/map') }
      : null;

  return (
    <>
      <Header title="Início" marca />

      <div className="p-5 space-y-5">
        {/* O AVISO VEM ANTES DE TUDO, inclusive do seletor de filho: quando
          * ele existe, é a coisa mais importante da tela. */}
        <TarjaDeAviso aviso={aviso} />
        {/* Sem rede, o cartão continua mostrando o último estado que chegou
          * — e nada na tela diria que pode ser velho. */}
        <FaixaSemInternet />
        {/* O irmão que entrou sozinho pelo WhatsApp dela, com a saída
          * "Não é meu filho" — antes do seletor, porque é sobre ele. */}
        <AvisoDeIrmao />
        {/* Mudança no contrato esperando o aceite dela — não bloqueia nada. */}
        <AvisoDeMudancaNoContrato child={child} />
        {/* Confirmar o e-mail é lembrete, nunca portão (ConfirmeSeuEmail). */}
        <ConfirmeSeuEmail />
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
            rotulo={rotuloDoCartao}
            aoVivo={dadoVivo && !semAtualizacao}
            absence={absence}
            ride={ride}
            // No dia sem rota o pé ("a rota de hoje ainda não começou")
            // mentiria: ela não vai começar.
            presence={estadoDoDia === 'esperando' && !semRotaHoje ? presence : null}
            semRota={semRotaHoje ? motivoSemRota : null}
            proximoDia={diaPorExtenso(proximaAula)}
            onTap={() => setFichaAberta(true)}
            onMapa={() => navigate('/pai/map')}
          />
        </div>

        {/* A FICHA, ESCRITA (03/10/2026). Tocar no cartão sempre abriu a
          * ficha — e ninguém sabia: cartão não parece botão. É lá que moram
          * o acesso de 24 horas do segundo responsável, a escola e a saúde. */}
        <button
          type="button"
          onClick={() => setFichaAberta(true)}
          className="tap flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 text-base font-semibold text-primary"
        >
          <FileText size={20} className="shrink-0" />
          <span className="truncate">Ficha {artigo(child)} {primeiro}</span>
          <ChevronRight size={18} className="shrink-0" />
        </button>

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
                absenceProximo={absenceProximo}
                proximoKey={proximoKey}
                hojeTemRota={!motivoSemRota}
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

        {/* O CARTÃO SEPARADO DE "QUEM BUSCA HOJE" SAIU.
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
              onVerRecado={verRecado}
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
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primaryChip text-primary">
                <CalendarX2 size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-text">
                  Faltas
                </span>
                <span className="block text-sm text-textMuted">
                  Meses anteriores e avisar uma nova
                </span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-textMuted" />
            </button>

            {/* A AVALIAÇÃO RÁPIDA — depois que o filho chegou em casa, a
              * partir do 5º dia (dominio/suporte/avaliacaoRapida.js). Só o dono
              * lê: é o único jeito de saber se o app serve a ponta que não
              * paga pela ferramenta. */}
            <AvaliacaoNoInicio
              papel={PAPEL_DA_AVALIACAO.RESPONSAVEL}
              momento={MOMENTO.DIA_ENTREGUE}
              momentoHoje={status === 'delivered'}
              crianca={child?.name}
            />

            {/* A gaveta "Mais opções" saiu. Ela escondia quatro linhas atrás
              * de um toque, e gaveta esconde justamente de quem tem medo de
              * procurar. */}
            <div className="bg-card rounded-3xl shadow-sm overflow-hidden divide-y divide-neutro">
              <OptionRow
                icon={Calendar}
                title="Histórico de pagamentos"
                subtitle="Mês a mês"
                // O EXTRATO, não o Financeiro: a linha promete o histórico, e
                // o `/pai/finance` abre na mensalidade do mês.
                onClick={() => navigate('/pai/finance/report')}
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

        {/* O CADERNO, como linha e dentro da rolagem — EM TODOS OS ESTADOS.
          *
          * Ele sumia no `acompanhando` ("recado de semana passada não compete
          * com onde ele está agora"), e isso quebrava duas coisas justamente
          * durante a rota: o painel da perua quebrada manda "veja o recado
          * dele no caderno" e o caderno não existia na tela; e a notificação
          * de recado (que abre o caderno pelo `state` da navegação) caía num
          * Início sem caderno para abrir. Fica no fim, que é onde vai quem
          * terminou de ler — e sobe o tom quando há problema na perua. */}
        <PaiNotebookFAB destaque={ocorrencia} />
      </div>

      {/* A BARRA DE BAIXO — a ação do momento, onde o polegar descansa.
        * Mesma forma e lugar da `BarraDoInicio` do motorista: `sticky` no fim
        * do conteúdo (o `PaiLayout` já reserva o espaço das abas), então o
        * último cartão nunca fica escondido por baixo dela. */}
      {acaoDaBarra && (
        <div
          className="sticky z-20 mx-3 mt-2 rounded-2xl bg-card p-2 shadow-float"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.75rem)' }}
        >
          <button
            type="button"
            onClick={acaoDaBarra.onClick}
            className="tap flex h-16 w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 text-lg font-extrabold text-white shadow-focus"
          >
            <acaoDaBarra.Icone size={24} className="shrink-0" />
            <span className="truncate">{acaoDaBarra.rotulo}</span>
          </button>
        </div>
      )}

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
  esperando: 'Hoje',
  acompanhando: 'Ao vivo',
  encerrado: 'Dia encerrado',
};

/** "do Pedro" / "da Lia" — pelo gênero da ficha; sem ele, "de". */
function artigo(child) {
  const g = String(child?.gender || '').toLowerCase();
  if (g.startsWith('f') || g === 'menina') return 'da';
  if (g.startsWith('m') || g === 'menino') return 'do';
  return 'de';
}

function CartaoDeHoje({
  child,
  status,
  phrase,
  estadoDoDia,
  // O que a tarja diz ("Hoje", "Ao vivo", "Última posição há 7 minutos"…) —
  // quem decide é o Início, que sabe se o dado é vivo.
  rotulo,
  // NADA DE ANIMAÇÃO VIVA SOBRE DADO MORTO.
  //
  // O anel só pulsa quando a posição é fresca. Com o app sem receber nada
  // (a tarja de aviso grave) ou com a posição velha, o anel e a palavra
  // "Ao vivo" viravam a pior parte da tela: afirmavam, com movimento, que o
  // app estava sabendo justamente quando ele não sabia.
  aoVivo = false,
  absence,
  ride,
  presence,
  semRota = null,
  proximoDia = null,
  onTap,
  onMapa,
}) {
  const gradient = GRADIENTE_STATUS[status] || GRADIENTE_STATUS.home;
  const destaqueFrase = estadoDoDia === 'acompanhando' ? 'text-[26px]' : 'text-2xl';
  const [principal, apoio] = phrase.split(' · ');

  return (
    <div className="rounded-3xl overflow-hidden shadow-focus bg-card">
      <div className="relative">
      <button
        onClick={onTap}
        className={`tap w-full text-left bg-gradient-to-br ${gradient} text-white p-5 relative overflow-hidden block`}
      >
        {/* Ilustração de fundo — muda com o estado da criança */}
        <StateIllustration status={status} />

        {/* LEITURA EM Z (03/10/2026). No canto de cima, à esquerda, DE QUEM
          * é o dia: o rosto e o nome em 22px (era 16px, abaixo da hora). Na
          * diagonal, o estado numa frase grande; a hora vem logo abaixo, no
          * corpo do cartão. A tarja do momento fica colada ao nome. */}
        <div className="relative flex items-center gap-3 pr-10">
          <div className="rounded-full overflow-hidden border-2 border-white/30 bg-white/20 backdrop-blur-sm shrink-0">
            <Avatar
              photoURL={child.photoURL}
              gender={child.gender}
              seed={child.id}
              kind="child"
              size="lg"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[22px] font-bold leading-tight text-white">
              {child.name?.split(' ')[0]}
            </p>
            {/* A TARJA DIZ QUAL DOS MOMENTOS É — ver o cabeçalho. 14px, em
              * caixa normal: era o `.rotulo` de 12px em caixa alta. */}
            <span className="mt-1 inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/25 px-2.5 py-0.5 text-sm font-bold text-white">
              {aoVivo && (
                <span className="relative inline-flex shrink-0">
                  <span className="absolute inline-flex h-2 w-2 rounded-full bg-white opacity-75 animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                </span>
              )}
              <span className="truncate">{rotulo}</span>
            </span>
          </div>
        </div>

        <p className={`relative mt-4 ${destaqueFrase} font-bold leading-tight`}>
          {principal}
        </p>
        {apoio && (
          <p className="relative mt-1 text-base text-white/90">{apoio}</p>
        )}
      </button>
      {/* O ANIVERSÁRIO É DA CRIANÇA, então o enfeite mora no cartão dela. Fica
        * FORA do botão do cartão: ele é um botão também, e botão dentro de
        * botão é HTML inválido (o React avisava no console, e o leitor de
        * tela lia os dois como um só). */}
      <span className="absolute right-3 top-3">
        <FestiveBadge />
      </span>
      </div>

      {/* O CORPO: a hora, que é o motivo de ela abrir o app.
        * `semCasca` porque quem desenha a superfície agora é este cartão. */}
      <HorarioDoDia
        child={child}
        absence={absence}
        ride={ride}
        semCasca
        semRota={semRota}
        proximoDia={proximoDia}
      />

      {/* O PÉ: onde a perua está, em UMA linha.
        *
        * No `esperando` o painel da perua dizia sempre a mesma coisa — "a
        * rota ainda não começou" — num bloco inteiro. Bloco cujo conteúdo é
        * "nada aconteceu" ensina a pular blocos. A frase cabe numa linha, e
        * tocar leva pro mapa. 16px no título: era 12px. */}
      {presence && (
        <button
          type="button"
          onClick={onMapa}
          className="tap flex min-h-14 w-full items-center gap-2.5 border-t border-neutro bg-surface px-5 py-3 text-left"
        >
          <MapPin size={18} className="shrink-0 text-textMuted" />
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold leading-snug text-text">
              {presence.title}
            </span>
            {presence.detail && (
              <span className="block text-sm leading-snug text-textMuted">
                {presence.detail}
              </span>
            )}
          </span>
          <ChevronRight size={18} className="shrink-0 text-textMuted" />
        </button>
      )}
    </div>
  );
}

/**
 * Ilustração decorativa que diz o estado atual pelo desenho:
 *   - home      → casa (à direita)
 *   - onboard   → perua
 *   - atSchool  → escola
 *   - delivered → estrela
 *
 * Tudo em opacity baixa pra não competir com o texto.
 *
 * ⚠️ PARADA DE PROPÓSITO (03/10/2026). Eram quatro animações em loop — a
 * perua atravessando, a escola balançando, a estrela girando, a casa
 * pulsando. O design system diz que nada se mexe sozinho, só o "ao vivo": a
 * perua que andava sem parar continuava andando quando a posição envelhecia,
 * e competia com o anel da tarja, que é quem diz se o dado é vivo.
 */
function StateIllustration({ status }) {
  if (status === 'onboard') {
    return (
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-3 pointer-events-none"
      >
        <Bus size={56} className="text-white/25 mx-auto" />
      </div>
    );
  }
  if (status === 'atSchool') {
    return (
      <div
        aria-hidden
        className="absolute -bottom-2 -right-2 pointer-events-none"
      >
        <School size={88} className="text-white/15" />
      </div>
    );
  }
  if (status === 'delivered') {
    return (
      <div
        aria-hidden
        className="absolute -top-2 -right-2 pointer-events-none"
      >
        <Star
          size={72}
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
      className="absolute -bottom-2 -right-2 pointer-events-none"
    >
      <Home size={88} className="text-white/15" />
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
      className="tap w-full text-left rounded-2xl bg-gradient-to-br from-warningSoft to-warningChip border border-warningBorder p-4 flex items-center gap-3"
    >
      <div className="w-10 h-10 rounded-xl bg-warning text-white flex items-center justify-center shrink-0">
        <CheckCircle2 size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-text leading-tight">
          Ausência registrada para hoje
        </p>
        <p className="text-sm text-textMuted mt-0.5">
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
        className="tap w-full text-left rounded-2xl bg-gradient-to-br from-escolaSoft to-escolaChip border border-escolaBorder p-4 flex items-center gap-3"
      >
        <div className="w-10 h-10 rounded-xl bg-escola text-white flex items-center justify-center shrink-0">
          <UserCheck size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-text leading-tight">
            Hoje quem busca: {pickup.name}
          </p>
          <p className="text-sm text-textMuted mt-0.5 truncate">
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
      className="tap w-full text-left rounded-2xl bg-card shadow-sm p-4 flex items-center gap-3 border border-dashed border-border"
    >
      <div className="w-10 h-10 rounded-xl bg-escolaChip text-escola flex items-center justify-center shrink-0">
        <UserCheck size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-text leading-tight">
          Quem busca hoje?
        </p>
        <p className="text-sm text-textMuted mt-0.5">
          Outra pessoa vai buscar? Avise o motorista aqui
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
function PresencePanel({ presence, onOpenMap, onVerRecado }) {
  const cfg = {
    [PRESENCE.NO_ROUTE]: {
      ring: 'border-dashed border-border',
      iconBg: 'bg-neutro text-textMuted',
      icon: MapIcon,
    },
    [PRESENCE.STALE]: {
      ring: 'border-warningBorder',
      iconBg: 'bg-warningChip text-warningText',
      icon: CircleAlert,
    },
    [PRESENCE.MOVING]: {
      ring: 'border-neutro',
      iconBg: 'bg-primaryChip text-primary',
      icon: Bus,
    },
    // ⚠️ FALTAVA, E QUEBRARIA A TELA (03/10/2026): sem esta entrada, `cfg`
    // era `undefined` com o mapa desligado. Só não quebrava porque a rota sem
    // mapa nunca chegava a gravar (o `merge` que faltava em locationService).
    [PRESENCE.SEM_MAPA]: {
      ring: 'border-neutro',
      iconBg: 'bg-primaryChip text-primary',
      icon: Bus,
    },
    [PRESENCE.OCORRENCIA]: {
      ring: 'border-dangerBorder',
      iconBg: 'bg-dangerChip text-dangerText',
      icon: CircleAlert,
    },
  }[presence.kind] || {
    // Estado novo sem cor própria: neutro, nunca a tela quebrada.
    ring: 'border-neutro',
    iconBg: 'bg-neutro text-textMuted',
    icon: MapIcon,
  };

  const Icon = cfg.icon;
  const ocorrencia = presence.kind === PRESENCE.OCORRENCIA;

  return (
    <div className={`rounded-2xl bg-card shadow-sm border ${cfg.ring} overflow-hidden`}>
    <button
      onClick={onOpenMap}
      className="tap w-full text-left p-4 flex items-center gap-3"
    >
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${cfg.iconBg}`}
      >
        <Icon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-base font-bold text-text leading-tight">{presence.title}</p>
        {presence.detail && (
          <p className="text-sm text-textMuted mt-0.5 leading-snug">
            {presence.detail}
          </p>
        )}
        {/* Selo de frescor: sempre visível quando vem do GPS. É o que separa
          * "está aqui agora" de "estava aqui em algum momento". 14px. */}
        {presence.freshness && (
          <p className="text-sm text-textMuted mt-1">
            {presence.freshness}
            {presence.distanceKm != null &&
              ` · ${formatDistance(presence.distanceKm) || '—'} daqui`}
          </p>
        )}
      </div>
      <ChevronRight size={18} className="text-textMuted shrink-0" />
    </button>
    {/* "VEJA O RECADO DELE NO CADERNO" — e o caderno a um toque, aqui
      * mesmo. A frase mandava procurar uma coisa que, durante a rota, nem
      * estava na tela. */}
    {ocorrencia && onVerRecado && (
      <div className="px-4 pb-4">
        <button
          type="button"
          onClick={onVerRecado}
          className="tap flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-dangerBorder bg-dangerSoft px-4 text-base font-bold text-dangerText"
        >
          <FileText size={20} />
          Ver o recado
        </button>
      </div>
    )}
    </div>
  );
}


/* ─────────────── Pagamento ─────────────── */

function PaymentBanner({ payment, onClick }) {
  const dleft = daysUntil(payment._due);
  const overdue = dleft != null && dleft < 0;
  const urgent = dleft != null && dleft >= 0 && dleft <= 3;

  const bg = overdue
    ? 'from-dangerSoft to-dangerChip border-dangerBorder'
    : urgent
    ? 'from-warningSoft to-warningChip border-warningBorder'
    : 'from-infoSoft to-infoChip border-infoBorder';

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
        <p className="text-sm text-textMuted mt-0.5">{headline}</p>
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
      className={`tap w-full text-left p-4 flex items-center gap-3 hover:bg-sunken transition-colors ${
        disabled ? 'opacity-50' : ''
      }`}
    >
      <div className="w-10 h-10 rounded-xl bg-primaryChip text-primary flex items-center justify-center shrink-0">
        <Icon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-text leading-tight">{title}</p>
        {subtitle && <p className="text-sm text-textMuted mt-0.5">{subtitle}</p>}
      </div>
      <ChevronRight size={18} className="text-textMuted shrink-0" />
    </button>
  );
}
