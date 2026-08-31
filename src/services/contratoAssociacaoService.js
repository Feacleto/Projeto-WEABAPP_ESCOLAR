import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  VERSAO_CONTRATO,
  montarContrato,
  diasParaVencer,
  precisaRenovar,
} from '../dominio/associacao/contratoAssociacao';

export { VERSAO_CONTRATO, montarContrato, diasParaVencer, precisaRenovar };

/**
 * O CONTRATO ENTRE A PLATAFORMA E O MOTORISTA.
 *
 * Não confundir com `contractService`, que é o contrato entre o MOTORISTA e o
 * RESPONSÁVEL. São dois documentos, em dois níveis: um rege o transporte da
 * criança, este rege o uso do sistema.
 *
 * ELE NASCE DO ORÇAMENTO, NÃO É DIGITADO
 * Valor, periodicidade, carência e vigência vêm da negociação gravada em
 * `taxaParceiros`. Reescrever à mão criaria a possibilidade de o papel
 * discordar do sistema — e num documento aceito eletronicamente essa
 * divergência não é bug, é problema jurídico.
 *
 * ACEITE É DEFINITIVO, RENOVAÇÃO CRIA DOCUMENTO NOVO
 * Contrato aceito não se edita: nem pelo associado, nem pelo dono. As rules
 * garantem (`update` só passa em documento com `aceitoEm == null`, e o ramo do
 * associado só grava os quatro campos do aceite, uma vez). Renovar gera outro
 * documento e o anterior fica no histórico — reescrever o que já foi aceito
 * apagaria a prova do que tinha sido combinado antes.
 */

const COL = () => collection(db, 'contratosAssociacao');
const DOC = (id) => doc(db, 'contratosAssociacao', id);


/**
 * Impressão digital do conteúdo aceito.
 *
 * Mesma técnica do contrato entre motorista e responsável: SHA-256 do JSON
 * canônico. O que ela prova é estreito e é o que importa — que o texto aceito
 * foi ESTE, e não outro. Sem isso, "eu aceitei outra coisa" não tem como ser
 * respondido.
 */
export async function hashDoContrato(conteudo) {
  const texto = JSON.stringify(conteudo, Object.keys(conteudo).sort());
  const bytes = new TextEncoder().encode(texto);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Emite o contrato. Só o dono, e nasce SEM aceite.
 *
 * `aceitoEm: null` explícito em vez de campo ausente: a rule compara
 * `resource.data.aceitoEm == null`, e chave inexistente é erro de avaliação —
 * que nega. Nascer sem o campo tornaria o contrato impossível de aceitar.
 */
export async function emitirContrato({ tioUid, conteudo, emitidoPor }) {
  if (!tioUid) throw new Error('Sem uid do associado.');
  const id = `${tioUid}_${Date.now()}`;
  const hash = await hashDoContrato(conteudo);

  await setDoc(DOC(id), {
    tioUid,
    conteudo,
    hash,
    versao: VERSAO_CONTRATO,
    emitidoEm: serverTimestamp(),
    emitidoPor: emitidoPor || null,
    aceitoEm: null,
    aceitoPorNome: null,
    aceiteHash: null,
    aceiteUserAgent: null,
  });

  return { id, hash };
}

/**
 * O associado aceita. Uma vez, e nunca mais.
 *
 * Grava o nome que ele digitou, o hash do conteúdo e o user agent. Os três
 * respondem perguntas diferentes numa disputa: quem, o quê, e de onde.
 */
export async function aceitarContrato({ id, nome, conteudo }) {
  const hash = await hashDoContrato(conteudo);
  await updateDoc(DOC(id), {
    aceitoEm: serverTimestamp(),
    aceitoPorNome: String(nome || '').trim(),
    aceiteHash: hash,
    aceiteUserAgent: navigator.userAgent.slice(0, 300),
  });
}

/** O contrato vigente de um associado — o mais recente aceito. */
export async function contratoVigente(tioUid) {
  const snap = await getDocs(
    query(COL(), where('tioUid', '==', tioUid), orderBy('emitidoEm', 'desc'), limit(5))
  );
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return docs.find((c) => c.aceitoEm) || docs[0] || null;
}

/** Acompanha todos os contratos — pro painel do dono. */
export function watchContratos(cb, onError) {
  return onSnapshot(
    query(COL(), orderBy('emitidoEm', 'desc'), limit(200)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('[contrato] assinatura falhou:', err);
      onError?.(err);
    }
  );
}


