import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { diasDeCalendario } from '../../compartilhado/formatters';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Clock,
  UserX,
  Phone,
  Check,
  School,
  Home,
  UserCheck,
  MessageCircle,
  BellRing,
  NotebookPen,
  Undo2,
  DoorClosed,
  Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../common/Button';
import Avatar from '../common/Avatar';
import Skeleton from '../common/Skeleton';
import EmptyState from '../common/EmptyState';
import Spinner from '../common/Spinner';
import ConfirmDialog from '../common/ConfirmDialog';
import ControleDeRota from './ControleDeRota';
import FaixaDaViagem from './FaixaDaViagem';
import { GrupoDaLinha, ItemDaLinha } from './LinhaDoTempo';
import './rota.css';
import { useAuth } from '../../hooks/useAuth';
import { useChildren } from '../../hooks/useChildren';
import { useEscolas } from '../../hooks/useEscolas';
import { useAbsences } from '../../hooks/useAbsences';
import { useQuemBuscaHoje } from '../../hooks/useQuemBuscaHoje';
import { useRecadosDoDiaDaTurma } from '../../hooks/useRecadosDoDia';
import { useLiveLocation } from '../../hooks/useLiveLocation';
import {
  getActionForStatus,
  advanceChild,
  advanceMany,
  statusNaDirecao,
  voltarPasso,
} from '../../services/routeStatusService';
import { passoAnterior, barraTravada, TRAVA_DA_PARADA_MS } from '../../dominio/rota/acaoDaParada.js';
import BarraDaAcao from '../layout/BarraDaAcao';
import AvisosDaViagem from './AvisosDaViagem';
import MensalidadeNaPorta from './MensalidadeNaPorta';
import PixDaPerua from './PixDaPerua';
import { useMensalidadesEmAberto } from '../../hooks/usePayments';
import { emAbertoPorCrianca } from '../../dominio/cobranca/semSenha.js';
import RecadoDaRota from './RecadoDaRota';
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
} from '../../dominio/rota/horarios';

import {
  declareAbsence,
  notifyAbsence,
  removeAbsence,
  ABSENCE_TYPES,
} from '../../services/absencesService';
import { createCall, encerrarChamadas } from '../../services/pendingCallService';
import { momentoDaBuzina } from '../../dominio/rota/buzina.js';
import { playSound } from '../../services/soundService';
import { publicarOrdemDoDia, publicarPrevisoes } from '../../services/ridesService';
import {
  lugarDoPasso,
  pendentesEmOrdem,
  focoDaViagem,
  loteDoFoco,
  proximoAAvisar,
  saidaDaViagem,
  previsoesDaViagem,
  quemFicouSemRegistro,
} from '../../dominio/rota/focoDaViagem.js';

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
 *
 * UMA LINHA DO TEMPO, NÃO TRÊS LISTAS (03/10/2026, design system)
 * A tela era "já feitos" em cima, o cartão em foco no meio e "o resto da
 * viagem" embaixo. Cada toque mudava a criança de lista — ela sumia de um
 * lugar e aparecia noutro, e o olho tinha que achá-la de novo. Agora a viagem
 * é uma linha só, na ordem em que a perua anda (casas, depois escolas na ida;
 * o contrário na volta), e o que muda com o toque é o ESTADO da linha, nunca
 * a posição. A parada atual abre ali mesmo, no lugar dela. O que manda no
 * foco, no lote e no aviso continua sendo `focoDaViagem` — esta tela só
 * desenha.
 */
