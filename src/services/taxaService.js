import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  serverTimestamp,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/config';
// A RÉGUA PURA MORA EM `dominio/associacao/taxa.js`, E NÃO AQUI.
//
// Tudo que é aritmética de dinheiro saiu deste arquivo: enquanto morava atrás
// do `import { db }` acima, era IMPOSSÍVEL testar — o projeto testa com
// scripts Node puros, e o script não consegue nem importar o módulo sem
// inicializar o Firebase. Duas vezes o contrato de associação saiu com valor
// zero por causa disso (ver o cabeçalho de `dominio/associacao/taxa.js`).
//
// Aqui ficou só o que fala com o Firestore. O reexport abaixo mantém
// `taxaService` como a porta pública: nenhuma tela precisou trocar de import,
// e quem quiser testar a régua importa direto do utils.
import {
  PADRAO,
  MODOS,
  PERIODICIDADES,
  MESES_DA_PERIODICIDADE,
  limitarDiaVencimento,
  resumirBase,
  centavos,
  taxaPadrao,
  calcularTaxa,
  isentoEm,
  dataDeVencimento,
} from '../dominio/associacao/taxa';

export {
  PADRAO,
  MODOS,
  PERIODICIDADES,
  MESES_DA_PERIODICIDADE,
  limitarDiaVencimento,
  resumirBase,
  taxaPadrao,
  calcularTaxa,
  isentoEm,
  dataDeVencimento,
};
// Aritmética de mês reusada de formatters: já existia, e três funções
// somando mês no mesmo código é como elas divergem numa virada de ano.
import { addMonths, getCurrentMonthKey } from '../compartilhado/formatters';
// A validação de chave PIX já existe e é a mesma regra — reusar evita duas
// definições de "chave válida" divergindo entre a tela do tio e a do dono.
import { validatePixKey } from './userService';

/**
 * A TAXA DE ASSOCIAÇÃO — o que a plataforma cobra do MOTORISTA.
 *
 * NÃO CONFUNDIR COM `payments`
 * `payments` é o dinheiro do PAI para o MOTORISTA (a mensalidade da criança), e
 * a plataforma não está no caminho dele: o pai paga por PIX, dinheiro ou
 * maquininha, direto. Isto aqui é outro dinheiro, em outro sentido — do
 * motorista para a plataforma, pelo uso do sistema.
 *
 * Manter os dois separados não é preciosismo de modelagem: é o que sustenta o
 * item 7 dos Termos de Uso ("não processa nem intermedeia transações
 * financeiras"). No dia em que a taxa sair de dentro da mensalidade, essa frase
 * fica falsa e a plataforma passa a ser intermediária — com tudo que vem junto.
 *
 * POR QUE O CÁLCULO RODA NO NAVEGADOR DO DONO
 *
 * ATENÇÃO AO QUE ESTE PARÁGRAFO DIZIA ANTES: "a Cloud Functions API está
 * desativada no projeto (sem Blaze), então não existe servidor onde rodar".
 * Isso deixou de ser verdade — há quinze functions em produção, e uma delas
 * (`generateMonthlyPayments`) faz exatamente esta forma de trabalho do outro
 * lado do dinheiro. A premissa era falsa, e é ela que a próxima sessão leria
 * antes de decidir o que pode ir pro servidor.
 *
 * O ARGUMENTO, ESSE, CONTINUA VALENDO, e é o inverso do caso pai→tio:
 * quem calcula é quem COBRA, e o cobrado não tem escrita na fatura. As rules
 * garantem — `faturasParceiro` é `write: isOwner()`, e o motorista só lê a dele.
 *
 * No caso do pai era o contrário: cálculo no cliente colocava a caneta na mão de
 * quem se beneficiava do erro.
 *
 * TRÊS COLEÇÕES, TRÊS REGRAS — E NÃO UM `match {docId}` SÓ
 * Rules em Firestore são OR: um match abrangente que permite não é apertado por
 * um match específico que nega. Se as três morassem numa coleção só, a regra
 * mais frouxa das três valeria para todas — e a mais frouxa aqui precisa deixar
 * o motorista ler a própria fatura. Isso abriria a nota interna e a estrutura de
 * preço junto.
 */

// ── as três coleções ────────────────────────────────────────────────────────

/** O padrão da casa: percentual e piso. Só o dono lê e escreve. */
const CONFIG = () => doc(db, 'taxaConfig', 'app');

/** A negociação de um motorista + nota interna. Só o dono, nem ele mesmo lê. */
const PARCEIRO = (uid) => doc(db, 'taxaParceiros', uid);

/** A fatura de um mês. O dono escreve; o motorista lê a dele. */
const FATURA = (uid, mes) => doc(db, 'faturasParceiro', `${uid}_${mes}`);


