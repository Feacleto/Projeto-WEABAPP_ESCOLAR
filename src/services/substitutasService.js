import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { monthKeyOf } from './expensesService';
import {
  CATEGORIA_DA_SUBSTITUTA,
  descricaoDaDespesa,
  estatisticaDaSubstituta,
  idDaFalta,
  validarSubstituta,
  valorDoDia,
} from '../dominio/identidade/faltaDaAuxiliar.js';

/**
 * A FALTA DA AUXILIAR E AS SUBSTITUTAS — o caminho até o Firestore (05/10/2026,
 * fase 5). A régua é `dominio/identidade/faltaDaAuxiliar.js`.
 *
 * Por que o CLIENTE escreve, e não uma callable: é dado do próprio tio, sem
 * efeito em ninguém — como `expenses`. As rules prendem cada documento ao
 * `motoristaUid` dele, conferem os campos e, na falta, exigem que o id seja
 * `{ele}_{auxiliar}_{dia}` e que a auxiliar seja DELE (o vínculo do par,
 * `auxiliares/{ele}_{auxiliar}`).
 * A auxiliar não lê nada disto.
 *
 * ⚠️ TUDO DE UMA SUBSTITUIÇÃO VAI NUM LOTE SÓ: a falta ganha a substituta, a
 * despesa do dia nasce em `expenses` (categoria `auxiliar`) e o contador da
 * substituta é RECONTADO. Separados, existiria a despesa sem falta ou a
 * substituta com "3 vezes" que ninguém consegue explicar.
 *
 * ⚠️ NADA AQUI DESCONTA DO PAGAMENTO DA AUXILIAR. O desconto, se houver, é
 * combinado entre os dois.
 */

function uidOuErro() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Entre de novo para continuar.');
  return uid;
}

/** As substitutas do motorista. */
export function watchSubstitutas(motoristaUid, onUpdate, onError) {
  if (!motoristaUid) {
    onUpdate([]);
    return () => {};
  }
  return onSnapshot(
    query(collection(db, 'substitutasDoTio'), where('motoristaUid', '==', motoristaUid)),
    (snap) => onUpdate(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('watchSubstitutas:', err);
      onError?.(err);
    }
  );
}

/**
 * As faltas das auxiliares dele — TODAS, não só as do mês: o contador de cada
 * substituta é recontado delas a cada registro e a cada "Desfazer". São
 * poucas por mês (uma por auxiliar por dia, no máximo), então a escuta é leve.
 */
export function watchFaltasDasAuxiliares(motoristaUid, onUpdate, onError) {
  if (!motoristaUid) {
    onUpdate([]);
    return () => {};
  }
  return onSnapshot(
    query(collection(db, 'faltasDaAuxiliar'), where('motoristaUid', '==', motoristaUid)),
    (snap) => onUpdate(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('watchFaltasDasAuxiliares:', err);
      onError?.(err);
    }
  );
}

/**
 * As faltas de HOJE das auxiliares dele — a escuta ESTREITA do Início
 * (05/10/2026). A de cima traz todas as faltas, de sempre, porque a Central
 * reconta as substitutas; o Início só precisa do dia, e abrir a escuta larga
 * em toda tela de entrada seria ler o histórico inteiro para mostrar uma
 * linha. Duas igualdades: o Firestore serve com os índices de campo único,
 * sem índice composto. A rule é a mesma (`motoristaUid` é ele).
 */
export function watchFaltasDeHoje(motoristaUid, dateKey, onUpdate, onError) {
  if (!motoristaUid || !dateKey) {
    onUpdate([]);
    return () => {};
  }
  return onSnapshot(
    query(
      collection(db, 'faltasDaAuxiliar'),
      where('motoristaUid', '==', motoristaUid),
      where('dateKey', '==', dateKey)
    ),
    (snap) => onUpdate(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('watchFaltasDeHoje:', err);
      onError?.(err);
    }
  );
}

/** "A {nome} faltou hoje" — a falta sem substituta (ele faz a rota sozinho). */
export async function registrarFaltaDaAuxiliar({ auxiliar, dateKey }) {
  const uid = uidOuErro();
  if (!auxiliar?.uid || !dateKey) throw new Error('Falta sem auxiliar ou sem dia.');
  const batch = writeBatch(db);
  batch.set(doc(db, 'faltasDaAuxiliar', idDaFalta(uid, auxiliar.uid, dateKey)), {
    motoristaUid: uid,
    auxiliarUid: auxiliar.uid,
    nomeDaAuxiliar: String(auxiliar.nome || 'Auxiliar').slice(0, 60),
    dateKey,
    substituta: null,
    despesaId: null,
    criadaEm: serverTimestamp(),
  });
  await batch.commit();
}

/**
 * "Quem substituiu hoje?" — uma da lista (`substituta`) ou outra pessoa
 * (`nova: { nome, telefone }`, que entra na lista no mesmo lote).
 * `faltas` é a lista que a tela já escuta: o contador sai dela.
 */
