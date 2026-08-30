/**
 * O DIA DO MOTORISTA — uma lista de paradas ordenada pela hora.
 *
 * POR QUE NÃO EXISTE MAIS "TURNO" NEM "CORRIDA"
 * O modelo antigo tinha três períodos fixos (manhã 4–9, tarde 11–14, noite
 * 16–19) × duas direções = seis turnos. Ele quebrava em lugares que aparecem
 * na primeira semana de operação: quem sai 12h e quem sai 13h30 caíam na mesma
 * fila sendo duas viagens; quem sai 15h não caía em período nenhum
 * (`getCurrentPeriod` devolvia null entre 14h e 16h); e o motorista tinha que
 * traduzir hora → período de cabeça em todo cadastro.
 *
 * A tentativa seguinte foi agrupar por "corrida" com uma janela de tempo
 * (06:00–07:30). Foi descartada por um motivo melhor que os anteriores: essa
 * janela era um compromisso que ninguém tinha feito. O motorista combinou
 * 6h20 com a mãe da Ana — a janela era andaime de agrupamento aparecendo na
 * tela como se fosse prazo, e prazo inventado gera ansiedade.
 *
 * O QUE SOBROU
 * O compromisso real: cada criança tem a hora em que o motorista pega em casa
 * e a hora em que entrega em casa, combinadas com o pai, uma a uma. O dia é
 * essas horas em ordem. Os blocos de viagem APARECEM sozinhos, como o buraco
 * entre a última parada da manhã e a primeira do meio-dia — eles são visíveis
 * sem precisar existir como entidade.
 *
 * E toda uma classe de bug morreu junto: não há lista de membros salva, então
 * não há como uma criança que mudou de horário ficar em duas filas, nem como
 * uma criança nova não aparecer em nenhuma. A fila é "toda criança ativa com
 * horário, ordenada pela hora". Não existe array pra envelhecer.
 */

/**
 * ESTE ARQUIVO NÃO IMPORTA NADA. É de propósito.
 *
 * A primeira versão importava `ABSENCE_TYPES` de `absencesService`, que puxa
 * `firebase/firestore` e a config junto. Isso tornaria o modelo do dia
 * impossível de testar sem inicializar o Firebase — e o teste é justamente o
 * que torna seguro trocar de modelo, coisa que já aconteceu duas vezes aqui.
 *
 * Os três valores abaixo espelham `ABSENCE_TYPES`. São strings gravadas no
 * banco: mudá-las quebraria os documentos existentes, então elas são estáveis
 * por construção, não por disciplina.
 */
const TIPO_FALTA_CHEIA = 'full';
const TIPO_SEM_IDA = 'no-pickup';
const TIPO_SEM_VOLTA = 'no-dropoff';
const TIPO_JA_PEGOU = 'picked-up';

// ============================================================================
// Datas e horas
// ============================================================================

/**
 * A chave do dia, 'YYYY-MM-DD', em hora LOCAL.
 *
 * Veio de `routePlanService`, que morreu junto com os turnos. Local e não UTC
 * de propósito: à noite no Brasil o UTC já virou o dia seguinte, e a rota da
 * noite passaria a gravar ausência no dia errado.
 */
export function getDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Aceita '7:00', '07:00', '7h00', '0700', ' 7 : 00 ' → '07:00'.
 * Lixo vira null, nunca 0 — mesma lição do `toCoord` em childrenService:
 * completar o silêncio com um chute é como o dado nasce errado sem ninguém ver.
 */
