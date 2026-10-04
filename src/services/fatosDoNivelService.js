import {
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * O QUE O APARELHO DO MOTORISTA LÊ PARA MONTAR OS FATOS DO NÍVEL, e os três
 * marcos que só o próprio cliente consegue gravar (docs/niveis.md, seção 4).
 *
 * ── SÓ O QUE ELE JÁ PODE LER
 * Nada aqui abre permissão nova: `users/{uid}` é o doc dele, `payments` e
 * `acessosTemporarios` são consultas escopadas pelo `adminUid` dele — o mesmo
 * filtro que as rules exigem para devolver qualquer coisa.
 *
 * ── CONTAGEM, NÃO LISTA
 * A régua só pergunta "já houve pelo menos um?" para baixa e para acesso de
 * 24 horas. Por isso as duas escutas têm `limit(1)`: baixar o histórico de
 * mensalidades para responder sim ou não seria ler um ano de dinheiro das
 * famílias à toa.
 *
 * ── POR QUE O DOC DO USUÁRIO É ESCUTADO AQUI, E NÃO LIDO DO `profile`
 * `AuthContext` lê `users/{uid}` UMA vez, no login (ver TioSelo.jsx). O
 * `fcmTokens` muda pelo `sincronizarPush`, e os `marcos` mudam por este
 * arquivo — o checklist do "Meu nível" mostraria "a fazer" o que ele acabou
 * de fazer.
 *
 * ── ⚠️ OS MARCOS SÃO GRAVADOS PELO CLIENTE, E ISSO É DECIDIDO
 * `users.marcos.*` e `children.conviteEnviadoEm` são a mesma troca consciente
 * de `users.ultimaRota` (CLAUDE.md): mentir ali exige devtools e só faz ele
 * subir um degrau de APRENDIZADO — nunca mexe em dinheiro nem em cláusula.
 * O `update` de `users` é lista de PROIBIDOS e o ramo do motorista em
 * `children` aceita qualquer campo fora da saúde, então nenhuma rule nova.
 */

/** O documento do próprio motorista, ao vivo. `{}` sem documento ou com erro. */
export function watchUsuarioDoNivel(uid, onUpdate) {
  if (!uid) {
    onUpdate({});
    return () => {};
  }
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => onUpdate(snap.exists() ? snap.data() : {}),
    (err) => {
      console.error('[fatosDoNivel] users:', err);
      onUpdate({});
    }
  );
}

/** 1 se ele já deu baixa em alguma mensalidade, 0 se não. */
export function watchAlgumaBaixa(uid, onUpdate) {
  if (!uid) {
    onUpdate(0);
    return () => {};
  }
  const q = query(
    collection(db, 'payments'),
    where('adminUid', '==', uid),
    where('status', '==', 'paid'),
    limit(1)
  );
  return onSnapshot(
    q,
    (snap) => onUpdate(snap.size),
    (err) => {
      console.error('[fatosDoNivel] payments:', err);
      onUpdate(0);
    }
  );
}

/**
 * 1 se ELE já mandou um acesso de 24 horas, 0 se não. Conta o gesto dele,
 * nunca o da família (regra 3): o acesso que a titular gerou também carrega o
 * `adminUid` dele, e por isso o filtro em `criadoPor`.
 */
export function watchAlgumAcessoCriado(uid, onUpdate) {
  if (!uid) {
    onUpdate(0);
    return () => {};
  }
  const q = query(
    collection(db, 'acessosTemporarios'),
    where('adminUid', '==', uid),
    where('criadoPor', '==', 'motorista'),
    limit(1)
  );
  return onSnapshot(
    q,
    (snap) => onUpdate(snap.size),
    (err) => {
      console.error('[fatosDoNivel] acessosTemporarios:', err);
      onUpdate(0);
    }
  );
}

/** O app foi aberto instalado na tela de início. Gravado uma vez. */
export function marcarAppInstalado(uid) {
  if (!uid) return Promise.resolve();
  return updateDoc(doc(db, 'users', uid), { 'marcos.appInstalado': serverTimestamp() });
}

/** Ele viu o "De costume" de uma criança (atividade `horarioDeCostumeVisto`). */
export function marcarHorarioDeCostumeVisto(uid) {
  if (!uid) return Promise.resolve();
  return updateDoc(doc(db, 'users', uid), { 'marcos.horarioDeCostumeVisto': serverTimestamp() });
}

/**
 * Ele tocou em mandar o convite desta criança. É o GESTO que conta (regra 3);
 * a família entrar ou não é outra história. Regravar a cada toque é
 * inofensivo — a régua só pergunta se existe.
 */
export function marcarConviteEnviado(childId) {
  if (!childId) return Promise.resolve();
  return updateDoc(doc(db, 'children', childId), { conviteEnviadoEm: serverTimestamp() });
}
