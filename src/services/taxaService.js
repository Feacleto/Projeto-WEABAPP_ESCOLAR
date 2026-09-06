import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
// A RÉGUA PURA MORA EM `dominio/associacao/planos.js`, E NÃO AQUI.
//
// Tudo que é aritmética de dinheiro fica fora deste arquivo: enquanto morava
// atrás do `import { db }` acima, era IMPOSSÍVEL testar — o projeto testa com
// scripts Node puros, e o script não consegue nem importar o módulo sem
// inicializar o Firebase. Duas vezes o contrato de associação saiu com valor
// zero por causa disso.
import {
  DIA_DE_VENCIMENTO,
  dataDeVencimento,
  isentoEm,
  limitarDiaVencimento,
  planoPorId,
  precoDoMes,
} from '../dominio/associacao/planos.js';
import { assinaturaAteDoMes } from '../dominio/associacao/contaAtiva.js';

export { dataDeVencimento, isentoEm, limitarDiaVencimento, planoPorId, precoDoMes };

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
 * fica falsa e a plataforma passa a ser intermediária.
 *
 * ── O MODELO NEGOCIADO MORREU EM 06/09/2026, E O ARQUIVO ENCOLHEU À METADE
 * Havia percentual sobre a soma das mensalidades, piso, modo (`percentual` /
 * `fixo` / `gratuito`), periodicidade (mensal / semestral / anual / anual em
 * 12×), carência em meses e desconto de antecipação — tudo ajustado caso a
 * caso num orçamento. Seis eixos negociáveis, e a fatura era o cruzamento
 * deles.
 *
 * Hoje é uma FAIXA de tabela por número de crianças ativas, escolhida pelo
 * próprio motorista. A fatura é `preço da faixa menos os descontos dele`.
 *
 * ── A CONSEQUÊNCIA TÉCNICA QUE VALE MAIS QUE A COMERCIAL
 * O cálculo antigo precisava da SOMA DAS MENSALIDADES de cada parceiro, e para
 * isso este arquivo varria `children` inteira — mil documentos com endereço,
 * escola e telefone de família viajando para o navegador do dono toda vez que
 * a aba Taxa abria, para produzir um punhado de somas. A varredura não podia
 * ter `limit()`: teto ali faria a cobrança sair MENOR que a devida, em
 * silêncio.
 *
 * O preço de tabela não depende de mensalidade nenhuma. Depende do NÚMERO de
 * crianças ativas, que já está materializado em `users.criancasAtivas` e sobe
 * no mesmo batch do cadastro. A varredura foi apagada — não otimizada,
 * apagada.
 *
 * ── QUEM CALCULA É QUEM COBRA
 * O cálculo roda no navegador do DONO, e o cobrado não tem escrita na fatura:
 * `faturasParceiro` é `write: isOwner()`, e o motorista só lê a dele. No caso
 * do pai era o contrário — cálculo no cliente colocava a caneta na mão de quem
 * se beneficiava do erro.
 *
 * ── TRÊS COLEÇÕES, TRÊS REGRAS — E NÃO UM `match {docId}` SÓ
 * Rules em Firestore são OR: um match abrangente que permite não é apertado
 * por um match específico que nega. Se as três morassem numa coleção só, a
 * mais frouxa valeria para todas — e a mais frouxa precisa deixar o motorista
 * ler a própria fatura. Isso abriria a nota interna junto.
 */

// ── as três coleções ────────────────────────────────────────────────────────

/**
 * A configuração da CASA: para onde pagar e em que dia. Só o dono.
 *
 * O que ela NÃO tem mais: `percentual` e `piso`. Eram a régua do modelo
 * negociado, e um percentual sobrando aqui é a chance de alguém somá-lo ao
 * preço de tabela e cobrar duas vezes.
 */
const CONFIG = () => doc(db, 'taxaConfig', 'app');

/**
 * O que o motorista NÃO pode ver sobre si: nota interna do dono, CPF/CNPJ e o
 * id dele no gateway. Só o dono, nem ele mesmo.
 *
 * A negociação saiu daqui junto com o modelo. O que define quanto ele paga —
 * plano, condição de fundador, descontos — mora em `users`, porque ele PRECISA
 * ver: é o que a tela de planos mostra.
 */
const PARCEIRO = (uid) => doc(db, 'taxaParceiros', uid);

/** A fatura de um mês. O dono escreve; o motorista lê a dele. */
const FATURA = (uid, mes) => doc(db, 'faturasParceiro', `${uid}_${mes}`);