// ── config global ───────────────────────────────────────────────────────────

export async function getTaxaConfig() {
  try {
    const snap = await getDoc(CONFIG());
    return snap.exists() ? { ...PADRAO, ...snap.data() } : { ...PADRAO };
  } catch (err) {
    // Sem permissão ou offline: cai no padrão. A tela mostra número em vez de
    // erro, e o número é o que o código promete — não um chute.
    console.error('[taxa] config não leu:', err);
    return { ...PADRAO };
  }
}

export function watchTaxaConfig(cb) {
  return onSnapshot(
    CONFIG(),
    (snap) => cb(snap.exists() ? { ...PADRAO, ...snap.data() } : { ...PADRAO }),
    (err) => {
      console.error('[taxa] assinatura da config falhou:', err);
      cb({ ...PADRAO });
    }
  );
}

/**
 * Onde o motorista paga a taxa.
 *
 * Separado de `setTaxaConfig` porque são duas decisões diferentes com ritmos
 * diferentes: a régua muda quando o negócio muda, a chave muda quando a conta
 * muda. Junto num formulário só, mexer numa obrigaria a reenviar a outra.
 */
export async function setPixPlataforma({ pixKey, pixKeyType, nome, cidade }) {
  const erro = validatePixKey(pixKeyType, pixKey);
  if (erro) throw new Error(erro);
  await setDoc(
    CONFIG(),
    {
      pixKey: String(pixKey).trim(),
      pixKeyType,
      nomePlataforma: (nome || '').trim(),
      cidadePlataforma: (cidade || '').trim(),
      atualizadoEm: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function setTaxaConfig({ percentual, piso, diaVencimento }) {
  const p = Number(percentual);
  const f = Number(piso);
  if (!Number.isFinite(p) || p < 0 || p > 100) {
    throw new Error('Percentual tem que estar entre 0 e 100.');
  }
  if (!Number.isFinite(f) || f < 0) throw new Error('Piso não pode ser negativo.');

  // O dia RECUSA em vez de corrigir calado.
  //
  // `limitarDiaVencimento` existe pra defender o cálculo de dado que já está
  // gravado; aqui há uma pessoa digitando, e salvar 30 como 28 sem dizer nada
  // deixaria o contrato prometendo um dia e a fatura cobrando outro.
  const d = Math.trunc(Number(diaVencimento));
  if (!Number.isFinite(d) || d < 1 || d > 28) {
    throw new Error(
      'Dia do vencimento tem que estar entre 1 e 28 — dia 29, 30 ou 31 não existe em todo mês.'
    );
  }

  await setDoc(
    CONFIG(),
    { percentual: p, piso: f, diaVencimento: d, atualizadoEm: serverTimestamp() },
    { merge: true }
  );
}

/**
 * QUANTAS CRIANÇAS ATIVAS ELE PODE CADASTRAR — a vaga contratada.
 *
 * MORA EM `users/{uid}`, e não em `taxaParceiros`, apesar de ser cláusula de
 * negociação. O motivo é a regra que o consome: `allow create` em `children`
 * confere o contador do motorista contra este teto a cada cadastro, via
 * `getAfter` no doc dele. Guardar o limite noutra coleção obrigaria a rule a
 * uma segunda leitura de documento em TODA criação de criança, pra sempre.
 *
 * A separação de leitura continua respeitada: `taxaParceiros` guarda o que o
 * motorista não pode ver (nota interna, estrutura de preço) e por isso é
 * `read: isOwner()`. O limite é o contrário — ele PRECISA ver, porque é o
 * número que a tela dele mostra quando as vagas acabam.
 *
 * Só o dono escreve: as rules põem `limiteCriancas` na mesma lista de campos
 * de gestão que `suspenso`, fora do alcance do próprio parceiro. Limite que o
 * limitado aumenta não é limite.
 */
export async function setLimiteCriancas(uid, limite) {
  if (!uid) throw new Error('Sem motorista.');
  const n = Math.trunc(Number(limite));
  if (!Number.isFinite(n) || n < 0) {
    throw new Error('O número de vagas não pode ser negativo.');
  }
  await setDoc(
    doc(db, 'users', uid),
    { limiteCriancas: n },
    { merge: true }
  );
}

// ── a base: o que o motorista contratou ─────────────────────────────────────


/**
 * Lê as crianças ativas de TODOS os motoristas e agrupa por `adminUid`.
 *
 * Só o dono consegue: as rules de `children` liberam leitura ampla para
 * `isOwner()` de propósito — ele conta a base e resume o negócio, sem poder
 * operar nada.
 *
 * Documento legado sem `adminUid` cai em `semDono`, e isso é informação e não
 * detrito: enquanto esse balde não estiver vazio, a base de algum parceiro está
 * incompleta e a fatura dele sairia menor que a real. A tela precisa dizer isso
 * em voz alta em vez de somar o que sobrou.
 */
/**
 * ESTA CONSULTA NÃO PODE RECEBER `limit()`, e isso é decisão, não esquecimento.
 *
 * Ela é a única sem teto que sobrou depois da varredura de escala — e é assim
 * de propósito: o resultado vira a BASE DE CÁLCULO da fatura de cada parceiro.
 * Um teto aqui não deixaria a tela mais leve; faria a cobrança sair MENOR que
 * o devido, em silêncio, e o parceiro seria subfaturado sem ninguém notar.
 * Consulta que alimenta dinheiro ou conta tudo, ou não serve.
 *
 * O custo é real e está medido: com mil crianças, mil documentos — com
 * endereço, escola e telefone de família — trafegam pro navegador do dono toda
 * vez que a aba Taxa abre, pra produzir um punhado de somas por parceiro.
 *
 * A SAÍDA CERTA É MATERIALIZAR, NÃO TRUNCAR: `users.criancasAtivas` já existe
 * e responde a contagem; falta o par dele para a soma de mensalidades,
 * mantido no mesmo batch de `addChild`/`updateChild`/`deactivateChild`. Aí
 * esta varredura vira conferência sob demanda em vez de caminho de abertura de
 * tela. Está em docs/arquitetura.md (seção 13) como trabalho seguinte
 * — e depende do
 * contador ser confiável primeiro (ver `childrenService`, transação do
 * decremento).
 */
export async function carregarBasePorMotorista() {
  const snap = await getDocs(
    query(collection(db, 'children'), where('active', '==', true))
  );

  const porUid = new Map();
  const semDono = [];

  for (const d of snap.docs) {
    const c = { id: d.id, ...d.data() };
    const uid = c.adminUid;
    if (!uid) {
      semDono.push(c);
      continue;
    }
    if (!porUid.has(uid)) porUid.set(uid, []);
    porUid.get(uid).push(c);
  }

  const resumos = {};
  for (const [uid, lista] of porUid) resumos[uid] = resumirBase(lista);

  return { resumos, semDono };
}

// ── a negociação de cada motorista ──────────────────────────────────────────

/** Modo `percentual` acompanha o crescimento; `fixo` não. Ver `taxaDe`. */


export async function getNegociacao(uid) {
  if (!uid) return null;
  const snap = await getDoc(PARCEIRO(uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}

export function watchNegociacoes(cb, onError) {
  return onSnapshot(
    collection(db, 'taxaParceiros'),
    (snap) => {
      const porUid = {};
      snap.docs.forEach((d) => {
        porUid[d.id] = { uid: d.id, ...d.data() };
      });
      cb(porUid);
    },
    (err) => {
      console.error('[taxa] assinatura das negociações falhou:', err);
      onError?.(err);
    }
  );
}

/**
 * Grava o que foi combinado com aquele motorista.
 *
 * `isencaoMeses` guarda a quantidade combinada, e `isencaoAte` guarda o MÊS em
 * que ela termina. Os dois, porque respondem perguntas diferentes: "quantos
 * meses eu dei" é o histórico da negociação, "até quando vale" é o que o
 * fechamento do mês consulta. Derivar o segundo do primeiro exigiria uma data de
 * início que ninguém garante estar preenchida.
 */
export async function setNegociacao(
  uid,
  { modo, valor, isencaoMeses, notas, desdeMes, periodicidade, descontoAntecipacao }
) {
  if (!uid) throw new Error('Sem uid do motorista.');

  const m = modo || MODOS.PERCENTUAL;
  if (!Object.values(MODOS).includes(m)) {
    throw new Error('Modo tem que ser percentual, fixo ou gratuito.');
  }
  // Gratuidade não tem valor a validar: o valor É zero, por definição.
  const v = m === MODOS.GRATUITO ? 0 : Number(valor);
  if (!Number.isFinite(v) || v < 0) throw new Error('Valor inválido.');
  if (m === MODOS.PERCENTUAL && v > 100) {
    throw new Error('Percentual não pode passar de 100.');
  }

  const per = periodicidade || PERIODICIDADES.MENSAL;
  if (!Object.values(PERIODICIDADES).includes(per)) {
    throw new Error('Periodicidade inválida.');
  }
  const desc = Math.min(100, Math.max(0, Number(descontoAntecipacao) || 0));

  const meses = Math.max(0, Math.floor(Number(isencaoMeses) || 0));

  await setDoc(
    PARCEIRO(uid),
    {
      modo: m,
      valor: v,
      periodicidade: per,
      descontoAntecipacao: desc,
      isencaoMeses: meses,
      isencaoAte:
        meses > 0 ? addMonths(desdeMes || getCurrentMonthKey(), meses - 1) : null,
      notas: (notas || '').trim(),
      atualizadoEm: serverTimestamp(),
    },
    { merge: true }
  );
}

// ── o cálculo ───────────────────────────────────────────────────────────────


// ── a fatura ────────────────────────────────────────────────────────────────


/**
 * Fecha a fatura do mês — e CONGELA a régua usada.
 *
 * A fatura guarda o modo e o valor VIGENTES no fechamento, não um ponteiro para
 * `taxaParceiros`. Renegociar em novembro não pode reescrever o que foi cobrado
 * em setembro: numa conversa de "combinamos 4%", quem tem o histórico congelado
 * tem o que mostrar, e quem tem ponteiro só tem a régua de hoje.
 *
 * É o mesmo princípio do `premiosNaEpoca` no `entryBonuses` — a régua viaja
 * junto com o lançamento, senão o lançamento antigo fica impossível de explicar.
 */
export async function fecharFatura({
  tioUid,
  mes,
  resumo,
  negociacao,
  config,
  desconto = 0,
  ownerUid,
}) {
  if (!tioUid || !mes) throw new Error('Sem motorista ou mês.');

  const calc = calcularTaxa({ base: resumo.base, negociacao, config });
  const isento = isentoEm(negociacao, mes);
  const desc = centavos(Math.max(0, Number(desconto) || 0));
  const total = isento ? 0 : centavos(Math.max(0, calc.cobrada - desc));

  await setDoc(FATURA(tioUid, mes), {
    tioUid,
    mes,

    // a base, como ela era neste mês
    criancas: resumo.criancas,
    semMensalidade: resumo.semMensalidade,
    base: resumo.base,
    ticketMedio: resumo.ticketMedio,

    // a régua, congelada
    reguaPercentual: Number(config?.percentual ?? PADRAO.percentual),
    reguaPiso: Number(config?.piso ?? PADRAO.piso),

    // QUANDO VENCE — data pronta, congelada junto com o resto da régua.
    //
    // Mudar o dia na régua em dezembro não pode mexer no que já venceu em
    // setembro, pelo mesmo motivo que renegociar o percentual não reescreve
    // fatura antiga: o histórico é o que se mostra numa conversa sobre atraso.
    vencimento: (() => {
      const d = dataDeVencimento(mes, { negociacao, config });
      return d ? Timestamp.fromDate(d) : null;
    })(),

    // PARA ONDE PAGAR — copiado, não referenciado.
    //
    // `taxaConfig` é `read: isOwner()`: o motorista não lê a estrutura de
    // preço da plataforma, e não deveria. Mas ele precisa da chave pra pagar.
    // Copiar na fatura resolve os dois de uma vez, e de graça ganha o que a
    // régua congelada já dá: se a conta da plataforma mudar, a fatura antiga
    // continua mostrando a chave que valia quando ela foi emitida.
    pixKey: config?.pixKey || '',
    pixKeyType: config?.pixKeyType || 'random',
    nomePlataforma: config?.nomePlataforma || '',
    cidadePlataforma: config?.cidadePlataforma || '',
    modo: negociacao?.modo || null,
    valorNegociado: negociacao ? Number(negociacao.valor) : null,

    // o resultado
    taxaPadrao: calc.padrao,
    taxaCobrada: calc.cobrada,
    isento,
    desconto: desc,
    total,

    status: total === 0 ? 'quitada' : 'aberta',
    lancadaPor: ownerUid || null,
    lancadaEm: serverTimestamp(),
  }, { merge: true });

  return { tioUid, mes, total, isento };
}

/** O dono dá baixa quando o PIX do motorista cai. Não há gateway envolvido. */
export async function marcarFaturaPaga(tioUid, mes, ownerUid) {
  if (!tioUid || !mes) throw new Error('Sem motorista ou mês.');
  await setDoc(
    FATURA(tioUid, mes),
    {
      status: 'quitada',
      quitadaEm: serverTimestamp(),
      quitadaPor: ownerUid || null,
    },
    { merge: true }
  );
}

export function watchFaturasDoMes(mes, cb, onError) {
  return onSnapshot(
    query(collection(db, 'faturasParceiro'), where('mes', '==', mes)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('[taxa] assinatura das faturas falhou:', err);
      onError?.(err);
    }
  );
}

/** O histórico de um parceiro — mais recente primeiro. */
export function watchFaturasDoParceiro(tioUid, cb, onError) {
  return onSnapshot(
    query(collection(db, 'faturasParceiro'), where('tioUid', '==', tioUid)),
    (snap) => {
      const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      lista.sort((a, b) => String(b.mes).localeCompare(String(a.mes)));
      cb(lista);
    },
    (err) => {
      console.error('[taxa] assinatura do histórico falhou:', err);
      onError?.(err);
    }
  );
}

