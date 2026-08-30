import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  BellRing,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../common/Button';
import Avatar from '../common/Avatar';
import Skeleton from '../common/Skeleton';
import EmptyState from '../common/EmptyState';
import ConfirmDialog from '../common/ConfirmDialog';
import ControleDeRota from './ControleDeRota';
import { useAuth } from '../../hooks/useAuth';
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
  formataEspera,
} from '../../services/horariosService';

import {
  declareAbsence,
  removeAbsence,
  ABSENCE_TYPES,
} from '../../services/absencesService';
import { createCall } from '../../services/pendingCallService';
import { playSound } from '../../services/soundService';
import { publicarOrdemDoDia } from '../../services/ridesService';

/**
 * A OPERAÇÃO — o cartão em foco, o botão grande e a viagem inteira.
 *
 * POR QUE É COMPONENTE E NÃO TELA
 * Ela precisa aparecer em dois lugares: no Início, quando a rota está andando,
 * e na página `/tio/route/now`, que continua existindo. Duas portas, uma sala.
 *
 * A porta separada não é herança que sobrou: é a saída de emergência. Com a
 * operação morando dentro do Início, um erro no Início deixaria o motorista sem
 * rota — e ele está na rua. A rota própria dá um caminho que não depende da
 * home montar.
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
export default function OperacaoDaRota({
  mostrarRodape = true,
  // Dentro do Início o controle de rota é FIXO no topo da tela, acima de
  // tudo. Renderizar o daqui também deixaria dois botões de encerrar rota na
  // mesma tela, um deles rolando pra fora da vista.
  mostrarControle = true,
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
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
  const [desfazendo, setDesfazendo] = useState(null); // criança fora que ele quer devolver

  /**
   * O som de fim de viagem toca UMA VEZ, na transição.
   *
   * Sem a trava ele tocaria a cada render enquanto a tela estiver concluída —
   * e "concluída" é um estado que dura horas, até a próxima viagem. O id do
   * bloco entra na chave porque duas viagens diferentes terminam no mesmo
   * dia, e a segunda merece o mesmo aviso da primeira.
   */
  const jaCelebrou = useRef(null);

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

  /**
   * O bloco ainda tem alguém esperando? É o mesmo predicado que monta a fila
   * (`fila.filter(q => q.action)`), só que aplicável a QUALQUER bloco — a fila
   * só existe pro bloco atual, e quem escolhe o atual precisa olhar os outros.
   */
  const temPendencia = useCallback(
    (bloco) => {
      const dir = bloco.direcao === 'ida' ? 'pickup' : 'dropoff';
      return bloco.paradas.some((p) => {
        if (!precisaDaPerua(p.estado)) return false;
        const st = statusNaDirecao(p.child, declaracoes?.[p.child.id], dir);
        return !!getActionForStatus(st, dir);
      });
    },
    [declaracoes]
  );
  const blocoAtual = useMemo(() => {
    if (!blocos.length) return null;
    if (indiceEscolhido != null) return blocos[indiceEscolhido] || blocos[0];
    return blocoDoMomento(blocos, new Date(), temPendencia);
    // `tick` força o recálculo no relógio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocos, indiceEscolhido, tick, temPendencia]);

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
  const { feitos, restantes, totalEfetivo, resolvidas, foco, lote } = useMemo(() => {
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
            parentUid: q.child.parentUid || null,
            childName: q.child.name,
            home: q.child.lat != null ? { lat: q.child.lat, lng: q.child.lng } : null,
            school:
              q.child.schoolLat != null
                ? { lat: q.child.schoolLat, lng: q.child.schoolLng }
                : null,
          })),
        };
      }
    }
    // A fila se divide em três em vez de ser uma lista só.
    //
    // Quem já foi marcado sobe pra cima do cartão em foco: é o que dá a
    // sensação de progresso e o que o motorista olha pra conferir se não
    // esqueceu ninguém. Quem falta fica embaixo, na ordem do relógio.
    const feitos = fila.filter((q) => precisaDaPerua(q.estado) && !q.action);
    const focoAtual = p[0] || null;

    // Tudo que não foi feito e não está em foco — e NÃO "o que vem depois do
    // foco na ordem". Fatiar por índice fazia quem faltou e estava antes do
    // foco no relógio desaparecer das três listas: não é feito (não embarcou),
    // não é o foco, e ficava atrás do corte. Sumir com a criança é justamente
    // o que esta tela existe pra não fazer.
    const restantes = fila.filter((q) => q !== focoAtual && !feitos.includes(q));

    return {
      feitos,
      restantes,
      totalEfetivo: fila.filter((q) => precisaDaPerua(q.estado)).length,
      resolvidas: feitos.length,
      foco: focoAtual,
      lote: l,
    };
  }, [fila]);

  // Toca quando a viagem VIRA concluída — e só então.
  useEffect(() => {
    if (!blocoAtual) return;
    const chave = `${blocoAtual.direcao}-${blocoAtual.inicio}`;
    const concluida = !foco && totalEfetivo > 0;
    if (concluida && jaCelebrou.current !== chave) {
      jaCelebrou.current = chave;
      playSound('viagem_concluida');
    } else if (!concluida && jaCelebrou.current === chave) {
      // Voltou a ter pendência (o motorista desfez, ou o responsável cancelou
      // a falta): a viagem pode terminar de novo, e merece o aviso de novo.
      jaCelebrou.current = null;
    }
  }, [blocoAtual, foco, totalEfetivo]);

  const espera = useMemo(
    () => esperaAte(blocos, blocoAtual, new Date()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [blocos, blocoAtual, tick]
  );

  /**
   * Publica no doc de viagem de cada criança a posição dela no dia.
   *
   * Roda ao INICIAR a rota, uma vez. O número é o ordinal ("4ª parada"), e não
   * "quantas faltam": ordinal só muda se o motorista mexer nos horários, e
   * "quantas faltam" custaria uma escrita por criança a cada entrega — além de
   * envelhecer errado se uma delas falhasse.
   *
   * O responsável não consegue calcular isso sozinho: ele lê apenas o doc do
   * próprio filho, e a fila é feita das outras crianças.
   */
  async function publicarOrdem() {
    try {
      const contexto = {};
      for (const b of blocos) {
        for (const p of b.paradas) contexto[p.child.id] = { adminUid: user?.uid };
      }
      await publicarOrdemDoDia(blocos, dateKey, contexto);
    } catch (err) {
      // Não bloqueia a rota: ele precisa sair, e a posição na fila é conforto
      // do responsável, não requisito da operação.
      console.error('Falha ao publicar a ordem do dia:', err);
    }
  }

  const posicaoDoDriver =
    liveLocation?.routeActive && liveLocation?.lat
      ? { lat: liveLocation.lat, lng: liveLocation.lng }
      : null;

  async function avancarUma(item) {
    setBusy(true);
    try {
      await advanceChild(item.child.id, item.action.nextStatus, {
        driverPosition: posicaoDoDriver,
        dateKey,
        adminUid: user?.uid,
        parentUid: item.child.parentUid || null,
        childName: item.child.name,
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
      const n = await advanceMany(lote.moves, {
        driverPosition: posicaoDoDriver,
        dateKey,
        adminUid: user?.uid,
      });
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

  /**
   * A BUZINA DIGITAL — faz o celular do responsável TOCAR.
   *
   * Ela existia e sumiu junto com o Kanban: o botão que criava a chamada morava
   * no cartão de lá, e apagar aquela tela deixou `createCall` sem gatilho
   * nenhum. O modal com ringtone continuava montado no celular do pai
   * esperando uma chamada que ninguém mais conseguia criar.
   *
   * É o caso que motivou o recurso: o motorista na porta, buzinando de verdade,
   * e o pai não desce. Aqui ela é o primeiro degrau — toca o aparelho sem
   * exigir que ele saia do app — e o WhatsApp e a ligação ficam como os
   * degraus seguintes, pra quando o primeiro não resolve.
   */
  async function chamar(child) {
    if (!child?.parentUid) {
      toast('Esse responsável ainda não entrou no app. Use o WhatsApp.');
      return;
    }
    setBusy(true);
    try {
      await createCall({
        adminUid: user?.uid,
        parentUid: child.parentUid,
        childId: child.id,
        childName: child.name,
      });
      // O som toca AQUI, no aparelho do motorista, e não é decoração: ele
      // está parado na porta olhando pra rua. Sem esta confirmação ele volta
      // os olhos pra tela pra saber se o toque pegou.
      playSound('buzina');
      toast.success(
        `Buzinando… o celular de ${child.name.split(' ')[0]} está tocando`
      );
    } catch (err) {
      console.error(err);
      toast.error('Não deu pra chamar. Tente o WhatsApp.');
    } finally {
      setBusy(false);
    }
  }

  /**
   * "ELA VEIO" — devolve a criança pra rota, na porta.
   *
   * POR QUE ISTO É A ÚLTIMA DEFESA
   * O responsável avisa que a criança falta no dia 28, o plano muda, e ele não
   * lembra de desmarcar. No dia 28 o motorista lê "falta hoje", não passa, e a
   * criança fica esperando. O app inteiro fica do lado errado de uma
   * informação velha.
   *
   * As outras defesas são preventivas (teto de 14 dias, o aviso voltando pra
   * tela do pai, a pergunta na véspera). Esta é a que funciona quando todas
   * falharam e ele está na porta vendo a criança de mochila.
   */
  async function devolverPraRota(child) {
    setBusy(true);
    try {
      await removeAbsence({ dateKey, childId: child.id });
      toast.success(`${child.name.split(' ')[0]} voltou pra rota.`);
    } catch (err) {
      console.error(err);
      toast.error('Não deu pra desfazer. Tente de novo.');
    } finally {
      setBusy(false);
      setDesfazendo(null);
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
    <>
      <div className="px-5 pt-4 space-y-4">
        {/* O interruptor do GPS vem primeiro. Sem ele ligado, o painel do
          * responsável diz "a rota ainda não começou" o dia inteiro — e essa
          * é a falha que o pai percebe antes de qualquer outra. */}
        {mostrarControle && (
          <ControleDeRota
            onIniciar={publicarOrdem}
            direcao={blocoAtual?.direcao}
          />
        )}

        {loading && <Skeleton className="h-56 rounded-2xl" />}

        {!loading && blocos.length === 0 && (
          <EmptyState
            icon={Clock}
            title="Nenhuma viagem hoje"
            description="Defina a hora de pegar e entregar cada criança — a rota se monta a partir disso, e é o que o responsável vê."
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
                  // Tocar na viagem JÁ ativa volta pro automático.
                  //
                  // Antes `indiceEscolhido` nunca era zerado: o primeiro toque
                  // congelava a tela naquela viagem o dia inteiro, sem nenhum
                  // caminho de volta a não ser recarregar o app. Uma escolha
                  // manual sem desfazer não é escolha, é armadilha.
                  onClick={() =>
                    setIndiceEscolhido((atual) => (atual === i ? null : i))
                  }
                  aria-pressed={ativa}
                  className={`tap shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border inline-flex items-center gap-1.5 ${
                    ativa
                      ? 'bg-text text-white border-text'
                      : 'bg-card text-textMuted border-border'
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
          <div className="bg-card border border-border rounded-2xl p-3 flex items-center gap-2.5">
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
                {totalEfetivo > 0
                  ? `${resolvidas} de ${totalEfetivo} ${resolvidas === 1 ? 'resolvida' : 'resolvidas'}`
                  : `${fila.length} ${fila.length === 1 ? 'criança' : 'crianças'} nesta viagem`}
              </p>
            </div>
            {blocoAtual.escolas.length > 0 && (
              <span className="text-[10px] text-escola bg-escolaSoft border border-escolaBorder px-2 py-1 rounded-full shrink-0 max-w-[40%] truncate">
                {blocoAtual.escolas.map((e) => e.nome).join(' · ')}
              </span>
            )}
          </div>
        )}

        {/* A BARRA — quanto da viagem já foi.
          * Um número ("2 de 5") ele precisa ler; a barra ele reconhece de
          * relance, que é o único jeito de olhar a tela com o veículo em
          * movimento. */}
        {totalEfetivo > 1 && (
          <div className="h-1.5 rounded-full bg-border overflow-hidden">
            <div
              className="progresso-barra h-full rounded-full bg-primary"
              style={{ width: `${Math.round((resolvidas / totalEfetivo) * 100)}%` }}
            />
          </div>
        )}

        {/* Viagem concluída — e quando é a próxima */}
        {!loading && blocoAtual && !foco && (
          <div className="bg-primarySoft border border-primaryBorder rounded-2xl p-5 text-center space-y-2">
            <CheckCircle2 size={36} className="text-accentText mx-auto" />
            <p className="font-bold text-text">Viagem concluída</p>
            {espera ? (
              <p className="text-sm text-primary/75">
                Próxima parada só às{' '}
                <b>{horaCurta(deMinutos(espera.bloco.inicio))}</b>
                {espera.minutos > 0 && ` · daqui a ${formataEspera(espera.minutos)}`}
              </p>
            ) : (
              <p className="text-sm text-primary/75">
                Era a última viagem do dia.
              </p>
            )}
          </div>
        )}

        {/* JÁ FEITOS — sobem pra cima do cartão em foco.
          * Colapsa a partir de quatro: com vinte crianças, a lista inteira
          * empurraria o botão grande pra baixo da dobra, e ele é apertado com
          * a perua andando. */}
        {feitos.length > 0 && <JaFeitos itens={feitos} direcao={blocoAtual?.direcao} />}

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

            {/* A PORTA: o motorista chegou e ninguém desceu.
              * Três degraus, do mais barato pro mais caro: tocar o celular
              * dele sem sair do app, mandar mensagem, ligar. */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => chamar(foco.child)}
                className="tap h-10 rounded-xl bg-primary/10 border border-primary/30 text-primary text-xs font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                <BellRing size={14} />
                Buzinar
              </button>
              <button
                type="button"
                onClick={() => zap(foco.child)}
                className="tap h-10 rounded-xl bg-card border border-border text-text text-xs font-semibold inline-flex items-center justify-center gap-1.5"
              >
                <MessageCircle size={14} />
                Zap
              </button>
              {foco.child.parentPhone ? (
                <a
                  href={`tel:${foco.child.parentPhone}`}
                  className="tap h-10 rounded-xl bg-card border border-border text-text text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                >
                  <Phone size={14} />
                  Ligar
                </a>
              ) : (
                <span className="h-10 rounded-xl bg-neutro text-textMuted text-[11px] font-semibold inline-flex items-center justify-center">
                  sem tel.
                </span>
              )}
            </div>

            {/* O QUE O BOTÃO FAZ, ESCRITO.
              * "Buzinar" não diz onde a buzina toca. Sem esta linha o
              * motorista testa uma vez pra descobrir — e testar significa
              * fazer o celular de uma família tocar à toa. */}
            <p className="text-[11px] text-textMuted text-center -mt-1">
              Buzinar faz o celular do responsável tocar
            </p>

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
                      tipo: ABSENCE_TYPES.ALREADY_PICKED,
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
            className="tap w-full rounded-2xl bg-warning text-warningText font-extrabold text-sm flex flex-col items-center justify-center gap-0.5 disabled:opacity-60 py-4"
          >
            <span>
              {lote.label} — TODOS OS {lote.count}
            </span>
            <span className="text-[11px] font-semibold opacity-75">
              depois marque só quem faltou
            </span>
          </button>
        )}

        {/* O QUE FALTA. Ninguém some — quem não vai fica em cinza, no lugar
          * onde estaria, pra ele não perder a referência da ordem. */}
        {restantes.length > 0 && (
          <section className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-textMuted">
              o resto da viagem
            </p>
            {restantes.map((q) => {
              const fora = !precisaDaPerua(q.estado);
              const feito = !fora && !q.action;
              return (
                <div
                  key={q.child.id}
                  role={fora ? 'button' : undefined}
                  tabIndex={fora ? 0 : undefined}
                  onClick={fora ? () => setDesfazendo(q.child) : undefined}
                  onKeyDown={
                    fora
                      ? (ev) => {
                          if (ev.key === 'Enter' || ev.key === ' ') {
                            ev.preventDefault();
                            setDesfazendo(q.child);
                          }
                        }
                      : undefined
                  }
                  className={`fila-entra rounded-xl px-3 py-2.5 flex items-center gap-2.5 border ${
                    fora
                      ? 'tap bg-sunken border-border opacity-70'
                      : 'bg-card border-border'
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
                      <span className="block text-[11px] text-warningText font-medium">
                        {ROTULO_ESTADO[q.estado] || 'Fora hoje'}
                        {/* A IDADE DO AVISO É O QUE DIZ SE ELE AINDA VALE.
                          * Um aviso de ontem quase certamente vale; um de duas
                          * semanas atrás é justamente o que o responsável
                          * esqueceu que existe. Mostrar a idade transforma
                          * "ela falta" em "ela faltaria, segundo algo que
                          * alguém disse há doze dias" — que é a verdade. */}
                        {idadeDoAviso(declaracoes?.[q.child.id]) && (
                          <span className="text-textMuted font-normal">
                            {' · avisado '}
                            {idadeDoAviso(declaracoes[q.child.id])}
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                  {feito && (
                    <CheckCircle2 size={16} className="text-accentText shrink-0" />
                  )}
                </div>
              );
            })}
          </section>
        )}

        {/* Cadastro só na porta separada. Dentro do Início a operação aparece
          * com o veículo em movimento, e ali ele não vai ajustar horário. */}
        {mostrarRodape && (
          <Button
            variant="ghost"
            size="md"
            icon={Clock}
            onClick={() => navigate('/tio/horarios')}
          >
            Ajustar horários
          </Button>
        )}
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
        open={!!desfazendo}
        title={
          desfazendo
            ? `${desfazendo.name.split(' ')[0]} veio hoje?`
            : ''
        }
        description="Ela volta pra rota agora, e o responsável é avisado de que o aviso foi desfeito."
        confirmLabel="Voltar pra rota"
        loading={busy}
        onConfirm={() => devolverPraRota(desfazendo)}
        onCancel={() => setDesfazendo(null)}
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
    </>
  );
}

function tituloMarcacao({ child, tipo }) {
  const nome = child.name.split(' ')[0];
  if (tipo === ABSENCE_TYPES.FULL) return `${nome} faltou hoje?`;
  if (tipo === ABSENCE_TYPES.ALREADY_PICKED) {
    return `O responsável já pegou ${nome}?`;
  }
  return `O responsável levou ${nome}?`;
}

function descricaoMarcacao({ tipo }) {
  if (tipo === ABSENCE_TYPES.FULL) {
    return 'Ela sai da rota de hoje nas duas direções, e o responsável é avisado. Continua aparecendo na lista, em cinza.';
  }
  if (tipo === ABSENCE_TYPES.ALREADY_PICKED) {
    return 'Ela já saiu com o responsável. Você não precisa passar na escola por ela hoje.';
  }
  return 'Você não precisa buscá-la em casa hoje — mas continua trazendo ela de volta à tarde.';
}

/**
 * Quem já foi marcado nesta viagem.
 *
 * POR QUE ELES SOBEM
 * A lista antiga era uma só, na ordem do relógio, com o cartão em foco
 * repetido no topo. O motorista via o mesmo nome duas vezes e não tinha como
 * saber de relance quantos já tinham entrado — ele contava.
 *
 * POR QUE COLAPSA A PARTIR DE QUATRO
 * Com vinte crianças, vinte linhas de "já foi" empurram o botão grande pra
 * baixo da dobra. Esse botão é apertado com o veículo em movimento: nada pode
 * entrar acima dele além do que cabe num relance.
 */
function JaFeitos({ itens, direcao }) {
  const [aberto, setAberto] = useState(false);
  const compacto = itens.length > 3;
  const verbo = direcao === 'ida' ? 'já embarcaram' : 'já foram entregues';

  if (compacto && !aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="fila-entra tap w-full rounded-xl bg-primarySoft border border-primaryBorder px-3 py-2.5 flex items-center gap-2.5"
      >
        <CheckCircle2 size={17} className="text-accentText shrink-0" />
        <span className="flex-1 text-left text-sm font-semibold text-primary">
          {itens.length} {verbo}
        </span>
        <span className="text-[11px] font-semibold text-primary shrink-0">
          ver
        </span>
      </button>
    );
  }

  return (
    <section className="space-y-1.5">
      <div className="flex items-center gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">
          {verbo}
        </p>
        {compacto && (
          <button
            type="button"
            onClick={() => setAberto(false)}
            className="tap text-[11px] font-semibold text-textMuted ml-auto"
          >
            esconder
          </button>
        )}
      </div>
      {itens.map((q) => (
        <div
          key={q.child.id}
          className="fila-entra rounded-xl px-3 py-2 flex items-center gap-2.5 bg-primarySoft border border-primaryBorder"
        >
          <span className="font-mono text-xs tabular-nums shrink-0 w-11 text-primary">
            {horaCurta(q.hora)}
          </span>
          <Avatar
            photoURL={q.child.photoURL}
            gender={q.child.gender}
            seed={q.child.id}
            kind="child"
            size="sm"
          />
          <span className="flex-1 min-w-0 text-sm font-semibold text-primary truncate">
            {q.child.name}
          </span>
          <CheckCircle2 size={16} className="text-accentText shrink-0" />
        </div>
      ))}
    </section>
  );
}

/**
 * "hoje", "ontem", "há 12 dias".
 *
 * Só aparece quando o aviso não é de hoje: aviso feito hoje de manhã não
 * precisa de carimbo de validade, e repetir "avisado hoje" em toda linha vira
 * ruído que o olho aprende a pular — levando junto o "há 12 dias", que é o
 * único que importa.
 */
function idadeDoAviso(declaracao) {
  const ts = declaracao?.createdAt;
  const d = ts?.toDate?.() || (ts instanceof Date ? ts : null);
  if (!d) return null;
  const dias = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (dias <= 0) return null;
  if (dias === 1) return 'ontem';
  return `há ${dias} dias`;
}
