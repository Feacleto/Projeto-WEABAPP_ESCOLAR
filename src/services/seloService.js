import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, getStorageLazy } from '../firebase/config';
import { ESTADO as ADESIVO, fraseValida, podePedir, validarEndereco } from '../dominio/associacao/adesivo.js';
import { ESTADO as VERIF, validarRecusa } from '../dominio/identidade/verificacao.js';

/**
 * OS DOIS SELOS — o adesivo de rua e o certificado do alvará.
 *
 * São coisas opostas e moram no mesmo arquivo porque quem mexe num
 * inevitavelmente lê o outro, e a confusão entre eles foi o erro que atrasou a
 * conversa inteira: o adesivo se ganha PEDINDO, o certificado se ganha
 * CONQUISTANDO. As regras de cada um estão em `dominio/associacao/adesivo.js` e
 * `dominio/identidade/verificacao.js`.
 *
 * ── ⚠️ O ENDEREÇO NÃO FOI PARA `taxaParceiros`, E O PLANO DIZIA QUE IRIA
 * O motivo do plano continua valendo — endereço residencial NÃO pode ir para
 * `users`, que as famílias dele leem: é a regra que dá à mãe a chave PIX e o
 * telefone, e a maior parte dessas peruas sai da casa do motorista.
 *
 * Só que `taxaParceiros` é `read: isOwner()` e guarda a NOTA INTERNA do dono
 * sobre o parceiro, além do CPF. As rules do Firestore não sabem esconder
 * campo: liberar a leitura para o motorista ver o próprio pedido entregaria a
 * ele o que o dono anotou a seu respeito.
 *
 * Daí `pedidosAdesivo/{uid}`: coleção própria, o dono lê tudo, o motorista lê
 * SÓ o dele, e o item 13a.4 — "o estado aparece nos dois lados" — passou a ser
 * expressável sem vazar nada.
 *
 * ── O ALVARÁ VAI PARA O STORAGE, E A URL NÃO É PERSISTIDA
 * `alvaras/{uid}`. A URL assinada é buscada na hora de revisar (decisão 8): url
 * gravada em documento é um link que sobrevive à revogação do acesso.
 */

const PEDIDO = (uid) => doc(db, 'pedidosAdesivo', uid);

/* ─────────────── o adesivo ─────────────── */

/**
 * O motorista pede o adesivo. UMA VEZ — a rule só permite `create`.
 *
 * Desde 04/10/2026 é prêmio da 1ª Platina (`nivel` é `niveis/{uid}`, e a
 * rule confere o mesmo `platinaEm`), com a FRASE que ele escolheu e uma FOTO
 * da marca dele no instante do pedido (nome, logo, cor): é isso que o dono
 * imprime. Se ele trocar o logo depois, o adesivo que chega é o que ele viu.
 *
 * O endereço vem inteiro no mesmo documento: um pedido sem para onde enviar é
 * uma linha na tela do dono que ele não consegue resolver, e vira uma conversa
 * de WhatsApp que ninguém queria.
 */
export async function pedirAdesivo(motorista, endereco, { frase, nivel } = {}) {
  if (!podePedir(motorista, nivel)) throw new Error('O adesivo chega quando você alcança a Platina.');
  if (!fraseValida(frase)) throw new Error('Escolha a frase do adesivo.');
  const { ok, faltando } = validarEndereco(endereco);
  if (!ok) throw new Error(`Falta preencher: ${faltando.join(', ')}.`);

  await setDoc(PEDIDO(motorista.uid), {
    tioUid: motorista.uid,
    nome: motorista.name || '',
    estado: ADESIVO.PEDIDO,
    frase,
    marca: {
      nome: String(motorista.marcaNome || motorista.name || '').trim(),
      logoURL: motorista.marcaLogoURL || null,
      cor: motorista.marcaCor || null,
    },
    endereco: {
      cep: String(endereco.cep).trim(),
      logradouro: String(endereco.logradouro).trim(),
      numero: String(endereco.numero).trim(),
      complemento: String(endereco.complemento || '').trim(),
      bairro: String(endereco.bairro).trim(),
      cidade: String(endereco.cidade).trim(),
      uf: String(endereco.uf).trim().toUpperCase(),
    },
    em: serverTimestamp(),
  });
}

/** O dono move o pedido. A validação da transição é do domínio. */
export async function moverPedido(uid, estado) {
  if (!uid) throw new Error('Sem motorista.');
  await updateDoc(PEDIDO(uid), { estado, em: serverTimestamp() });
}

