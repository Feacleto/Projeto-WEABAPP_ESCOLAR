import {
  collection,
  addDoc,
  doc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { playSound } from './soundService';
import { haversineDistance } from '../utils/haversine';
import { getEffectiveStatus } from './childrenService';
import { ABSENCE_TYPES } from './absencesService';
import { anotarMarco } from './ridesService';

/**
 * Máquina de status da criança na rota.
 *
 * Estava dentro do KanbanCard, que era o ÚNICO lugar do app capaz de mudar
 * o status de uma criança. Trazer pra cá foi pré-requisito das telas novas
 * de rota — sem isso, cada interface nova reimplementaria as transições.
 *
 * Fluxo por direção do turno:
 *   ida   (pickup):  home → onboard → atSchool
 *   volta (dropoff): atSchool → onboard → delivered
 */

export const STATUS_CYCLE = ['home', 'onboard', 'atSchool', 'delivered'];

/**
 * Decide qual ação mostrar baseado no status efetivo + direção do turno.
 * Retorna { label, shortLabel, nextStatus, variant } ou null quando não há
 * ação possível naquele turno.
 */
export function getActionForStatus(status, direction) {
  if (direction === 'pickup') {
    if (status === 'home') {
      return {
        label: 'Embarcar',
        shortLabel: 'EMBARQUEI',
        nextStatus: 'onboard',
        variant: 'primary',
      };
    }
    if (status === 'onboard') {
      return {
        label: 'Entregar na escola',
        shortLabel: 'ENTREGUEI NA ESCOLA',
        nextStatus: 'atSchool',
        variant: 'success',
      };
    }
    return null; // atSchool ou delivered: nada a fazer na ida
  }
  // dropoff
  if (status === 'atSchool') {
    return {
      label: 'Embarcar pra casa',
      shortLabel: 'EMBARQUEI',
      nextStatus: 'onboard',
      variant: 'primary',
    };
  }
  if (status === 'onboard') {
    return {
      label: 'Entregar em casa',
      shortLabel: 'ENTREGUEI',
      nextStatus: 'delivered',
      variant: 'success',
    };
  }
  return null;
}

/**
 * Avança UMA criança pro próximo status.
 * Mantido separado do batch pra continuar tocando o som de feedback.
 */
/**
 * Distância entre onde o tio estava e onde a criança deveria estar.
 *
 * POR QUE ISTO EXISTE
 * "Entregue" é a informação mais séria do app: é o pai lendo que o filho
 * chegou. Se ela pode ser marcada de qualquer lugar sem deixar rastro,
 * ela vale menos do que parece — inclusive contra ERRO honesto, que é o
 * caso comum: o tio toca no cartão errado da lista e marca a criança
 * que ainda está na perua.
 *
 * Guardamos a distância no momento da marcação. Não bloqueia nada e não
 * acusa ninguém: cria o rastro que permite conferir depois.
 *
 * OPORTUNISTA de propósito: usa a posição que o rastreamento JÁ gravou.
 * Nunca pede GPS na hora — pedir permissão no meio da rota travaria a
 * ação, e uma verificação que atrasa o trabalho é uma verificação que o
 * tio vai querer desligar.
 */
function checkpointFrom(context, nextStatus) {
  const pos = context?.driverPosition;
  if (!pos?.lat || !pos?.lng) return null;

  // Só faz sentido conferir onde há um destino esperado.
  const target =
    nextStatus === 'delivered'
      ? context?.home
      : nextStatus === 'atSchool'
      ? context?.school
      : null;

  const checkpoint = {
    lat: pos.lat,
    lng: pos.lng,
    at: new Date().toISOString(),
  };

  if (target?.lat && target?.lng) {
    checkpoint.distanceKm = Number(
      haversineDistance(target.lat, target.lng, pos.lat, pos.lng).toFixed(3)
    );
  }
  return checkpoint;
}

/**
 * Avança UMA criança pro próximo status.
 *
 * `context` é opcional: { driverPosition, home, school }. Quando vem,
 * gravamos de onde a marcação foi feita — ver `checkpointFrom`.
 */
export async function advanceChild(childId, nextStatus, context = null) {
  if (!childId || !nextStatus) return;

  const updates = {
    status: nextStatus,
    statusUpdatedAt: serverTimestamp(),
  };

  const checkpoint = checkpointFrom(context, nextStatus);
  if (checkpoint) updates.lastStatusCheckpoint = checkpoint;

  const batch = writeBatch(db);
  batch.update(doc(db, 'children', childId), updates);

  // O marco vai no MESMO batch. Escrita separada poderia deixar "entregue" sem
  // a hora da entrega — e a hora que falta é justamente a que alguém procura.
  if (context?.dateKey) {
    anotarMarco(batch, {
      childId,
      dateKey: context.dateKey,
      status: nextStatus,
      contexto: {
        adminUid: context.adminUid,
        parentUid: context.parentUid,
        checkpoint,
      },
    });
  }

  await batch.commit();

  await avisarChegadas([
    {
      parentUid: context?.parentUid,
      childId,
      childName: context?.childName,
      status: nextStatus,
    },
  ]);

  playSound('status_change');
}

/**
 * Avança VÁRIAS crianças de uma vez — "embarquei todos", "cheguei na escola".
 *
 * Uma parada é um evento, não vinte: marcar criança por criança custava mais
 * de quarenta toques precisos com vinte crianças, em veículo em movimento.
 *
 * Recebe uma lista de { childId, nextStatus } pra que crianças em estados
 * diferentes possam avançar no mesmo lote. Ignora entradas sem nextStatus
 * (criança que já não tem ação naquele turno).
 *
 * Firestore aceita 500 operações por batch, mas o limite que morde aqui é
 * outro: 20 `get()` por requisição. Ver o CHUNK abaixo.
 */
export async function advanceMany(moves, context = null) {
  const valid = (moves || []).filter((m) => m?.childId && m?.nextStatus);
  if (!valid.length) return 0;

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
  for (let i = 0; i < valid.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const m of valid.slice(i, i + CHUNK)) {
      const updates = {
        status: m.nextStatus,
        statusUpdatedAt: serverTimestamp(),
      };

      // O LOTE TAMBÉM DEIXA RASTRO. Antes não deixava, e o buraco era grande:
      // `advanceChild` gravava `lastStatusCheckpoint` porque "entregue é a
      // informação mais séria do app" — mas o botão de lote é justamente o
      // caminho que marca VINTE crianças como entregues em casa de uma vez,
      // e passava sem uma linha de rastro. O mecanismo anti-erro existia só
      // no caminho que quase ninguém usa.
      //
      // A distância é por criança e é isso que denuncia o lote apertado cedo
      // demais: no lote legítimo (todos na escola) todas as distâncias são
      // pequenas; no lote errado, as das casas seguintes são quilômetros.
      const checkpoint = checkpointFrom(
        { driverPosition: context?.driverPosition, home: m.home, school: m.school },
        m.nextStatus
      );
      if (checkpoint) updates.lastStatusCheckpoint = checkpoint;

      batch.update(doc(db, 'children', m.childId), updates);

      if (context?.dateKey) {
        anotarMarco(batch, {
          childId: m.childId,
          dateKey: context.dateKey,
          status: m.nextStatus,
          contexto: {
            adminUid: context.adminUid,
            parentUid: m.parentUid,
            checkpoint,
          },
        });
      }
    }
    await batch.commit();
  }

  await avisarChegadas(
    valid.map((m) => ({
      parentUid: m.parentUid,
      childId: m.childId,
      childName: m.childName,
      status: m.nextStatus,
    }))
  );

  // Som PRÓPRIO do lote, e não o mesmo do toque individual.
  //
  // Marcar cinco de uma vez soava exatamente igual a marcar uma. Com o
  // veículo em movimento ele não tinha como distinguir "peguei a Ana" de
  // "peguei todas" sem conferir a lista — e conferir lista dirigindo é o que
  // esta tela existe pra evitar.
  playSound('lote');
  return valid.length;
}

