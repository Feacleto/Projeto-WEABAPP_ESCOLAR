import {
  collection,
  addDoc,
  serverTimestamp,
  writeBatch,
  doc,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { ABSENCE_TYPES } from './absencesService';

/**
 * "Sem aula" — broadcast por escola. Quando o Tio dispara:
 *   1. Cria um doc em `schoolBroadcasts/{id}` (histórico).
 *   2. Cria notificação pra cada pai daquela escola.
 *   3. Marca ausência `full` em `absenceDeclarations/{date}_{childId}` pra cada criança.
 *
 * Tudo agrupado num batch pra ficar atômico (Firestore garante).
 *
 * Params:
 *   - schoolName: string
 *   - dateKey: 'YYYY-MM-DD'
 *   - message: string (opcional)
 *   - adminUid: uid de quem disparou
 *   - children: array de crianças ativas {id, name, school, parentUid, ...}
 */
export async function createSchoolBroadcast({
  schoolName,
  dateKey,
  message,
  adminUid,
  children,
}) {
  if (!schoolName || !dateKey || !adminUid) {
    throw new Error('Dados insuficientes pra criar aviso.');
  }
  const affected = (children || []).filter(
    (c) => c.school === schoolName && c.active !== false
  );

  // 1) histórico
  const broadcastRef = await addDoc(collection(db, 'schoolBroadcasts'), {
    schoolName,
    date: dateKey,
    message: message?.trim() || '',
    createdBy: adminUid,
    affectedChildIds: affected.map((c) => c.id),
    createdAt: serverTimestamp(),
  });

  // 2) + 3) — batch de notifs + ausências
  const batch = writeBatch(db);
  const labelDate = formatDateLabel(dateKey);
  const body = message?.trim()
    ? `Não haverá aula em ${schoolName} (${labelDate}). ${message.trim()}`
    : `Não haverá aula em ${schoolName} (${labelDate}).`;

  for (const c of affected) {
    // Notificação pro pai (só se tiver parentUid vinculado)
    if (c.parentUid) {
      const notifRef = doc(collection(db, 'notifications'));
      batch.set(notifRef, {
        userId: c.parentUid,
        type: 'school_no_class',
        title: 'Sem aula amanhã' /* genérico */,
        body,
        broadcastId: broadcastRef.id,
        dateKey,
        schoolName,
        createdAt: serverTimestamp(),
      });
    }
    // Ausência automática — id estável evita duplicar com declaração do pai
    const absRef = doc(db, 'absenceDeclarations', `${dateKey}_${c.id}`);
    batch.set(absRef, {
      dateKey,
      childId: c.id,
      childName: c.name || '',
      parentUid: c.parentUid || null,
      type: ABSENCE_TYPES.FULL,
      declaredBy: 'admin',
      note: `Sem aula em ${schoolName}`,
      broadcastId: broadcastRef.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();

  return {
    broadcastId: broadcastRef.id,
    affectedCount: affected.length,
  };
}

function formatDateLabel(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return dateKey;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(y, m - 1, d));
}
