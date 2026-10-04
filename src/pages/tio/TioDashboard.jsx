import { saidaDaViagem, quemFicouSemRegistro } from '../../dominio/rota/focoDaViagem.js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLiveLocation } from '../../hooks/useLiveLocation';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  Clock,
  Users,
  School,
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
import ReviewNudge from '../../components/feedback/ReviewNudge';
import Header from '../../components/layout/Header';
import Avatar from '../../components/common/Avatar';
import Skeleton from '../../components/common/Skeleton';
import Button from '../../components/common/Button';
import SchoolBroadcastSheet from '../../components/broadcasts/SchoolBroadcastSheet';
import AbsenceListSheet from '../../components/dashboard/AbsenceListSheet';
import ControleDeRota from '../../components/route/ControleDeRota';
import ResumoDaTurma from '../../components/tio/ResumoDaTurma';
import ConfirmeSeuEmail from '../../components/common/ConfirmeSeuEmail';
import AvisoDoBronze from '../../components/nivel/AvisoDoBronze';
import CartaoPrazoPlatina from '../../components/nivel/CartaoPrazoPlatina';
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
  ROTULO_ESTADO,
  formataEspera,
} from '../../dominio/rota/horarios';
import {
  statusNaDirecao,
  getActionForStatus,
} from '../../services/routeStatusService';
import { publicarOrdemDoDia } from '../../services/ridesService';
import { greet } from '../../marca/greeting';
import { ChildDetailSheet } from '../ChildDetail';
import MeuTransporteSheet from '../../components/tio/MeuTransporteSheet';
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