export async function registrarSubstituicao({ falta, substituta = null, nova = null, valor, faltas = [] }) {
  const uid = uidOuErro();
  if (!falta?.id) throw new Error('Registre a falta primeiro.');
  if (falta.substituta) throw new Error('Este dia já tem substituta. Desfaça a falta para trocar.');
  const v = valorDoDia(valor);
  if (!v) throw new Error('Quanto você pagou pelo dia? (até R$ 5.000)');

  const batch = writeBatch(db);
  let ref;
  let pessoa;
  if (substituta?.id) {
    ref = doc(db, 'substitutasDoTio', substituta.id);
    pessoa = { id: substituta.id, nome: substituta.nome, telefone: substituta.telefone };
  } else {
    const ok = validarSubstituta(nova || {});
    if (!ok.ok) throw new Error(ok.erro);
    ref = doc(collection(db, 'substitutasDoTio'));
    pessoa = { id: ref.id, nome: ok.nome, telefone: ok.telefone };
  }

  const comEsta = [
    ...faltas.filter((f) => f.id !== falta.id),
    { ...falta, substituta: { ...pessoa, valor: v } },
  ];
  const conta = estatisticaDaSubstituta(comEsta, pessoa.id);

  if (substituta?.id) {
    batch.update(ref, conta);
  } else {
    batch.set(ref, {
      motoristaUid: uid,
      nome: pessoa.nome,
      telefone: pessoa.telefone,
      ...conta,
      criadaEm: serverTimestamp(),
    });
  }

  // A despesa do dia: o mesmo formato de `addExpense`, gravado aqui porque
  // precisa entrar no lote. Meio-dia evita virar o dia no fuso.
  const despesa = doc(collection(db, 'expenses'));
  const quando = new Date(`${falta.dateKey}T12:00:00`);
  batch.set(despesa, {
    adminUid: uid,
    amount: v,
    category: CATEGORIA_DA_SUBSTITUTA,
    description: descricaoDaDespesa(pessoa.nome, falta.dateKey),
    date: Timestamp.fromDate(quando),
    monthKey: monthKeyOf(quando),
    createdAt: serverTimestamp(),
  });

  batch.update(doc(db, 'faltasDaAuxiliar', falta.id), {
    substituta: { ...pessoa, valor: v },
    despesaId: despesa.id,
  });

  await batch.commit();
}

/**
 * "Desfazer a falta": apaga a falta do dia e a despesa da substituta daquele
 * dia, e reconta a substituta sem este dia. Ela continua na lista — tirar da
 * lista é decisão dele, em "Minhas substitutas".
 *
 * `substitutas` é a lista que a tela escuta: se ela já foi tirada da lista
 * depois de cobrir o dia, não há contador para recontar — e um update num
 * documento que não existe derrubaria o lote inteiro.
 */
export async function desfazerFaltaDaAuxiliar({ falta, faltas = [], substitutas = [] }) {
  uidOuErro();
  if (!falta?.id) return;
  const batch = writeBatch(db);
  batch.delete(doc(db, 'faltasDaAuxiliar', falta.id));
  if (falta.despesaId) {
    // Ele pode ter apagado a despesa à mão em "Despesas do mês". Apagar um
    // documento que não existe é recusado pela rule (ela lê o dono dele), e
    // a recusa levaria o "Desfazer" junto — então pergunta antes.
    const despesa = doc(db, 'expenses', falta.despesaId);
    const existe = await getDoc(despesa).then((s) => s.exists()).catch(() => false);
    if (existe) batch.delete(despesa);
  }
  const subId = falta.substituta?.id;
  if (subId && substitutas.some((s) => s.id === subId)) {
    const sem = faltas.filter((f) => f.id !== falta.id);
    batch.update(doc(db, 'substitutasDoTio', subId), estatisticaDaSubstituta(sem, subId));
  }
  await batch.commit();
}

/** "Acrescentar substituta" — só nome e WhatsApp. */
export async function acrescentarSubstituta({ nome, telefone }) {
  const uid = uidOuErro();
  const ok = validarSubstituta({ nome, telefone });
  if (!ok.ok) throw new Error(ok.erro);
  const batch = writeBatch(db);
  batch.set(doc(collection(db, 'substitutasDoTio')), {
    motoristaUid: uid,
    nome: ok.nome,
    telefone: ok.telefone,
    vezes: 0,
    ultimaEm: null,
    ultimoValor: null,
    criadaEm: serverTimestamp(),
  });
  await batch.commit();
}

/** "Editar" — nome e WhatsApp; o contador não muda por aqui. */
export async function editarSubstituta(id, { nome, telefone }) {
  uidOuErro();
  const ok = validarSubstituta({ nome, telefone });
  if (!ok.ok) throw new Error(ok.erro);
  const batch = writeBatch(db);
  batch.update(doc(db, 'substitutasDoTio', id), { nome: ok.nome, telefone: ok.telefone });
  await batch.commit();
}

/**
 * "Tirar da lista". As faltas que ela cobriu continuam com o nome dela
 * (cópia dentro da falta): o controle do mês não perde o que aconteceu.
 */
export async function tirarSubstituta(id) {
  uidOuErro();
  const batch = writeBatch(db);
  batch.delete(doc(db, 'substitutasDoTio', id));
  await batch.commit();
}
