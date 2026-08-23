import {
  collection,
  doc,
  getDoc,
  query,
  where,
  getDocs,
  limit,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase/config';

// Aceita os dois formatos de convite: legado (2 letras + 4 dígitos) e
// novo (2 letras + 6 caracteres sem ambiguidade visual).
const CODE_RE = /^[A-Z]{2}(\d{4}|[ABCDEFGHJKMNPQRSTVWXYZ23456789]{6})$/;

/** Normaliza o que veio do teclado do celular: maiúsculas, sem espaço/traço. */
export function normalizeInviteCode(raw) {
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Pré-visualiza um convite ANTES de o responsável ter conta.
 *
 * Roda na Cloud Function `lookupInvite`, não aqui. A busca por inviteCode
 * no cliente exigia liberar leitura de toda criança com
 * `inviteStatus == 'pending'` nas rules — e como a landing autentica
 * anonimamente pra gravar leads, qualquer visitante do site conseguia
 * listar as crianças com nome, endereço, coordenada, escola e telefone
 * do responsável.
 *
 * A função devolve de propósito o mínimo: primeiro nome da criança e do
 * motorista. Assim, mesmo varrendo os 9.000 códigos possíveis, ninguém
 * colhe dado pessoal útil.
 *
 * Retorna { childFirstName, driverFirstName, companyName }.
 */
export async function lookupInvite(rawCode) {
  const code = normalizeInviteCode(rawCode);
  if (!CODE_RE.test(code)) {
    throw new Error('Código inválido. São 2 letras e 4 números (ex: TN4582).');
  }
  const fn = httpsCallable(functions, 'lookupInvite');
  try {
    const res = await fn({ code });
    return res.data;
  } catch (err) {
    const c = String(err?.code || '');
    if (c.includes('not-found')) {
      throw new Error('Convite não encontrado ou já usado.', { cause: err });
    }
    if (c.includes('invalid-argument')) {
      throw new Error('Código inválido. São 2 letras e 4 números.', { cause: err });
    }
    throw new Error('Não conseguimos verificar o convite. Tente de novo.', {
      cause: err,
    });
  }
}


/**
 * Prévia do convite — o que aparece ANTES de o responsável ter conta.
 *
 * Mais rica que `lookupInvite`: além do nome, traz a mensalidade em aberto
 * e a contagem de recados. É o que faz o pai entender o app sem digitar
 * nada. O conteúdo dos recados fica de fora de propósito — recado pode
 * falar de saúde da criança ou de outra família.
 *
 * Abrir o link NÃO consome o convite: o robô do WhatsApp busca a URL pra
 * montar o cartão de prévia, e não queremos que ele gaste o convite.
 *
 * Retorna { status: "pending" | "used", childFirstName, driverFirstName,
 *           companyName, monthlyFee, nextPayment, notices }.
 */
export async function getInvitePreview(rawCode) {
  const code = normalizeInviteCode(rawCode);
  if (!CODE_RE.test(code)) {
    throw new Error('Link de convite inválido. Peça outro ao motorista.');
  }
  const fn = httpsCallable(functions, 'getInvitePreview');
  try {
    const res = await fn({ code });
    return res.data;
  } catch (err) {
    const c = String(err?.code || '');
    if (c.includes('not-found')) {
      throw new Error('Este convite não existe. Peça um link novo ao motorista.', {
        cause: err,
      });
    }
    if (c.includes('invalid-argument')) {
      throw new Error('Link de convite inválido.', { cause: err });
    }
    throw new Error('Não conseguimos abrir o convite. Tente de novo.', {
      cause: err,
    });
  }
}
/**
 * Verifica se já existe ao menos um administrador no app.
 *
 * Lê o doc público appState/init (criado por createFirstAdmin).
 * Não consulta a coleção users — assim podemos manter as rules estritas.
 */
export async function adminExists() {
  const snap = await getDoc(doc(db, 'appState', 'init'));
  return snap.exists() && snap.data().hasAdmin === true;
}

/**
 * Verifica se um inviteCode específico já existe em qualquer children doc.
 * Usado pelo ADMIN ao gerar novos códigos pra evitar colisão — o admin lê
 * children livremente pelas rules, então segue no cliente.
 */
export async function inviteCodeExists(code) {
  const q = query(
    collection(db, 'children'),
    where('inviteCode', '==', code),
    limit(1)
  );
  const snap = await getDocs(q);
  return !snap.empty;
}
