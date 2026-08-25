import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/config';
// Aritmética de mês reusada de formatters: já existia, e três funções
// somando mês no mesmo código é como elas divergem numa virada de ano.
import { addMonths, getCurrentMonthKey } from '../utils/formatters';
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
 * A Cloud Functions API está desativada no projeto (sem Blaze), então não existe
 * servidor onde rodar. Aqui isso é aceitável, e é o inverso do caso pai→tio:
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

/**
 * O padrão quando `taxaConfig/app` não existe.
 *
 * Existe como constante e não como "tela obrigatória de configuração" porque o
 * dono precisa conseguir abrir o painel e VER número antes de decidir qual
 * número quer. Config vazia que bloqueia a tela transforma calibragem em
 * pré-requisito, e aí ninguém calibra — configura no escuro.
 */
export const PADRAO = {
  /** Percentual sobre o total contratado do motorista. */
  percentual: 5,
  /**
   * Para onde o motorista paga.
   *
   * Nasce vazio de propósito: sem chave cadastrada a tela dele diz "combine
   * com a plataforma" em vez de mostrar um campo em branco onde deveria estar
   * um código de pagamento. É a mesma decisão que o `PixBlock` toma quando o
   * motorista não cadastrou a chave dele.
   */
  pixKey: '',
  pixKeyType: 'random',
  nomePlataforma: '',
  cidadePlataforma: '',
  /**
   * Piso em reais.
   *
   * Não é ganância: fatura de R$ 4,50 custa mais para emitir, cobrar e
   * conferir do que rende. Abaixo de um certo valor a cobrança dá prejuízo
   * mesmo quando é paga.
   */
  piso: 25,
};

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

export async function setTaxaConfig({ percentual, piso }) {
  const p = Number(percentual);
  const f = Number(piso);
  if (!Number.isFinite(p) || p < 0 || p > 100) {
    throw new Error('Percentual tem que estar entre 0 e 100.');
  }
  if (!Number.isFinite(f) || f < 0) throw new Error('Piso não pode ser negativo.');
  await setDoc(
    CONFIG(),
    { percentual: p, piso: f, atualizadoEm: serverTimestamp() },
    { merge: true }
  );
}

// ── a base: o que o motorista contratou ─────────────────────────────────────

/**
 * Resume as crianças de um motorista na base de cálculo.
 *
 * POR QUE NÃO EXISTE "A MENSALIDADE DELE"
 * Cada criança tem seu próprio `monthlyFee` — o tio cobra 250 de uma e 320 de
 * outra, por distância, por irmão, por acordo antigo. Um número único seria
 * mentira arredondada. Então devolvemos o TOTAL (que é a base real) e, ao lado,
 * ticket médio e faixa: é o que permite negociar sabendo o que se está olhando.
 *
 * Criança sem mensalidade configurada entra na CONTAGEM e não na base — ela
 * existe na operação, e o dono precisa ver que ela está sem valor em vez de
 * ela desaparecer da tela. É a mesma decisão que `billing.js` toma ao não
 * gerar cobrança de R$ 0,00.
 */
export function resumirBase(criancas) {
  const ativas = (criancas || []).filter((c) => c.active !== false);
  const valores = ativas
    .map((c) => Number(c.monthlyFee) || 0)
    .filter((v) => v > 0);

  // Soma arredondada: mensalidade com centavo (R$ 287,50) acumula erro de
  // ponto flutuante ao somar oito delas, e a base é o que multiplica tudo.
  const base = Math.round(valores.reduce((s, v) => s + v, 0) * 100) / 100;

  const media = valores.length ? base / valores.length : 0;

  return {
    criancas: ativas.length,
    semMensalidade: ativas.length - valores.length,
    base,
    ticketMedio: media,
    // MESMO NÚMERO, O NOME QUE O CONTRATO PROCURA.
    //
    // `montarContrato` lê `base.mensalidadeMedia` — nome que ninguém produzia.
    // Como o painel de associados ainda não está plugado, isso estava latente;
    // no dia em que fosse ligado, o contrato de associação sairia com
    // `valorPorPeriodo: 0` e o motorista assinaria eletronicamente, com hash,
    // um documento dizendo que não deve nada.
    //
    // Os dois nomes convivem de propósito: `ticketMedio` é como o painel do
    // dono chama, `mensalidadeMedia` é como o contrato chama. Derivar os dois
    // do mesmo cálculo aqui é mais barato que renomear em dois vocabulários
    // que já existem na tela.
    mensalidadeMedia: media,
    menor: valores.length ? Math.min(...valores) : 0,
    maior: valores.length ? Math.max(...valores) : 0,
  };
}

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
/**
 * GRATUITO é modo, não `valor: 0`.
 *
 * Zero é indistinguível de "ainda não configurei" — e as duas coisas levam a
 * decisões opostas: uma pede cobrança, a outra pede nada. Modo explícito faz a
 * gratuidade aparecer no painel como DECISÃO de alguém, com data e nota, e faz
 * o custo dela entrar no CAC em vez de sumir num campo vazio.
 */
