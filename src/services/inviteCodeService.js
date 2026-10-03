import {
  collection,
  doc,
  getDoc,
  query,
  where,
  getDocs,
  limit,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../firebase/config';
import { exigirCloud } from './callableError';
import { generateInviteCode } from '../dominio/identidade/generateInviteCode';

// SÓ O FORMATO NOVO (03/10/2026): 2 letras + 6 caracteres sem ambiguidade.
// O legado (2 letras + 4 dígitos) saiu do servidor — 9.000 combinações eram
// varríveis —, e aceitá-lo aqui só gastaria uma chamada para ouvir "não".
const CODE_RE = /^[A-Z]{2}[ABCDEFGHJKMNPQRSTVWXYZ23456789]{6}$/;

/**
 * A RECUSA ÚNICA (03/10/2026). O servidor responde igual para convite
 * inexistente, já usado e vencido — distinguir ensinava a quem varre códigos
 * que acertou um. A tela oferece "entrar com sua conta" a quem já entrou.
 * O mesmo texto de `functions/lib/reguaDoConvite.js`.
 */
export const MENSAGEM_DO_CONVITE_RECUSADO =
  'Este convite não vale mais. Peça um link novo ao motorista.';

const MENSAGEM_DE_LIMITE = 'Muitas tentativas seguidas. Espere um pouco e tente de novo.';

/** Normaliza o que veio do teclado do celular: maiúsculas, sem espaço/traço. */
export function normalizeInviteCode(raw) {
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/** O erro da callable de convite, na frase que a tela mostra. */
function erroDoConvite(err, padrao) {
  const c = String(err?.code || '');
  if (c.includes('not-found')) return new Error(MENSAGEM_DO_CONVITE_RECUSADO, { cause: err });
  if (c.includes('resource-exhausted')) return new Error(MENSAGEM_DE_LIMITE, { cause: err });
  return new Error(padrao, { cause: err });
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
 * motorista.
 *
 * Retorna { childFirstName, driverFirstName, companyName }.
 */
export async function lookupInvite(rawCode) {
  const code = normalizeInviteCode(rawCode);
  if (!CODE_RE.test(code)) throw new Error(MENSAGEM_DO_CONVITE_RECUSADO);
  exigirCloud('conferir o convite');
  const fn = httpsCallable(functions, 'lookupInvite');
  try {
    const res = await fn({ code });
    return res.data;
  } catch (err) {
    throw erroDoConvite(err, 'Não conseguimos verificar o convite. Tente de novo.');
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
 * Retorna { status, childFirstName, driverFirstName, companyName,
 *           monthlyFee, nextPayment, notices, childId? }.
 *
 *   'pending' → ninguém pegou ainda e está no prazo: a prévia completa
 *   'yours'   → quem está chamando JÁ é o responsável: entra direto no app
 *
 * Qualquer outro caso (não existe, vinculado a outra conta, vencido) é a
 * recusa única, que chega aqui como erro com `MENSAGEM_DO_CONVITE_RECUSADO`.
 *
 * O caso 'yours' é o mais importante e o mais percorrido. Na prática o pai
 * não guarda o endereço do site nem pede link novo ao tio: ele volta na
 * conversa do WhatsApp e toca no MESMO link, pra sempre. Esse link é a porta
 * de entrada permanente do app, não um passo de cadastro — e o prazo de 15
 * dias não vale para ele.
 */
export async function getInvitePreview(rawCode) {
  const code = normalizeInviteCode(rawCode);
  if (!CODE_RE.test(code)) throw new Error(MENSAGEM_DO_CONVITE_RECUSADO);
  exigirCloud('abrir o convite');
  const fn = httpsCallable(functions, 'getInvitePreview');
  try {
    const res = await fn({ code });
    return res.data;
  } catch (err) {
    throw erroDoConvite(err, 'Não conseguimos abrir o convite. Tente de novo.');
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
  // O ESCOPO É REQUISITO DA REGRA, e sem ele a consulta é negada INTEIRA.
  //
  // `children` exige `adminUid == request.auth.uid` na leitura. Uma consulta
  // só por `inviteCode` não prova isso, então o Firestore recusa tudo — e
  // como o chamador engole o erro, a checagem de colisão respondia "não
  // existe" SEMPRE. Dois convites com o mesmo código passariam.
  //
  // Conferir só dentro das crianças deste motorista é suficiente: o código
  // só precisa ser único pra quem vai usá-lo.
  const dono = auth.currentUser?.uid;
  if (!dono) return false;
  const q = query(
    collection(db, 'children'),
    where('adminUid', '==', dono),
    where('inviteCode', '==', code),
    limit(1)
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

/**
 * "GERAR LINK NOVO" (03/10/2026). O convite vale 15 dias (decisão do dono), e
 * o link velho pode estar no WhatsApp de quem não devia — então o motorista
 * troca o CÓDIGO, não só a data: o link antigo para de abrir na hora.
 *
 * Só para convite ainda não usado: para quem já entrou, o link é a porta de
 * volta ao app e trocá-lo a deixaria do lado de fora. A tela só oferece o
 * botão nesse caso; o servidor recusa o antigo de qualquer forma, porque ele
 * busca pelo código.
 *
 * Devolve o código novo.
 */
export async function gerarLinkNovo(childId) {
  for (let i = 0; i < 10; i++) {
    const code = generateInviteCode();
    if (!(await inviteCodeExists(code))) {
      await updateDoc(doc(db, 'children', childId), {
        inviteCode: code,
        inviteCriadoEm: serverTimestamp(),
      });
      return code;
    }
  }
  throw new Error('Não foi possível gerar um link novo. Tente de novo.');
}
