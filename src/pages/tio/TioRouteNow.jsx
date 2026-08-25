import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  UserX,
  Phone,
  CheckCircle2,
  School,
  Home,
  UserCheck,
  MessageCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../components/layout/Header';
import Button from '../../components/common/Button';
import Avatar from '../../components/common/Avatar';
import Skeleton from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import ControleDeRota from '../../components/route/ControleDeRota';
import { useChildren } from '../../hooks/useChildren';
import { useEscolas } from '../../hooks/useEscolas';
import { useAbsences } from '../../hooks/useAbsences';
import { useLiveLocation } from '../../hooks/useLiveLocation';
import {
  getActionForStatus,
  advanceChild,
  advanceMany,
  statusNaDirecao,
} from '../../services/routeStatusService';
import {
  diaCompleto,
  blocoDoMomento,
  esperaAte,
  horaCurta,
  deMinutos,
  precisaDaPerua,
  ROTULO_ESTADO,
  getDateKey,
} from '../../services/horariosService';

import { declareAbsence, ABSENCE_TYPES } from '../../services/absencesService';

/**
 * "Rota agora" — a tela de operação em movimento.
 *
 * O QUE MUDOU COM O FIM DOS TURNOS
 * Antes ela deduzia um dos seis turnos pelo relógio (`getCurrentPeriod`), e às
 * 15h esse relógio devolvia `null` — a tela ficava sem turno nenhum. Agora ela
 * mostra a VIAGEM do momento, que sai dos horários combinados: a que está
 * acontecendo, ou a próxima, ou a última do dia. Nunca vazia com criança na rua.
 *
 * E NINGUÉM SOME DA LISTA
 * Quem faltou, quem o pai vai levar e quem o pai já buscou continuam
 * aparecendo, em cinza e com o motivo escrito. Sumir com a criança fazia o
 * motorista perder a referência de onde ela estaria na ordem — e não dava
 * chance de perceber que a falta foi marcada por engano.
 */
