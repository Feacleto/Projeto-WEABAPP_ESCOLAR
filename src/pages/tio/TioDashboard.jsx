import { saidaDaViagem, quemFicouSemRegistro } from '../../dominio/rota/focoDaViagem.js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLiveLocation } from '../../hooks/useLiveLocation';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  Clock,
  Users,
  Route,
  CircleAlert,
  AlertTriangle,
  ChevronRight,
  LayoutGrid,
  ArrowRight,
  MailWarning,
  UserPlus,
  Bus,
} from 'lucide-react';
import PedidosDeAcesso from '../../components/tio/PedidosDeAcesso';
import AvaliacaoNoInicio from '../../components/feedback/AvaliacaoNoInicio';
import { MOMENTO, PAPEL_DA_AVALIACAO, aconteceuHoje } from '../../dominio/suporte/avaliacaoRapida.js';
import Header from '../../components/layout/Header';
import Skeleton from '../../components/common/Skeleton';
import Button from '../../components/common/Button';
import SchoolBroadcastSheet from '../../components/broadcasts/SchoolBroadcastSheet';
import AbsenceListSheet from '../../components/dashboard/AbsenceListSheet';
import ControleDeRota from '../../components/route/ControleDeRota';
import ConfirmeSeuEmail from '../../components/common/ConfirmeSeuEmail';
import ParaVoce from '../../components/tio/ParaVoce';
import LinhaComunidade from '../../components/comunidade/LinhaComunidade';
import { useAuth } from '../../hooks/useAuth';
import { useChildren } from '../../hooks/useChildren';
import { usePedidosDeAcesso } from '../../hooks/usePedidosDeAcesso';
import { useEscolas } from '../../hooks/useEscolas';
import { usePaymentsByMonth } from '../../hooks/usePayments';
import { useAbsences } from '../../hooks/useAbsences';
import { getCurrentMonthKey } from '../../compartilhado/formatters';
import {
  getDateKey,
  diaCompleto,
  blocoDoMomento,
  horaCurta,
  deMinutos,
  precisaDaPerua,
  semHorarioCombinado,
  formataEspera,
} from '../../dominio/rota/horarios';
import {
  statusNaDirecao,
  getActionForStatus,
} from '../../services/routeStatusService';
import { publicarOrdemDoDia } from '../../services/ridesService';
import { greet } from '../../marca/greeting';
import MeuTransporteSheet from '../../components/tio/MeuTransporteSheet';
import { useRelogio } from '../../hooks/useRelogio';
import { diaSemRota, fraseDoDiaSemRota } from '../../dominio/rota/calendario.js';

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
 *               tela: "Iniciar a rota", na barra de baixo (03/10/2026). No
 *               meio, quem ele vai pegar.
 *   DIRIGINDO — a operação mora na aba Rota; aqui fica o cartão do que falta
 *               e o "Abrir a rota" na barra de baixo.
 *   ENTRE     — o intervalo entre as viagens é a única janela em que ele
 *               resolve pendência. Então é a pendência que aparece.
 *
 * O QUE SAIU, E POR QUÊ
 * A gaveta "Mais opções" virou linhas escritas, e depois as linhas saíram pra
 * folha "Meu transporte". NÃO é a gaveta de volta, e a diferença é a que
 * motivou a mudança: a gaveta escondia sem nome e sem lugar fixo, e sumia no
 * estado `dirigindo`. A folha tem nome escrito, mora sempre no fim da rolagem
 * — e continua alcançável COM A ROTA LIGADA.
 *
 * Esse último ponto é o motivo inteiro. O bloco de cadastro desaparecia
 * durante a rota, que é justamente quando o motorista está parado no portão
 * da escola com seis minutos livres. Pra avisar uma escola ele precisava
 * ENCERRAR a rota — o que apaga a perua do mapa de todas as famílias — e
 * ligar de novo.
 *
 * Os quatro cartões de contagem (Crianças / Ausentes / Manhã / Tarde) também
 * saíram. Eles diziam QUANTOS; a lista da viagem diz QUEM, na ordem, com quem
 * faltou já em cinza. É o mesmo dado fazendo trabalho em vez de decorar.
 *
 * E o "a receber no mês" foi APAGADO, não movido. Era previsão — soma do que
 * ainda não entrou — e o Financeiro responde melhor a mesma pergunta com dois
 * números reais: "Recebido" no topo e a lista de quem está devendo. Duas
 * superfícies pro mesmo assunto é como elas divergem.
 */