/** O pedido de UM motorista — o que ele mesmo vê. */
export function watchPedidoAdesivo(uid, cb, onError) {
  return onSnapshot(
    PEDIDO(uid),
    (snap) => cb(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    onError
  );
}

/**
 * Todos os pedidos — a fila de postagem do dono.
 *
 * ⚠️ COM TETO DE SEGURANÇA (03/10/2026). É um pedido por motorista, então o
 * teto não corta nada na base que o plano mira (100); ele existe para a
 * assinatura não virar uma leitura sem fim se a coleção um dia crescer por
 * outro motivo. Passando disso, o caminho é filtrar por estado, não subir o
 * número.
 */
export const TETO_DE_PEDIDOS_DE_ADESIVO = 300;

export function watchPedidosAdesivo(cb, onError) {
  return onSnapshot(
    query(collection(db, 'pedidosAdesivo'), limit(TETO_DE_PEDIDOS_DE_ADESIVO)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  );
}

/* ─────────────── o certificado ─────────────── */

/**
 * O motorista envia o alvará.
 *
 * ⚠️ ELE ESCREVE `verificacao: 'enviada'` E NADA MAIS. As rules impedem que ele
 * escreva qualquer outro valor nesse campo — se o enviado pudesse se marcar
 * verificado, o selo não valeria nada, e valeria menos ainda por parecer que
 * vale.
 */
export async function enviarAlvara(uid, arquivo) {
  if (!uid) throw new Error('Sem motorista.');
  if (!arquivo) throw new Error('Escolha o arquivo do alvará.');

  // `getStorageLazy` e nao `storage`: o modulo do Storage e ~56 KB e so e
  // baixado por quem realmente vai enviar arquivo. O gate mora em
  // `firebase/config.js`, com o porque.
  await uploadBytes(ref(await getStorageLazy(), `alvaras/${uid}`), arquivo, {
    contentType: arquivo.type || 'application/octet-stream',
  });

  await setDoc(
    doc(db, 'users', uid),
    { verificacao: VERIF.ENVIADA, alvaraEnviadoEm: serverTimestamp() },
    { merge: true }
  );
}

/**
 * A URL do alvará, buscada na hora.
 *
 * NÃO É PERSISTIDA (decisão 8): url gravada em documento é um link que
 * sobrevive à revogação do acesso, e este documento é do motorista.
 */
export async function urlDoAlvara(uid) {
  try {
    return await getDownloadURL(ref(await getStorageLazy(), `alvaras/${uid}`));
  } catch {
    return null;
  }
}

/**
 * O dono confere. `validade` é 'AAAA-MM-DD' — a data que está no papel.
 *
 * ⚠️ A VALIDADE É OBRIGATÓRIA, e é o que impede o selo de mentir sozinho. Sem
 * ela, `estadoDaVerificacao` mantém "verificado" para sempre, e três anos
 * depois a tela da família estaria afirmando uma coisa falsa — pior do que não
 * ter selo nenhum.
 */
export async function verificarAlvara(uid, validade, ownerUid) {
  if (!uid) throw new Error('Sem motorista.');
  const d = validade ? new Date(`${validade}T12:00:00`) : null;
  if (!d || Number.isNaN(d.getTime())) {
    throw new Error('Informe a data de validade que está no alvará.');
  }
  await setDoc(
    doc(db, 'users', uid),
    {
      verificacao: VERIF.VERIFICADA,
      verificadoEm: serverTimestamp(),
      verificadoPor: ownerUid || null,
      alvaraValidade: d,
      alvaraMotivoRecusa: null,
    },
    { merge: true }
  );
}

/** O dono recusa, e o motivo VOLTA para ele — senão reenvia o mesmo papel. */
export async function recusarAlvara(uid, motivo) {
  const { ok, erro } = validarRecusa(motivo);
  if (!ok) throw new Error(erro);
  await setDoc(
    doc(db, 'users', uid),
    {
      verificacao: VERIF.RECUSADA,
      alvaraMotivoRecusa: String(motivo).trim(),
      alvaraValidade: null,
    },
    { merge: true }
  );
}

/** Revogar um selo concedido: volta ao começo, não a "recusada". */
export async function revogarSelo(uid) {
  await setDoc(
    doc(db, 'users', uid),
    {
      verificacao: VERIF.NAO_INICIADA,
      verificadoEm: null,
      alvaraValidade: null,
    },
    { merge: true }
  );
}

/** O documento do motorista, para a tela dele. */
export async function getVerificacao(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}