export default function TioRouteNow() {
  const navigate = useNavigate();
  const dateKey = getDateKey();

  const { children, loading } = useChildren();
  const { mapa: escolasPorId } = useEscolas();
  const { byChildId: declaracoes } = useAbsences(dateKey);

  // Posição que o rastreamento JÁ gravou — nunca pedimos GPS na hora: pedir
  // permissão no meio da rota trava a ação do motorista.
  const { location: liveLocation } = useLiveLocation();

  const [indiceEscolhido, setIndiceEscolhido] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmLote, setConfirmLote] = useState(null);
  const [marcando, setMarcando] = useState(null); // { child, tipo }

  // O relógio anda: sem isto a tela fica presa na viagem da manhã a tarde
  // inteira, porque `blocoDoMomento` só é recalculado quando algo muda.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const blocos = useMemo(
    () => diaCompleto(children, { declaracoes, escolasPorId }),
    [children, declaracoes, escolasPorId]
  );

  const blocoAtual = useMemo(() => {
    if (!blocos.length) return null;
    if (indiceEscolhido != null) return blocos[indiceEscolhido] || blocos[0];
    return blocoDoMomento(blocos, new Date());
    // `tick` força o recálculo no relógio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocos, indiceEscolhido, tick]);

  const direcaoAntiga = blocoAtual?.direcao === 'ida' ? 'pickup' : 'dropoff';

  /** A fila da viagem, com a ação de cada criança já resolvida. */
  const fila = useMemo(() => {
    if (!blocoAtual) return [];
    return blocoAtual.paradas.map((p) => {
      const status = statusNaDirecao(
        p.child,
        declaracoes?.[p.child.id],
        direcaoAntiga
      );
      return {
        ...p,
        status,
        action: precisaDaPerua(p.estado)
          ? getActionForStatus(status, direcaoAntiga)
          : null,
      };
    });
  }, [blocoAtual, declaracoes, direcaoAntiga]);

  // Tudo que deriva da fila sai do MESMO memo: derivar `pendentes` fora e
  // memoizar o lote em cima dele fazia o React Compiler desistir de memoizar
  // a árvore inteira ("Compilation Skipped").
  const { resolvidas, foco, lote } = useMemo(() => {
    const p = fila.filter((q) => q.action);
    let l = null;
    if (p.length >= 2) {
      const proximo = p[0].action.nextStatus;
      const iguais = p.filter((q) => q.action.nextStatus === proximo);
      if (iguais.length >= 2) {
        l = {
          nextStatus: proximo,
          label: p[0].action.shortLabel,
          count: iguais.length,
          // Casa e escola vão POR CRIANÇA pra o lote gravar um checkpoint de
          // distância pra cada uma, como o toque individual já faz.
          moves: iguais.map((q) => ({
            childId: q.child.id,
            nextStatus: proximo,
            home: q.child.lat != null ? { lat: q.child.lat, lng: q.child.lng } : null,
            school:
              q.child.schoolLat != null
                ? { lat: q.child.schoolLat, lng: q.child.schoolLng }
                : null,
          })),
        };
      }
    }
    return {
      resolvidas: fila.filter((q) => precisaDaPerua(q.estado) && !q.action).length,
      foco: p[0] || null,
      lote: l,
    };
  }, [fila]);

  const espera = useMemo(
    () => esperaAte(blocos, blocoAtual, new Date()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [blocos, blocoAtual, tick]
  );

  const posicaoDoDriver =
    liveLocation?.routeActive && liveLocation?.lat
      ? { lat: liveLocation.lat, lng: liveLocation.lng }
      : null;

  async function avancarUma(item) {
    setBusy(true);
    try {
      await advanceChild(item.child.id, item.action.nextStatus, {
        driverPosition: posicaoDoDriver,
        home: item.child.lat != null ? { lat: item.child.lat, lng: item.child.lng } : null,
        school:
          item.child.schoolLat != null
            ? { lat: item.child.schoolLat, lng: item.child.schoolLng }
            : null,
      });
      toast.success(`${item.child.name.split(' ')[0]}: pronto`);
    } catch (err) {
      console.error(err);
      toast.error('Não deu pra salvar. Tente de novo.');
    } finally {
      setBusy(false);
    }
  }

  async function avancarLote() {
    if (!lote) return;
    setBusy(true);
    try {
      const n = await advanceMany(lote.moves, { driverPosition: posicaoDoDriver });
      toast.success(`${n} crianças atualizadas.`);
    } catch (err) {
      console.error(err);
      toast.error('Não deu pra salvar todas. Confira a lista.');
    } finally {
      setBusy(false);
      setConfirmLote(null);
    }
  }

  /**
   * Marcar do lado do motorista grava a MESMA declaração que o pai grava.
   *
   * A tela antiga escrevia numa lista de ausentes só dela (`dailyRoutes`), que
   * o painel do responsável não lia — o pai não ficava sabendo que o filho
   * tinha sido marcado como falta.
   */
  async function marcar() {
    if (!marcando) return;
    setBusy(true);
    try {
      await declareAbsence({
        dateKey,
        childId: marcando.child.id,
        childName: marcando.child.name,
        parentUid: marcando.child.parentUid || null,
        adminUid: marcando.child.adminUid || null,
        type: marcando.tipo,
        declaredBy: 'admin',
      });
      toast.success(`${marcando.child.name.split(' ')[0]}: registrado.`);
    } catch (err) {
      console.error(err);
      toast.error('Não deu pra registrar.');
    } finally {
      setBusy(false);
      setMarcando(null);
    }
  }

  const zap = (child) => {
    const tel = String(child.parentPhone || '').replace(/\D/g, '');
    if (!tel) {
      toast('Telefone do responsável não cadastrado.');
      return;
    }
    const texto = encodeURIComponent(
      `Oi! Cheguei com a perua pra ${child.name?.split(' ')[0] || 'a criança'}.`
    );
    window.open(`https://wa.me/55${tel}?text=${texto}`, '_blank');
  };

  return (
    <div className="min-h-screen pb-28">
      <Header title="Rota agora" />

      <div className="px-5 pt-4 space-y-4">
        {/* O interruptor do GPS vem primeiro. Sem ele ligado, o painel do
          * responsável diz "a rota ainda não começou" o dia inteiro — e essa
          * é a falha que o pai percebe antes de qualquer outra. */}
        <ControleDeRota />

        {loading && <Skeleton className="h-56 rounded-2xl" />}

        {!loading && blocos.length === 0 && (
          <EmptyState
            icon={Clock}
            title="Nenhuma viagem hoje"
            description="Combine com cada responsável a hora de pegar e entregar — a rota se monta a partir disso."
            action={
              <Button
                variant="secondary"
                fullWidth={false}
                onClick={() => navigate('/tio/horarios')}
              >
                Definir horários
              </Button>
            }
          />
        )}

        {/* As viagens do dia. O rótulo é a hora da PRIMEIRA porta — um
          * compromisso real, não uma janela inventada. */}
        {!loading && blocos.length > 1 && (
          <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
            {blocos.map((b, i) => {
              const ativa = b === blocoAtual;
              const Icone = b.direcao === 'ida' ? Home : School;
              return (
                <button
                  key={`${b.direcao}-${b.inicio}`}
                  type="button"
                  onClick={() => setIndiceEscolhido(i)}
                  aria-pressed={ativa}
                  className={`tap shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border inline-flex items-center gap-1.5 ${
                    ativa
                      ? 'bg-text text-white border-text'
                      : 'bg-card text-textMuted border-gray-200'
                  }`}
                >
                  <Icone size={13} />
                  {horaCurta(deMinutos(b.inicio))}
                </button>
              );
            })}
          </div>
        )}

        {blocoAtual && (
          <div className="bg-card border border-gray-200 rounded-2xl p-3 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              {blocoAtual.direcao === 'ida' ? <Home size={17} /> : <School size={17} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-text leading-tight">
                {blocoAtual.direcao === 'ida'
                  ? 'Levando pra escola'
                  : 'Trazendo pra casa'}
              </p>
              <p className="text-[11px] text-textMuted">
                {resolvidas > 0
                  ? `${resolvidas} de ${fila.filter((q) => precisaDaPerua(q.estado)).length} resolvidas`
                  : `${fila.length} ${fila.length === 1 ? 'criança' : 'crianças'} nesta viagem`}
              </p>
            </div>
            {blocoAtual.escolas.length > 0 && (
              <span className="text-[10px] text-violet-700 bg-violet-50 border border-violet-200 px-2 py-1 rounded-full shrink-0 max-w-[40%] truncate">
                {blocoAtual.escolas.map((e) => e.nome).join(' · ')}
              </span>
            )}
          </div>
        )}

        {/* Viagem concluída — e quando é a próxima */}
        {!loading && blocoAtual && !foco && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center space-y-2">
            <CheckCircle2 size={36} className="text-emerald-600 mx-auto" />
            <p className="font-bold text-text">Viagem concluída</p>
            {espera ? (
              <p className="text-sm text-emerald-900/75">
                Próxima parada só às{' '}
                <b>{horaCurta(deMinutos(espera.bloco.inicio))}</b>
                {espera.minutos > 0 && ` · daqui a ${formataEspera(espera.minutos)}`}
              </p>
            ) : (
              <p className="text-sm text-emerald-900/75">
                Era a última viagem do dia.
              </p>
            )}
          </div>
        )}

        {/* A criança em foco */}
        {foco && (
          <div className="bg-card border-2 border-primary rounded-2xl p-4 space-y-3 shadow-lg shadow-emerald-600/15">
            <div className="flex items-center gap-3">
              <Avatar
                photoURL={foco.child.photoURL}
                gender={foco.child.gender}
                seed={foco.child.id}
                kind="child"
                size="md"
              />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-text leading-tight truncate">
                  {foco.child.name}
                </p>
                <p className="text-xs text-textMuted truncate">
                  {foco.child.address || 'Sem endereço'}
                </p>
              </div>
              <span className="font-mono text-sm font-bold text-primary shrink-0 tabular-nums">
                {horaCurta(foco.hora)}
              </span>
            </div>

            {/* 62 px: é o botão que ele aperta com o veículo em movimento */}
            <button
              type="button"
              disabled={busy}
              onClick={() => avancarUma(foco)}
              className="tap w-full rounded-2xl bg-primary text-white font-extrabold text-base tracking-wide flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ height: 62 }}
            >
              <CheckCircle2 size={22} />
              {foco.action.shortLabel}
            </button>

            {/* A porta: o pai não desceu. Antes de buzinar, o WhatsApp. */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => zap(foco.child)}
                className="tap h-10 rounded-xl bg-card border border-gray-200 text-text text-xs font-semibold inline-flex items-center justify-center gap-1.5"
              >
                <MessageCircle size={14} />
                WhatsApp
              </button>
              {foco.child.parentPhone ? (
                <a
                  href={`tel:${foco.child.parentPhone}`}
                  className="tap h-10 rounded-xl bg-card border border-gray-200 text-text text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                >
                  <Phone size={14} />
                  Ligar
                </a>
              ) : (
                <Button size="sm" variant="ghost" disabled>
                  Sem telefone
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm"
                variant="secondary"
                icon={UserX}
                disabled={busy}
                onClick={() =>
                  setMarcando({ child: foco.child, tipo: ABSENCE_TYPES.FULL })
                }
              >
                Faltou
              </Button>
              {blocoAtual?.direcao === 'volta' ? (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={UserCheck}
                  disabled={busy}
                  onClick={() =>
                    setMarcando({
                      child: foco.child,
                      tipo: ABSENCE_TYPES.NO_DROPOFF,
                    })
                  }
                >
                  O pai pegou
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={UserCheck}
                  disabled={busy}
                  onClick={() =>
                    setMarcando({
                      child: foco.child,
                      tipo: ABSENCE_TYPES.NO_PICKUP,
                    })
                  }
                >
                  O pai levou
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Lote — uma parada é um evento, não vinte */}
        {lote && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmLote(lote)}
            className="tap w-full rounded-2xl bg-secondary text-[#3B2600] font-extrabold text-sm flex flex-col items-center justify-center gap-0.5 disabled:opacity-60 py-4"
          >
            <span>
              {lote.label} — TODOS OS {lote.count}
            </span>
            <span className="text-[11px] font-semibold opacity-75">
              depois marque só quem faltou
            </span>
          </button>
        )}

        {/* A viagem inteira. Ninguém some — quem não vai fica em cinza. */}
        {fila.length > 0 && (
          <section className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-textMuted">
              a viagem
            </p>
            {fila.map((q) => {
              const fora = !precisaDaPerua(q.estado);
              const feito = !fora && !q.action;
              return (
                <div
                  key={q.child.id}
                  className={`rounded-xl px-3 py-2.5 flex items-center gap-2.5 border ${
                    fora
                      ? 'bg-gray-50 border-gray-200 opacity-70'
                      : 'bg-card border-gray-200'
                  }`}
                >
                  <span
                    className={`font-mono text-xs tabular-nums shrink-0 w-11 ${
                      fora ? 'text-textMuted' : 'text-text font-semibold'
                    }`}
                  >
                    {horaCurta(q.hora)}
                  </span>
                  <Avatar
                    photoURL={q.child.photoURL}
                    gender={q.child.gender}
                    seed={q.child.id}
                    kind="child"
                    size="sm"
                  />
                  <span className="flex-1 min-w-0">
                    <span
                      className={`block text-sm font-semibold truncate ${
                        fora ? 'text-textMuted line-through' : 'text-text'
                      }`}
                    >
                      {q.child.name}
                    </span>
                    {fora && (
                      <span className="block text-[11px] text-amber-700 font-medium">
                        {ROTULO_ESTADO[q.estado] || 'Fora hoje'}
                      </span>
                    )}
                  </span>
                  {feito && (
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  )}
                </div>
              );
            })}
          </section>
        )}

        <Button
          variant="ghost"
          size="md"
          icon={Clock}
          onClick={() => navigate('/tio/horarios')}
        >
          Ajustar horários
        </Button>
      </div>

      <ConfirmDialog
        open={!!confirmLote}
        title={
          confirmLote
            ? `${confirmLote.label.toLowerCase()} — ${confirmLote.count} crianças`
            : ''
        }
        description="Todas de uma vez. Se alguma faltou, você corrige na lista depois."
        confirmLabel="Confirmar"
        loading={busy}
        onConfirm={avancarLote}
        onCancel={() => setConfirmLote(null)}
      />

      <ConfirmDialog
        open={!!marcando}
        title={marcando ? tituloMarcacao(marcando) : ''}
        description={
          marcando ? descricaoMarcacao(marcando) : ''
        }
        confirmLabel="Registrar"
        variant={marcando?.tipo === ABSENCE_TYPES.FULL ? 'danger' : 'primary'}
        loading={busy}
        onConfirm={marcar}
        onCancel={() => setMarcando(null)}
      />
    </div>
  );
}

function tituloMarcacao({ child, tipo }) {
  const nome = child.name.split(' ')[0];
  if (tipo === ABSENCE_TYPES.FULL) return `${nome} faltou hoje?`;
  if (tipo === ABSENCE_TYPES.NO_DROPOFF) return `O responsável já pegou ${nome}?`;
  return `O responsável levou ${nome}?`;
}

function descricaoMarcacao({ tipo }) {
  if (tipo === ABSENCE_TYPES.FULL) {
    return 'Ela sai da rota de hoje nas duas direções, e o responsável é avisado. Continua aparecendo na lista, em cinza.';
  }
  if (tipo === ABSENCE_TYPES.NO_DROPOFF) {
    return 'Você não precisa mais buscá-la na escola hoje. A ida de amanhã continua normal.';
  }
  return 'Você não precisa buscá-la em casa hoje — mas continua trazendo ela de volta à tarde.';
}

function formataEspera(min) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}
