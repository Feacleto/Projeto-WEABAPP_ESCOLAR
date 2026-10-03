/**
 * QUEM ESTÁ EM FOCO NA VIAGEM, E QUEM PODE SER MARCADO JUNTO (03/10/2026).
 *
 * A régua morava dentro de `OperacaoDaRota`, como `p[0]` — a primeira criança
 * com ação pendente, na ordem do relógio — e isso travava a rota no meio:
 *
 *   ⚠️ O FOCO NÃO ANDAVA. Na ida, depois do "EMBARQUEI" da criança 1, a ação
 *   dela vira "ENTREGUEI NA ESCOLA" e ela continuava a primeira da fila. O
 *   motorista dirigia até a casa da criança 2 com o botão dizendo "entreguei
 *   na escola" para quem estava sentada atrás dele. Para embarcar a 2, ou
 *   mentia que a 1 tinha chegado (e a mãe dela recebia "chegou na escola"), ou
 *   usava o "TODOS" na primeira casa.
 *
 *   ⚠️ O "TODOS" JUNTAVA LUGARES DIFERENTES. Ele agrupava quem tinha o mesmo
 *   próximo passo — então "EMBARQUEI — TODOS OS 4" aparecia na porta da
 *   primeira casa, e "ENTREGUEI NA ESCOLA — TODOS" marcava também as crianças
 *   da OUTRA escola, cujas mães recebiam "chegou na escola" antes da hora.
 *
 * A regra agora, nas duas direções:
 *   - PRIMEIRO EMBARCA, DEPOIS ENTREGA. Quem ainda falta entrar na perua vem
 *     antes de quem já está nela, cada grupo na ordem do relógio.
 *   - "TODOS" SÓ JUNTA QUEM ESTÁ NO MESMO LUGAR: a mesma escola (desembarque
 *     na ida, embarque na volta) ou a mesma casa (irmãos).
 *   - O MOTORISTA PODE ESCOLHER O FOCO tocando na criança — a ordem do relógio
 *     é sugestão, e a rua manda (`focoEscolhido`).
 *
 * Puro, sem React: `npm run testar:viagem`.
 *
 * Cada item da fila tem a forma que `OperacaoDaRota` monta:
 *   { child: { id, schoolId, school, address, lat, lng }, status,
 *     action: { nextStatus, shortLabel } | null }
 */

import { precisaDaPerua, emMinutos, deMinutos } from './horarios.js';

const EMBARCAR = 'onboard';

/** Onde o próximo passo desta criança acontece — escola ou casa. */
export function lugarDoPasso(item) {
  const proximo = item?.action?.nextStatus;
  const c = item?.child || {};
  // Na escola: desembarcar na ida ('atSchool'), ou embarcar na volta (ela
  // está na escola e o próximo passo é a perua).
  const naEscola = proximo === 'atSchool' || (proximo === EMBARCAR && item?.status === 'atSchool');
  if (naEscola) return `escola:${c.schoolId || String(c.school || '').trim().toLowerCase()}`;
  const endereco = String(c.address || '').trim().toLowerCase();
  if (endereco) return `casa:${endereco}`;
  if (Number.isFinite(c.lat) && Number.isFinite(c.lng)) return `casa:${c.lat},${c.lng}`;
  // Sem endereço nem ponto, ninguém é "o mesmo lugar" que ela.
  return `casa:${c.id || ''}`;
}

/**
 * As crianças com algo a fazer, na ordem em que o motorista as encontra:
 * primeiro as que faltam embarcar, depois as que já estão na perua. `fila`
 * chega na ordem do relógio, e a ordem dentro de cada grupo é preservada.
 */
export function pendentesEmOrdem(fila, adiados = []) {
  const p = (fila || []).filter((q) => q?.action);
  const ordem = [
    ...p.filter((q) => q.action.nextStatus === EMBARCAR),
    ...p.filter((q) => q.action.nextStatus !== EMBARCAR),
  ];
  // "NINGUÉM EM CASA" (03/10/2026): quem o motorista deixou para depois vai
  // para o FIM da viagem, e o foco segue. Ela não sai da lista — ele volta
  // nela no fim.
  const depois = new Set(adiados || []);
  if (!depois.size) return ordem;
  return [
    ...ordem.filter((q) => !depois.has(q.child?.id)),
    ...ordem.filter((q) => depois.has(q.child?.id)),
  ];
}