/**
 * AVISA O RESPONSÁVEL QUE A CRIANÇA CHEGOU.
 *
 * POR QUE FALTAVA, E POR QUE DÓI
 * O app avisava bem sobre dinheiro, falta e recado — e era mudo justamente
 * sobre a criança. O tracker mostrava "na escola" e "voltou", mas só pra quem
 * estivesse com o app ABERTO. Quem está no trabalho não tinha como saber que o
 * filho chegou sem parar o que estava fazendo e abrir o app.
 *
 * Escrever em `notifications` já vira push: a Cloud Function
 * `sendPushOnNotification` dispara em qualquer documento criado ali.
 *
 * SÓ AS DUAS CHEGADAS, E NÃO OS QUATRO PASSOS
 * Embarcou na ida, chegou na escola, embarcou na volta, chegou em casa — quatro
 * pushes por dia por criança é o caminho mais curto pra ele desligar as
 * notificações do app, levando junto o aviso de falta e o de pagamento. As
 * chegadas são as que respondem a pergunta que ele tem de verdade.
 *
 * FORA DO BATCH, E ISSO NÃO É DESCUIDO
 * A tentação é gravar junto com o status, pelo mesmo motivo do marco da
 * viagem: atomicidade. Mas a regra de `notifications` resolve o destinatário
 * com um `get()` em `users/{userId}` — um documento DIFERENTE por família.
 * Somado ao `get()` que a regra de `rides` já faz, o lote de "embarquei todos"
 * passaria do teto de 20 acessos por requisição, voltaria 403, e o batch é
 * atômico: NADA salvaria, com as crianças já embarcadas de verdade. É o mesmo
 * buraco que o CHUNK de 15 existe pra evitar.
 *
 * Fora do batch a ordem fica até melhor: o status grava primeiro, e o aviso
 * sai depois de ele existir. O preço é que uma falha aqui custa a notificação
 * — e notificação perdida é muito mais barato que marcação perdida.
 */
