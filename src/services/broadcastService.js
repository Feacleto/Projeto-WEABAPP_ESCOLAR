import {
  collection,
  addDoc,
  serverTimestamp,
  writeBatch,
  doc,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { ABSENCE_TYPES } from './absencesService';
import { playSound } from './soundService';
// A parte pura (intervalo, dias úteis, rótulos) mora em utils pra poder ser
// testada sem Firebase — e é ela que decide em que dia a ausência é gravada.
import { diasUteis, rotuloDoPeriodo } from '../utils/intervaloDeDias';

export {
  diasUteis,
  rotuloDoPeriodo,
  rotuloDoDia,
  MAX_DIAS,
  truncouIntervalo,
} from '../utils/intervaloDeDias';

/**
 * "Sem aula" — o aviso que o motorista dispara e que já sai virando ausência.
 *
 * Quando ele avisa, três coisas acontecem de uma vez:
 *   1. um doc em `schoolBroadcasts/{id}` guarda o histórico;
 *   2. cada responsável recebe uma notificação;
 *   3. cada criança ganha ausência `full` em cada dia atingido — a rota do dia
 *      já nasce sem elas, sem ele precisar marcar uma a uma.
 *
 * O QUE MUDOU E POR QUÊ
 *
 * INTERVALO DE DATAS. Era um dia só. "Não vai ter aula de segunda a quarta por
 * causa da reunião do conselho" obrigava o motorista a disparar o mesmo aviso
 * três vezes — e três avisos separados chegam pro pai como três sustos.
 *
 * SELEÇÃO DE CRIANÇAS. Pegava a escola INTEIRA. Mas o caso comum é o contrário:
 * o recado veio da professora de uma turma, e serve pra três crianças. Sem
 * poder escolher, ou ele avisava famílias que não deviam ser avisadas, ou não
 * usava o recurso.
 *
 * ESCOLA POR ID. O agrupamento era `c.school === schoolName`, comparação exata
 * de string digitada à mão. "E.M." numa criança e "EM" na outra eram duas
 * escolas, e o aviso alcançava metade da turma — a outra metade mandava a
 * criança pro portão fechado. Agora casa por `schoolId`, com o nome só como
 * texto do recado.
 */

/**
 * Dispara o aviso.
 *
 * @param {object} p
 * @param {string} p.escolaId       — id da escola (pode ser null em base legada)
 * @param {string} p.escolaNome     — nome, só pro texto do recado
 * @param {string} p.de             — 'YYYY-MM-DD'
 * @param {string} [p.ate]          — 'YYYY-MM-DD'; ausente = um dia só
 * @param {string} [p.message]
 * @param {string} p.adminUid
 * @param {Array}  p.children       — as crianças ESCOLHIDAS
 */
export async function createSchoolBroadcast({
  escolaId,
  escolaNome,
  de,
  ate,
  message,
  adminUid,
  children,
}) {
  if (!adminUid) throw new Error('Sem sessão.');
  const dias = diasUteis(de, ate);
  if (!dias.length) throw new Error('Escolha pelo menos um dia útil.');

  const alcancadas = (children || []).filter((c) => c?.active !== false);
  if (!alcancadas.length) throw new Error('Escolha pelo menos uma criança.');

  const broadcastRef = await addDoc(collection(db, 'schoolBroadcasts'), {
    escolaId: escolaId || null,
    schoolName: escolaNome || '',
    dias,
    // `date` (singular) continua gravado pro histórico antigo continuar
    // legível junto do novo, sem migração.
    date: dias[0],
    message: message?.trim() || '',
    createdBy: adminUid,
    adminUid,
    affectedChildIds: alcancadas.map((c) => c.id),
    createdAt: serverTimestamp(),
  });

  const periodo = rotuloDoPeriodo(dias);
  const corpo = message?.trim()
    ? `Não haverá aula em ${escolaNome} (${periodo}). ${message.trim()}`
    : `Não haverá aula em ${escolaNome} (${periodo}).`;

  // Uma notificação por responsável, não uma por dia: cinco avisos iguais
  // chegam como cinco sustos e o pai desliga a notificação do app.
  const ops = [];
  for (const c of alcancadas) {
    if (c.parentUid) {
      ops.push((batch) => {
        const ref = doc(collection(db, 'notifications'));
        batch.set(ref, {
          userId: c.parentUid,
          type: 'school_no_class',
          title: dias.length > 1 ? 'Dias sem aula' : 'Sem aula',
          body: corpo,
          broadcastId: broadcastRef.id,
          dateKey: dias[0],
          dias,
          schoolName: escolaNome || '',
          createdAt: serverTimestamp(),
        });
      });
    }

    // Uma ausência por criança POR DIA. Id estável (`{dia}_{criança}`) pra não
    // duplicar com a declaração que o pai já tenha feito — e pra reenviar o
    // mesmo aviso ser idempotente em vez de criar lixo.
    for (const dia of dias) {
      ops.push((batch) => {
        batch.set(doc(db, 'absenceDeclarations', `${dia}_${c.id}`), {
          dateKey: dia,
          childId: c.id,
          childName: c.name || '',
          parentUid: c.parentUid || null,
          adminUid,
          type: ABSENCE_TYPES.FULL,
          declaredBy: 'admin',
          note: `Sem aula em ${escolaNome}`,
          broadcastId: broadcastRef.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
    }
  }

  // Firestore aceita 500 operações por batch. Vinte crianças por vinte dias
  // são quatrocentas ausências — fatiar deixou de ser precaução e virou
  // requisito quando o intervalo entrou.
  const CHUNK = 400;
  for (let i = 0; i < ops.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const aplicar of ops.slice(i, i + CHUNK)) aplicar(batch);
    await batch.commit();
  }

  // Som de "gravou". Mora no serviço e não na tela porque o mesmo fato é
  // disparado de mais de um lugar — e um som que só toca em metade dos
  // caminhos ensina que o silêncio às vezes também é sucesso.
  playSound('salvo');

  return {
    broadcastId: broadcastRef.id,
    affectedCount: alcancadas.length,
    dias,
  };
}