/**
 * A criança em foco: a que o motorista tocou, enquanto o PASSO dela for o
 * mesmo de quando ele tocou; senão a primeira da ordem.
 *
 * ⚠️ A ESCOLHA VALE UM PASSO (03/10/2026). Ela valia enquanto a criança
 * tivesse "algo a fazer" — então tocar no Pedro e marcar EMBARQUEI deixava o
 * foco PRESO nele ("ENTREGUEI NA ESCOLA"), o mesmo travamento que esta régua
 * nasceu para tirar, voltando pela escolha manual (achado no teste M6).
 * `focoEscolhido` é `{ id, passo }`; um id solto ainda é aceito.
 */
export function focoDaViagem(pendentes, focoEscolhido = null) {
  if (!pendentes?.length) return null;
  if (focoEscolhido) {
    const id = typeof focoEscolhido === 'string' ? focoEscolhido : focoEscolhido.id;
    const passo = typeof focoEscolhido === 'string' ? null : focoEscolhido.passo;
    const escolhido = pendentes.find((q) => q.child?.id === id);
    if (escolhido && (!passo || escolhido.action?.nextStatus === passo)) return escolhido;
  }
  return pendentes[0];
}

/**
 * Quem pode ser marcado JUNTO com o foco: o mesmo passo, no mesmo lugar. Lista
 * vazia quando não há pelo menos dois — "todos" de um só é o botão de sempre.
 */
export function loteDoFoco(pendentes, foco) {
  if (!foco?.action || !pendentes?.length) return [];
  const passo = foco.action.nextStatus;
  const lugar = lugarDoPasso(foco);
  const iguais = pendentes.filter(
    (q) => q.action?.nextStatus === passo && lugarDoPasso(q) === lugar
  );
  return iguais.length >= 2 ? iguais : [];
}

/**
 * QUEM RECEBE "VOCÊS SÃO OS PRÓXIMOS" depois que o motorista marcou `movidos`
 * (03/10/2026). Devolve o item da fila, ou `null`.
 *
 * Saiu de `avisarProximo`, que consultava a turma do DIA INTEIRO, e errava em
 * três lugares: embarcar na ESCOLA (volta) era lido como ida e avisava quem
 * estava em casa; a família da TARDE ouvia "são os próximos" às 6h40; e quem
 * faltou ou ia com o pai também entrava. Aqui a fila é a da VIAGEM, e quem
 * está fora hoje já chega sem ação.
 *
 *   - embarcou em CASA (ida): a próxima casa — quem ainda falta embarcar.
 *   - embarcou na ESCOLA ou ENTREGOU (volta): a próxima entrega — quem está na
 *     perua, pela hora de entrega.
 *   - desembarcou na escola (ida): ninguém; é o meio do caminho.
 */
export function proximoAAvisar(fila, movidos) {
  const lista = Array.isArray(movidos) ? movidos : [movidos];
  const primeiro = lista[0];
  if (!primeiro?.action) return null;
  const ids = new Set(lista.map((m) => m.child?.id));
  const passo = primeiro.action.nextStatus;
  const deCasa = passo === EMBARCAR && primeiro.status === 'home';
  const naVolta = (passo === EMBARCAR && primeiro.status === 'atSchool') || passo === 'delivered';
  const resto = (fila || []).filter((q) => q?.action && !ids.has(q.child?.id));

  if (deCasa) {
    return resto.find((q) => q.action.nextStatus === EMBARCAR && q.status === 'home') || null;
  }
  if (naVolta) {
    // Ainda falta buscar alguém numa escola (a segunda escola da volta): a
    // perua vai para lá antes de qualquer casa, e "próxima entrega" agora
    // seria cedo demais. O aviso sai quando o último embarcar.
    if (resto.some((q) => q.action.nextStatus === EMBARCAR && q.status === 'atSchool')) {
      return null;
    }
    // Na perua e indo para casa: quem acabou de embarcar na escola conta.
    const naPerua = (fila || []).filter((q) => {
      if (!q?.action) return false;
      if (ids.has(q.child?.id)) return passo === EMBARCAR;
      return q.status === 'onboard' && q.action.nextStatus === 'delivered';
    });
    return naPerua[0] || null;
  }
  return null;
}

