import {
  collection,
  doc,
  getDoc,
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
  DEV_NAME,
  DEV_CNPJ,
  DEV_CITY,
  DEV_EMAIL,
  DEV_PHONE_DISPLAY,
} from '../config/developer';
// O teto de 28 é a mesma regra da fatura — duas definições de "dia possível"
// divergindo entre o contrato e a cobrança é como um promete o que a outra
// não cumpre. `taxaService` não importa daqui, então não há ciclo.
import { limitarDiaVencimento } from './taxaService';

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
 * Versão do texto das cláusulas. Subir aqui exige novo aceite.
 *
 * 2 — o contrato passou a dizer QUANDO a taxa vence.
 *
 * A versão 1 tinha a cláusula de suspensão por inadimplência sem nenhuma
 * cláusula definindo atraso: "havendo atraso" sobre um documento que não
 * marcava data. O associado assinava, com hash, um papel que não dizia o
 * prazo — e depois recebia um aviso de fatura em aberto. Subir a versão custa
 * uma rodada de reassinatura, e custava zero enquanto nenhum contrato tinha
 * sido emitido.
 */
export const VERSAO_CONTRATO = 2;

/** Quantos meses de vigência cada periodicidade gera. */
const VIGENCIA_MESES = { mensal: 12, semestral: 6, anual: 12, anual12: 12 };

const ROTULO_PER = {
  mensal: 'mensal',
  semestral: 'semestral',
  anual: 'anual à vista',
  anual12: 'anual em 12×',
};

function somaMeses(data, n) {
  const d = new Date(data);
  d.setMonth(d.getMonth() + n);
  return d;
}

/**
 * Monta o conteúdo do contrato a partir da negociação.
 *
 * Devolve um objeto puro — nada de JSX. É o mesmo dado que a tela renderiza e
 * que entra no hash: se a tela montasse o texto por conta própria, o hash
 * provaria um conteúdo e a pessoa teria lido outro.
 */
export function montarContrato({ motorista, negociacao, base, config }) {
  const agora = new Date();
  const per = negociacao?.periodicidade || 'mensal';
  const meses = VIGENCIA_MESES[per] || 12;
  const modo = negociacao?.modo || 'percentual';
  const valor = Number(negociacao?.valor) || 0;
  const carencia = Math.max(0, Number(negociacao?.isencaoMeses) || 0);
  const desconto = Math.max(0, Number(negociacao?.descontoAntecipacao) || 0);

  const criancas = Number(base?.criancas) || 0;
  const mensalidadeMedia = Number(base?.mensalidadeMedia) || 0;
  const baseMensal = criancas * mensalidadeMedia;

  const cheia = modo === 'gratuito' ? 0 : modo === 'fixo' ? valor : baseMensal * (valor / 100);
  const mesesCobrados = Math.max(0, (per === 'mensal' ? 1 : meses) - carencia);
  const totalPeriodo = cheia * mesesCobrados * (1 - desconto / 100);

  return {
    versao: VERSAO_CONTRATO,
    emitidoEm: agora.toISOString(),
    vigenciaInicio: agora.toISOString(),
    vigenciaFim: somaMeses(agora, meses).toISOString(),
    vigenciaMeses: meses,

    contratada: {
      razao: DEV_NAME,
      cnpj: DEV_CNPJ,
      cidade: DEV_CITY,
      email: DEV_EMAIL,
      telefone: DEV_PHONE_DISPLAY,
    },
    associado: {
      uid: motorista?.uid || '',
      nome: motorista?.name || '',
      cidade: motorista?.city || '',
      email: motorista?.email || '',
      telefone: motorista?.phone || '',
    },

    taxa: {
      modo,
      valor,
      rotuloRegra:
        modo === 'gratuito'
          ? 'gratuidade integral'
          : modo === 'fixo'
            ? `R$ ${valor.toFixed(2)} fixos por mês`
            : `${valor}% sobre a mensalidade das crianças ativas`,
      periodicidade: per,
      rotuloPeriodicidade: ROTULO_PER[per] || per,
      // O DIA VIAJA DENTRO DO CONTRATO, não como ponteiro pra régua.
      //
      // Mesma razão de todo o resto deste objeto: o que foi aceito tem que
      // continuar legível depois que a casa mudar de padrão. Um contrato que
      // dissesse "vence no dia definido pela plataforma" não prometeria nada.
      diaVencimento: limitarDiaVencimento(
        negociacao?.diaVencimento ?? config?.diaVencimento
      ),
      carenciaMeses: carencia,
      descontoAntecipacao: desconto,
      baseCriancas: criancas,
      baseMensalidade: mensalidadeMedia,
      valorPorPeriodo: Number(totalPeriodo.toFixed(2)),
      valorMensalReconhecido: Number((totalPeriodo / (per === 'mensal' ? 1 : meses)).toFixed(2)),
    },
  };
}

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

/** Tudo que ele já assinou, do mais novo pro mais velho. */
export async function historicoDe(tioUid) {
  const snap = await getDocs(
    query(COL(), where('tioUid', '==', tioUid), orderBy('emitidoEm', 'desc'), limit(30))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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

/** Um contrato específico. */
export async function getContrato(id) {
  const snap = await getDoc(DOC(id));
  return snap.exists() ? { id, ...snap.data() } : null;
}

/**
 * Quantos dias faltam pro fim da vigência. Negativo = já venceu.
 *
 * Vencer NÃO suspende ninguém, e isso é decisão: cortar por vencimento de
 * papel suspenderia quem está pagando em dia. Suspensão continua sendo coisa
 * de inadimplência. O que o vencimento faz é entrar na fila do dono.
 */
export function diasParaVencer(contrato) {
  const fim = contrato?.conteudo?.vigenciaFim;
  if (!fim) return null;
  return Math.ceil((new Date(fim) - new Date()) / 86400000);
}

/** Está na janela de renovação? */
export function precisaRenovar(contrato, janelaDias = 60) {
  const d = diasParaVencer(contrato);
  return d !== null && d <= janelaDias;
}