// O DIA EM TRÊS LINHAS (03/10/2026, pedido do dono): "Hoje é sábado", embaixo
// "3 de outubro", embaixo a hora. Numa linha só, em letra miúda ("SÁBADO, 3 DE
// OUTUBRO · 20:51"), o dia da semana — que é o que decide se tem rota — se
// perdia no meio da data.
function diaDaSemana(d = new Date()) {
  return `Hoje é ${WEEK_DAYS[d.getDay()]}`;
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

  // A hora do cabeçalho, andando de minuto em minuto.
  const agora = useRelogio();
  const horaAgora = agora.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Qual criança está com a ficha aberta. `null` = nenhuma.
  const [fichaDe, setFichaDe] = useState(null);

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
  const rotuloDaTurma =
    bloco && pendentes.length
      ? `Próxima viagem · ${bloco.direcao === 'ida' ? 'ida' : 'volta'}`
      : 'Sua turma';

  // A VIAGEM NO CARTÃO VERDE (design system, 03/10/2026): nome, intervalo das
  // paradas combinadas, escolas e os rostos de quem vai — quem está fora hoje
  // (falta, o pai leva ou busca) fica na mesma fila, apagado. Sem viagem
  // pendente, o cartão volta a contar a turma.
  const viagemDoCartao = useMemo(() => {
    if (!bloco || !pendentes.length) return null;
    const ini = horaCurta(deMinutos(bloco.inicio));
    const fim = horaCurta(deMinutos(bloco.fim));
    const rostos = bloco.paradas.map((p) => ({
      child: p.child,
      fora: !precisaDaPerua(p.estado),
    }));
    return {
      titulo: bloco.direcao === 'ida' ? 'Levando pra escola' : 'Trazendo pra casa',
      horario: bloco.fim > bloco.inicio ? `${ini} → ${fim}` : ini,
      escolas: bloco.escolas?.length || 0,
      rostos,
      vao: rostos.filter((r) => !r.fora).length,
      faltam: rostos.filter((r) => r.fora).length,
    };
  }, [bloco, pendentes.length]);
  const linhaDaViagem =
    faltamMin > 1
      ? `Começa daqui a ${formataEspera(faltamMin)}.`
      : faltamMin >= 0
        ? 'Começa agora.'
        : null;

  const primeiroNome =
    profile?.marcaNome?.trim() || profile?.name?.split(' ')[0] || 'Tio';

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
        * isso a barra ficaria por baixo do relógio e da bateria.
        *
        * ⚠️ MAS NÃO COM A TURMA VAZIA (02/10/2026). Sem criança com horário
        * não há rota para iniciar, e o maior botão da tela era "INICIAR ROTA"
        * acima de "Cadastrar a primeira criança" — o próximo passo de verdade
        * ficava em segundo plano, e a chave "as famílias veem sua perua"
        * falava de famílias que ainda não existem. Achado do teste no
        * navegador (M1). Enquanto carrega também não aparece: piscar o botão
        * para depois tirá-lo é pior que chegar um instante depois. */}
      {/* ⚠️ PARADO, O BOTÃO MORA NO CARTÃO VERDE (03/10/2026, design system).
        * A barra fixa continua só com a rota LIGADA: é ali que o "Encerrar"
        * não pode rolar para fora da vista. Parado, o botão é o primeiro
        * bloco da tela, logo abaixo da saudação — sempre à vista ao abrir o
        * app, que era o que a barra fixa garantia. */}
      {estado === 'dirigindo' && (
        <div
          className="sticky z-10 bg-bg px-5 pt-3 pb-3 border-b border-neutro"
          style={{ top: 'calc(3.5rem + env(safe-area-inset-top, 0px))' }}
        >
          <ControleDeRota
            direcao={bloco?.direcao}
            alvos={alvosDaRota}
            saida={saidaDaViagem(bloco)}
            pendentes={pendentesDaViagem}
          />
        </div>
      )}

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
            <div className="leading-snug">
              <p className="text-[17px] font-bold text-primary">{diaDaSemana(agora)}</p>
              <p className="text-[15px] text-textBody">{diaEMes(agora)}</p>
              <p className="font-mono text-[15px] font-semibold tabular-nums text-textBody">
                {horaAgora}
              </p>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <h1 className="text-[28px] font-extrabold text-text leading-tight flex-1 min-w-0">
                {greet(new Date())}, {primeiroNome}!
              </h1>
              <FestiveBadge />
            </div>
            {/* Lembrete, nunca portão: some sozinho depois de confirmar. */}
            <ConfirmeSeuEmail className="mt-4" />
            {/* OS NÍVEIS (docs/niveis.md): o aviso único do Bronze e o
              * prazo da Platina — nunca dirigindo, porque este bloco some
              * com a rota rodando. */}
            <AvisoDoBronze className="mt-4" />
            <CartaoPrazoPlatina className="mt-4" />
          </div>
        )}

        {/* CADASTRAR SEMPRE À MÃO, NO TOPO (03/10/2026, pedido do dono). A
          * turma cresce o ano inteiro — a família nova chega no meio da
          * semana, no portão —, e o caminho para cadastrar morava dentro de
          * "Meu transporte" ou só aparecia com a turma vazia. Com a turma
          * vazia ele não aparece aqui: o cartão "Cadastrar a primeira
          * criança" já é o centro da tela. */}
        {children.length > 0 && (
          <div className="px-5 pt-4">
            <button
              type="button"
              onClick={() => navigate('/tio/children/new')}
              className="tap flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-primary bg-card text-base font-bold text-primary"
            >
              <UserPlus size={19} />
              Cadastrar nova criança
            </button>
          </div>
        )}

        {/* ─────────── DIRIGINDO — a home é a operação ─────────── */}
        {estado === 'dirigindo' && (
          <>
            {/* A OPERAÇÃO MORA NA ABA ROTA (03/10/2026). Aqui fica só o que
              * leva até ela — duas telas iguais faziam ele perguntar qual era
              * a de verdade. */}
            <div className="px-5 pt-5">
              <button
                type="button"
                onClick={() => navigate('/tio/route/now')}
                className="tap flex w-full items-center gap-3 rounded-2xl bg-primary p-4 text-left text-white shadow-focus"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
                  <Bus size={22} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-bold">Rota em andamento</span>
                  <span className="block text-sm text-white/85">
                    {pendentesDaViagem.length
                      ? `${pendentesDaViagem.length} ${pendentesDaViagem.length === 1 ? 'criança ainda tem' : 'crianças ainda têm'} um passo nesta viagem`
                      : 'Nada pendente nesta viagem'}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-bold">Abrir</span>
              </button>
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
          * Aparece assim que existe a primeira criança, e os números crescem
          * conforme ele cadastra (pedido do dono). Com a turma vazia, quem
          * fala é o cartão de "Cadastrar a primeira criança", mais abaixo. */}
        {(estado === 'antes' || estado === 'entre' || (estado === 'vazio' && children.length > 0)) && (
          <div className="px-5 pt-4">
            <ResumoDaTurma
              rotulo={rotuloDaTurma}
              criancas={children.length}
              escolas={escolas.length}
              viagem={viagemDoCartao}
              linha={viagemDoCartao ? linhaDaViagem : linhaDaTurma}
            >
              {estado === 'vazio' ? (
                <button
                  type="button"
                  onClick={() => navigate('/tio/horarios')}
                  className="tap flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-accent text-base font-bold text-onAccent"
                >
                  Definir os horários
                  <ArrowRight size={20} />
                </button>
              ) : (
                <ControleDeRota
                  destaque
                  onIniciar={() => {
                    publicarOrdem();
                    // A ROTA TEM TELA PRÓPRIA (03/10/2026): começou, vai para ela.
                    navigate('/tio/route/now');
                  }}
                  direcao={bloco?.direcao}
                  alvos={alvosDaRota}
                  saida={saidaDaViagem(bloco)}
                  pendentes={pendentesDaViagem}
                />
              )}
            </ResumoDaTurma>
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

            <ListaDaViagem bloco={bloco} onAbrirFicha={setFichaDe} />
            <LinhaMeuTransporte onClick={() => setIndiceAberto(true)} />
          </div>
        )}

        {/* ─────────── ENTRE — a janela das pendências ─────────── */}
        {estado === 'entre' && (
          <div className="px-5 pt-4 space-y-4">


            <ReviewNudge />

            <LinhaMeuTransporte onClick={() => setIndiceAberto(true)} />
          </div>
        )}

        {/* ─────────── VAZIO — ainda não há de onde tirar rota ─────────── */}
        {estado === 'vazio' && children.length === 0 && (
          <div className="px-5 pt-4 space-y-4">
            <div
              data-tour="hero"
              className="bg-card shadow-rest rounded-2xl p-6 text-center"
            >
              <div className="w-14 h-14 rounded-xl bg-primaryChip text-primary flex items-center justify-center mx-auto">
                <Users size={26} />
              </div>
              <p className="font-bold text-text mt-3">
                Sua turma ainda está vazia
              </p>
              <p className="text-sm text-textMuted mt-1 max-w-xs mx-auto">
                Cadastre as crianças e a hora que você combinou com cada
                família. A rota se monta a partir disso.
              </p>
              {/* COMEÇA PELA CRIANÇA, NÃO PELA ESCOLA (02/10/2026). Era
                * "Começar pela escola", porque a criança dependia de uma escola
                * já cadastrada — e quem começava pela criança perdia o que
                * tinha digitado ao sair para criar a escola. Agora a escola
                * nasce num popup dentro do cadastro da criança. */}
              <Button
                data-tour="primeira-crianca"
                onClick={() => navigate('/tio/children/new')}
                icon={UserPlus}
                className="mt-4"
              >
                Cadastrar a primeira criança
              </Button>
            </div>

            <LinhaMeuTransporte onClick={() => setIndiceAberto(true)} />
          </div>
        )}
        {estado === 'vazio' && children.length > 0 && (
          <div className="px-5 pt-4">
            <LinhaMeuTransporte onClick={() => setIndiceAberto(true)} />
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
      <p className="rotulo px-1">
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
              fora ? 'bg-sunken border-border opacity-70' : 'bg-card border-border'
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
                <span className="block text-xs text-warningText font-medium">
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
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-escolaSoft border border-escolaBorder">
      <span className="rotulo w-11 shrink-0 text-escola">
        depois
      </span>
      <School size={15} className="text-escola shrink-0" />
      <span className="flex-1 min-w-0 text-sm font-semibold text-escola truncate">
        {escolas.map((e) => e.nome).join(' · ')}
      </span>
    </div>
  );
}

/* ─────────────── pendências do intervalo ─────────────── */

/**
 * PARA RESOLVER — o que pede um toque dele, com o número no título.
 *
 * Só aparece o que EXISTE. Uma lista de pendências que mostra zeros é uma
 * lista que ele aprende a não ler. A ordem é de quem está esperando: o pedido
 * de acesso (a mãe com o app travado), o dinheiro que alguém disse ter
 * mandado, o atraso, e só depois o que é cadastro.
 *
 * Âmbar porque é aviso — algo para atender (design system, regra 1).
 */
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
      sub: 'Confira se caiu e dê baixa',
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
      sub: 'Sem horário, a criança não entra na rota',
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
      <p className="rotulo flex items-center justify-between px-1">
        <span>para resolver</span>
        <span className="tabular-nums">{total}</span>
      </p>
      <PedidosDeAcesso pedidos={pedidos} criancas={criancas} />
      {itens.map((i) => (
        <button
          key={i.titulo}
          type="button"
          onClick={i.onClick}
          className="tap flex w-full items-center gap-3 rounded-2xl border border-warningBorder bg-warningSoft p-3.5 text-left"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warningChip text-warningText">
            <i.icon size={19} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-text">{i.titulo}</span>
            <span className="block text-xs text-textBody">{i.sub}</span>
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
      className="tap w-full text-left bg-card border border-border rounded-xl px-3 py-3 flex items-center gap-3"
    >
      <div className="w-8 h-8 rounded-lg bg-primaryChip text-primary flex items-center justify-center shrink-0">
        <LayoutGrid size={16} />
      </div>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-text truncate">
          Meu transporte
        </span>
        {/* O subtítulo MUDA durante a rota, e é a única coisa que muda. Fora
          * de rota ele é um sumário; dirigindo, responde a pergunta do
          * momento — e é a resposta que o motorista não tinha: sim, dá pra
          * avisar a escola sem encerrar a rota. */}
        <span className="block text-xs text-textMuted truncate">
          {dirigindo
            ? 'Dá pra avisar a escola aqui mesmo'
            : 'Turma, escolas, rota padrão, avisos'}
        </span>
      </span>
      <ChevronRight size={16} className="text-textMuted shrink-0" />
    </button>
  );
}


