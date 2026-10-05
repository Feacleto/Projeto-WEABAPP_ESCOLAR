import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { idDoRecado, textoDoRecado } from '../dominio/rota/recadoDoDia.js';

/**
 * O RECADO DO DIA DA FAMÍLIA PARA O TIO (05/10/2026) —
 * `recadosDoDia/{AAAA-MM-DD}_{childId}`. A régua (teto de 140, id) é
 * `dominio/rota/recadoDoDia.js`.
 *
 * Quem escreve é a FAMÍLIA, só do próprio filho; o tio só lê; a auxiliar nem
 * lê (rules). O `adminUid` e o `parentUid` vêm da CRIANÇA — a rule confere os
 * dois contra o documento dela, como em `altPickups`.
 *
 * ⚠️ CRIAR E EDITAR SÃO ESCRITAS DIFERENTES: na edição a rule só aceita
 * mudar `texto` e `atualizadoEm` (o dia, a criança e os donos não mudam).
 * Por isso a edição é `updateDoc` com os dois campos, nunca um `setDoc` do
 * documento inteiro.
 */

/** O recado de um dia de UMA criança (a tela da família). `null` = não há. */
export function watchRecadoDoDia(dateKey, childId, onUpdate) {
  if (!dateKey || !childId) {
    onUpdate(null);
    return () => {};
  }
  // Escuta pelo id: o documento do dia pode ainda não existir, e a rule tem
  // o ramo `resource == null` para isso (o mesmo de `altPickups`).
  return onSnapshot(
    doc(db, 'recadosDoDia', idDoRecado(dateKey, childId)),
    (snap) => onUpdate(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    (err) => {
      console.error('watchRecadoDoDia:', err);
      onUpdate(null);
    }
  );
}

/**
 * Grava o recado do dia. `existe` diz se já há um (então só o texto muda).
 * Lança com a frase da régua quando o texto não serve.
 */
export async function salvarRecadoDoDia({ child, dateKey, texto, existe }) {
  const r = textoDoRecado(texto);
  if (!r.ok) throw new Error(r.erro);
  if (!child?.id || !dateKey) throw new Error('Sem criança ou dia.');
  const ref = doc(db, 'recadosDoDia', idDoRecado(dateKey, child.id));
  if (existe) {
    await updateDoc(ref, { texto: r.texto, atualizadoEm: serverTimestamp() });
    return r.texto;
  }
  await setDoc(ref, {
    childId: child.id,
    parentUid: child.parentUid || null,
    adminUid: child.adminUid || null,
    dateKey,
    texto: r.texto,
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
  return r.texto;
}

export async function apagarRecadoDoDia(dateKey, childId) {
  if (!dateKey || !childId) return;
  await deleteDoc(doc(db, 'recadosDoDia', idDoRecado(dateKey, childId)));
}

/**
 * OS RECADOS DO DIA DA TURMA, PARA O TIO — UMA consulta, nunca uma escuta
 * por criança. `adminUid == ele` E `dateKey == hoje`: a rule exige o filtro
 * do dono, e duas igualdades não pedem índice composto (o Firestore junta
 * os índices de campo único). `{ [childId]: recado }`.
 */
export function watchRecadosDoDiaDaTurma(adminUid, dateKey, onUpdate) {
  if (!adminUid || !dateKey) {
    onUpdate({});
    return () => {};
  }
  const q = query(
    collection(db, 'recadosDoDia'),
    where('adminUid', '==', adminUid),
    where('dateKey', '==', dateKey)
  );
  return onSnapshot(
    q,
    (snap) => {
      const porCrianca = {};
      snap.docs.forEach((d) => {
        const r = d.data();
        if (r.childId) porCrianca[r.childId] = { id: d.id, ...r };
      });
      onUpdate(porCrianca);
    },
    (err) => {
      console.error('watchRecadosDoDiaDaTurma:', err);
      onUpdate({});
    }
  );
}
