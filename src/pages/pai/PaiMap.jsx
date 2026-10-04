import { Bus, ParkingCircle, Home, School, EyeOff } from 'lucide-react';
import LiveMap from '../../components/map/LiveMap';
import Skeleton from '../../components/common/Skeleton';
import Header, { FalarComOMotorista } from '../../components/layout/Header';
import FaixaSemInternet from '../../components/dashboard/FaixaSemInternet';
import RouteTracker from '../../components/dashboard/RouteTracker';
import { describeRoutePresence, PRESENCE, formatDistance } from '../../dominio/rota/routePresence';
import { useActiveChild } from '../../hooks/useActiveChild';
import { useLiveLocation } from '../../hooks/useLiveLocation';
import { useMarcaDoTio } from '../../hooks/useMarcaDoTio';
import { haversineDistance } from '../../compartilhado/haversine';
import { formatDateTime } from '../../compartilhado/formatters';
import { getEffectiveStatus } from '../../services/childrenService';

const NEAR_KM = 2; // ≤ 2 km da casa do pai = "zona próxima"
const ARRIVED_KM = 0.4;

/**
 * Mapa do Pai — desenhado pra preservar a privacidade do Tio:
 *
 * 1. Sempre mostra: a casa (verde) e a escola da criança (violeta)
 * 2. Quando rota INATIVA: só casa + escola. Mensagem "Tio não está em rota".
 * 3. Quando rota ATIVA mas Tio LONGE (> 2 km da casa): NÃO mostra perua.
 *    Mensagem "em rota, chega em breve". Privacidade preservada
 *    (outros pais não veem por onde ele tá indo).
 * 4. Quando rota ATIVA e Tio PRÓXIMO (≤ 2 km): perua aparece na posição real
 *    + mensagem "Pode preparar a criança". Permite o pai se organizar sem
 *    atrasar a rota.
 * 5. O aviso de chegada vem do servidor (ver o comentário abaixo).
 */