/**
 * "A PERUA SAIU" — para quem é, e qual viagem é (03/10/2026). A trava passou a
 * ser por VIAGEM, e não por dia: quem anda só à tarde recebia o aviso às 6h e
 * nada às 12h. Só as famílias que esperam a perua NESTA viagem — quem faltou,
 * ou vai com o pai, fica de fora.
 */
export function saidaDaViagem(bloco) {
  if (!bloco?.paradas?.length) return null;
  const familias = [
    ...new Set(
      bloco.paradas
        .filter((p) => precisaDaPerua(p.estado))
        .map((p) => p.child?.parentUid)
        .filter(Boolean)
    ),
  ];
  return { viagem: `${bloco.direcao || 'viagem'}-${bloco.inicio}`, familias };
}

/**
 * QUEM FICOU SEM REGISTRO quando o motorista encerra a viagem (03/10/2026).
 *
 * Era decidido pelo RELÓGIO ("antes do meio-dia é a ida") sobre a turma
 * inteira — errava a direção da ida da tarde, avisava quem tinha faltado, e
 * nunca olhava quem ficou "na perua", que é o caso mais sério. Agora é a fila
 * da VIAGEM: quem ainda tem um passo pendente, e qual.
 *
 *   'embarque' — não foi marcado entrando na perua (em casa, ou na escola)
 *   'entrega'  — consta DENTRO da perua
 */
export function quemFicouSemRegistro(fila) {
  return (fila || [])
    .filter((q) => q?.action && q.child?.id)
    .map((q) => ({
      childId: q.child.id,
      parentUid: q.child.parentUid || null,
      name: q.child.name || '',
      hora: q.hora || null,
      falta: q.status === 'onboard' ? 'entrega' : 'embarque',
    }));
}

/**
 * A PREVISÃO DE CHEGADA — hora combinada corrigida pelo atraso REAL
 * (03/10/2026; o dono tinha tirado a previsão e pediu para reavaliar).
 *
 * A previsão que saiu era LINHA RETA ÷ 18 km/h, um número inventado. Esta não
 * adivinha trânsito: quando o motorista marca uma parada, mede-se quanto ele
 * está atrasado (ou adiantado) em relação ao COMBINADO daquela criança, e cada
 * família que ainda espera nesta viagem recebe a hora combinada DELA mais essa
 * diferença. Abaixo de 5 minutos, nada — o combinado já basta, e uma previsão
 * que muda de minuto em minuto ensina a ignorá-la.
 *
 *   - embarcou em CASA (ida): prevê o embarque de quem ainda está em casa;
 *   - ENTREGOU (volta): prevê a entrega de quem ainda está na perua.
 * Outros passos (desembarque na escola, embarque na escola) não têm hora
 * combinada para comparar — não mexem na previsão.
 *
 * Devolve [{ childId, parentUid, campo, previsao }], com `previsao` null para
 * APAGAR uma previsão antiga (voltou ao horário).
 */
const DESVIO_MINIMO = 5;
export function previsoesDaViagem(fila, marcado, agora = new Date()) {
  if (!marcado?.action) return [];
  const passo = marcado.action.nextStatus;
  const deCasa = passo === EMBARCAR && marcado.status === 'home';
  const entregou = passo === 'delivered';
  if (!deCasa && !entregou) return [];
  const combinado = emMinutos(marcado.hora);
  if (combinado == null) return [];
  const desvio = agora.getHours() * 60 + agora.getMinutes() - combinado;
  // Mais de hora e meia não é atraso de rota: é a rota fora do horário.
  if (Math.abs(desvio) > 90) return [];

  const campo = deCasa ? 'previsaoIda' : 'previsaoVolta';
  const espera = (q) =>
    deCasa
      ? q.action?.nextStatus === EMBARCAR && q.status === 'home'
      : q.action?.nextStatus === 'delivered' && q.status === 'onboard';

  return (fila || [])
    .filter((q) => q?.child?.id && q.child.id !== marcado.child?.id && espera(q))
    .map((q) => {
      const hora = emMinutos(q.hora);
      return {
        childId: q.child.id,
        parentUid: q.child.parentUid || null,
        campo,
        previsao:
          hora == null || Math.abs(desvio) < DESVIO_MINIMO ? null : deMinutos(hora + desvio),
      };
    });
}