const TEXTO_DA_CHEGADA = {
  atSchool: {
    title: 'Chegou na escola',
    corpo: (nome, hora) => `${nome} chegou na escola às ${hora}.`,
  },
  delivered: {
    title: 'Chegou em casa',
    corpo: (nome, hora) => `${nome} chegou em casa às ${hora}.`,
  },
};

async function avisarChegadas(avisos) {
  const validos = (avisos || []).filter(
    (a) => a?.parentUid && TEXTO_DA_CHEGADA[a.status]
  );
  if (!validos.length) return;

  const agora = new Date();
  const hora = `${String(agora.getHours()).padStart(2, '0')}:${String(
    agora.getMinutes()
  ).padStart(2, '0')}`;

  await Promise.all(
    validos.map((a) => {
      const texto = TEXTO_DA_CHEGADA[a.status];
      const nome = (a.childName || '').split(' ')[0] || 'A criança';
      return addDoc(collection(db, 'notifications'), {
        userId: a.parentUid,
        type:
          a.status === 'delivered' ? 'child_arrived_home' : 'child_arrived_school',
        title: texto.title,
        body: texto.corpo(nome, hora),
        childId: a.childId,
        createdAt: serverTimestamp(),
      }).catch((err) => {
        // Silencioso de propósito: o motorista não pode ver erro de
        // notificação no meio da rota. A marcação — que é o que importa — já
        // está gravada quando isto roda.
        console.error('Falha ao avisar chegada:', err);
      });
    })
  );
}

/**
 * O status que VALE pra esta direção, considerando o que o pai declarou hoje.
 *
 * POR QUE ISTO EXISTE
 * Quando o pai declara "eu vou levar de manhã", nada marca a criança como
 * `atSchool`: `AbsenceSheet` só grava a declaração, e as rules — corretamente
 * — proíbem o pai de escrever `status`. À tarde, `getActionForStatus('home',
 * 'dropoff')` devolve null: a criança SOME da fila da volta e o tio não
 * consegue registrar a entrega dela em casa.
 *
 * Quando é o TIO que marca a mesma coisa, o Kanban chama `updateChildStatus`
 * na mão e funciona. Ou seja: o mesmo fato do mundo produzia dois resultados
 * diferentes dependendo de quem digitou.
 *
 * A correção não é dar escrita ao pai. É DERIVAR na leitura: a declaração do
 * dia é um fato tão bom quanto o campo, e derivar não precisa de permissão.
 */
export function statusNaDirecao(child, declaracao, direction) {
  // Parte do status EFETIVO, não do campo cru: `getEffectiveStatus` devolve
  // 'home' quando o `statusUpdatedAt` é de ontem. Sem isso o 'delivered' de
  // ontem vazaria pra hoje e a criança nasceria o dia já entregue.
  const base = getEffectiveStatus(child);
  if (!declaracao) return base;

  // "O pai leva de manhã": pra rota da VOLTA, a criança está na escola —
  // ainda que ninguém tenha tocado no botão de embarcar.
  if (
    direction === 'dropoff' &&
    declaracao.type === ABSENCE_TYPES.NO_PICKUP &&
    base === 'home'
  ) {
    return 'atSchool';
  }
  return base;
}