export function normalizaHora(valor) {
  if (valor == null) return null;
  const s = String(valor).trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\s*[:hH]?\s*(\d{2})?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] == null ? 0 : Number(m[2]);
  if (!Number.isInteger(h) || h < 0 || h > 23) return null;
  if (!Number.isInteger(min) || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/**
 * '07:30' → 450.
 * Comparar hora como STRING ordena '13:00' antes de '7:00'. Toda ordenação
 * deste arquivo passa por aqui justamente por isso.
 */
export function emMinutos(hhmm) {
  const n = normalizaHora(hhmm);
  if (n == null) return null;
  const [h, m] = n.split(':').map(Number);
  return h * 60 + m;
}

/** 450 → '07:30'. Aceita negativo e passa da meia-noite sem explodir. */
export function deMinutos(min) {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** '06:20' → '6h20'; '07:00' → '7h'. Pra ler em voz alta, não pra ordenar. */
export function horaCurta(hhmm) {
  const n = normalizaHora(hhmm);
  if (!n) return '';
  const [h, m] = n.split(':');
  return m === '00' ? `${Number(h)}h` : `${Number(h)}h${m}`;
}

// ============================================================================
// O horário que o motorista define — e que o pai lê
// ============================================================================
//
// Chamava-se "o combinado com o pai", e o nome descrevia um acordo que não
// existe. Quem define é o MOTORISTA: o horário sai da rota inteira (ordem das
// crianças, distância, trânsito), e o responsável não tem nenhuma dessas
// informações pra negociar. Ele precisa saber a hora de estar na porta.
//
// O nome importava porque virava texto de tela: a interface pedia ao motorista
// pra "confirmar o que combinou" e ao pai pra "combinar com ele", e nenhum dos
// dois tinha o que fazer com essa instrução.

export const CAMPO_DA_DIRECAO = { ida: 'horaPega', volta: 'horaEntrega' };

/**
 * Horário presumido por período, pra ponte com o modelo antigo.
 *
 * Só serve pra ninguém parar de operar durante a migração. O que importa é o
 * `presumido: true` que sai junto: a tela do motorista PRECISA cobrar o
 * horário dele, e a do pai PRECISA esconder o chute. Horário chutado que se
 * disfarça de horário definido é pior que horário faltando, porque o pai vai
 * esperar na porta no horário errado.
 */
const PRESUMIDO_POR_PERIODO = {
  morning: { pega: '06:30', entrega: '12:30' },
  afternoon: { pega: '12:30', entrega: '17:30' },
  evening: { pega: '17:30', entrega: '22:00' },
};

/**
 * O horário definido pelo motorista: { pega, entrega, presumido }.
 * `presumido` é true quando qualquer um dos dois veio do período antigo — ou
 * seja, quando é chute do app e não decisão dele. A tela do pai não mostra
 * horário presumido.
 */
export function horariosCombinados(child) {
  if (!child) return { pega: null, entrega: null, presumido: true };

  const pega = normalizaHora(child.horaPega);
  const entrega = normalizaHora(child.horaEntrega);
  if (pega && entrega) return { pega, entrega, presumido: false };

  // A VOLTA PRESUMIDA SAI DA IDA, e este default era uma volta fantasma.
  //
  // Era `child.dropoffPeriod || 'afternoon'`. Como `childrenService` grava
  // `dropoffPeriod: data.dropoffPeriod || 'afternoon'` em TODA criança, cada
  // criança legada da manhã — que volta por volta das 12h30 — recebia entrega
  // presumida às 17h30. No dia da migração o motorista abria o app com uma
  // viagem de volta que não existe, e ao meio-dia, entregando de verdade, a
  // tela apontava pra ela; o bloco real das 12h30 não existia.
  //
  // A tabela também não fechava consigo mesma: `periodoDaHora('17:30')`
  // devolve 'evening', não 'afternoon'. O 'afternoon' do modelo antigo era
  // 11h–14h; o 17h30 veio de outro lugar.
  //
  // Presumir a volta pelo MESMO período da ida faz o par ida/volta ser
  // coerente: quem é pego de manhã volta ao meio-dia. Continua sendo chute —
  // e continua saindo com `presumido: true`, que é o que a tela usa pra pedir
  // confirmação em vez de exibir como combinado.
  const periodoDaIda = child.pickupPeriod || child.period || 'morning';
  const base = PRESUMIDO_POR_PERIODO[periodoDaIda] || PRESUMIDO_POR_PERIODO.morning;
  const baseVolta = PRESUMIDO_POR_PERIODO[child.dropoffPeriod || periodoDaIda]
    || base;

  return {
    pega: pega || base.pega,
    entrega: entrega || baseVolta.entrega,
    presumido: true,
  };
}

export function horaNaDirecao(child, direcao) {
  const h = horariosCombinados(child);
  return direcao === 'ida' ? h.pega : h.entrega;
}

/**
 * Rótulo de período a partir da hora — manhã/tarde/noite.
 *
 * O período deixou de ser regra e virou cosmético, mas os três campos ainda
 * são gravados — e por motivos DIFERENTES, o que importa pra quem for
 * simplificar isto:
 *
 *   `period`         é LIDO DE VERDADE: ChildCard, ChildDetail e o filtro de
 *                    TioChildren. Removê-lo quebra o filtro da lista.
 *   `pickupPeriod`   e `dropoffPeriod` são lidos SÓ por `horariosCombinados`,
 *                    aqui neste arquivo, como ponte pra criança cadastrada
 *                    antes do modelo de horários. É ponte com prazo: quando
 *                    toda criança tiver hora combinada, os dois saem.
 *
 * O comentário anterior dizia que "o Kanban dos seis turnos lê esses campos".
 * O Kanban foi APAGADO no mesmo conjunto de commits que escreveu essa frase.
 * Quem fosse simplificar procuraria o Kanban, não acharia, e ou removeria os
 * três de uma vez (quebrando o filtro) ou manteria os três pra sempre. *
 * Derivar da hora mantém tudo coerente sem pedir nada ao motorista: ele
 * informa a hora, o rótulo se acerta sozinho.
 */
export function periodoDaHora(hhmm) {
  const min = emMinutos(hhmm);
  if (min == null) return 'morning';
  if (min < 11 * 60) return 'morning';
  if (min < 16 * 60) return 'afternoon';
  return 'evening';
}

/**
 * '3 min', '1h20' — quanto falta, pra ler.
 *
 * Existia copiada em OperacaoDaRota e TioDashboard, e as duas JÁ divergiam:
 * uma arredondava, a outra não. As duas telas mostram a MESMA espera ao mesmo
 * motorista, então bastava a primeira fonte fracionária pra uma exibir
 * "3,4 min" e a outra "3 min". Ficou a versão endurecida.
 */
export function formataEspera(min) {
  const n = Math.round(Number(min) || 0);
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

/** Crianças sem horário combinado de verdade — a tela tem que cobrar. */
export function semHorarioCombinado(children) {
  return (children || [])
    .filter((c) => c?.active !== false)
    .filter((c) => horariosCombinados(c).presumido);
}

// ============================================================================
// O estado de cada criança HOJE
// ============================================================================

export const ESTADOS = {
  NORMAL: 'normal',
  FALTA: 'falta',
  PAI_LEVA: 'pai-leva',
  PAI_BUSCA: 'pai-busca',
  PAI_PEGOU: 'pai-pegou',
};

export const ROTULO_ESTADO = {
  [ESTADOS.FALTA]: 'Falta hoje',
  [ESTADOS.PAI_LEVA]: 'O pai leva hoje',
  [ESTADOS.PAI_BUSCA]: 'O pai busca hoje',
  // Tempo verbal diferente de propósito: "busca" é plano, "já pegou" é fato.
  // Pro motorista lendo a lista em movimento, a diferença é entre "não vou
  // precisar esperar" e "não preciso nem passar lá".
  [ESTADOS.PAI_PEGOU]: 'O pai já pegou',
};

/**
 * O que a declaração do dia faz com esta criança NESTA direção.
 *
 * Devolve estado em vez de sumir com ela: no modelo antigo a ausência tirava a
 * criança da fila, e o motorista perdia a referência de onde ela estaria na
 * ordem. Ela continua na lista, em cinza, com o motivo escrito.
 */
export function estadoNoDia(child, declaracao, direcao) {
  if (!declaracao) return ESTADOS.NORMAL;
  const t = declaracao.type;
  if (t === TIPO_FALTA_CHEIA) return ESTADOS.FALTA;
  if (t === TIPO_SEM_IDA) {
    return direcao === 'ida' ? ESTADOS.PAI_LEVA : ESTADOS.NORMAL;
  }
  if (t === TIPO_SEM_VOLTA) {
    return direcao === 'volta' ? ESTADOS.PAI_BUSCA : ESTADOS.NORMAL;
  }
  if (t === TIPO_JA_PEGOU) {
    // Mesmo efeito na rota que `no-dropoff` — o que muda é o que o motorista
    // lê. A ida do dia já aconteceu quando isto é declarado, então ela fica
    // normal: mexer nela seria reescrever um passado que já foi marcado.
    return direcao === 'volta' ? ESTADOS.PAI_PEGOU : ESTADOS.NORMAL;
  }
  return ESTADOS.NORMAL;
}

/** A criança precisa da perua nesta direção hoje? */
export function precisaDaPerua(estado) {
  return estado === ESTADOS.NORMAL;
}

// ============================================================================
// O dia
// ============================================================================

/**
 * Intervalo a partir do qual duas paradas são viagens diferentes.
 *
 * O corte é sobre o buraco entre paradas CONSECUTIVAS, não sobre a duração da
 * viagem: dentro de uma viagem as casas ficam a minutos umas das outras, mesmo
 * numa rota espalhada — vinte crianças podem ocupar uma hora de relógio com
 * três minutos entre cada porta.
 *
 * Começou em 90 minutos e estava errado: uma volta às 17h20 e outra às 18h30
 * viravam a mesma viagem, e as duas escolas apareciam juntas no começo do
 * bloco — o motorista buscaria o Theo às 17h20 numa escola que só solta 18h30.
 * Quarenta e cinco minutos separa viagem de viagem com folga e ainda é o dobro
 * do maior buraco plausível entre duas casas.
 */
const INTERVALO_ENTRE_VIAGENS = 45;

/**
 * As paradas de uma direção, em ordem de hora, agrupadas em blocos.
 *
 * O bloco NÃO é uma entidade salva e nunca ganha rótulo de horário na tela —
 * foi exatamente isso que fez a "corrida" ser descartada. Ele existe aqui pra
 * duas coisas concretas: saber onde entra a parada da escola, e saber quando
 * dizer "próxima parada só às 12h20".
 *
 * Retorna [{ paradas: [...], inicio, fim }].
 */
export function blocosDaDirecao(children, direcao, opcoes = {}) {
  const { declaracoes = {}, escolasPorId = {} } = opcoes;

  const comHora = (children || [])
    .filter((c) => c?.active !== false)
    .map((c) => {
      const hora = horaNaDirecao(c, direcao);
      const estado = estadoNoDia(c, declaracoes[c.id], direcao);
      return {
        child: c,
        hora,
        minutos: emMinutos(hora),
        estado,
        presumido: horariosCombinados(c).presumido,
      };
    })
    .filter((p) => p.minutos != null)
    .sort((a, b) => a.minutos - b.minutos);

  if (!comHora.length) return [];

  // Corta onde o buraco é grande. Só quem realmente vai hoje conta pro corte:
  // uma criança que faltou não deve manter dois blocos colados nem criar um
  // bloco só dela.
  const blocos = [];
  let atual = [comHora[0]];
  let ultimaEfetiva = precisaDaPerua(comHora[0].estado) ? comHora[0].minutos : null;

  for (let i = 1; i < comHora.length; i++) {
    const p = comHora[i];
    const ref = ultimaEfetiva ?? atual[atual.length - 1].minutos;
    if (p.minutos - ref > INTERVALO_ENTRE_VIAGENS) {
      blocos.push(atual);
      atual = [];
      ultimaEfetiva = null;
    }
    atual.push(p);
    if (precisaDaPerua(p.estado)) ultimaEfetiva = p.minutos;
  }
  blocos.push(atual);

  return blocos.map((paradas) => ({
    direcao,
    paradas,
    inicio: paradas[0].minutos,
    fim: paradas[paradas.length - 1].minutos,
    // A parada de escola NÃO ganha hora. Inventar "~06:52" seria trazer de
    // volta o número que ninguém combinou. Ela é só o passo que fecha (ida)
    // ou abre (volta) o bloco.
    escolas: escolasDoBloco(paradas, escolasPorId),
  }));
}

function escolasDoBloco(paradas, escolasPorId) {
  const vistas = new Set();
  const out = [];
  for (const p of paradas) {
    if (!precisaDaPerua(p.estado)) continue;
    const chave = p.child.schoolId || p.child.school || '?';
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    const e = escolasPorId[p.child.schoolId];
    out.push({
      schoolId: p.child.schoolId || null,
      nome: e?.nome || p.child.school || 'Escola',
      lat: e?.lat ?? p.child.schoolLat ?? null,
      lng: e?.lng ?? p.child.schoolLng ?? null,
    });
  }
  return out;
}

/**
 * O dia inteiro: os blocos das duas direções, ordenados pela primeira hora.
 *
 * Blocos são calculados POR DIREÇÃO de propósito. Uma volta que termina 12h05
 * e uma ida que começa 12h20 são duas viagens, ainda que o motorista dirija
 * direto de uma pra outra — misturar as duas num bloco só bagunçaria onde
 * entra a parada da escola.
 */
export function diaCompleto(children, opcoes = {}) {
  return [
    ...blocosDaDirecao(children, 'ida', opcoes),
    ...blocosDaDirecao(children, 'volta', opcoes),
  ].sort((a, b) => a.inicio - b.inicio);
}

/**
 * O bloco em que o motorista ESTÁ — e não é só o relógio que decide.
 *
 * As janelas fixas do modelo antigo tinham buraco: às 15h devolviam null e a
 * tela ficava sem turno nenhum. Aqui nunca é null havendo blocos.
 *
 * O RELÓGIO SOZINHO TROCAVA DE VIAGEM COM AS CRIANÇAS NA CALÇADA
 * `fim` é a hora da ÚLTIMA porta do bloco. Um minuto depois dela, o bloco
 * deixava de ser "o atual" e a tela pulava pra próxima viagem — sozinha, com
 * a fila ainda cheia. Às 6h36, atrasado cinco minutos na porta da Duda, o
 * motorista via a Ana, o Caio e a Duda sumirem do cartão, o botão grande virar
 * o do Theo (12h20) e o rodapé anunciar "próxima viagem em 6h". No Início, o
 * mesmo relógio dizia "você está entre viagens" com três crianças esperando.
 *
 * Atrasar um minuto numa rota escolar é o caso NORMAL. E isto era regressão:
 * o Kanban dos seis turnos ficava no turno até o motorista sair dele.
 *
 * A REGRA: um bloco com parada pendente continua sendo o atual até chegar a
 * hora da primeira porta do PRÓXIMO. Aí a tela avança mesmo com pendência —
 * porque nesse ponto ele está atrasado pra viagem seguinte, e é ela que
 * precisa aparecer.
 *
 * `pendente` é injetado por quem chama, e não calculado aqui de propósito: se
 * uma criança já foi marcada depende do `status` dela, que mora no
 * routeStatusService. Este módulo não importa Firebase nem serviço de
 * operação — é o que o mantém testável sem emulador (ver o topo do arquivo).
 * Sem o callback, o comportamento é o antigo, só pelo relógio.
 *
 * @param {Function} [pendente] recebe um bloco, devolve true se ele ainda tem
 *   parada esperando ação do motorista.
 */
// A margem existe só na PARTIDA: ele tem que estar na porta às 6h20, então às
// 6h10 já está trabalhando nesse bloco. Aplicá-la também no FIM fazia a ida
// das 12h20 continuar "em andamento" às 12h38 e vencer a volta das 12h35, que
// é onde ele realmente está.
const MARGEM_DE_PARTIDA = 20;

export function blocoDoMomento(blocos, agora = new Date(), pendente = null) {
  if (!blocos?.length) return null;
  const min = agora.getHours() * 60 + agora.getMinutes();

  if (typeof pendente === 'function') {
    for (let i = 0; i < blocos.length; i += 1) {
      const b = blocos[i];
      // Ainda não começou: quem decide é o relógio, lá embaixo.
      if (min < b.inicio - MARGEM_DE_PARTIDA) break;
      if (!pendente(b)) continue;
      const proximo = blocos[i + 1];
      // Segura o bloco inacabado até a porta do próximo chamar.
      if (!proximo || min < proximo.inicio - MARGEM_DE_PARTIDA) return b;
    }
  }

  const emAndamento = blocos.find((b) => min >= b.inicio && min <= b.fim);
  if (emAndamento) return emAndamento;

  const saindo = blocos.find((b) => min >= b.inicio - MARGEM_DE_PARTIDA && min < b.inicio);
  if (saindo) return saindo;

  return blocos.find((b) => b.inicio > min) || blocos[blocos.length - 1];
}

/** Quanto falta pro próximo bloco, em minutos. null quando não há próximo. */
export function esperaAte(blocos, bloco, agora = new Date()) {
  if (!blocos?.length || !bloco) return null;
  const i = blocos.indexOf(bloco);
  const proximo = blocos[i + 1];
  if (!proximo) return null;
  const min = agora.getHours() * 60 + agora.getMinutes();
  return { bloco: proximo, minutos: proximo.inicio - min, hora: deMinutos(proximo.inicio) };
}

// ============================================================================
// "Dá tempo?" — o aviso que fala do compromisso, não de prazo inventado
// ============================================================================

const KMH_URBANO = 18;  // mesma velocidade conservadora do routePresence
const MIN_POR_PARADA = 1;

/**
 * Só avisa quando o aperto é grande o bastante pra ser real.
 *
 * Sem isto a conta acusava faltar 2 minutos entre duas casas a 2 km — um
 * aperto que qualquer motorista absorve num semáforo. Aviso que aparece em
 * toda rota é aviso que ele aprende a ignorar, e aí o aviso que importa passa
 * despercebido junto.
 */
const TOLERANCIA_MIN = 5;

function distanciaKm(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return 0;
  const dLat = (a.lat - b.lat) * 111;
  const dLng = (a.lng - b.lng) * 111 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

const pontoDaCasa = (c) => (c?.lat == null ? null : { lat: c.lat, lng: c.lng });

/**
 * Promessas consecutivas que não cabem no relógio.
 *
 * O aviso fala do que ELE combinou — "você prometeu Ana 6h20 e Caio 6h22, mas
 * são 4 km entre as casas" — e não de um prazo que o app inventou. É por isso
 * que o horário da escola não faz falta aqui.
 *
 * Só compara quem realmente vai hoje: quem faltou não atrasa ninguém.
 */
export function avisosDeTempo(blocos) {
  const out = [];
  for (const bloco of blocos || []) {
    const efetivas = bloco.paradas.filter((p) => precisaDaPerua(p.estado));
    for (let i = 1; i < efetivas.length; i++) {
      const a = efetivas[i - 1];
      const b = efetivas[i];
      const km = distanciaKm(pontoDaCasa(a.child), pontoDaCasa(b.child));
      if (!km) continue;
      const precisa = Math.ceil((km / KMH_URBANO) * 60) + MIN_POR_PARADA;
      const tem = b.minutos - a.minutos;
      if (precisa - tem > TOLERANCIA_MIN) {
        out.push({
          de: a.child,
          para: b.child,
          horaDe: a.hora,
          horaPara: b.hora,
          km: Number(km.toFixed(1)),
          minutosDisponiveis: tem,
          minutosNecessarios: precisa,
          faltamMin: precisa - tem,
        });
      }
    }
  }
  return out;
}

/**
 * Proposta de cascata: mover uma criança arrasta as seguintes do mesmo bloco.
 *
 * PROPÕE, não aplica. Cada horário destes foi combinado com uma família
 * diferente; mexer sozinho seria alterar acordos que o motorista fez um a um.
 * E não mexer deixaria a lista fora de ordem em silêncio, que é pior.
 *
 * Retorna [{ child, de, para }] — só quem muda.
 */
export function proporCascata(children, childId, novaHora, direcao) {
  const hora = normalizaHora(novaHora);
  if (!hora || !childId) return [];

  const blocos = blocosDaDirecao(children, direcao);
  const bloco = blocos.find((b) => b.paradas.some((p) => p.child.id === childId));
  if (!bloco) return [];

  const idx = bloco.paradas.findIndex((p) => p.child.id === childId);
  const delta = emMinutos(hora) - bloco.paradas[idx].minutos;
  if (delta === 0) return [];

  const out = [{ child: bloco.paradas[idx].child, de: bloco.paradas[idx].hora, para: hora }];

  // Só empurra pra frente. Adiantar uma parada não obriga ninguém a sair mais
  // cedo de casa — mas atrasar empurra todo mundo que vem depois.
  if (delta > 0) {
    for (let i = idx + 1; i < bloco.paradas.length; i++) {
      const p = bloco.paradas[i];
      const novo = p.minutos + delta;
      // A CASCATA NÃO ATRAVESSA A MEIA-NOITE.
      //
      // `deMinutos` embrulha (`% 1440`), então numa rota noturna atrasar a Ana
      // de 23h00 pra 23h50 propunha mover o Bob de 23h20 pra 00h10 — e uma
      // entrega às 00h10 tem `inicio = 10`, o que joga o Bob do FIM da fila
      // pro começo do dia seguinte, na frente de todo mundo.
      //
      // Parar aqui é mais honesto que propor um horário que reordena o dia: o
      // motorista vê a cascata até onde ela faz sentido e decide o resto.
      if (novo > 23 * 60 + 59) break;
      out.push({ child: p.child, de: p.hora, para: deMinutos(novo) });
    }
  }
  return out;
}