/** O padrão quando `taxaConfig/app` ainda não existe. */
export const PADRAO = {
  diaVencimento: DIA_DE_VENCIMENTO,
  pixKey: '',
  pixKeyType: 'random',
  nomePlataforma: '',
  cidadePlataforma: '',
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
      console.error('[taxa] config não assinou:', err);
      cb({ ...PADRAO });
    }
  );
}

/** Para onde o motorista paga a taxa. */
export async function setPixPlataforma({ pixKey, pixKeyType, nome, cidade }) {
  await setDoc(
    CONFIG(),
    {
      pixKey: String(pixKey || '').trim(),
      pixKeyType: pixKeyType || 'random',
      nomePlataforma: String(nome || '').trim(),
      cidadePlataforma: String(cidade || '').trim(),
      atualizadoEm: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * O DIA DO VENCIMENTO É DA CASA, e vale para todo mundo.
 *
 * Do outro lado do dinheiro, o vencimento da mensalidade é por CRIANÇA — e a
 * diferença é de quem negocia: lá é o motorista com cada família; aqui é a
 * plataforma com todos os associados, no mesmo dia.
 */
export async function setDiaVencimento(dia) {
  await setDoc(
    CONFIG(),
    { diaVencimento: limitarDiaVencimento(dia), atualizadoEm: serverTimestamp() },
    { merge: true }
  );
}

// ── o que a plataforma sabe de cada parceiro ────────────────────────────────

export async function getParceiro(uid) {
  if (!uid) return null;
  const snap = await getDoc(PARCEIRO(uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}

export function watchParceiros(cb, onError) {
  return onSnapshot(
    collection(db, 'taxaParceiros'),
    (snap) => cb(snap.docs.map((d) => ({ uid: d.id, ...d.data() }))),
    (err) => {
      console.error('[taxa] parceiros não assinou:', err);
      onError?.(err);
    }
  );
}

/**
 * SUSPENDER OU REATIVAR um parceiro.
 *
 * `suspenso` é a única via em que uma PESSOA decide que a conta para — o
 * bloqueio por teste vencido e por atraso é conta de data, e acontece sozinho.
 * `isAdmin()` nas rules nega quem está suspenso, então isto vale para todas as
 * coleções de uma vez, não uma por uma.
 *
 * A data fica junto porque "desde quando" é a primeira pergunta de qualquer
 * conversa sobre uma suspensão.
 */
export async function suspenderParceiro(uid, suspenso) {
  if (!uid) throw new Error('Sem motorista.');
  await setDoc(
    doc(db, 'users', uid),
    { suspenso: suspenso === true, suspensoEm: suspenso === true ? serverTimestamp() : null },
    { merge: true }
  );
}

/** A nota interna do dono sobre um parceiro. Ele nunca lê isto. */
export async function setNotaInterna(uid, nota) {
  if (!uid) throw new Error('Sem motorista.');
  await setDoc(
    PARCEIRO(uid),
    { notaInterna: String(nota || '').slice(0, 2000), atualizadoEm: serverTimestamp() },
    { merge: true }
  );
}

// ── a cláusula: o que define quanto ele paga ────────────────────────────────

/**
 * A FAIXA CONTRATADA, e o teto de crianças que vem com ela.
 *
 * OS DOIS CAMPOS VÃO NO MESMO BATCH de propósito. `planoId` é o que a fatura
 * cobra; `limiteCriancas` é o que as rules cobram no cadastro de criança. Se
 * eles pudessem ser gravados separado, existiria uma janela em que o motorista
 * paga a faixa de R$ 69 com teto de 40 — e ninguém veria, porque cada campo
 * está certo do ponto de vista de quem o lê.
 *
 * `limiteCriancas` MORA EM `users`, e não em `taxaParceiros`, apesar de ser
 * cláusula. O motivo é a regra que o consome: `allow create` em `children`
 * confere o contador contra este teto a cada cadastro, via `getAfter` no doc
 * do motorista. Guardá-lo noutra coleção obrigaria a rule a uma segunda
 * leitura de documento em TODA criação de criança, para sempre.
 *
 * `teto` opcional é a saída para quem está ACIMA DA TABELA (mais de 40
 * crianças): ali não há preço de prateleira, é conversa, e o teto entra à mão.
 *
 * Só o dono escreve — as rules põem os dois campos na lista de gestão, fora do
 * alcance do parceiro. Limite que o limitado aumenta não é limite, e preço que
 * o devedor escolhe não é preço.
 */
export async function setPlanoDoParceiro(uid, planoId, { teto = null } = {}) {
  if (!uid) throw new Error('Sem motorista.');
  const plano = planoPorId(planoId);
  if (!plano && teto === null) {
    throw new Error('Faixa desconhecida. Acima da tabela, informe o teto à mão.');
  }
  const limite = teto === null ? plano.ate : Math.max(0, Math.trunc(Number(teto) || 0));

  const lote = writeBatch(db);
  lote.set(
    doc(db, 'users', uid),
    { planoId: plano ? plano.id : null, limiteCriancas: limite },
    { merge: true }
  );
  await lote.commit();
}

/**
 * A condição de fundador — quem entrou primeiro, e o que ganhou.
 *
 * QUEM MARCA É O DONO, e nunca um contador automático. A tentação é óbvia
 * ("o primeiro motorista do banco é o fundador"), e ela premiaria a primeira
 * conta de TESTE que alguém criou — com gratuidade vitalícia, que por
 * definição não expira.
 */
export async function setCondicaoFundador(uid, condicao) {
  if (!uid) throw new Error('Sem motorista.');
  await setDoc(doc(db, 'users', uid), { condicaoFundador: condicao || null }, { merge: true });
}

/**
 * Os descontos COM PRAZO de um parceiro (antecipação e roleta).
 *
 * A lista inteira é substituída, e é de propósito: `arrayUnion` acumularia o
 * mesmo prêmio duas vezes numa reemissão de contrato, e desconto duplicado
 * numa fatura é dinheiro que a plataforma deixa de receber sem ninguém somar.
 *
 * Cada item é `{ origem, fracao, ate }`, com `ate` em 'AAAA-MM'. Ver
 * `descontosVigentes` em `planos.js` — desconto sem prazo vira preço.
 */
export async function setDescontos(uid, descontos) {
  if (!uid) throw new Error('Sem motorista.');
  await setDoc(
    doc(db, 'users', uid),
    { descontos: Array.isArray(descontos) ? descontos : [] },
    { merge: true }
  );
}

/** Até que mês ele não recebe fatura (meses sem taxa da roleta). */
export async function setIsencao(uid, isencaoAte) {
  if (!uid) throw new Error('Sem motorista.');
  await setDoc(doc(db, 'users', uid), { isencaoAte: isencaoAte || null }, { merge: true });
}

// ── a base ──────────────────────────────────────────────────────────────────
//
// NÃO HÁ MAIS FUNÇÃO DE BASE AQUI, e a ausência é o resultado da mudança.
//
// O modelo negociado cobrava percentual sobre a soma das mensalidades, então
// este arquivo varria `children` inteira — mil documentos com endereço, escola
// e telefone de família viajando para o navegador do dono toda vez que a aba
// Taxa abria, só para produzir somas. E a consulta não podia ter `limit()`:
// teto ali fazia a cobrança sair MENOR que a devida, em silêncio.
//
// O preço de tabela depende só do NÚMERO de crianças ativas, que já está em
// `users.criancasAtivas` e sobe no mesmo batch do cadastro. Quem lista os
// parceiros é `userService.listarParceiros()`, que já existia: um documento
// por parceiro, e nenhum dado de criança sai do lugar.

// ── a fatura ────────────────────────────────────────────────────────────────

/**
 * Fecha a fatura de um mês para um parceiro.
 *
 * A FATURA CONGELA TUDO O QUE USOU, e isso é o trabalho dela. Faixa, preço de
 * tabela, cada desconto aplicado, a data pronta de vencimento e a chave PIX
 * para onde pagar viajam DENTRO do documento — nunca como ponteiro para a
 * régua da casa.
 *
 * Mudar o preço da tabela em dezembro não pode mexer no que já foi cobrado em
 * setembro, pelo mesmo motivo que renegociar não reescreve fatura antiga: o
 * histórico é o que se mostra numa conversa sobre atraso.
 *
 * A CHAVE PIX É COPIADA, NÃO REFERENCIADA. `taxaConfig` é `read: isOwner()` —
 * o motorista não lê a estrutura de preço da plataforma, e não deveria. Mas
 * ele precisa da chave para pagar. Copiar resolve os dois de uma vez.
 *
 * O id é `{uid}_{mes}` — determinístico, um por parceiro por mês. É ele que
 * vira `externalReference` no gateway e permite perguntar "este mês já foi
 * cobrado?" antes de criar outra cobrança.
 */
export async function fecharFatura({ motorista, mes, config, ownerUid }) {
  const tioUid = motorista?.uid;
  if (!tioUid || !mes) throw new Error('Sem motorista ou mês.');

  const plano = planoPorId(motorista.planoId);
  const isento = isentoEm(motorista.isencaoAte, mes);

  const conta = precoDoMes({
    plano,
    fundador: motorista.condicaoFundador || null,
    indicacoesAtivas: Number(motorista.indicacoesAtivas) || 0,
    descontos: motorista.descontos,
    mes,
  });

  // ACIMA DA TABELA NÃO VIRA FATURA DE ZERO. `precoDoMes` devolve `liquido:
  // null` quando não há faixa, e zero ali seria indistinguível de "não paga" —
  // exatamente o caso em que alguém precisa conversar antes de cobrar.
  if (!isento && conta.liquido === null) {
    throw new Error('Este parceiro está acima da tabela: defina a faixa antes de fechar.');
  }

  const total = isento ? 0 : conta.liquido;
  const dia = limitarDiaVencimento(config?.diaVencimento ?? PADRAO.diaVencimento);

  await setDoc(
    FATURA(tioUid, mes),
    {
      tioUid,
      mes,

      // a faixa, como ela era neste mês
      planoId: plano?.id || null,
      planoRotulo: plano?.rotulo || '',
      planoTeto: plano?.ate ?? null,
      precoTabela: plano ? plano.preco : null,
      criancasAtivas: Number(motorista.criancasAtivas) || 0,

      // os descontos, abertos — para a conversa que vem depois
      descontoTotal: conta.desconto,
      descontoFundador: conta.descontoFundador,
      descontoAntecipacao: conta.descontoAntecipacao,
      descontoIndicacao: conta.descontoIndicacao,
      descontoRoleta: conta.descontoRoleta,
      isento,

      total,

      // a data pronta, congelada junto com o resto
      vencimento: (() => {
        const d = dataDeVencimento(mes, dia);
        return d ? Timestamp.fromDate(d) : null;
      })(),
      diaVencimento: dia,

      // para onde pagar — copiado, não referenciado (ver o cabeçalho)
      pixKey: config?.pixKey || '',
      pixKeyType: config?.pixKeyType || 'random',
      nomePlataforma: config?.nomePlataforma || '',
      cidadePlataforma: config?.cidadePlataforma || '',

      status: total === 0 ? 'quitada' : 'aberta',
      lancadaPor: ownerUid || null,
      lancadaEm: serverTimestamp(),
    },
    { merge: true }
  );

  return { tioUid, mes, total, isento };
}

/**
 * O dono dá baixa quando o PIX do motorista cai.
 *
 * ELE ESCREVE DOIS DOCUMENTOS, E O SEGUNDO É O QUE DESTRAVA O RESTO.
 * A fatura vira `quitada`, e `users.assinaturaAte` passa a dizer ATÉ QUANDO
 * esta conta está paga.
 *
 * Esse campo existe por um motivo específico: nenhuma regra do Firestore
 * alcança o contrato de associação, porque o id dele é
 * `${tioUid}_${Date.now()}` e não se calcula. Sem um campo em `users`, o
 * bloqueio por fim de trial não teria como poupar quem já assinou — e o
 * primeiro cliente pagante seria trancado no dia 90.
 *
 * OS DOIS VÃO NO MESMO LOTE de propósito. Separados, uma falha de rede entre
 * eles deixa a fatura paga e a conta bloqueada — o pior desfecho possível,
 * porque o motorista tem o comprovante na mão e o app diz que ele não pagou.
 * O webhook do gateway faz exatamente o mesmo par, pela mesma razão.
 */
export async function marcarFaturaPaga(tioUid, mes, ownerUid) {
  if (!tioUid || !mes) throw new Error('Sem motorista ou mês.');

  const lote = writeBatch(db);
  lote.set(
    FATURA(tioUid, mes),
    {
      status: 'quitada',
      quitadaEm: serverTimestamp(),
      quitadaPor: ownerUid || null,
    },
    { merge: true }
  );

  // `null` sai quando o mês vem fora do formato — e aí o campo não é tocado,
  // em vez de gravar uma data inventada sobre a que já existia.
  const ate = assinaturaAteDoMes(mes);
  if (ate) {
    lote.set(doc(db, 'users', tioUid), { assinaturaAte: ate }, { merge: true });
  }

  await lote.commit();
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
  if (!tioUid) {
    cb([]);
    return () => {};
  }
  return onSnapshot(
    query(collection(db, 'faturasParceiro'), where('tioUid', '==', tioUid)),
    (snap) => {
      const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      lista.sort((a, b) => String(b.mes).localeCompare(String(a.mes)));
      cb(lista);
    },
    (err) => {
      console.error('[taxa] faturas do parceiro não assinou:', err);
      onError?.(err);
    }
  );
}