const WEEK_DAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/** "Domingo, 4 de outubro" — a data do Início numa linha só. */
function dataDoDia(d = new Date()) {
  const dia = WEEK_DAYS[d.getDay()] || '';
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)}, ${diaEMes(d)}`;
}

function diaEMes(d = new Date()) {
  return `${d.getDate()} de ${MONTHS[d.getMonth()]}`;
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
  const { pedidos } = usePedidosDeAcesso('motorista');
  const pedidosAbertos = useMemo(
    () => pedidos.filter((p) => p.status === 'aguardando'),
    [pedidos]
  );
  const { mapa: escolasPorId, escolas } = useEscolas();
  const { payments } = usePaymentsByMonth(getCurrentMonthKey());
  const todayKey = getDateKey();
  const { absences, byChildId: declaracoes } = useAbsences(todayKey);

  // O dia do cabeçalho; `useRelogio` vira a data à meia-noite sozinho.
  const agora = useRelogio();


  const [indiceAberto, setIndiceAberto] = useState(false);
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
  //
  // PELO HOOK, e não por um `onSnapshot` próprio. Esta página reimplementava
  // à mão o que `useLiveLocation` já faz — importando `firebase/firestore`
  // direto, fora da regra de camada, e abrindo uma TERCEIRA assinatura do
  // mesmo documento (ControleDeRota e OperacaoDaRota já assinam as outras
  // duas, na mesma tela). A cópia local também não tinha a guarda de "esta
  // posição é de quem eu pedi" que o hook documenta.
  const { location: minhaPosicao } = useLiveLocation(user?.uid);
  const rotaAtiva = !!minhaPosicao?.routeActive;

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

  // Quem ainda tem um passo na viagem atual — a barra mostra ao encerrar, e o
  // "faltou registrar" do fim da rota sai daqui (ver `quemFicouSemRegistro`).
  const pendentesDaViagem = useMemo(() => {
    const dir = bloco?.direcao === 'ida' ? 'pickup' : 'dropoff';
    return quemFicouSemRegistro(
      paradasPendentes(bloco).map((p) => {
        const st = statusNaDirecao(p.child, declaracoes?.[p.child.id], dir);
        return { child: p.child, status: st, hora: p.hora, action: getActionForStatus(st, dir) };
      })
    );
  }, [bloco, paradasPendentes, declaracoes]);


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

  const { atrasados, marcados } = useMemo(() => {
    let atraso = 0;
    let claimed = 0;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    for (const p of payments) {
      if (p.status === 'paid') continue;
      if (p.status === 'claimed') claimed++;
      const venc = p.dueDate?.toDate?.() || (p.dueDate ? new Date(p.dueDate) : null);
      if (venc && venc < hoje && p.status !== 'claimed') atraso++;
    }
    return { atrasados: atraso, marcados: claimed };
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
      (bloco?.paradas || [])
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
    [bloco]
  );

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
  // A FRASE DO CARTÃO VERDE — o que vem a seguir, em palavras. Nunca uma
  // previsão: é a hora COMBINADA da primeira parada, e "daqui a" só conta
  // para a frente (ver o comentário de `faltamMin` mais abaixo, na história).
  const linhaDaTurma = (() => {
    if (!blocos.length) {
      const n = semHorario.length;
      return n
        ? `Falta o horário de ${n} ${n === 1 ? 'criança' : 'crianças'} para a rota se montar.`
        : 'Combine o horário de cada criança para a rota se montar.';
    }
    if (!bloco || !pendentes.length) return 'Nenhuma viagem pendente hoje.';
    const hora = horaCurta(deMinutos(bloco.inicio));
    const quando =
      faltamMin > 1 ? ` · daqui a ${formataEspera(faltamMin)}` : faltamMin >= 0 ? ' · agora' : '';
    if (estado === 'entre') return `Próxima viagem às ${hora}${quando}.`;
    return bloco.direcao === 'ida'
      ? `A primeira parada é às ${hora}${quando}.`
      : `A saída da escola é às ${hora}${quando}.`;
  })();
  // HÁ VIAGEM PELA FRENTE HOJE? É o que decide se "Iniciar a rota" é a ação
  // principal (barra de baixo, cheia) ou a secundária (contorno no cartão).
  const temViagem = !!bloco && pendentes.length > 0;
  // O DIA ACABOU: havia viagem hoje e ninguém espera mais a perua.
  const diaConcluido = estado === 'entre' && !temViagem && blocos.length > 0;

  function iniciarEAbrir() {
    publicarOrdem();
    // A ROTA TEM TELA PRÓPRIA (03/10/2026): começou, vai para ela.
    navigate('/tio/route/now');
  }

  // A FRASE DO CARTÃO VERDE — uma coisa só, a do momento.
  const motivoSemRota = diaSemRota(agora);
  const cartaoDoDia = (() => {
    if (estado === 'vazio') return { rotulo: 'Sua turma', titulo: linhaDaTurma };
    if (motivoSemRota) return { rotulo: fraseDoDiaSemRota(motivoSemRota), titulo: 'Sem viagem hoje.' };
    if (temViagem) {
      const vao = bloco.paradas.filter((p) => precisaDaPerua(p.estado)).length;
      return {
        rotulo: 'Próxima viagem',
        titulo: `${bloco.direcao === 'ida' ? 'Ida' : 'Volta'} às ${horaCurta(deMinutos(bloco.inicio))} · ${vao} ${vao === 1 ? 'criança' : 'crianças'}`,
      };
    }
    if (diaConcluido) return { rotulo: 'Hoje', titulo: 'Tudo entregue hoje.' };
    return { rotulo: 'Hoje', titulo: 'Nenhuma viagem pendente.' };
  })();

  const primeiroNome =
    profile?.marcaNome?.trim() || profile?.name?.split(' ')[0] || 'Tio';

  // ── "PARA VOCÊ" (04/10/2026) ─────────────────────────────────────────────
  // Só existe quando ele está EM DIA — o mesmo total que esconde o "Para
  // resolver" — e fora da rota. Fica no fim, depois de "Meu transporte".
  const emDia =
    pedidosAbertos.length === 0 &&
    !(marcados > 0) &&
    !(atrasados > 0) &&
    semHorario.length === 0 &&
    !(convitesAbertos > 0) &&
    absences.length === 0;
  const paraVoce = (
    <ParaVoce
      foraDaRota={!rotaAtiva}
      emDia={emDia}
      criancas={children.length}
      familias={children.filter((c) => c?.parentUid).length}
    />
  );

  return (
    <>
      <Header title="Início" marca />

      {/* ⚠️ A AÇÃO DA ROTA MORA EMBAIXO (03/10/2026, auditoria de UX).
        *
        * Ela já foi uma barra FIXA NO TOPO — com a rota ligada, ali morava o
        * "segure para encerrar". O topo é onde o olho lê "onde estou", não
        * onde o polegar alcança. Agora a ação principal fica numa barra presa
        * acima das abas (`BarraDoInicio`, no fim desta tela): "Iniciar a
        * rota" antes de sair, "Abrir a rota" com ela rodando.
        *
        * ⚠️ E O ENCERRAR SAIU DO INÍCIO. A rota tem aba própria, e a tela
        * dela tem o encerrar na faixa verde. Dois "encerrar" em duas telas
        * faziam ele perguntar qual era o de verdade.
        *
        * O que fica aqui, com a rota rodando, é o controle OCULTO: ele não
        * desenha nada e só religa o GPS se o app recarregou no meio da rota
        * e abriu direto no Início — sem ele, o GPS só voltaria quando ele
        * tocasse na aba Rota. */}
      {estado === 'dirigindo' && (
        <ControleDeRota
          oculto
          direcao={bloco?.direcao}
          alvos={alvosDaRota}
          saida={saidaDaViagem(bloco)}
          pendentes={pendentesDaViagem}
        />
      )}

      <div className="pb-4">
        {/* Saudação — pequena, contexto. Durante a rota ela sai: o topo da
          * tela é caro demais pra gastar com cortesia enquanto ele dirige. */}
        {estado !== 'dirigindo' && (
          <div className="px-5 pt-5">
            {/* O DIA EM DUAS LINHAS (04/10/2026, decisão do dono): o nome e,
              * embaixo, a data numa linha só. A hora em letra de máquina e o
              * botão festivo saíram: o Início ficou com quatro blocos. */}
            <h1 className="text-[28px] font-extrabold leading-tight text-text">
              {greet(new Date())}, {primeiroNome}!
            </h1>
            <p className="mt-1 text-base text-textBody">{dataDoDia(agora)}</p>
            {/* ⚠️ TURMA VAZIA: O CADASTRO VEM LOGO DEPOIS DA SAUDAÇÃO
              * (04/10/2026). Ele morava embaixo do "Confirme seu e-mail" e dos
              * avisos do nível, e no celular pequeno caía abaixo da dobra —
              * a única ação da tela, escondida. É o protagonista: verde cheio
              * e a sombra colorida da tela. */}
            {estado === 'vazio' && children.length === 0 && (
              <div
                data-tour="hero"
                className="mt-4 bg-card shadow-rest rounded-2xl p-5 text-center"
              >
                <p className="font-bold text-text">
                  Sua turma ainda está vazia
                </p>
                {/* COMEÇA PELA CRIANÇA, NÃO PELA ESCOLA (02/10/2026). Era
                  * "Começar pela escola", porque a criança dependia de uma
                  * escola já cadastrada — e quem começava pela criança perdia
                  * o que tinha digitado ao sair para criar a escola. Agora a
                  * escola nasce num popup dentro do cadastro da criança. */}
                <Button
                  data-tour="primeira-crianca"
                  onClick={() => navigate('/tio/children/new')}
                  icon={UserPlus}
                  className="mt-4 shadow-focus"
                >
                  Cadastrar criança
                </Button>
              </div>
            )}
            {/* Lembrete, nunca portão: some sozinho depois de confirmar. */}
            <ConfirmeSeuEmail className="mt-4" />
            {/* OS AVISOS DE NÍVEL SAÍRAM DAQUI (04/10/2026): o do Bronze e o do
              * prazo da Platina moram agora no "Para você", no fim da tela.
              * Só um lugar fala de nível, e o topo fica com o dia dele. */}
          </div>
        )}

        {/* CADASTRAR NO TOPO SÓ ENQUANTO A ROTA NÃO SE MONTOU (04/10/2026).
          * Ele era fixo aqui em todo estado (03/10/2026), e antes e entre as
          * viagens competia com o "Iniciar a rota" — dois botões grandes
          * pedindo o mesmo polegar. Com a turma de pé, cadastrar continua a
          * um toque pela Minha turma (Meu transporte); aqui ele fica só
          * quando há criança e ainda não há rota (falta o horário). Nunca
          * dirigindo. */}
        {estado === 'vazio' && children.length > 0 && (
          <div className="px-5 pt-4">
            <button
              type="button"
              onClick={() => navigate('/tio/children/new')}
              className="tap flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-primary bg-card text-base font-bold text-primary"
            >
              <UserPlus size={19} />
              Cadastrar criança
            </button>
          </div>
        )}

        {/* ─────────── DIRIGINDO — a home é a operação ─────────── */}
        {estado === 'dirigindo' && (
          <>
            {/* A OPERAÇÃO MORA NA ABA ROTA (03/10/2026). Aqui fica só o que
              * leva até ela — duas telas iguais faziam ele perguntar qual era
              * a de verdade. O cartão é INFORMAÇÃO (o que falta nesta
              * viagem); o toque é o "Abrir a rota" da barra de baixo. */}
            {/* ⚠️ UM SÓ VERDE CHEIO (04/10/2026): o cartão também era verde e
              * também abria a rota — dois botões iguais para o mesmo lugar.
              * Virou só leitura (branco, sem toque); quem leva é o "Abrir a
              * rota" da barra de baixo. */}
            <div className="px-5 pt-5">
              <div
                data-cartao="rota-em-andamento"
                className="flex w-full items-center gap-3 rounded-2xl bg-card p-4 text-left shadow-rest"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primaryChip text-primary">
                  <Bus size={24} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-bold text-text">Rota em andamento</span>
                  <span className="block text-base text-textBody">
                    {pendentesDaViagem.length
                      ? `Faltam ${pendentesDaViagem.length} nesta viagem`
                      : 'Nada pendente nesta viagem'}
                  </span>
                </span>
              </div>
            </div>
            {/* O CADASTRO DEIXA DE SUMIR DURANTE A ROTA.
              * Ele sumia inteiro neste estado — e a rota é justamente quando o
              * motorista fica parado no portão da escola com seis minutos
              * livres. Pra avisar uma escola ele tinha que ENCERRAR a rota, o
              * que apaga a perua do mapa de todas as famílias, e ligar de
              * novo. Uma linha de 56px no fim da rolagem é o preço de não ter
              * mais esse buraco. */}
            <div className="px-5 pt-2">
              <LinhaMeuTransporte
                dirigindo
                onClick={() => setIndiceAberto(true)}
              />
            </div>
          </>
        )}

        {/* ─────────── O CARTÃO VERDE — a turma e o próximo passo ───────────
          * Desde 04/10/2026 (decisão do dono) ele diz UMA coisa — a próxima
          * viagem, ou que hoje não tem, ou que o dia acabou — e leva a "Minha
          * rota" (`/tio/rota`), onde moram a lista de quem vai, a escola, a
          * chave do mapa e o "Rodar mesmo assim". Leitura, nunca o botão
          * cheio: o verde cheio da tela é o "Iniciar a rota" da barra. */}
        {(estado === 'antes' || estado === 'entre' || (estado === 'vazio' && children.length > 0)) && (
          <div className="px-5 pt-4">
            {/* Na COR VIVA da marca (04/10/2026), com a letra que lê nela. */}
            <section data-tour="hero" className="rounded-2xl bg-gradient-to-br from-marca to-marcaEscuro p-5 text-naMarca shadow-rest">
              <p className="rotulo !text-naMarca opacity-80">{cartaoDoDia.rotulo}</p>
              <p className="mt-1.5 font-display text-[24px] font-extrabold leading-tight text-naMarca">
                {cartaoDoDia.titulo}
              </p>
              {estado === 'vazio' ? (
                <button
                  type="button"
                  onClick={() => navigate('/tio/horarios')}
                  className="tap mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-accent text-base font-bold text-onAccent"
                >
                  Definir horários
                  <ArrowRight size={20} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate('/tio/rota')}
                  className="tap mt-4 inline-flex min-h-12 items-center gap-2 rounded-xl border border-naMarca/30 bg-naMarca/10 px-4 text-base font-bold text-naMarca"
                >
                  <Route size={19} aria-hidden="true" />
                  Abrir rota
                </button>
              )}
            </section>
          </div>
        )}

        {/* PARA RESOLVER — um bloco só, com o número (design system,
          * 03/10/2026). Os pedidos de acesso ficavam soltos no topo e as
          * outras pendências só apareciam ENTRE viagens; agora tudo o que
          * pede um toque dele mora aqui, em qualquer momento fora da rota.
          * O pedido de acesso vem primeiro: a mãe está esperando do outro
          * lado, com o app travado até ele responder. */}
        {estado !== 'dirigindo' && estado !== 'carregando' && (
          <ParaResolver
            className="px-5 pt-5"
            pedidos={pedidosAbertos}
            criancas={children}
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
            {/* O CARTÃO BRANCO DA "PRÓXIMA VIAGEM" SAIU (03/10/2026). A hora
              * e o "daqui a" foram para o cartão verde, e o PRÓXIMO da fila é
              * a primeira linha da lista abaixo — duas telas dizendo a mesma
              * coisa faziam ele procurar qual era a certa. */}

            <LinhaMeuTransporte onClick={() => setIndiceAberto(true)} />
            <LinhaComunidade />
          </div>
        )}

        {/* ─────────── ENTRE — a janela das pendências ─────────── */}
        {estado === 'entre' && (
          <div className="px-5 pt-4 space-y-4">


            {/* A AVALIAÇÃO RÁPIDA — depois de encerrar a rota de hoje, e nunca
              * com ela rodando (dominio/suporte/avaliacaoRapida.js). */}
            <AvaliacaoNoInicio
              papel={PAPEL_DA_AVALIACAO.MOTORISTA}
              momento={MOMENTO.FIM_DA_ROTA}
              momentoHoje={aconteceuHoje(profile?.ultimaRota)}
              rotaRodando={rotaAtiva}
            />

            <LinhaMeuTransporte onClick={() => setIndiceAberto(true)} />
            <LinhaComunidade />
            {paraVoce}
          </div>
        )}

        {/* ─────────── VAZIO — ainda não há de onde tirar rota ─────────── */}
        {estado === 'vazio' && children.length === 0 && (
          <div className="px-5 pt-4">
            <LinhaMeuTransporte onClick={() => setIndiceAberto(true)} />
          </div>
        )}
        {estado === 'vazio' && children.length > 0 && (
          <div className="px-5 pt-4 space-y-4">
            <LinhaMeuTransporte onClick={() => setIndiceAberto(true)} />
            <LinhaComunidade />
            {paraVoce}
          </div>
        )}
      </div>

      {/* A BARRA DE BAIXO — a ação principal, onde o polegar descansa. */}
      {estado === 'dirigindo' && (
        <BarraDoInicio>
          <button
            type="button"
            onClick={() => navigate('/tio/route/now')}
            className="tap flex h-16 w-full items-center justify-center gap-2 rounded-xl bg-marca px-3 text-lg font-extrabold text-naMarca shadow-focus"
          >
            <Bus size={24} />
            Abrir a rota
            <ArrowRight size={22} />
          </button>
        </BarraDoInicio>
      )}
      {/* SÓ EM DIA DE ROTA (04/10/2026): no domingo ou feriado a barra some, e
        * o "Rodar mesmo assim" mora em "Minha rota". */}
      {(estado === 'antes' || estado === 'entre') && temViagem && !motivoSemRota && (
        <BarraDoInicio>
          <ControleDeRota
            parte="botao"
            onIniciar={iniciarEAbrir}
            direcao={bloco?.direcao}
            alvos={alvosDaRota}
            saida={saidaDaViagem(bloco)}
            pendentes={pendentesDaViagem}
          />
        </BarraDoInicio>
      )}


      {/* O ÍNDICE. As contagens vão por prop: esta tela já assina `children`
        * e `escolas`, e reassinar dentro da folha abriria duas leituras
        * permanentes do mesmo dado — permanentes porque o hook roda com a
        * folha fechada — e duas fontes que podem discordar por um instante. */}
      <MeuTransporteSheet
        open={indiceAberto}
        onClose={() => setIndiceAberto(false)}
        onBroadcast={() => setBroadcastOpen(true)}
        onTutorial={() => openTutorial?.()}
        criancas={children.length}
        escolas={escolas.length}
        semHorario={semHorario.length}
        rotaRodando={rotaAtiva}
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

function ParaResolver({
  className = '',
  pedidos, criancas,
  semHorario, convitesAbertos, atrasados, marcados, ausentes,
  onHorarios, onCriancas, onFinanceiro, onAusentes,
}) {
  const itens = [];
  if (marcados > 0) {
    itens.push({
      icon: AlertTriangle,
      titulo: marcados === 1 ? '1 família avisou que pagou' : `${marcados} famílias avisaram que pagaram`,
      sub: 'Conferir e dar baixa',
      onClick: onFinanceiro,
    });
  }
  if (atrasados > 0) {
    itens.push({
      icon: CircleAlert,
      titulo: `${atrasados} ${atrasados === 1 ? 'mensalidade atrasada' : 'mensalidades atrasadas'}`,
      sub: 'Ver no financeiro',
      onClick: onFinanceiro,
    });
  }
  if (semHorario > 0) {
    itens.push({
      icon: Clock,
      titulo: `${semHorario} ${semHorario === 1 ? 'criança sem horário' : 'crianças sem horário'}`,
      // O nome da tela é o mesmo em todo lugar: "Horários da rota".
      sub: 'Definir horário',
      onClick: onHorarios,
    });
  }
  if (convitesAbertos > 0) {
    itens.push({
      icon: MailWarning,
      titulo: `${convitesAbertos} ${convitesAbertos === 1 ? 'família ainda não entrou' : 'famílias ainda não entraram'}`,
      sub: 'Mande o convite de novo',
      onClick: onCriancas,
    });
  }
  if (ausentes > 0) {
    itens.push({
      icon: Users,
      titulo: `${ausentes} ${ausentes === 1 ? 'falta avisada hoje' : 'faltas avisadas hoje'}`,
      sub: 'Ver quem não vai',
      onClick: onAusentes,
    });
  }
  const total = pedidos.length + itens.length;
  if (!total) return null;

  return (
    <section className={`space-y-2.5 ${className}`}>
      <p className="flex items-center justify-between px-1 text-sm font-semibold text-textMuted">
        <span>Para resolver</span>
        <span className="tabular-nums">{total}</span>
      </p>
      <PedidosDeAcesso pedidos={pedidos} criancas={criancas} />
      {itens.map((i) => (
        <button
          key={i.titulo}
          type="button"
          onClick={i.onClick}
          className="tap flex min-h-16 w-full items-center gap-3 rounded-2xl border border-warningBorder bg-warningSoft p-3.5 text-left"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warningChip text-warningText">
            <i.icon size={19} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-bold leading-snug text-text">{i.titulo}</span>
            <span className="block text-sm text-textBody">{i.sub}</span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-warningText" />
        </button>
      ))}
    </section>
  );
}

/* ─────────────── cadastro, escrito e visível ─────────────── */


/**
 * A LINHA QUE ABRE O ÍNDICE.
 *
 * Ela existe em TODOS os estados do Início — inclusive "dirigindo", e esse é
 * o ponto inteiro da mudança. O bloco de cadastro antigo sumia durante a
 * rota, e a rota é justamente quando ele está parado no portão da escola com
 * seis minutos livres.
 *
 * Fica no FIM da rolagem em todos os estados: é destino de quem terminou de
 * ler o que a tela tinha a dizer, não competidor do assunto de agora.
 *
 * `tour="turma"` mora aqui porque o tutorial precisa de um alvo VISÍVEL — e
 * "Minha turma" agora está dentro de uma folha fechada. Passo que aponta pra
 * elemento escondido não quebra: vira um balão no rodapé e o tutorial segue,
 * ensinando sem mostrar. Já aconteceu duas vezes neste projeto.
 */
function LinhaMeuTransporte({ onClick, dirigindo = false }) {
  return (
    <button
      type="button"
      data-tour="turma"
      onClick={onClick}
      className="tap w-full min-h-14 text-left bg-card border border-border rounded-xl px-3 py-3 flex items-center gap-3"
    >
      <div className="w-10 h-10 rounded-lg bg-primaryChip text-primary flex items-center justify-center shrink-0">
        <LayoutGrid size={20} />
      </div>
      <span className="flex-1 min-w-0">
        <span className="block text-base font-semibold text-text truncate">
          Meu transporte
        </span>
        {/* Só dirigindo há subtítulo (04/10/2026, textos curtos): responde a
          * pergunta do momento — dá pra avisar a escola sem encerrar a rota. */}
        {dirigindo && (
          <span className="block text-sm text-textMuted truncate">Avisar a escola</span>
        )}
      </span>
      <ChevronRight size={16} className="text-textMuted shrink-0" />
    </button>
  );
}

/**
 * A BARRA DE BAIXO DO INÍCIO — a ação principal presa acima das abas.
 *
 * Mesma forma e mesmo lugar do rodapé da tela da rota (o botão da parada):
 * a ação do momento mora onde o polegar descansa, e a tela de cima fica para
 * LER — onde estou, quem vai, que horas.
 *
 * `sticky` no fim do conteúdo, não `fixed`: rolando até o fim ela pousa no
 * lugar dela, e o último cartão nunca fica escondido por baixo.
 */
function BarraDoInicio({ children }) {
  return (
    <div
      className="sticky z-20 mx-3 mt-2 rounded-2xl bg-card p-2 shadow-float"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.75rem)' }}
    >
      {children}
    </div>
  );
}