export default function PaiMap() {
  // O nome que ELA usa ("Tio Zé"). Esta tela escrevia "Tio Nino" — o nome
  // fictício de antes — à mão, em três frases.
  const { nome: nomeDaMarca } = useMarcaDoTio();
  const quem = nomeDaMarca || 'O motorista';
  const { child, loading } = useActiveChild();
  const { location: liveLocation } = useLiveLocation(child?.adminUid);

  const home =
    child?.lat && child?.lng ? { lat: child.lat, lng: child.lng } : null;
  const school =
    child?.schoolLat && child?.schoolLng
      ? { lat: child.schoolLat, lng: child.schoolLng }
      : null;
  const routeActive = !!liveLocation?.routeActive;

  // Posição real da perua (só usamos se for próximo)
  const realVan =
    routeActive && liveLocation?.lat && liveLocation?.lng
      ? { lat: liveLocation.lat, lng: liveLocation.lng }
      : null;

  const realDistanceKm =
    realVan && home
      ? haversineDistance(home.lat, home.lng, realVan.lat, realVan.lng)
      : null;

  const isNearby = realDistanceKm != null && realDistanceKm <= NEAR_KM;
  const hasArrived = realDistanceKm != null && realDistanceKm <= ARRIVED_KM;

  // O marcador da perua só aparece quando entra na zona próxima
  // MESMA lógica honesta do dashboard. Esta tela tinha regra própria e
  // ficou pra trás quando o estado de três casos foi criado: aqui a perua
  // continuava aparecendo no mapa mesmo com posição velha, exatamente o
  // caso do motorista que fecha a aba no meio do caminho.
  const presence = describeRoutePresence({
    liveLocation,
    distanceKm: realDistanceKm,
  });
  const positionIsStale = presence.kind === PRESENCE.STALE;

  // Só desenha a perua quando ela está perto E a posição é fresca.
  const visibleVan = isNearby && !positionIsStale ? realVan : null;

  // O ALERTA DE CHEGADA SAIU DAQUI (03/10/2026): esta tela tinha um segundo
  // caminho, com "Tio Nino" escrito à mão e emoji, que tocava junto com o do
  // Início. Hoje quem avisa é o servidor (`functions/lib/avisosDaRota.js`),
  // em qualquer tela e com o app fechado.

  // ⚠️ O CABEÇALHO É O PADRÃO DO APP (03/10/2026). Esta tela tinha um
  // próprio, com voltar de 40px e um "AO VIVO" pulsando sempre que a rota
  // estava ligada — inclusive com a posição velha, que é animação viva
  // sobre dado morto. Agora o voltar é o do `Header` (48px, rotulado, com a
  // mesma regra de consumir a história ou cair em `/pai` quando se chegou
  // por notificação), e o "ao vivo" mora no painel, só quando é verdade.
  const cabecalho = (
    <Header title="Mapa da perua" showBack backLabel="Início" backTo="/pai" />
  );

  if (loading) {
    return (
      <>
        {cabecalho}
        <div className="p-5">
          <Skeleton className="h-[60vh]" />
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      {cabecalho}

      {/* Mapa — 70% da viewport */}
      {/* `isolate`: os painéis do Leaflet têm z-index 400 e passariam por
        * cima do cabeçalho grudado ao rolar. */}
      <div className="relative isolate" style={{ height: 'min(70vh, 600px)' }}>
        {home || school ? (
          <>
            <LiveMap van={visibleVan} home={home} school={school} />
            {/* ⚠️ A RESSALVA É PARTE DO DADO, e ela só aparece quando há
              * perua na tela — frase permanente sobre um mapa vazio é ruído
              * que se aprende a pular, e aí não é lida no dia em que importa.
              *
              * Ela fica SOBRE o mapa, e não num rodapé de termos: quem
              * precisa dela é quem está olhando o alfinete agora e decidindo
              * se desce com a criança. O círculo desenha o tamanho da
              * imprecisão; esta linha diz o nome dela. */}
            {visibleVan && (
              <p className="pointer-events-none absolute inset-x-3 bottom-6 z-[500] rounded-lg bg-card/90 px-3 py-1.5 text-center text-sm leading-snug text-textMuted shadow-sm">
                Posição aproximada, por referência — o círculo mostra a margem.
                Não indica o ponto exato da perua.
              </p>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-center p-5">
            <p className="text-base text-textMuted">
              Endereços ainda não cadastrados.
            </p>
          </div>
        )}
      </div>

      {/* Painel inferior — contextual ao estado da rota */}
      <div className="flex-1 bg-card -mt-4 rounded-t-3xl shadow-lg p-5 space-y-4 relative z-10">
        <div className="flex justify-center -mt-1 pb-1">
          <span className="block w-10 h-1 rounded-full bg-border" />
        </div>

        <FaixaSemInternet />

        {/* O "AO VIVO" SÓ QUANDO É VERDADE: rota ligada E posição fresca.
          * Com a posição velha, quem fala é o painel abaixo ("Sem posição
          * há 7 minutos"), parado. */}
        {presence.kind === PRESENCE.MOVING && (
          <p className="inline-flex items-center gap-2 rounded-full bg-primaryChip px-3 py-1 text-sm font-bold text-primary">
            <span className="relative inline-flex">
              <span className="absolute inline-flex h-2 w-2 rounded-full bg-primary opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            Ao vivo · {presence.freshness}
          </p>
        )}

        <StatusPanel
          routeActive={routeActive}
          hasArrived={hasArrived}
          isNearby={isNearby}
          realDistanceKm={realDistanceKm}
          updatedAt={liveLocation?.updatedAt}
          presence={presence}
          quem={quem}
        />

        {/* Tracker do trajeto da criança — mesmo do dashboard */}
        <RouteTracker status={child ? getEffectiveStatus(child) : 'home'} compact />

        {/* Pontos de referência sempre visíveis */}
        <div className="bg-bg rounded-2xl p-3 space-y-2">
          <ReferenceRow
            icon={Home}
            color="bg-primary"
            label="Casa"
            value={child?.address || 'Endereço não cadastrado'}
          />
          <ReferenceRow
            icon={School}
            color="bg-escola"
            label="Escola"
            value={
              child?.schoolAddress || child?.school || 'Não cadastrada'
            }
          />
        </div>

        {/* O MESMO "FALAR" DO CABEÇALHO, em tamanho de pé de tela. Era um
          * botão próprio que ficava APAGADO sem telefone — ela tocava e nada
          * acontecia. Agora é o mesmo componente: abre o WhatsApp, ou explica
          * por que não dá. Nunca desabilitado. */}
        <FalarComOMotorista grande />
      </div>
    </div>
  );
}

/* ─────────────── Painel de status (contextual) ─────────────── */

function StatusPanel({
  routeActive,
  hasArrived,
  isNearby,
  realDistanceKm,
  updatedAt,
  presence,
  quem,
}) {
  // Rota marcada como ativa mas sem posição nova: o motorista pode estar
  // sem sinal, ou fechou a aba sem encerrar. Antes esta tela mostrava a
  // perua parada no mapa como se fosse a posição atual — e é o caso em que
  // parecer errado custa mais caro que parecer incompleto.
  // O MOTORISTA AVISOU UM PROBLEMA COM A PERUA (03/10/2026): a rota não anda,
  // e o mapa não pode fingir que anda.
  if (presence?.kind === PRESENCE.OCORRENCIA) {
    return (
      <div className="rounded-2xl bg-dangerSoft border border-dangerBorder p-4 flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-dangerChip text-dangerText flex items-center justify-center shrink-0">
          <ParkingCircle size={22} />
        </div>
        <div className="flex-1">
          <p className="text-lg font-bold text-text leading-tight">{presence.title}</p>
          <p className="text-base text-dangerText mt-0.5 leading-snug">{presence.detail}</p>
        </div>
      </div>
    );
  }

  if (presence?.kind === PRESENCE.STALE) {
    return (
      <div className="rounded-2xl bg-warningSoft border border-warningBorder p-4 flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-warningChip text-warningText flex items-center justify-center shrink-0">
          <ParkingCircle size={22} />
        </div>
        <div className="flex-1">
          <p className="text-lg font-bold text-text leading-tight">{presence.title}</p>
          <p className="text-base text-warningText mt-0.5 leading-snug">
            {presence.detail}
          </p>
        </div>
      </div>
    );
  }

  // ELE DESLIGOU O MAPA (`SEM_MAPA`): não é falha, é escolha dele — a
  // frase é a da régua, que diz isso e promete o aviso de chegada.
  if (presence?.kind === PRESENCE.SEM_MAPA) {
    return (
      <div className="rounded-2xl bg-sunken p-4 flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-primaryChip text-primary flex items-center justify-center shrink-0">
          <EyeOff size={22} />
        </div>
        <div className="flex-1">
          <p className="text-lg font-bold text-text leading-tight">
            {quem} está em rota
          </p>
          <p className="text-base text-textMuted mt-0.5 leading-snug">
            {presence.detail}
          </p>
        </div>
      </div>
    );
  }

  if (!routeActive) {
    return (
      <div className="rounded-2xl bg-sunken p-4 flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-border text-textMuted flex items-center justify-center shrink-0">
          <ParkingCircle size={22} />
        </div>
        <div className="flex-1">
          <p className="text-lg font-bold text-text leading-tight">
            {quem} não está em rota
          </p>
          {updatedAt && (
            <p className="text-sm text-textMuted mt-0.5">
              Última rota: {formatDateTime(updatedAt)}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (hasArrived) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-primarySoft to-primaryChip border border-primaryBorder p-4 flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-primary text-white flex items-center justify-center shrink-0">
          <Bus size={22} />
        </div>
        <div className="flex-1">
          <p className="font-bold text-primary leading-tight text-lg">
            {quem} chegou
          </p>
          <p className="text-base text-primary mt-0.5">
            A perua está na sua porta.
          </p>
        </div>
      </div>
    );
  }

  if (isNearby) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-warningSoft to-warningChip border border-warningBorder p-4 flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-warning text-white flex items-center justify-center shrink-0">
          <Bus size={22} />
        </div>
        <div className="flex-1">
          <p className="font-bold text-warningText leading-tight text-lg">
            Tá chegando!
          </p>
          <p className="text-base text-warningText mt-0.5">
            {formatDistance(realDistanceKm) || '—'} daqui · prepare a criança
          </p>
        </div>
      </div>
    );
  }

  // Longe — privacidade do Tio: não mostra distância nem posição
  return (
    <div className="rounded-2xl bg-gradient-to-br from-infoSoft to-infoChip border border-infoBorder p-4 flex items-start gap-3">
      <div className="w-11 h-11 rounded-xl bg-info text-white flex items-center justify-center shrink-0">
        <Bus size={22} />
      </div>
      <div className="flex-1">
        <p className="text-lg font-bold text-infoText leading-tight">
          {quem} está em rota
        </p>
        <p className="text-base text-infoText mt-0.5">
          Vamos te avisar quando estiver perto.
        </p>
      </div>
    </div>
  );
}

function ReferenceRow({ icon: Icon, color, label, value }) {
  return (
    <div className="flex items-start gap-2.5">
      <div
        className={`w-8 h-8 rounded-lg text-white flex items-center justify-center shrink-0 ${color}`}
      >
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="rotulo">
          {label}
        </p>
        <p className="text-base text-text leading-tight truncate">{value}</p>
      </div>
    </div>
  );
}

