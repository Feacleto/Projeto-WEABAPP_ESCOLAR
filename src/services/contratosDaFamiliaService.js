import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase/config';
import { exigirCloud } from './callableError';
import { buildContractData } from './contractService';
import { notifyContratoPronto } from './notificationsService';
import {
  estadoDoContrato,
  mesmoConteudo,
  mudancasEntre,
} from '../dominio/cobranca/contratoDaFamilia.js';

/**
 * AS VERSÕES DO CONTRATO DE UMA CRIANÇA — `children/{id}/contratos/{numero}`
 * (02/10/2026). A régua está em `dominio/cobranca/contratoDaFamilia.js`, e o
 * porquê de o contrato virar documento está no cabeçalho dela.
 *
 * Quem escreve o quê:
 *   - o MOTORISTA emite uma versão (`aguardando`) e pode retirá-la enquanto
 *     ninguém aceitou;
 *   - a FAMÍLIA aceita pela callable `aceitarContrato` — o aceite e o hash são
 *     do servidor;
 *   - ninguém edita uma versão gravada. Mudou o combinado? Versão nova.
 *
 * A criança guarda dois ponteiros: `contratoAguardando` (o número da versão
 * esperando aceite, que o motorista escreve) e `contratoVigente` (a aceita,
 * que só o servidor escreve — as rules recusam o motorista ali).
 */

export function watchContratos(childId, onData, onError) {
  if (!childId) return () => {};
  const q = query(collection(db, 'children', childId, 'contratos'), orderBy('numero', 'desc'));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('watchContratos', err);
      onError?.(err);
    }
  );
}

/**
 * A versão esperando aceite, lida da LISTA e não do ponteiro da criança. Os
 * dois chegam por escutas diferentes: logo depois de emitir, a lista pode já
 * ter a versão nova enquanto a criança ainda aponta para nada — e confiar no
 * ponteiro faria emitir a mesma versão duas vezes.
 */
function versaoAguardando(contratos) {
  return contratos.find((c) => c.status === 'aguardando') || null;
}

function proximoNumero(contratos) {
  return contratos.reduce((m, c) => Math.max(m, Number(c.numero) || 0), 0) + 1;
}

async function emitir({
  child,
  dados,
  tipo,
  contratos,
  mudancas = null,
  novosValores = null,
  naCrianca = {},
}) {
  const numero = proximoNumero(contratos);
  const pendente = versaoAguardando(contratos);
  const batch = writeBatch(db);
  batch.set(doc(db, 'children', child.id, 'contratos', String(numero)), {
    numero,
    tipo,
    dados,
    status: 'aguardando',
    emitidoEm: serverTimestamp(),
    adminUid: child.adminUid,
    mudancas,
    novosValores,
    substitui: child.contratoVigente?.numero ?? null,
  });
  if (pendente) {
    batch.update(doc(db, 'children', child.id, 'contratos', String(pendente.numero)), {
      status: 'retirado',
      retiradoEm: serverTimestamp(),
    });
  }
  // `naCrianca`: o que muda na criança JUNTO com a versão (mensalidade nova
  // antes do aceite). No mesmo lote — separado, a escuta da tela via a
  // criança mudada sem a versão e emitia a mesma versão de novo.
  batch.update(doc(db, 'children', child.id), { ...naCrianca, contratoAguardando: numero });
  await batch.commit();
  return numero;
}

/**
 * GARANTE QUE O PRIMEIRO CONTRATO ESTÁ EMITIDO E EM DIA — antes do aceite.
 *
 * Chamada por quem mostra o convite e pela tela do contrato. Idempotente: se
 * a versão esperando aceite já diz a mesma coisa, não escreve nada; se o
 * motorista mudou a mensalidade antes de a família aceitar, a versão velha é
 * retirada e uma nova é emitida — ela nunca aceita um número que já não vale.
 *
 * Depois do aceite ela não faz nada: mudança depois do aceite é ADITIVO, e
 * aditivo só nasce quando o motorista pede (`salvarCombinado`).
 *
 * `contratos` precisa estar carregado — o número da versão sai dele.
 */
