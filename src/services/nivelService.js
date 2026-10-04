import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase/config';
import { exigirCloud, mensagemDeErro } from './callableError';

/**
 * O NÍVEL DO MOTORISTA — o selo oficial e as atividades de Platina
 * (docs/niveis.md).
 *
 * O selo oficial é o que o SERVIDOR grava em `niveis/{uid}` (agendada
 * `calcularNiveis` e callable `recalcularMeuNivel`, em
 * `functions/lib/niveis.js`). O documento tem SÓ o rótulo — `{ nivel, desde,
 * atualizadoEm }` — porque as famílias dele também o leem, e regra não esconde
 * campo. O checklist da tela "Meu nível" é recalculado no aparelho com a
 * mesma régua (`dominio/identidade/nivel.js`); este arquivo não calcula nada.
 *
 * Documento AUSENTE é "sem nível": o servidor não cria documento para quem
 * ainda não encerrou a primeira rota.
 */

/** Escuta `niveis/{uid}`. Entrega o documento ou `null`. */
export function watchNivel(uid, onUpdate, onError) {
  if (!uid) {
    onUpdate(null);
    return () => {};
  }
  return onSnapshot(
    doc(db, 'niveis', uid),
    (snap) => onUpdate(snap.exists() ? snap.data() : null),
    (err) => {
      console.error('watchNivel:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Pede ao servidor para recalcular o PRÓPRIO nível agora (ao encerrar a rota e
 * ao abrir "Meu nível"). O servidor usa o uid da sessão — não há parâmetro.
 * Devolve o nível (`'sem_nivel'`, `'bronze'`… `'diamante'`).
 */
export async function recalcularMeuNivel() {
  exigirCloud('atualizar o seu nível');
  try {
    const { data } = await httpsCallable(functions, 'recalcularMeuNivel')();
    return data?.nivel || 'sem_nivel';
  } catch (err) {
    throw new Error(mensagemDeErro(err, 'atualizar o seu nível'), { cause: err });
  }
}

/**
 * As atividades de Platina em vigor (`ativa == true`), com o id. A CONSULTA
 * filtra no banco — as desligadas não precisam viajar até o aparelho.
 */
export function watchAtividadesDaPlatina(onUpdate, onError) {
  const q = query(collection(db, 'atividadesDaPlatina'), where('ativa', '==', true));
  return onSnapshot(
    q,
    (snap) => onUpdate(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('watchAtividadesDaPlatina:', err);
      if (onError) onError(err);
    }
  );
}