export const MODOS = { PERCENTUAL: 'percentual', FIXO: 'fixo', GRATUITO: 'gratuito' };

/**
 * Como o associado paga.
 *
 * `anual` é à vista; `anual12` é o mesmo período em doze parcelas. Os dois
 * geram a MESMA receita reconhecida por mês e caixas completamente diferentes —
 * e é justamente essa diferença que o painel precisa mostrar separada.
 */
export const PERIODICIDADES = {
  MENSAL: 'mensal',
  SEMESTRAL: 'semestral',
  ANUAL: 'anual',
  ANUAL12: 'anual12',
};

/** Meses que cada periodicidade cobre. */
export const MESES_DA_PERIODICIDADE = {
  mensal: 1, semestral: 6, anual: 12, anual12: 12,
};

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

/**
 * Arredonda para centavo.
 *
 * POR QUE ISTO NÃO É DETALHE
 * `2240 * 0.04` em ponto flutuante dá `89.60000000000001`. Sem arredondar, esse
 * número entra na fatura, aparece na tela e é somado no relatório — e um total
 * que fecha com quatorze casas depois da vírgula não é um total, é uma pergunta.
 * Dinheiro tem duas casas; o arredondamento acontece UMA vez, aqui, e não em
 * cada `toFixed` espalhado pelas telas.
 */
function centavos(v) {
  return Math.round((Number(v) || 0) * 100) / 100;
}

/** A taxa que a régua da casa pediria, sem negociação nenhuma. */
export function taxaPadrao(base, config = PADRAO) {
  const bruta = (Number(base) || 0) * ((Number(config.percentual) || 0) / 100);
  return centavos(Math.max(bruta, Number(config.piso) || 0));
}

/**
 * A taxa que vale para este motorista, e como ela se compara com o padrão.
 *
 * O PERCENTUAL EFETIVO É O NÚMERO QUE PERMITE COMPARAR MOTORISTAS
 * R$ 90 de quem tem base de R$ 2.240 e R$ 90 de quem tem base de R$ 800 são
 * negócios completamente diferentes. Numa lista de parceiros, o valor absoluto
 * engana e o efetivo não: é ele que mostra quem está pagando pouco de verdade.
 *
 * `abaixoDoPiso` é aviso, não bloqueio. A negociação é do dono, e um piso que
 * recusa o acordo dele deixaria de ser referência para virar regra — o oposto
 * do que ele pediu.
 */
export function calcularTaxa({ base, negociacao, config = PADRAO }) {
  const b = Number(base) || 0;
  const padrao = taxaPadrao(b, config);

  let cobrada = padrao;
  let negociada = false;

  // GRATUIDADE ANTES DE TUDO, e explícita.
  //
  // Ela funcionaria por acidente: `valor: 0` no ramo percentual dá zero. Mas
  // sairia daqui com `abaixoDoPiso: true`, e a tela mostraria um alerta de
  // preço mal negociado em cima de uma decisão deliberada do dono. Um aviso
  // que grita no caso certo é um aviso que se aprende a ignorar.
  const gratuito = negociacao?.modo === MODOS.GRATUITO;

  if (gratuito) {
    negociada = true;
    cobrada = 0;
  } else if (negociacao && Number.isFinite(Number(negociacao.valor))) {
    negociada = true;
    cobrada =
      negociacao.modo === MODOS.FIXO
        ? Number(negociacao.valor)
        : b * (Number(negociacao.valor) / 100);
  }

  cobrada = centavos(cobrada);

  return {
    base: centavos(b),
    padrao,
    cobrada,
    negociada,
    delta: centavos(cobrada - padrao),
    // Sem base não existe percentual — evita 0/0 virando NaN na tela.
    efetivo: b > 0 ? (cobrada / b) * 100 : 0,
    padraoEfetivo: b > 0 ? (padrao / b) * 100 : 0,
    // Gratuidade NÃO é preço abaixo do piso: é decisão. Sem esta exceção o
    // painel alertaria o dono contra a própria escolha dele, toda vez.
    abaixoDoPiso: !gratuito && cobrada < (Number(config.piso) || 0),
    gratuito,
    // `fixo` não acompanha crescimento: entra criança, a plataforma recebe o
    // mesmo. A tela avisa; quem decide é o dono.
    naoAcompanhaCrescimento: negociada && negociacao.modo === MODOS.FIXO,
  };
}

/** A isenção cobre este mês? "Sem negociação" é zero isenção, não erro. */
export function isentoEm(negociacao, mes) {
  const ate = negociacao?.isencaoAte;
  if (!ate) return false;
  return String(mes) <= String(ate);
}

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