export async function garantirContrato({ child, admin, contratos }) {
  if (!child || !contratos) return null;
  const estado = estadoDoContrato(child);
  if (estado !== 'sem-contrato' && estado !== 'aguardando') return null;
  const dados = buildContractData({ child, admin });
  if (!dados) return null;
  const pendente = versaoAguardando(contratos);
  // ⚠️ AS DUAS ESCUTAS FORA DE COMPASSO: a criança aponta para uma versão que
  // a lista ainda não mostra (ou já trocou). Por um instante, logo depois de
  // salvar, uma chega antes da outra — e emitir agora duplicaria a versão.
  // A próxima rodada, com as duas em dia, decide.
  if (child.contratoAguardando != null && pendente?.numero !== child.contratoAguardando) {
    return null;
  }
  if (pendente && mesmoConteudo(pendente.dados, dados)) return pendente.numero;
  const numero = await emitir({ child, dados, tipo: 'contrato', contratos });
  // Ela já tem conta e esperava um contrato que mudou: avisa.
  if (child.parentUid) notifyContratoPronto({ parentUid: child.parentUid, childName: child.name });
  return numero;
}

/**
 * O MOTORISTA MUDA O COMBINADO — mensalidade, vencimento, vigência.
 *
 *   - Antes do aceite: grava direto na criança e reemite o contrato.
 *   - Depois do aceite: NÃO grava na criança. Emite um ADITIVO com os valores
 *     novos, e eles só valem quando a família aceitar (o servidor aplica).
 *     A cobrança continua lendo o valor aceito até lá.
 *
 * Devolve `'direto'`, `'aditivo'` ou `'nada'` (quando nada do contrato mudou).
 */
export async function salvarCombinado({ child, admin, contratos, novos }) {
  const estado = estadoDoContrato(child);
  if (estado === 'sem-contrato' || estado === 'aguardando') {
    const naCrianca = { ...novos, updatedAt: serverTimestamp() };
    const dados = buildContractData({ child: { ...child, ...novos }, admin });
    const pendente = versaoAguardando(contratos);
    // Sem os dados dele não há contrato a reemitir; e se a versão esperando
    // já diz isto, reemitir só criaria uma versão igual. Nos dois casos, só o
    // combinado muda.
    if (!dados || (pendente && mesmoConteudo(pendente.dados, dados))) {
      await updateDoc(doc(db, 'children', child.id), naCrianca);
      return 'direto';
    }
    await emitir({ child, dados, tipo: 'contrato', contratos, naCrianca });
    if (child.parentUid) notifyContratoPronto({ parentUid: child.parentUid, childName: child.name });
    return 'direto';
  }
  const vigente = contratos.find((c) => c.numero === child.contratoVigente?.numero);
  // Aceite antigo (anterior aos documentos): a base é o que os campos dizem.
  const base = vigente?.dados || buildContractData({ child, admin });
  const dados = buildContractData({ child: { ...child, ...novos }, admin });
  if (!dados) throw new Error('Complete seus dados do contrato antes.');
  const mudancas = mudancasEntre(base, dados);
  if (mudancas.length === 0) return 'nada';
  await emitir({ child, dados, tipo: 'aditivo', contratos, mudancas, novosValores: novos });
  notifyContratoPronto({ parentUid: child.parentUid, childName: child.name, mudanca: true });
  return 'aditivo';
}

/** O motorista desiste da mudança que a família ainda não aceitou. */
export async function retirarMudanca({ child }) {
  if (child?.contratoAguardando == null) return;
  const batch = writeBatch(db);
  batch.update(doc(db, 'children', child.id, 'contratos', String(child.contratoAguardando)), {
    status: 'retirado',
    retiradoEm: serverTimestamp(),
  });
  batch.update(doc(db, 'children', child.id), { contratoAguardando: null });
  await batch.commit();
}

/** A família aceita — o servidor grava o aceite e o hash. */
export async function aceitarContrato({ childId, numero, nome }) {
  exigirCloud('aceitar o contrato');
  const fn = httpsCallable(functions, 'aceitarContrato');
  const { data } = await fn({ childId, numero, nome });
  return data;
}
