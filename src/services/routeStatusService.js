import { doc, writeBatch, serverTimestamp } from 'firebase/firestore';
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
 * Firestore aceita 500 operações por batch; ver o CHUNK abaixo.
 */
export async function advanceMany(moves, context = null) {
  const valid = (moves || []).filter((m) => m?.childId && m?.nextStatus);
  if (!valid.length) return 0;

  // 200 e não 400: cada criança agora custa DUAS operações no batch (o doc
  // dela e o marco da viagem), e o teto do Firestore é 500.
  const CHUNK = 200;
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
  playSound('status_change');
  return valid.length;
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
