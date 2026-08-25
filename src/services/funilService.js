import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * O FUNIL COMERCIAL — de quem se inscreveu a quem virou parceiro.
 *
 * POR QUE UMA COLEÇÃO PRÓPRIA, E NÃO UM CAMPO EM `users`
 * A inscrição já cria conta (`role: 'aguardando'`), então seria tentador
 * guardar a etapa lá dentro. Duas razões pra não:
 *
 *   1. `users` é lido por várias telas e por regras. Pendurar dado comercial
 *      — valor proposto, nota de negociação, motivo da perda — num documento
 *      que o próprio dono da conta lê em outros contextos é como um dia isso
 *      vaza. Aqui a regra é uma só e é fechada: `isOwner()`.
 *   2. Nem todo lead tem conta. Alguém que ligou, alguém indicado, alguém que
 *      preencheu no papel numa feira — todos precisam entrar no funil sem
 *      existir no Firebase Auth.
 *
 * O QUE ESTE MÓDULO NÃO FAZ
 * Não aprova ninguém. Mover pra "fechado" é registro comercial; o acesso ao
 * app vem da aprovação do papel (`aguardando` → `admin`), que é outra escrita,
 * em outra coleção, com outra regra. Separar as duas impede que arrastar um
 * cartão numa tela de vendas dê acesso a um sistema.
 */

const COL = () => collection(db, 'leadsFunil');
const DOC = (id) => doc(db, 'leadsFunil', id);

/**
 * As etapas, em ordem.
 *
 * `perdido` fica fora da sequência de propósito: ele não é o fim do caminho,
 * é uma saída lateral. Tratá-lo como última etapa faria o funil parecer que
 * todo mundo termina lá.
 */
export const ETAPAS = [
  { id: 'inscrito', rotulo: 'Inscrito' },
  { id: 'contato', rotulo: 'Contato feito' },
  { id: 'orcamento', rotulo: 'Orçamento enviado' },
  { id: 'negociando', rotulo: 'Negociando' },
  { id: 'fechado', rotulo: 'Fechado' },
];

export const ETAPA_PERDIDO = 'perdido';
const IDS_VALIDOS = [...ETAPAS.map((e) => e.id), ETAPA_PERDIDO];

/**
 * Cria ou atualiza um lead.
 *
 * `id` é o uid quando a pessoa se inscreveu pelo app, e um id gerado quando
 * ela chegou por fora. Usar o uid quando existe é o que permite ligar o lead
 * à conta sem tabela de-para.
 */
export async function salvarLead(id, dados) {
  const alvo = id || doc(COL()).id;
  await setDoc(
    DOC(alvo),
    {
      nome: String(dados.nome || '').trim(),
      cidade: String(dados.cidade || '').trim(),
      telefone: String(dados.telefone || '').trim(),
      email: String(dados.email || '').trim().toLowerCase(),
      etapa: IDS_VALIDOS.includes(dados.etapa) ? dados.etapa : 'inscrito',
      criancasEstimadas: Math.max(0, Number(dados.criancasEstimadas) || 0),
      mensalidadeEstimada: Math.max(0, Number(dados.mensalidadeEstimada) || 0),
      propostaMensal: Math.max(0, Number(dados.propostaMensal) || 0),
      notas: String(dados.notas || '').trim(),
      atualizadoEm: serverTimestamp(),
      ...(dados.criadoEm ? {} : { criadoEm: serverTimestamp() }),
    },
    { merge: true }
  );
  return alvo;
}

/**
 * Move um lead de etapa.
 *
 * FECHAR EXIGE PROPOSTA, e a checagem vive aqui e não só na tela: negócio
 * ganho sem valor é número que ninguém consegue usar depois — nem pra cobrar,
 * nem pra calcular ticket médio, nem pra projetar. Deixar entrar "pra
 * organizar agora e completar depois" é como a base de conversão fica
 * inutilizável em três meses.
 */
export async function moverEtapa(id, etapa, lead) {
  if (!IDS_VALIDOS.includes(etapa)) throw new Error('Etapa inválida.');
  if (etapa === 'fechado' && !(Number(lead?.propostaMensal) > 0)) {
    throw new Error(
      'Fechar exige um orçamento aprovado — sem valor, o negócio ganho não entra em nenhuma conta.'
    );
  }
  await updateDoc(DOC(id), {
    etapa,
    atualizadoEm: serverTimestamp(),
    ...(etapa === 'fechado' ? { fechadoEm: serverTimestamp() } : {}),
    ...(etapa === ETAPA_PERDIDO ? { perdidoEm: serverTimestamp() } : {}),
  });
}

/** Registra por que se perdeu. Sem isso o funil só conta; com isso, ensina. */
export async function registrarPerda(id, motivo) {
  await updateDoc(DOC(id), {
    etapa: ETAPA_PERDIDO,
    motivoPerda: String(motivo || '').trim(),
    perdidoEm: serverTimestamp(),
  });
}

export async function apagarLead(id) {
  await deleteDoc(DOC(id));
}

export function watchFunil(cb, onError) {
  return onSnapshot(
    query(COL(), orderBy('atualizadoEm', 'desc'), limit(300)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('[funil] assinatura falhou:', err);
      onError?.(err);
    }
  );
}

/**
 * Os números que uma conversa de investimento pede sobre aquisição.
 *
 * `conversao` exclui os perdidos do denominador? NÃO — e é deliberado. Taxa de
 * conversão que ignora quem se perdeu é taxa que só sobe, e não serve pra
 * decidir nada. Quem entrou no funil entrou; o que ele virou é o resultado.
 */
export function metricasDoFunil(leads) {
  const lista = leads || [];
  const fechados = lista.filter((l) => l.etapa === 'fechado');
  const perdidos = lista.filter((l) => l.etapa === ETAPA_PERDIDO);
  const comProposta = lista.filter((l) => Number(l.propostaMensal) > 0);
  const somaProposta = comProposta.reduce((s, l) => s + Number(l.propostaMensal), 0);

  return {
    total: lista.length,
    ativos: lista.length - fechados.length - perdidos.length,
    fechados: fechados.length,
    perdidos: perdidos.length,
    comProposta: comProposta.length,
    ticketMedioProposto: comProposta.length ? somaProposta / comProposta.length : 0,
    conversao: lista.length ? (fechados.length / lista.length) * 100 : 0,
    // Receita que entraria se tudo que está na mesa fechasse. É expectativa,
    // e a tela precisa chamar assim — nunca somar com receita real.
    pipeline: lista
      .filter((l) => !['fechado', ETAPA_PERDIDO].includes(l.etapa))
      .reduce((s, l) => s + Number(l.propostaMensal || 0), 0),
  };
}
