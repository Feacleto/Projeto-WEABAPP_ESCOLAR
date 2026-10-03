import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  deleteField,
  setDoc,
  writeBatch,
  getDocs,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { precisaDaPerua } from '../dominio/rota/horarios';
import {
  previsoesParaGravar,
  chaveDaPrevisao,
  emLotes,
  LOTE_MAXIMO,
} from '../dominio/rota/escritasDaRota';

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
 * `contexto` traz o que dá sentido ao registro depois: de qual motorista é
 * e o horário que estava combinado com a família — sem ele, saber que a
 * entrega foi 12h51 não diz se atrasou.
 *
 * ⚠️ ELE NÃO CARREGA MAIS `checkpoint`. O documento do dia guardava, por
 * status, onde o veículo do motorista estava na hora da marcação. Saiu por
 * decisão do dono em 11/09/2026: **o registro é que entregou e a que horas,
 * e nada sobre onde.** Ver o bloco em `routeStatusService`.
 *
 * ⚠️ O EMBARQUE EM CASA TEM MARCO PRÓPRIO (03/10/2026). `onboard` é o
 * MESMO campo na ida (embarca em casa) e na volta (embarca na escola), então
 * o embarque da tarde apagava a hora do embarque da manhã — justamente a que
 * varia e que o horário médio precisa. Quando a criança sai de `home`, a
 * hora vai também para `embarqueEmCasa`. (A chegada em casa não precisa:
 * `delivered` só acontece lá.) Fica dentro de `marcos`, que as rules já
 * aceitam — nenhum campo novo no topo do documento.
 */