export default function OperacaoDaRota({
  mostrarRodape = true,
  // O controle de rota (encerrar e a chave do mapa) mora na FAIXA VERDE.
  // Quem montar esta operação numa tela que já tem o próprio encerrar passa
  // `false`, senão seriam dois botões de encerrar rota na mesma tela.
  mostrarControle = true,
  // A ROTA AO VIVO (05/10/2026): o registro "O que a Cida marcou" e as
  // zonas (em casa / na perua / na escola) entram no topo da operação por
  // aqui. É uma função porque elas precisam dos MESMOS dados que esta tela já
  // escuta (a fila da viagem, as declarações e quem busca hoje) — montá-las
  // de fora abriria uma segunda escuta para cada um. Ela só desenha; a
  // operação (foco, rodapé, desfazer, avisos) continua inteira aqui.
  aoVivo = null,
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const dateKey = getDateKey();
  // Quem a família indicou para buscar hoje — aparece na entrega (ver abaixo).
  const quemBusca = useQuemBuscaHoje(user?.uid, dateKey);
  // Os recados do dia da família (05/10/2026): UMA consulta para a turma,
  // entregue à rota ao vivo pela `aoVivo` — a ficha rápida não abre escuta.
  const recados = useRecadosDoDiaDaTurma(user?.uid, dateKey);
  // A MENSALIDADE EM ABERTO DE QUEM ESTÁ NA PORTA (04/10/2026). A rota é a
  // A rota é o lugar da auxiliar: ela vê o mês, nunca o valor (`MensalidadeNaPorta`).
  const { payments: pendentes } = useMensalidadesEmAberto();
  const emAberto = useMemo(() => emAbertoPorCrianca(pendentes), [pendentes]);

  const { children, loading } = useChildren();
  const { mapa: escolasPorId } = useEscolas();
  const { byChildId: declaracoes } = useAbsences(dateKey);

  // Posição que o rastreamento JÁ gravou — nunca pedimos GPS na hora: pedir
  // permissão no meio da rota trava a ação do motorista.
  const { location: liveLocation } = useLiveLocation();

  const [indiceEscolhido, setIndiceEscolhido] = useState(null);
  const [busy, setBusy] = useState(false);
  // O botão do rodapé diz "Gravando…" só quando é ELE que está gravando —
  // `busy` também acende na buzina, e "Gravando" ali seria mentira.
  const [gravando, setGravando] = useState(false);
  // A criança que o motorista TOCOU para pôr em foco — a ordem do relógio é
  // sugestão, e a rua manda (ver `focoDaViagem`).
  const [focoEscolhido, setFocoEscolhido] = useState(null);
  // "Ninguém em casa": quem ficou para o fim desta viagem (ver `pendentesEmOrdem`).
  const [adiados, setAdiados] = useState([]);
  const [recadoDe, setRecadoDe] = useState(null); // { child, tipo }
  const [voltandoPraCasa, setVoltandoPraCasa] = useState(null); // item da fila
  const [voltando, setVoltando] = useState(null); // item da fila a voltar um passo
  const [confirmLote, setConfirmLote] = useState(null);
  const [marcando, setMarcando] = useState(null); // { child, tipo }
  const [desfazendo, setDesfazendo] = useState(null); // criança fora que ele quer devolver
  const [ninguemEmCasa, setNinguemEmCasa] = useState(null); // item da fila a deixar pro fim
  // A ÚLTIMA MARCAÇÃO, para a trava do botão da parada (`barraTravada`):
  // { child, status, em }. Enquanto vale, o rodapé diz "Ana ✓ · Desfazer"
  // em vez de já oferecer a próxima criança ao mesmo polegar.
  const [recemMarcado, setRecemMarcado] = useState(null);
  useEffect(() => {
    if (!recemMarcado) return undefined;
    const resta = Math.max(0, TRAVA_DA_PARADA_MS - (Date.now() - recemMarcado.em));
    const t = setTimeout(() => setRecemMarcado(null), resta);
    return () => clearTimeout(t);
  }, [recemMarcado]);

  // "PROBLEMA NA PERUA" VINDO DO MEU TRANSPORTE (04/10/2026): com a rota
  // rodando, a linha de lá traz para cá, e a folha do aviso abre sozinha —
  // um nome e um caminho só (`marcarOcorrencia`).
  const location = useLocation();
  const pediuProblema = location.state?.atalho === 'problema';
  const consumirAtalho = useCallback(
    () => navigate(location.pathname, { replace: true, state: null }),
    [navigate, location.pathname]
  );

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
  const { totalEfetivo, resolvidas, foco, lote, proxima } = useMemo(() => {
    // QUEM ESTÁ EM FOCO E QUEM VAI JUNTO — régua pura em
    // `dominio/rota/focoDaViagem.js` (03/10/2026). Era `p[0]` com o lote por
    // "mesmo próximo passo", e a rota travava: depois do primeiro EMBARQUEI o
    // foco virava "ENTREGUEI NA ESCOLA" da mesma criança, e o "TODOS" juntava
    // casas diferentes e escolas diferentes.
    const p = pendentesEmOrdem(fila, adiados);
    const focoAtual = focoDaViagem(p, focoEscolhido);
    const iguais = loteDoFoco(p, focoAtual);
    const l = iguais.length
      ? {
          nextStatus: focoAtual.action.nextStatus,
          label: focoAtual.action.shortLabel,
          count: iguais.length,
          // Casa e escola vão POR CRIANÇA pra o lote gravar um checkpoint de
          // distância pra cada uma, como o toque individual já faz.
          moves: iguais.map((q) => ({
            childId: q.child.id,
            nextStatus: q.action.nextStatus,
            // De onde ela sai: embarcar NA ESCOLA é o aviso que a família
            // espera à tarde ("entrou na perua").
            statusAnterior: q.status,
            parentUid: q.child.parentUid || null,
            childName: q.child.name,
            home: q.child.lat != null ? { lat: q.child.lat, lng: q.child.lng } : null,
            school:
              q.child.schoolLat != null
                ? { lat: q.child.schoolLat, lng: q.child.schoolLng }
                : null,
          })),
        }
      : null;
    // Quem já terminou a viagem (não tem mais passo nesta direção). Já foi a
    // lista "já feitos" acima do cartão em foco, e o "resto da viagem" era
    // calculado ao lado — as duas listas saíram com a linha do tempo, que
    // mostra todo mundo no lugar da ordem (ver `linha` abaixo). Fica a
    // contagem.
    const feitos = fila.filter((q) => precisaDaPerua(q.estado) && !q.action);

    // QUEM VEM DEPOIS — a linha de baixo do botão do rodapé. É quem o foco
    // vira depois do toque: a mesma ordem, sem quem está em foco agora.
    const depois = focoAtual ? p.find((q) => q !== focoAtual) || null : null;

    return {
      totalEfetivo: fila.filter((q) => precisaDaPerua(q.estado)).length,
      resolvidas: feitos.length,
      foco: focoAtual,
      lote: l,
      proxima: depois,
    };
  }, [fila, focoEscolhido, adiados]);

  // Sem ninguém esperando a perua nesta viagem não há a quem avisar daqui:
  // o "Problema na perua" do Meu transporte segue pelo caderno, como sem rota.
  useEffect(() => {
    if (pediuProblema && !loading && !foco) {
      navigate('/tio/agenda', { replace: true, state: { atalho: 'quebrou' } });
    }
  }, [pediuProblema, loading, foco, navigate]);

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
   * A LINHA DO TEMPO — as paradas da viagem na ordem em que a perua as faz.
   *
   * Na ida: as casas (ordem do relógio), depois as escolas. Na volta: as
   * escolas, depois as casas. A escola não é uma entidade da viagem — ela é
   * agrupada aqui, para a tela, a partir das crianças que vão até ela, do
   * mesmo jeito que `escolasDoBloco` faz no domínio (chave `schoolId`, ou o
   * nome escrito). Nenhuma regra nova: o estado de cada linha sai da `action`
   * que `getActionForStatus` já deu, e o foco é o de `focoDaViagem`.
   *
   * Estados: `feito` (o passo desta linha aconteceu), `agora` (é o foco),
   * `falta` e `off` (fora hoje — faltou, o pai leva, o pai busca).
   *
   * ⚠️ A ESCOLA NÃO TEM HORA COMBINADA, e a linha dela não inventa uma: a
   * coluna da hora fica vazia até a entrega acontecer (ver `blocosDaDirecao`
   * — "inventar ~06:52 seria trazer de volta o número que ninguém combinou").
   */
  const ida = blocoAtual?.direcao === 'ida';
  const focoNaEscola = !!foco && lugarDoPasso(foco).startsWith('escola:');
  const linha = useMemo(() => {
    if (!blocoAtual) return [];
    // O passo da CASA é embarcar na ida e entregar na volta; o da ESCOLA é o
    // contrário. "Já embarcou" é o mesmo teste nas duas direções: o próximo
    // passo deixou de ser o embarque.
    const embarcou = (q) => q.action?.nextStatus !== 'onboard';
    const terminou = (q) => !q.action;
    const casaFeita = ida ? embarcou : terminou;
    const escolaFeita = ida ? terminou : embarcou;
    // A hora REAL só aparece quando o passo desta linha foi o ÚLTIMO que a
    // criança deu: `statusUpdatedAt` guarda só a hora do status atual. Quem
    // já embarcou e já foi entregue na escola perde a hora do embarque na
    // linha da casa — o marco existe em `rides/{dia}`, mas assinar um
    // documento por criança só para isso seria uma leitura a mais por porta.
    const statusDaCasa = ida ? 'onboard' : 'delivered';
    const statusDaEscola = ida ? 'atSchool' : 'onboard';

    const casas = fila.map((q) => {
      const fora = !precisaDaPerua(q.estado);
      const feito = !fora && casaFeita(q);
      const agora = !fora && !focoNaEscola && foco === q;
      return {
        chave: `casa:${q.child.id}`,
        tipo: 'casa',
        q,
        estado: fora ? 'off' : agora ? 'agora' : feito ? 'feito' : 'falta',
        real: feito && q.status === statusDaCasa ? horaDoStatus(q.child) : null,
        // Desfazer pela linha só quando o passo dela é o último dado — senão
        // o "voltar um passo" desfaria a ESCOLA tocando na CASA.
        desfaz: feito && q.status === statusDaCasa,
      };
    });

    const grupos = new Map();
    for (const q of fila) {
      if (!precisaDaPerua(q.estado)) continue;
      const k = q.child.schoolId || q.child.school || '?';
      if (!grupos.has(k)) {
        grupos.set(k, {
          chave: `escola:${k}`,
          tipo: 'escola',
          nome: escolasPorId?.[q.child.schoolId]?.nome || q.child.school || 'Escola',
          quem: [],
        });
      }
      grupos.get(k).quem.push(q);
    }
    const escolas = [...grupos.values()].map((g) => {
      const todos = g.quem.every(escolaFeita);
      const agora = focoNaEscola && g.quem.includes(foco);
      const horas = g.quem
        .filter((q) => q.status === statusDaEscola)
        .map((q) => horaDoStatus(q.child))
        .filter(Boolean)
        .sort();
      return {
        ...g,
        estado: agora ? 'agora' : todos ? 'feito' : 'falta',
        real: todos ? horas[horas.length - 1] || null : null,
        // Cada criança da escola, com o que um toque nela faz.
        pessoas: g.quem.map((q) => ({
          q,
          feito: escolaFeita(q),
          desfaz: escolaFeita(q) && q.status === statusDaEscola,
          pendente: !escolaFeita(q) && q.action?.nextStatus === (ida ? 'atSchool' : 'onboard'),
        })),
      };
    });

    return ida
      ? [
          { grupo: 'Buscar em casa', itens: casas },
          { grupo: 'Deixar na escola', itens: escolas },
        ]
      : [
          { grupo: 'Buscar na escola', itens: escolas },
          { grupo: 'Deixar em casa', itens: casas },
        ];
  }, [blocoAtual, fila, foco, focoNaEscola, ida, escolasPorId]);

  const itensDaLinha = linha.flatMap((g) => g.itens);

  /**
   * O QUE A FAIXA CONTA: primeiro quantos embarcaram, depois quantos chegaram.
   * São as duas metades da viagem, e o número que importa muda no meio dela.
   */
  const embarcados = fila.filter(
    (q) => precisaDaPerua(q.estado) && q.action?.nextStatus !== 'onboard'
  ).length;
  const contagem =
    totalEfetivo === 0
      ? `${fila.length} ${fila.length === 1 ? 'criança' : 'crianças'} nesta viagem`
      : embarcados < totalEfetivo
        ? `${embarcados} de ${totalEfetivo} embarcaram`
        : ida
          ? `${resolvidas} de ${totalEfetivo} na escola`
          : `${resolvidas} de ${totalEfetivo} já foram entregues`;

  /**
   * O PULSO DO "AO VIVO" PARA COM DADO VELHO. Três minutos sem posição nova
   * (sem sinal, aba suspensa) e o ponto da faixa fica parado — animação viva
   * sobre dado morto é a pior parte (a mesma regra de `avisoDoMomento`).
   */
  const rotaAtiva = !!liveLocation?.routeActive;
  const posicaoViva = useMemo(() => {
    const d = liveLocation?.updatedAt?.toDate?.();
    if (!d) return rotaAtiva;
    return Date.now() - d.getTime() < 3 * 60_000;
    // `tick` reavalia a idade a cada minuto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveLocation?.updatedAt, rotaAtiva, tick]);

  /**
   * O CHECK ESTALA SÓ NO TOQUE. Quem abre a tela no meio da viagem não pode
   * ver dez checks pulando de uma vez — isso seria festa, e na rota não tem
   * festa. As linhas já feitas quando a tela abriu ficam guardadas; só a que
   * vira feita DEPOIS ganha a mola.
   */
  const chavesFeitas = itensDaLinha
    .filter((it) => it.estado === 'feito')
    .map((it) => it.chave)
    .join('|');
  const [feitasNaAbertura, setFeitasNaAbertura] = useState(null);
  useEffect(() => {
    if (loading || feitasNaAbertura) return undefined;
    // Um respiro para as declarações do dia chegarem junto com as crianças.
    const t = setTimeout(() => setFeitasNaAbertura(new Set(chavesFeitas.split('|'))), 400);
    return () => clearTimeout(t);
  }, [loading, feitasNaAbertura, chavesFeitas]);
  const estala = (chave) => !!feitasNaAbertura && !feitasNaAbertura.has(chave);

  /**
   * A PARADA ATUAL FICA À VISTA. Depois de cada toque o foco anda para a
   * próxima linha, que pode estar fora da tela; sem isto ele rolaria com uma
   * mão, dirigindo, procurando o botão. Só rola quando o cartão não está
   * inteiro à vista — com ele visível, a tela não se mexe sozinha.
   */
  const focoRef = useRef(null);
  const chaveDoFoco = foco ? `${foco.child.id}:${foco.action.nextStatus}` : null;
  useEffect(() => {
    if (!chaveDoFoco) return undefined;
    const raf = requestAnimationFrame(() => {
      const el = focoRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      // Cabeçalho em cima; rodapé de encerrar e barra de abas embaixo.
      // O rodapé agora é a barra da parada (botão de 64 px e a linha do
      // "Depois"), um pouco mais alta que o "segure" de antes.
      if (r.top >= 72 && r.bottom <= window.innerHeight - 240) return;
      const calmo = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({
        top: Math.max(0, window.scrollY + r.top - 88),
        behavior: calmo ? 'auto' : 'smooth',
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [chaveDoFoco]);

  /** Tocar numa linha que ainda espera põe aquela criança em foco. */
  const porEmFoco = (q) => setFocoEscolhido({ id: q.child.id, passo: q.action.nextStatus });

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
  /**
   * AS CASAS QUE A PERUA VAI ALCANÇAR HOJE — entregues ao rastreamento.
   *
   * É com elas que o celular DELE mede o "está chegando", e é por isso que o
   * aviso deixou de depender de a posição ser compartilhada: o que sai do
   * aparelho é a faixa (`perto`, `chegou`), nunca a distância nem o ponto.
   *
   * Criança sem coordenada fica de fora — sem o destino não há o que medir, e
   * chutar seria avisar a família errada na hora errada.
   */
  const alvosDaRota = useMemo(
    () =>
        // ⚠️ SÓ A VIAGEM DE AGORA (03/10/2026). Eram as paradas do DIA
        // inteiro: na rota da manhã, a perua passando perto da casa de quem só
        // vai à tarde tocava "chegou" no celular dessa família.
      (blocoAtual?.paradas || [])
        // ⚠️ QUEM ESTÁ FORA HOJE NÃO É ALVO (03/10/2026): faltou, ou o pai
        // leva/busca. Sem o filtro, a perua passando na rua dela tocava a
        // buzina de "chegou" no celular de uma família que não a espera.
        .filter((p) => precisaDaPerua(p.estado))
        .map((p) => ({
          childId: p.child?.id,
          lat: Number(p.child?.lat),
          lng: Number(p.child?.lng),
          parentUid: p.child?.parentUid || null,
        }))
        .filter((a) => a.childId && Number.isFinite(a.lat) && Number.isFinite(a.lng)),
    [blocoAtual]
  );

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
    setGravando(true);
    // A ESCOLHA DO FOCO VALE UM TOQUE: marcou, o foco volta à ordem da
    // viagem. Sem isto, a escolha antiga reacendia quando a criança voltava
    // ao mesmo passo (desfazer e marcar de novo — achado no teste M6).
    setFocoEscolhido(null);
    try {
      const resultado = await advanceChild(item.child.id, item.action.nextStatus, {
        proximo: paraAvisar(proximoAAvisar(fila, item)),
        driverPosition: posicaoDoDriver,
        dateKey,
        adminUid: user?.uid,
        parentUid: item.child.parentUid || null,
        childName: item.child.name,
        statusAnterior: item.status,
        home: item.child.lat != null ? { lat: item.child.lat, lng: item.child.lng } : null,
        school:
          item.child.schoolLat != null
            ? { lat: item.child.schoolLat, lng: item.child.schoolLng }
            : null,
      });
      // A criança saiu da porta: a buzina daquela casa cumpriu o papel.
      encerrarChamadas({ adminUid: user?.uid, childId: item.child.id, motivo: 'embarque' });
      // A PREVISÃO DE QUEM AINDA ESPERA: combinado + o atraso desta parada.
      publicarPrevisoes({
        previsoes: previsoesDaViagem(fila, item),
        dateKey,
        adminUid: user?.uid,
      });
      // SEM SINAL: a marcação fica no celular e sobe quando ele voltar
      // (`gravarSemTravar`). Dizer isso evita o toque repetido.
      vibrar();
      setRecemMarcado({ child: item.child, status: item.action.nextStatus, em: Date.now() });
      if (resultado === 'fila') {
        toast(`${item.child.name.split(' ')[0]}: marcado. Sem sinal agora, sobe quando voltar.`);
      } else {
        toast.success(`${item.child.name.split(' ')[0]}: pronto`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Não deu pra salvar. Tente de novo.');
    } finally {
      setBusy(false);
      setGravando(false);
    }
  }

  /**
   * VOLTAR UM PASSO — o mesmo desfazer para o diálogo da lista e para o
   * "Desfazer" do rodapé logo depois de marcar. `q` é { child, status }.
   */
  async function voltarUmPasso(q) {
    if (!q) return;
    setBusy(true);
    setFocoEscolhido(null);
    setRecemMarcado(null);
    try {
      await voltarPasso({
        childId: q.child.id,
        statusAtual: q.status,
        anterior: passoAnterior(q.status, direcaoAntiga),
        dateKey,
      });
      vibrar();
      toast.success(`${q.child.name.split(' ')[0]} voltou um passo.`);
    } catch (err) {
      console.error(err);
      toast.error('Não deu pra voltar. Tente de novo.');
    } finally {
      setBusy(false);
      setVoltando(null);
    }
  }

  /** O item da fila vira o que o aviso precisa — ou nada. */
  function paraAvisar(q) {
    if (!q?.child?.parentUid) return null;
    return {
      childId: q.child.id,
      parentUid: q.child.parentUid,
      name: q.child.name,
      // Quem vai embarcar em casa espera a perua da IDA; quem está na perua
      // espera a ENTREGA.
      direcao: q.status === 'home' ? 'ida' : 'volta',
    };
  }

  async function avancarLote() {
    if (!lote) return;
    setBusy(true);
    setFocoEscolhido(null);
    try {
      const movidos = fila.filter((q) => lote.moves.some((mv) => mv.childId === q.child.id));
      const n = await advanceMany(lote.moves, {
        proximo: paraAvisar(proximoAAvisar(fila, movidos)),
        driverPosition: posicaoDoDriver,
        dateKey,
        adminUid: user?.uid,
      });
      vibrar();
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
      // A FAMÍLIA É AVISADA (03/10/2026). Antes a marcação só aparecia no
      // app dela: quem não abria o app descobria a falta à noite.
      notifyAbsence({
        child: marcando.child,
        type: marcando.tipo,
        dateKey,
        declaredBy: 'admin',
      });
      vibrar();
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
  async function chamar(child, status) {
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
        momento: momentoDaBuzina(status),
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

  /**
   * O QUE A PARADA ATUAL OFERECE — tudo o que a rua pede, menos o botão grande.
   *
   * ⚠️ O BOTÃO GRANDE DESCEU PARA O RODAPÉ (03/10/2026, auditoria de UX). Ele
   * morava aqui, no meio do cartão, e o rodapé preso era o "segure para
   * encerrar" — a ação mais frequente da rota no meio da tela e a mais rara
   * onde o polegar descansa. Inverteu: a marcação mora no rodapé fixo
   * (`BarraDaParada`) e o encerrar subiu para a faixa verde.
   *
   * O que sobra aqui são as ações da porta, em TRÊS GRUPOS com nome escrito —
   * dez botões soltos são dez decisões; três grupos são uma pergunta ("o que
   * aconteceu?") e a resposta perto. As condições de cada botão são as de
   * antes; mudou a arrumação.
   */
  const acoesDoFoco = foco && (
    <div className="space-y-4">
      {foco.child.notes && (
        // A OBSERVAÇÃO DO CADASTRO ("portão de trás") é escrita pelo
        // motorista, e é exatamente na porta que ela serve. Nunca dado de
        // saúde: aquele campo é da família e não aparece aqui.
        <p className="flex items-start gap-2 rounded-lg bg-surface px-3 py-2.5 text-base leading-snug text-textBody">
          <Info size={18} className="mt-0.5 shrink-0 text-textMuted" />
          <span className="min-w-0 whitespace-pre-wrap">{foco.child.notes}</span>
        </p>
      )}

      {/* ⚠️ QUEM BUSCA HOJE (03/10/2026). A família indicava a avó e o aviso
        * ia só para o sino: na porta, a tela da rota não dizia nada, e ele
        * entregava a criança a quem estava acostumado. Aparece na ENTREGA em
        * casa, que é onde a pessoa diferente está esperando. */}
      {foco.action.nextStatus === 'delivered' && quemBusca[foco.child.id] && (
        <p className="flex items-start gap-2 rounded-lg border border-warningBorder bg-warningSoft px-3 py-2.5 text-base leading-snug text-warningText">
          <UserCheck size={18} className="mt-0.5 shrink-0" />
          <span className="min-w-0">
            <strong>Hoje quem recebe: {quemBusca[foco.child.id].name}</strong>
            {quemBusca[foco.child.id].relationship ? ` (${quemBusca[foco.child.id].relationship})` : ''}
            {quemBusca[foco.child.id].phone ? ` · ${quemBusca[foco.child.id].phone}` : ''}
          </span>
        </p>
      )}

      {/* Lote — uma parada é um evento, não vinte.
        * ⚠️ NÃO É ÂMBAR (03/10/2026): âmbar é aviso e nada mais, e marcar
        * várias de uma vez é ação. E o texto de baixo diz QUEM vai junto
        * — o "TODOS" agora é por lugar (ver `loteDoFoco`), e o motorista
        * precisa conferir os nomes antes de tocar.
        * Ele NÃO desceu para o rodapé junto com o botão de uma criança: o
        * lote pede confirmação (são várias famílias avisadas de uma vez), e
        * o rodapé é o toque que não pergunta. */}
      {lote && (
        <button
          type="button"
          disabled={busy}
          onClick={() => setConfirmLote(lote)}
          className="tap flex min-h-14 w-full flex-col items-center justify-center gap-0.5 rounded-xl border-2 border-primary bg-card py-2.5 text-base font-extrabold text-primary disabled:opacity-60"
        >
          <span>
            {lote.label} — TODOS OS {lote.count}
          </span>
          <span className="text-base font-semibold text-text">
            {lote.moves.map((mv) => String(mv.childName || '').split(' ')[0]).join(', ')}
          </span>
        </button>
      )}

      {/* FALAR COM A FAMÍLIA — a porta: o motorista chegou e ninguém desceu.
        * Três degraus, do mais barato pro mais caro: tocar o celular
        * dele sem sair do app, mandar mensagem, ligar.
        *
        * ⚠️ SÓ NA PORTA (03/10/2026). No passo "ENTREGUEI NA ESCOLA" a
        * criança está sentada na perua: buzinar ali fazia o celular da
        * mãe tocar sem motivo (achado no teste M5). */}
      {foco.action.nextStatus !== 'atSchool' && (
        <GrupoDeAcoes titulo="Falar com a família">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              data-tour="buzinar"
              disabled={busy}
              onClick={() => chamar(foco.child, foco.status)}
              className="tap flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl border border-primaryBorder bg-primarySoft text-base font-bold text-primary disabled:opacity-60"
            >
              <BellRing size={18} />
              Buzinar
            </button>
            <button
              type="button"
              onClick={() => zap(foco.child)}
              className="tap flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl border border-neutro bg-surface text-base font-semibold text-text"
            >
              <MessageCircle size={18} className="text-primary" />
              Zap
            </button>
            {foco.child.parentPhone ? (
              <a
                href={`tel:${foco.child.parentPhone}`}
                className="tap flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl border border-neutro bg-surface text-base font-semibold text-text"
              >
                <Phone size={18} className="text-primary" />
                Ligar
              </a>
            ) : (
              <span className="flex h-14 items-center justify-center rounded-xl bg-neutro text-sm font-semibold text-textMuted">
                sem telefone
              </span>
            )}
          </div>

          {/* O QUE O BOTÃO FAZ, ESCRITO.
            * "Buzinar" não diz onde a buzina toca. Sem esta linha o
            * motorista testa uma vez pra descobrir — e testar significa
            * fazer o celular de uma família tocar à toa. */}
          <p className="text-center text-sm text-textMuted">
            Toca no celular da família
          </p>
        </GrupoDeAcoes>
      )}

      {/* O DINHEIRO QUE CHEGA NA PORTA (04/10/2026). Só na porta — na
        * escola não há família para pagar — e só o mês, sem valor. */}
      {foco.action.nextStatus !== 'atSchool' && emAberto[foco.child.id] && (
        <MensalidadeNaPorta payment={emAberto[foco.child.id]} childName={foco.child.name} />
      )}

      {/* NÃO VAI HOJE.
        * ⚠️ "FALTOU" E "O PAI LEVOU" SÓ ANTES DE EMBARCAR (03/10/2026):
        * oferecer "Faltou" para quem já está dentro da perua é convidar
        * o toque errado. "Faltou" já tem cara de alerta NO BOTÃO — o
        * diálogo de confirmação é vermelho, e o botão que leva até ele não
        * pode parecer irmão do "O pai levou". */}
      {foco.action.nextStatus === 'onboard' && (
        <GrupoDeAcoes titulo="Não vai hoje">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setMarcando({ child: foco.child, tipo: ABSENCE_TYPES.FULL })}
              className="tap inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-dangerBorder bg-dangerSoft px-3 text-base font-bold text-dangerText disabled:opacity-60"
            >
              <UserX size={18} />
              Faltou
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                setMarcando({
                  child: foco.child,
                  tipo:
                    blocoAtual?.direcao === 'volta'
                      ? ABSENCE_TYPES.ALREADY_PICKED
                      : ABSENCE_TYPES.NO_PICKUP,
                })
              }
              className="tap inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 text-base font-semibold text-text disabled:opacity-60"
            >
              <UserCheck size={18} />
              {blocoAtual?.direcao === 'volta' ? 'O pai pegou' : 'O pai levou'}
            </button>
          </div>
        </GrupoDeAcoes>
      )}

      {/* ⚠️ AS AÇÕES QUE A RUA PEDE E A TELA NÃO TINHA (03/10/2026):
        * ligar para a escola na hora da entrega lá, deixar para depois
        * quem não tem ninguém em casa, escrever no caderno (a briga, o
        * mal-estar) e voltar um passo marcado por engano. */}
      {(foco.action.nextStatus === 'atSchool' ||
        (foco.action.nextStatus === 'onboard' && foco.status === 'atSchool')) &&
        foco.child.schoolPhone && (
          <a
            href={`tel:${foco.child.schoolPhone}`}
            className="tap flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card text-base font-semibold text-text"
          >
            <Phone size={18} />
            Ligar para a escola
          </a>
        )}

      {/* CORRIGIR — o que ele usa quando algo saiu do combinado. Fica por
        * último e em contorno: é o grupo raro, e o raro mora longe do
        * polegar (o polegar está no rodapé, com a marcação). */}
      <GrupoDeAcoes titulo="Corrigir">
        <div className="grid grid-cols-2 gap-2">
          {passoAnterior(foco.status, direcaoAntiga) && (
            <BotaoDeCorrigir icon={Undo2} onClick={() => setVoltando(foco)}>
              Desfazer
            </BotaoDeCorrigir>
          )}
          {foco.action.nextStatus === 'delivered' && (
            <BotaoDeCorrigir icon={DoorClosed} onClick={() => setNinguemEmCasa(foco)}>
              Ninguém em casa
            </BotaoDeCorrigir>
          )}
          {/* PASSOU MAL NO CAMINHO (03/10/2026): na ida, com a criança na
            * perua, ele a leva de volta. Vira "entregue em casa" (a
            * família recebe o "chegou em casa" que já existe) e abre o
            * recado já no "Criança não tá bem". */}
          {foco.action.nextStatus === 'atSchool' && foco.status === 'onboard' && (
            <BotaoDeCorrigir icon={Home} onClick={() => setVoltandoPraCasa(foco)}>
              Levar de volta para casa
            </BotaoDeCorrigir>
          )}
          <BotaoDeCorrigir
            icon={NotebookPen}
            onClick={() => setRecadoDe({ child: foco.child, tipo: 'conflict' })}
          >
            Recado
          </BotaoDeCorrigir>
        </div>
      </GrupoDeAcoes>
    </div>
  );

  /** O conteúdo de cada linha — o cartão aberto, se for a parada atual. */
  function conteudo(it) {
    if (it.tipo === 'escola') return conteudoDaEscola(it);
    const { q } = it;

    if (it.estado === 'agora') {
      return (
        <div
          ref={focoRef}
          key={chaveDoFoco}
          className="rota-entra scroll-mt-24 space-y-3 rounded-2xl border-2 border-perua bg-card p-3 shadow-rest"
        >
          <div className="flex items-center gap-3">
            <Avatar
              photoURL={q.child.photoURL}
              gender={q.child.gender}
              seed={q.child.id}
              kind="child"
              size="md"
            />
            {/* 24 px no nome: é o que ele confere de relance, com o celular
              * no suporte, antes de tocar no rodapé. Endereço e hora em 16. */}
            <div className="min-w-0 flex-1">
              <p className="font-display text-2xl font-bold leading-tight text-text">
                {q.child.name}
              </p>
              <p className="text-base leading-snug text-textBody">
                {q.child.address || 'Sem endereço'}
              </p>
              {q.hora && (
                <p className="font-mono text-base font-semibold tabular-nums text-textMuted">
                  Combinado {horaCurta(q.hora)}
                </p>
              )}
            </div>
          </div>
          {acoesDoFoco}
        </div>
      );
    }

    const fora = it.estado === 'off';
    const feito = it.estado === 'feito';
    // ⚠️ QUEM AINDA TEM ALGO A FAZER É TOCÁVEL (03/10/2026): o toque põe a
    // criança em FOCO, com os botões dela (embarcar, faltou, buzinar). Quem
    // está fora devolve à rota ("ela veio"); quem já foi marcado volta um
    // passo — para o toque errado.
    const tocar = fora
      ? () => setDesfazendo(q.child)
      : feito
        ? it.desfaz && passoAnterior(q.status, direcaoAntiga)
          ? () => setVoltando(q)
          : undefined
        : q.action
          ? () => porEmFoco(q)
          : undefined;
    const sub = fora
      ? null
      : feito
        ? ida
          ? `Embarcou${it.real ? ` às ${it.real}` : ''}`
          : `Entregue em casa${it.real ? ` às ${it.real}` : ''}`
        : q.child.address || 'Sem endereço';

    return (
      <LinhaTocavel onTocar={tocar}>
        <Avatar
          photoURL={q.child.photoURL}
          gender={q.child.gender}
          seed={q.child.id}
          kind="child"
          size="sm"
        />
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate text-[17px] ${
              fora
                ? 'font-medium text-textMuted line-through'
                : feito
                  ? 'font-medium text-textMuted'
                  : 'font-semibold text-text'
            }`}
          >
            {q.child.name}
          </span>
          {fora ? (
            <span className="block text-sm font-medium text-warningText">
              {ROTULO_ESTADO[q.estado] || 'Fora hoje'}
              {/* A IDADE DO AVISO É O QUE DIZ SE ELE AINDA VALE.
                * Um aviso de ontem quase certamente vale; um de duas
                * semanas atrás é justamente o que o responsável
                * esqueceu que existe. Mostrar a idade transforma
                * "ela falta" em "ela faltaria, segundo algo que
                * alguém disse há doze dias" — que é a verdade. */}
              {idadeDoAviso(declaracoes?.[q.child.id]) && (
                <span className="font-normal text-textMuted">
                  {' · avisado '}
                  {idadeDoAviso(declaracoes[q.child.id])}
                </span>
              )}
            </span>
          ) : (
            <span className="block truncate text-sm text-textMuted">{sub}</span>
          )}
        </span>
        {!fora && !feito && q.action && (
          <span className="shrink-0 text-base font-semibold text-primary">{q.action.label}</span>
        )}
      </LinhaTocavel>
    );
  }

  /**
   * A ESCOLA É UM MARCO VIOLETA com quem desce (ou sobe) ali. Na ida o passo
   * da escola é a entrega; na volta, o embarque. Cada nome é um botão: o que
   * espera vira o foco, o que já foi marcado volta um passo.
   */
  function conteudoDaEscola(it) {
    const verbo = ida
      ? it.quem.length === 1 ? 'desce aqui' : 'descem aqui'
      : it.quem.length === 1 ? 'embarca aqui' : 'embarcam aqui';
    const feito = it.estado === 'feito';
    const pessoas = (
      <div className="mt-2 flex flex-wrap gap-1.5">
        {it.pessoas.map(({ q, feito: f, desfaz, pendente }) => {
          const tocar = f
            ? desfaz && passoAnterior(q.status, direcaoAntiga)
              ? () => setVoltando(q)
              : undefined
            : pendente
              ? () => porEmFoco(q)
              : undefined;
          const ehFoco = it.estado === 'agora' && foco === q;
          return (
            <button
              key={q.child.id}
              type="button"
              disabled={!tocar}
              onClick={tocar}
              aria-pressed={ehFoco || undefined}
              className={`tap inline-flex min-h-12 items-center gap-1.5 rounded-full px-4 text-base font-semibold disabled:cursor-default ${
                ehFoco
                  ? 'bg-perua/15 text-warningText ring-2 ring-perua'
                  : f
                    ? 'bg-card text-textMuted'
                    : 'bg-card text-escola'
              }`}
            >
              {f && <Check size={14} className="text-accentText" />}
              {String(q.child.name || '').split(' ')[0]}
            </button>
          );
        })}
      </div>
    );

    if (it.estado === 'agora') {
      return (
        <div
          ref={focoRef}
          key={chaveDoFoco}
          className="rota-entra space-y-3 rounded-2xl border-2 border-escola bg-card p-3 shadow-rest"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-escolaChip text-escola">
              <School size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-2xl font-bold leading-tight text-text">
                {it.nome}
              </p>
              <p className="text-base text-textBody">
                {it.quem.length} {verbo}
              </p>
            </div>
          </div>
          <div className="rounded-xl bg-escolaSoft p-2.5">
            {/* O BOTÃO É DE UMA CRIANÇA, e o nome dela fica escrito: o lote
              * (quando há mais de uma no mesmo lugar) é o botão de baixo. */}
            <p className="text-base text-textBody">
              Agora: <b className="text-text">{foco.child.name}</b>
            </p>
            {pessoas}
          </div>
          {acoesDoFoco}
        </div>
      );
    }

    return (
      <div className={`rounded-xl px-3 py-2.5 ${feito ? 'bg-surface' : 'bg-escolaChip'}`}>
        <div className="flex items-center gap-2.5">
          <School size={18} className={`shrink-0 ${feito ? 'text-textMuted' : 'text-escola'}`} />
          <span className="min-w-0 flex-1">
            <span
              className={`block truncate text-[17px] font-semibold ${
                feito ? 'text-textMuted' : 'text-escola'
              }`}
            >
              {it.nome}
            </span>
            <span className="block text-sm text-textBody">
              {feito
                ? ida
                  ? `Entregues${it.real ? ` às ${it.real}` : ''}`
                  : `Embarcaram${it.real ? ` às ${it.real}` : ''}`
                : `${it.quem.length} ${verbo}`}
            </span>
          </span>
        </div>
        {pessoas}
      </div>
    );
  }

  return (
    <>
      {/* A FAIXA VERDE: rota ativa, a viagem, a contagem, o trilho — e,
        * desde 03/10/2026, o ENCERRAR e a chave do mapa (`controle`).
        * ⚠️ ELA ROLA COM A TELA, ao contrário do modelo (onde fica presa no
        * topo). No app há o cabeçalho em cima e a barra de abas mais o
        * rodapé da parada embaixo; presa, a faixa deixaria menos de meia
        * tela para a lista num celular pequeno. Encerrar rolando para fora
        * da vista é aceitável: é o gesto do fim, feito com a perua parada,
        * e o topo está a um arrasto.
        *
        * ⚠️ ELA EXISTE MESMO SEM VIAGEM — é onde mora o encerrar. Sem a
        * faixa, a rota aberta num dia sem horário não teria como fechar. */}
      <FaixaDaViagem
        titulo={
          !blocoAtual
            ? 'Rota'
            : !foco && totalEfetivo > 0
              ? 'Viagem concluída'
              : ida
                ? 'Levando pra escola'
                : 'Trazendo pra casa'
        }
        direcao={blocoAtual?.direcao}
        inicio={blocoAtual?.inicio}
        fim={blocoAtual?.fim}
        contagem={blocoAtual ? contagem : null}
        nos={itensDaLinha.map((it) => ({ chave: it.chave, tipo: it.tipo, estado: it.estado }))}
        ativa={rotaAtiva}
        vivo={posicaoViva}
        controle={
          mostrarControle ? (
            <ControleDeRota
              faixa
              onIniciar={publicarOrdem}
              alvos={alvosDaRota}
              direcao={blocoAtual?.direcao}
              saida={saidaDaViagem(blocoAtual)}
              pendentes={quemFicouSemRegistro(fila)}
            />
          ) : null
        }
      />

      <div className="space-y-4 px-4 pt-4">
        {loading && <Skeleton className="h-56 rounded-2xl" />}

        {!loading && aoVivo?.({
          fila,
          direcao: blocoAtual?.direcao || null,
          escolasPorId,
          declaracoes,
          quemBusca,
          recados,
          vez: foco?.child?.id || null,
          rotaAtiva,
        })}

        {!loading && blocos.length === 0 && (
          <EmptyState
            icon={Clock}
            title="Nenhuma viagem hoje"
            action={
              <Button
                variant="secondary"
                fullWidth={false}
                onClick={() => navigate('/tio/horarios', { state: { de: 'rota' } })}
              >
                Definir horários
              </Button>
            }
          />
        )}

        {/* As viagens do dia. O rótulo é a hora da PRIMEIRA porta — um
          * compromisso real, não uma janela inventada. */}
        {!loading && blocos.length > 1 && (
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
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
                  className={`tap inline-flex min-h-12 shrink-0 items-center gap-1.5 rounded-full border px-4 text-base font-semibold ${
                    ativa
                      ? 'border-text bg-text text-white'
                      : 'border-border bg-card text-textMuted'
                  }`}
                >
                  <Icone size={18} />
                  {horaCurta(deMinutos(b.inicio))}
                </button>
              );
            })}
          </div>
        )}

        {/* Viagem concluída — e quando é a próxima. Sem festa: a rota não
          * comemora; o check estala uma vez e o texto diz o que vem. */}
        {!loading && blocoAtual && !foco && (
          <div className="rota-entra space-y-2 rounded-2xl bg-card p-5 text-center shadow-rest">
            {/* `accentText`, não o limão: o limão só é fundo sobre verde ou
              * escuro (docs/design-system.md), e aqui o cartão é branco. */}
            <span className="rota-estala mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accentText text-white">
              <Check size={30} />
            </span>
            <p className="font-display text-lg font-bold text-text">Viagem concluída</p>
            {espera ? (
              <p className="text-sm text-textBody">
                Próxima parada só às{' '}
                <b className="text-text">{horaCurta(deMinutos(espera.bloco.inicio))}</b>
                {espera.minutos > 0 && ` · daqui a ${formataEspera(espera.minutos)}`}
              </p>
            ) : (
              <p className="text-sm text-textBody">Era a última viagem do dia.</p>
            )}
          </div>
        )}

        {/* A LINHA DO TEMPO. Ninguém some — quem não vai fica riscado, no
          * lugar onde estaria, pra ele não perder a referência da ordem. */}
        {!loading && blocoAtual && (
          <div>
            {linha.map((g) =>
              g.itens.length ? (
                <section key={g.grupo} className="mt-4 first:mt-0">
                  <GrupoDaLinha>{g.grupo}</GrupoDaLinha>
                  {g.itens.map((it) => (
                    <ItemDaLinha
                      key={it.chave}
                      tipo={it.tipo}
                      estado={it.estado}
                      hora={it.tipo === 'casa' ? horaCurta(it.q.hora) : null}
                      real={it.real}
                      primeiro={it === itensDaLinha[0]}
                      ultimo={it === itensDaLinha[itensDaLinha.length - 1]}
                      estala={estala(it.chave)}
                    >
                      {conteudo(it)}
                    </ItemDaLinha>
                  ))}
                </section>
              ) : null
            )}
          </div>
        )}

        {/* AVISAR AS FAMÍLIAS DESTA VIAGEM — atraso, adiantado, problema na
          * perua. Só quem ainda espera a perua recebe. */}
        {foco && (
          <AvisosDaViagem
            adminUid={user?.uid}
            criancas={fila.filter((q) => q.action).map((q) => q.child)}
            focoHora={foco.hora}
            abrirProblema={pediuProblema}
            onAbriuProblema={consumirAtalho}
          />
        )}

        {/* "MOSTRAR PIX DA PERUA" (04/10/2026): a mãe pergunta no portão, e
          * quem está com o celular pode ser a auxiliar. Só mostra a chave. */}
        {!loading && <PixDaPerua />}

        {/* Cadastro só na porta separada. Dentro do Início a operação aparece
          * com o veículo em movimento, e ali ele não vai ajustar horário. */}
        {mostrarRodape && (
          <Button
            variant="ghost"
            size="md"
            icon={Clock}
            onClick={() => navigate('/tio/horarios', { state: { de: 'rota' } })}
          >
            Horários da rota
          </Button>
        )}
      </div>

      {/* O RODAPÉ É A PARADA (03/10/2026, auditoria de UX).
        * Era o "segure para encerrar" — a ação mais rara da rota onde o
        * polegar descansa, e a mais frequente (EMBARQUEI/ENTREGUEI) no meio
        * da lista, rolando com ela. Inverteu: aqui fica o botão da parada em
        * foco, preso acima da barra de abas, e o encerrar subiu para a faixa.
        *
        * É `sticky` no fim do conteúdo, não `fixed`: rolando até o fim, ele
        * pousa no lugar dele e a última linha da viagem nunca fica por baixo
        * — o espaço que ele ocupa já é o respiro da lista. */}
      {foco && (
        <BarraDaAcao>
          <BarraDaParada
            foco={foco}
            proxima={proxima}
            busy={busy}
            gravando={gravando}
            escolasPorId={escolasPorId}
            onMarcar={() => avancarUma(foco)}
            recemMarcado={
              recemMarcado && barraTravada(recemMarcado.em, Date.now()) ? recemMarcado : null
            }
            onDesfazer={() => voltarUmPasso(recemMarcado)}
          />
        </BarraDaAcao>
      )}

      <ConfirmDialog
        open={!!confirmLote}
        title={
          confirmLote
            ? `${confirmLote.label.toLowerCase()} — ${confirmLote.count} crianças`
            : ''
        }
        description="Todas de uma vez. Se alguma faltou, você corrige na lista depois."
        // O botão repete o VERBO do que vai acontecer (design system: nunca
        // "Confirmar") — quem lê só o botão sabe o que está marcando.
        confirmLabel={confirmLote ? verboDoLote(confirmLote) : ''}
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
        description="Ela volta pra rota agora, e a falta some do app do responsável."
        confirmLabel="Voltar pra rota"
        loading={busy}
        onConfirm={() => devolverPraRota(desfazendo)}
        onCancel={() => setDesfazendo(null)}
      />

      <ConfirmDialog
        open={!!voltando}
        title={
          voltando
            ? `Voltar ${voltando.child.name.split(' ')[0]} um passo?`
            : ''
        }
        description="O aviso já enviado não volta."
        confirmLabel="Voltar um passo"
        loading={busy}
        onConfirm={() => voltarUmPasso(voltando)}
        onCancel={() => setVoltando(null)}
      />

      <ConfirmDialog
        open={!!voltandoPraCasa}
        title={
          voltandoPraCasa
            ? `Levar ${voltandoPraCasa.child.name.split(' ')[0]} de volta para casa?`
            : ''
        }
        description="A família é avisada. Depois, escreva o recado."
        confirmLabel="Levar de volta"
        loading={busy}
        onConfirm={async () => {
          const q = voltandoPraCasa;
          setBusy(true);
          setFocoEscolhido(null);
          try {
            await advanceChild(q.child.id, 'delivered', {
              driverPosition: posicaoDoDriver,
              dateKey,
              adminUid: user?.uid,
              parentUid: q.child.parentUid || null,
              childName: q.child.name,
            });
            vibrar();
            setRecadoDe({ child: q.child, tipo: 'sick' });
          } catch (err) {
            console.error(err);
            toast.error('Não deu pra marcar. Tente de novo.');
          } finally {
            setBusy(false);
            setVoltandoPraCasa(null);
          }
        }}
        onCancel={() => setVoltandoPraCasa(null)}
      />

      {/* ⚠️ "NINGUÉM EM CASA" PERGUNTA ANTES (03/10/2026). Ele agia no toque,
        * e o botão mora ao lado do "Desfazer": um polegar errado mandava a
        * criança para o fim da viagem sem ninguém ter decidido isso. */}
      <ConfirmDialog
        open={!!ninguemEmCasa}
        title={
          ninguemEmCasa
            ? `Ninguém em casa para receber ${ninguemEmCasa.child.name.split(' ')[0]}?`
            : ''
        }
        description="Vai para o fim da viagem."
        confirmLabel="Deixar para o fim"
        onConfirm={() => {
          const q = ninguemEmCasa;
          setAdiados((a) => [...new Set([...a, q.child.id])]);
          setFocoEscolhido(null);
          setNinguemEmCasa(null);
          toast(`${q.child.name.split(' ')[0]} fica para o fim da viagem.`);
        }}
        onCancel={() => setNinguemEmCasa(null)}
      />

      {recadoDe && (
        <RecadoDaRota
          key={`${recadoDe.child.id}-${recadoDe.tipo}`}
          open
          child={recadoDe.child}
          tipoInicial={recadoDe.tipo}
          adminUid={user?.uid}
          onClose={() => setRecadoDe(null)}
        />
      )}

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
    // O responsável É avisado desde 03/10/2026 (`notifyAbsence` em `marcar`).
    return 'Sai da rota hoje. Família avisada.';
  }
  if (tipo === ABSENCE_TYPES.ALREADY_PICKED) {
    return 'Já saiu com o responsável.';
  }
  return 'Não precisa buscar em casa hoje.';
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
  // ⚠️ MESMO CONSERTO. Com períodos de 24h, uma ausência declarada ontem às
  // 21h e a rota aberta hoje às 6h30 davam zero — o carimbo "ontem" não
  // aparecia, e o motorista lia a falta como recém-declarada.
  const dias = diasDeCalendario(d);
  if (dias === null || dias <= 0) return null;
  if (dias === 1) return 'ontem';
  return `há ${dias} dias`;
}

/**
 * A hora em que a criança chegou ao status ATUAL, se foi hoje. `null` quando
 * não há carimbo ou ele é de outro dia (aí o status efetivo já voltou para o
 * começo, e a hora seria de uma viagem que não é esta).
 */
function horaDoStatus(child) {
  const d = child?.statusUpdatedAt?.toDate?.();
  if (!d) return null;
  if (d.toDateString() !== new Date().toDateString()) return null;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "Embarcar os 3", "Entregar os 3 na escola", "Entregar os 3". */
function verboDoLote({ nextStatus, count }) {
  if (nextStatus === 'onboard') return `Embarcar os ${count}`;
  if (nextStatus === 'atSchool') return `Entregar os ${count} na escola`;
  return `Entregar os ${count}`;
}

/**
 * A linha que reage ao toque — ou não, quando não há o que fazer nela.
 *
 * ⚠️ JÁ FOI UMA LISTA "JÁ FEITOS" QUE COLAPSAVA A PARTIR DE QUATRO, para o
 * botão grande não descer da dobra com vinte crianças marcadas. Com a linha do
 * tempo a ordem não muda mais a cada toque, e quem garante o botão à vista é
 * a rolagem até a parada atual (`focoRef`), não o recolhimento — esconder os
 * feitos tirava a conferência de "não esqueci ninguém" justo no fim da viagem.
 */
function LinhaTocavel({ onTocar, children }) {
  const classe = 'flex min-h-14 w-full items-center gap-2.5 rounded-xl py-1.5 text-left';
  if (!onTocar) return <div className={classe}>{children}</div>;
  return (
    <button type="button" onClick={onTocar} className={`tap ${classe}`}>
      {children}
    </button>
  );
}

/**
 * O TOQUE QUE PEGOU, SENTIDO NA MÃO. Uma vibração curta a cada marcação
 * gravada: com o celular no suporte e o olho na rua, o dedo sabe que o toque
 * valeu sem ele voltar os olhos para a tela. 30 ms é um "tic", não um alarme.
 * Sem `navigator.vibrate` (iPhone, desktop) não faz nada.
 */
function vibrar() {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(30);
  } catch {
    // Vibrar é conforto; nunca derruba a marcação.
  }
}

/** Um grupo de ações do cartão em foco, com o nome escrito em cima. */
function GrupoDeAcoes({ titulo, children }) {
  return (
    <section className="space-y-2">
      <p className="text-sm font-semibold text-textMuted">{titulo}</p>
      {children}
    </section>
  );
}

/** Os botões do grupo "Corrigir" — a mesma cara para a mesma família de ação. */
function BotaoDeCorrigir({ icon: Icone, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tap inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-base font-semibold leading-tight text-text"
    >
      <Icone size={18} className="shrink-0 text-textMuted" />
      {children}
    </button>
  );
}

/**
 * O BOTÃO DA PARADA, NO RODAPÉ — 64 px, largura inteira, com o nome dentro.
 *
 * O nome no botão não é enfeite: com o foco podendo ser escolhido à mão
 * (tocando numa linha), "EMBARQUEI" sozinho não diz QUEM embarca. O verbo
 * continua sendo o do passo (`shortLabel`), nunca "Confirmar".
 *
 * Gravando, o botão DIZ que está gravando (spinner e texto) — opacidade
 * sozinha some no sol do meio-dia, e ele tocaria de novo.
 *
 * `data-tour` ILUMINA, e nunca é tocado pelo tutorial: este botão muda o
 * estado da criança e avisa a família (components/tutorial/interactiveSteps.js,
 * travado em `npm run testar:tutorial`).
 */
function BarraDaParada({
  foco, proxima, busy, gravando, escolasPorId, onMarcar, recemMarcado = null, onDesfazer,
}) {
  const nome = String(foco.child.name || '').split(' ')[0];
  // ⚠️ A TRAVA DEPOIS DE MARCAR (`barraTravada`, 1,2 s): no lugar do botão
  // da próxima criança, quem acabou de ser marcado e o "Desfazer". O botão
  // cheio só volta depois — o segundo toque apressado cai num rótulo, não
  // no EMBARQUEI de quem ainda está na calçada. Sem diálogo e sem animação.
  if (recemMarcado) {
    const marcado = String(recemMarcado.child?.name || '').split(' ')[0];
    return (
      <>
        <div
          role="status"
          className="flex h-14 w-full items-center gap-2 rounded-xl border-2 border-primaryBorder bg-card px-3"
        >
          <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 text-[17px] font-extrabold text-text">
            <span className="truncate">{marcado}</span>
            <Check size={22} className="shrink-0 text-accentText" aria-label="marcado" />
            <span aria-hidden="true" className="text-textMuted">·</span>
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={onDesfazer}
            className="tap min-h-12 shrink-0 rounded-xl border border-primaryBorder bg-card px-4 text-base font-bold text-primary"
          >
            Desfazer
          </button>
        </div>
        {proxima && <p className="mt-1.5 h-5 px-1" aria-hidden="true" />}
      </>
    );
  }
  return (
    <>
      <button
        type="button"
        data-tour="avancar-status"
        disabled={busy}
        aria-busy={gravando || undefined}
        onClick={onMarcar}
        className="tap flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-marca px-3 text-[17px] font-extrabold tracking-[0.03em] text-naMarca shadow-focus disabled:cursor-wait"
      >
        {gravando ? (
          <>
            <Spinner size={22} />
            Gravando…
          </>
        ) : (
          <>
            <Check size={24} className="shrink-0" />
            <span className="min-w-0 truncate">
              {foco.action.shortLabel} — {nome}
            </span>
          </>
        )}
      </button>
      {proxima && (
        <p className="mt-1.5 truncate px-1 text-center text-sm text-textMuted">
          {textoDaProxima(proxima, escolasPorId)}
        </p>
      )}
    </>
  );
}

/** "Depois: Sofia · 7h01", ou "Depois: Ana · Escola Sol" no passo da escola. */
function textoDaProxima(q, escolasPorId) {
  const nome = String(q.child?.name || '').split(' ')[0];
  if (lugarDoPasso(q).startsWith('escola:')) {
    const escola = escolasPorId?.[q.child?.schoolId]?.nome || q.child?.school;
    return `Depois: ${nome} · ${escola || 'na escola'}`;
  }
  const hora = horaCurta(q.hora);
  return `Depois: ${nome}${hora ? ` · ${hora}` : ''}`;
}
