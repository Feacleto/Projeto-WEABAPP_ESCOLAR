import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { precisaDaPerua } from '../utils/horarios';

/**
 * A VIAGEM DE CADA CRIANÇA, DIA A DIA — `children/{id}/rides/{YYYY-MM-DD}`.
 *
 * POR QUE ISTO EXISTE
 * A criança guardava só `status` e `statusUpdatedAt`: o ÚLTIMO passo e a hora
 * dele. Três coisas ficavam impossíveis com isso, e as três importam:
 *
 *   - o tracker do responsável não conseguia dizer "chegou na escola às 7h12".
 *     Mostrava as quatro etapas sem hora nenhuma, o que é meio caminho entre
 *     informar e não informar;
 *   - no dia seguinte não havia como reconstruir a rota. `getEffectiveStatus`
 *     devolve 'home' quando o dia vira, e o que aconteceu ontem some. Numa
 *     reclamação — "meu filho chegou tarde na terça" — não havia o que olhar;
 *   - a estimativa de chegada era 18 km/h chutados, porque não existia
 *     histórico do que costuma acontecer naquele trecho.
 *
 * Uma subcoleção por criança, um doc por dia. O id é a data, então gravar duas
 * vezes o mesmo marco é idempotente e não cria lixo.
 *
 * ESCREVE NO MESMO BATCH DO STATUS
 * O marco é gravado junto com a mudança de status, não depois: se fosse uma
 * escrita separada, o par "criança entregue" e "hora da entrega" poderia
 * divergir — e a hora que falta é justamente a que alguém vai procurar.
 */

const MARCOS = ['onboard', 'atSchool', 'delivered'];

function refDaViagem(childId, dateKey) {
  return doc(collection(doc(db, 'children', childId), 'rides'), dateKey);
}

/**
 * Acrescenta ao batch o marco desta transição.
 *
 * `contexto` traz o que dá sentido ao registro depois: de qual motorista é,
 * a que distância do destino foi marcado (o mesmo checkpoint que já vai pro
 * doc da criança) e o horário que estava combinado com a família — sem ele,
 * saber que a entrega foi 12h51 não diz se atrasou.
 */
export function anotarMarco(batch, { childId, dateKey, status, contexto = {} }) {
  if (!childId || !dateKey || !MARCOS.includes(status)) return;

  batch.set(
    refDaViagem(childId, dateKey),
    {
      dateKey,
      childId,
      adminUid: contexto.adminUid || null,
      parentUid: contexto.parentUid || null,
      marcos: { [status]: serverTimestamp() },
      ...(contexto.combinado ? { combinado: contexto.combinado } : {}),
      ...(contexto.checkpoint ? { checkpoints: { [status]: contexto.checkpoint } } : {}),
      atualizadoEm: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Publica a posição de cada criança no dia — "você é a 4ª parada".
 *
 * POR QUE UMA VEZ SÓ, NO INÍCIO DA ROTA
 * O responsável não consegue calcular isso sozinho: ele lê apenas o doc do
 * próprio filho, e a fila é feita das outras crianças, que ele não pode (nem
 * deve) enxergar. Então quem sabe precisa publicar.
 *
 * O número gravado é o ORDINAL do dia, não "quantas faltam agora". Ordinal é
 * estável: muda só se o motorista mudar os horários. "Quantas faltam" mudaria
 * a cada criança entregue — vinte escritas por parada, e um número que
 * envelhece errado se uma escrita falhar. Um ordinal que não muda é melhor que
 * um contador que às vezes mente.
 */
export async function publicarOrdemDoDia(blocos, dateKey, contextoPorCrianca = {}) {
  if (!dateKey || !blocos?.length) return 0;

  // Acumula POR CRIANÇA antes de escrever. A mesma criança aparece em dois
  // blocos (a ida dela e a volta dela), e empilhar duas escritas no mesmo
  // documento dentro do mesmo batch é pedir pra depender da ordem de aplicação
  // — um detalhe que funciona até o dia em que não funciona. Um doc, uma
  // escrita, com os dois lados já juntos.
  const porCrianca = new Map();
  for (const bloco of blocos) {
    const efetivas = bloco.paradas.filter((p) => precisaDaPerua(p.estado));
    efetivas.forEach((p, i) => {
      const ctx = contextoPorCrianca[p.child.id] || {};
      const atual = porCrianca.get(p.child.id) || {
        dateKey,
        childId: p.child.id,
        adminUid: ctx.adminUid || null,
        parentUid: p.child.parentUid || null,
        combinado: { ...(ctx.combinado || {}) },
      };
      if (bloco.direcao === 'ida') {
        atual.ordemIda = i + 1;
        atual.totalIda = efetivas.length;
      } else {
        atual.ordemVolta = i + 1;
        atual.totalVolta = efetivas.length;
      }
      atual.combinado[bloco.direcao] = p.hora;
      porCrianca.set(p.child.id, atual);
    });
  }
  if (!porCrianca.size) return 0;

  const escritas = [...porCrianca.values()];
  // 15, E O TETO AQUI NÃO É O DE 500 OPERAÇÕES — É O DE 20 `get()`.
  //
  // A regra de `children/{id}/rides/{dia}` resolve a permissão com um
  // `get()` no doc da criança. Cada documento do lote aponta pra uma criança
  // DIFERENTE, então nada cacheia, e o Firestore corta em 20 acessos por
  // requisição de batch — não por operação.
  //
  // Medido no emulador (scripts/testar-regras.mjs trava isso): 18 crianças
  // passa, 19 devolve 403. E batch é atômico: nada salva. Uma perua escolar
  // leva 15 a 20 crianças, então o lote inteiro do "embarquei todos" caía
  // exatamente na faixa de uso normal — e o erro morria num console.error,
  // sem ninguém no app perceber.
  //
  // 15 deixa folga pros acessos que a própria regra faz por fora (users/{uid})
  // e pra regra ganhar mais um `get()` sem quebrar de novo em produção.
  const CHUNK = 15;
  for (let i = 0; i < escritas.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const dados of escritas.slice(i, i + CHUNK)) {
      batch.set(
        refDaViagem(dados.childId, dateKey),
        { ...dados, atualizadoEm: serverTimestamp() },
        { merge: true }
      );
    }
    await batch.commit();
  }
  return escritas.length;
}

/** A viagem de hoje de uma criança — usado no painel do responsável. */
export function watchRide(childId, dateKey, onUpdate, onError) {
  if (!childId || !dateKey) {
    onUpdate(null);
    return () => {};
  }
  return onSnapshot(
    refDaViagem(childId, dateKey),
    (snap) => onUpdate(snap.exists() ? snap.data() : null),
    (err) => {
      console.error('watchRide error:', err);
      if (onError) onError(err);
    }
  );
}

/** 'HH:MM' de um marco, ou null. Aceita Timestamp do Firestore ou Date. */
export function horaDoMarco(ride, status) {
  const v = ride?.marcos?.[status];
  const d = v?.toDate?.() || (v instanceof Date ? v : null);
  if (!d) return null;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