export function anotarMarco(batch, { childId, dateKey, status, statusAnterior = null, contexto = {} }) {
  if (!childId || !dateKey || !MARCOS.includes(status)) return;

  batch.set(
    refDaViagem(childId, dateKey),
    {
      dateKey,
      childId,
      adminUid: contexto.adminUid || null,
      parentUid: contexto.parentUid || null,
      marcos: {
        [status]: serverTimestamp(),
        ...(status === 'onboard' && statusAnterior === 'home'
          ? { embarqueEmCasa: serverTimestamp() }
          : {}),
      },
      ...(contexto.combinado ? { combinado: contexto.combinado } : {}),
      atualizadoEm: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * A PREVISÃO DE CHEGADA no documento do dia de cada criança (03/10/2026) —
 * régua em `previsoesDaViagem`. Só a HORA viaja ('HH:MM'), nunca a posição;
 * `null` apaga (voltou ao horário). Sem `await` de quem chama: previsão é
 * conveniência, a rota não espera por ela.
 *
 * ⚠️ SÓ GRAVA O QUE MUDOU (03/10/2026). Ela gravava, a cada marcação, TODAS
 * as crianças que ainda esperam — inclusive o apagar de quem nunca teve
 * previsão —, num lote só: O(n²) escritas por rota, e com 19 crianças ou mais
 * o lote estourava o teto de 20 `get()` da regra e caía INTEIRO. Quem decide
 * agora é `previsoesParaGravar` (mais de 2 minutos de diferença, ou o apagar
 * de quem tinha valor), e a escrita vai em lotes de 15, como
 * `publicarOrdemDoDia`. A memória do que foi gravado é deste aparelho e desta
 * sessão: a rota é de um motorista, num celular.
 */
let previsoesPublicadas = {};

export async function publicarPrevisoes({ previsoes, dateKey, adminUid }) {
  if (!previsoes?.length || !dateKey) return 0;
  const { escrever, publicadas } = previsoesParaGravar(previsoes, previsoesPublicadas, dateKey);
  if (!escrever.length) return 0;
  let gravadas = 0;
  for (const lote of emLotes(escrever, LOTE_MAXIMO)) {
    const batch = writeBatch(db);
    lote.forEach((p) => {
      batch.set(
        refDaViagem(p.childId, dateKey),
        {
          dateKey,
          childId: p.childId,
          adminUid: adminUid || null,
          parentUid: p.parentUid || null,
          [p.campo]: p.previsao || deleteField(),
          atualizadoEm: serverTimestamp(),
        },
        { merge: true }
      );
    });
    try {
      await batch.commit();
      gravadas += lote.length;
      // A memória só aprende o que SUBIU: lote recusado tenta de novo na
      // próxima marcação, em vez de ficar dado como gravado.
      for (const p of lote) {
        const chave = chaveDaPrevisao(dateKey, p);
        if (chave in publicadas) previsoesPublicadas[chave] = publicadas[chave];
        else delete previsoesPublicadas[chave];
      }
    } catch (err) {
      console.error('publicarPrevisoes', err);
    }
  }
  return gravadas;
}

/**
 * APAGA UM MARCO do dia — o toque errado desfeito (03/10/2026). Mesmo lote da
 * volta do status (`voltarPasso`), pelo mesmo motivo de `anotarMarco`: status
 * e hora andam juntos, senão o dia diria "entregue às 7h12" de quem voltou
 * para a perua.
 */
export function apagarMarco(batch, { childId, dateKey, status, anterior = null }) {
  if (!childId || !dateKey || !MARCOS.includes(status)) return;
  // Desfazer o embarque EM CASA apaga também o marco dele; desfazer o da
  // escola não, senão a hora da manhã sumiria junto.
  const embarqueEmCasa =
    status === 'onboard' && anterior === 'home' ? { embarqueEmCasa: deleteField() } : {};
  batch.set(
    refDaViagem(childId, dateKey),
    { marcos: { [status]: deleteField(), ...embarqueEmCasa }, atualizadoEm: serverTimestamp() },
    { merge: true }
  );
}

/**
 * A FAIXA EM QUE A PERUA ESTÁ, para UMA criança —
 * `children/{id}/proximidade/atual`.
 *
 * ── POR QUE ISTO EXISTE
 * O aviso de "está chegando" era calculado no celular da MÃE, a partir da
 * coordenada publicada — então ele morria junto com o mapa no dia em que o
 * motorista pudesse desligar o compartilhamento. Agora quem mede é o celular
 * DELE, e o que viaja é uma palavra: `longe`, `perto` ou `chegou`.
 *
 * ⚠️ UMA PALAVRA, NUNCA A DISTÂNCIA EM KM. Três casas com distância conhecida
 * dão o ponto exato por triangulação — publicar "1,2 km" seria republicar a
 * posição por outro nome.
 *
 * ⚠️ SAIU DO DOCUMENTO DO DIA (03/10/2026). Morava em `rides/{dia}`, e o
 * gatilho do "está chegando" (`avisarAproximacao`) escutava `rides` — então
 * ACORDAVA a cada marco, a cada previsão e a cada ordem do dia, para sair na
 * primeira linha porque a faixa não mudou. Em documento próprio, o gatilho só
 * roda quando a faixa é escrita. E nenhuma tela lia a faixa no `rides`: o
 * aviso da família é a notificação, não o documento.
 *
 * ⚠️ UM DOCUMENTO POR CRIANÇA, NÃO POR DIA. Um por dia seria arquivo que
 * cresce sozinho e ninguém consulta (a retenção de 60 dias só varre `rides`).
 * O que impede o "chegou" de ontem de valer hoje é o `dateKey` dentro dele: o
 * gatilho trata a faixa de outro dia como "nenhuma" (`zonaAnteriorDoDia`).
 */
export async function publicarProximidade({ childId, dateKey, zona, adminUid, parentUid }) {
  if (!childId || !dateKey || !zona) return;
  await setDoc(doc(db, 'children', childId, 'proximidade', 'atual'), {
    zona,
    dateKey,
    adminUid: adminUid || null,
    parentUid: parentUid || null,
    atualizadoEm: serverTimestamp(),
  });
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

/**
 * AS ÚLTIMAS VIAGENS DE UMA CRIANÇA — a matéria do horário de costume
 * (`dominio/rota/horarioDeCostume.js`). Leitura ÚNICA, não escuta: hábito não
 * muda no meio da tela aberta, e uma assinatura por ficha aberta seria leitura
 * permanente para um número que se recalcula na próxima abertura. Quarenta
 * dias letivos cabem folgados nos 60 de retenção.
 */
export async function lerViagensRecentes(childId, quantas = 40) {
  if (!childId) return [];
  const snap = await getDocs(
    query(
      collection(doc(db, 'children', childId), 'rides'),
      orderBy('dateKey', 'desc'),
      limit(quantas)
    )
  );
  return snap.docs.map((d) => d.data());
}
