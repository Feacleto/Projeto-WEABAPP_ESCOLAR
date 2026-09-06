/**
 * O QUE VAI PARA O GATEWAY — e o que se recusa a ir.
 *
 * Este arquivo não fala com ninguém. Ele responde três perguntas puras: esta
 * fatura PODE virar cobrança, que dados o gateway precisa receber, e este
 * CPF/CNPJ é de verdade. O transporte mora em `asaasApi.js`; a decisão mora
 * aqui, sem rede, provada por `npm run testar:gateway`.
 *
 * ── ELE NUNCA VÊ `payments`, E ESSA É A REGRA MAIS IMPORTANTE DO ARQUIVO
 * O gateway existe para UM dinheiro só: a taxa que o motorista paga à
 * plataforma (`faturasParceiro`). A mensalidade da família continua sendo PIX
 * direto para o motorista, sem a plataforma no caminho — é o item 7 dos Termos
 * e é promessa publicada na landing. No dia em que uma cobrança de `payments`
 * nascer aqui, a frase "a plataforma não intermedeia" fica falsa e a operação
 * muda de natureza jurídica.
 *
 * Por isso este módulo só sabe ler o formato de `faturasParceiro`. Não é falta
 * de generalidade: é a trava.
 *
 * ── A IDEMPOTÊNCIA VEM DO `externalReference`, NÃO DE UMA MARCA NOSSA
 * O id da fatura é `{uid}_{AAAA-MM}` — determinístico, um por motorista por
 * mês. Ele viaja como `externalReference` da cobrança, e é o que permite
 * PERGUNTAR ao gateway "esta fatura já virou cobrança?" antes de criar outra.
 *
 * Confiar só no `asaasPaymentId` gravado na fatura não basta: entre o gateway
 * responder e o Firestore gravar existe uma janela, e uma queda ali deixa uma
 * cobrança órfã lá e nenhum vestígio aqui. Na tentativa seguinte nasceria uma
 * SEGUNDA cobrança do mesmo mês, e o motorista pagaria a que abrisse primeiro
 * — ou as duas.
 *
 * ── VENCIMENTO NO PASSADO NÃO É ERRO, É O CASO COMUM
 * O dono fecha o mês quando dá, e a régua da casa vence no dia 10. Fechar dia
 * 14 produz uma fatura que já venceu. O gateway recusa data passada, então
 * aqui a data vira HOJE — a cobrança nasce vencendo hoje, que é a verdade. O
 * atraso continua sendo contado por `contaAtiva.js` a partir do `vencimento`
 * da fatura, que não é reescrito.
 */

/** Meses por extenso para a descrição que o motorista lê no PIX. */
const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

const SO_DIGITOS = /[^0-9]/g;

/** Normaliza Date, string, número ou Timestamp do Firestore. */
function paraData(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  if (typeof valor?.toDate === 'function') {
    const d = valor.toDate();
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
  }
  if (typeof valor === 'number' || typeof valor === 'string') {
    const d = new Date(valor);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Data no formato que o gateway espera.
 *
 * Montada campo a campo, NUNCA por `toISOString()`: o app roda em UTC-3, e o
 * ISO converte para UTC — um vencimento gravado às 12h do dia 10 sai como
 * "10", mas gravado às 22h sairia como "11". Um dia a mais de prazo por
 * acidente de fuso.
 */
function paraDiaISO(data) {
  const d = paraData(data);
  if (!d) return null;
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** 'setembro/2026' a partir de '2026-09'. */
function rotuloDoMes(mes) {
  const m = String(mes || '').trim();
  if (!/^[0-9]{4}-[0-9]{2}$/.test(m)) return m;
  const nome = MESES[Number(m.slice(5, 7)) - 1];
  return nome ? `${nome}/${m.slice(0, 4)}` : m;
}

/**
 * CPF ou CNPJ válido? Devolve só os dígitos, ou `null`.
 *
 * A VALIDAÇÃO É AQUI porque o erro do gateway é opaco: documento inválido
 * volta como um 400 genérico, e quem digitou nunca fica sabendo QUE foi o
 * documento. Conferir o dígito antes transforma isso numa frase que o dono lê
 * e conserta na hora.
 *
 * O cálculo é o oficial da Receita, e não uma checagem de tamanho: onze
 * dígitos iguais passam no tamanho e são o erro de digitação mais comum que
 * existe.
 */
function documentoValido(bruto) {
  const d = String(bruto || '').replace(SO_DIGITOS, '');
  if (d.length !== 11 && d.length !== 14) return null;
  // 111.111.111-11 e afins passariam em qualquer conta de dígito verificador.
  if (/^([0-9])\1+$/.test(d)) return null;

  const digito = (pesos) => {
    const soma = pesos.reduce((s, p, i) => s + Number(d[i]) * p, 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  if (d.length === 11) {
    if (digito([10, 9, 8, 7, 6, 5, 4, 3, 2]) !== Number(d[9])) return null;
    if (digito([11, 10, 9, 8, 7, 6, 5, 4, 3, 2]) !== Number(d[10])) return null;
    return d;
  }

  if (digito([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) !== Number(d[12])) return null;
  if (digito([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) !== Number(d[13])) return null;
  return d;
}

/**
 * Esta fatura pode virar cobrança no gateway?
 *
 *   { pode: true,  motivo: null }
 *   { pode: false, motivo: '...' }   e o motivo é a frase que o dono lê
 *
 * A ORDEM IMPORTA. `quitada` vem antes de `total`, porque fatura isenta nasce
 * quitada com total zero — e "já está paga" é uma resposta mais útil que "o
 * valor é zero" para quem está olhando a tela do mês.
 */
function podeCobrar(fatura) {
  if (!fatura) return { pode: false, motivo: 'Fatura não encontrada.' };
  if (fatura.status === 'quitada') {
    return { pode: false, motivo: 'Esta fatura já está quitada.' };
  }
  if (!(Number(fatura.total) > 0)) {
    return { pode: false, motivo: 'Fatura sem valor a cobrar.' };
  }
  // Cobrança já criada: quem cuida do resto é o webhook. Criar outra seria
  // pedir o mesmo mês duas vezes — ver o cabeçalho.
  if (fatura.asaasPaymentId) {
    return { pode: false, motivo: 'Esta fatura já tem cobrança no gateway.' };
  }
  return { pode: true, motivo: null };
}

/**
 * O corpo da cobrança, do jeito que o gateway recebe.
 *
 * `billingType: 'PIX'` e não 'UNDEFINED' (que deixaria o pagador escolher): a
 * taxa já é cobrada por PIX hoje, e o boleto acrescentaria dias de
 * compensação no meio de uma conta que decide se o motorista opera amanhã.
 */
function dadosDaCobranca({ fatura, faturaId, clienteId, hoje = new Date() }) {
  const vencimento = paraDiaISO(fatura?.vencimento);
  const agora = paraDiaISO(hoje);
  // Ver o cabeçalho: fatura fechada depois do dia do vencimento é o caso
  // comum, e o gateway recusa data passada.
  const dueDate = !vencimento || vencimento < agora ? agora : vencimento;

  return {
    customer: clienteId,
    billingType: 'PIX',
    value: Number(Number(fatura?.total || 0).toFixed(2)),
    dueDate,
    description: `Alô Buzinou — associação de ${rotuloDoMes(fatura?.mes)}`,
    // O elo com a fatura. É por ele que se pergunta ao gateway se este mês já
    // foi cobrado, e é o que permite reconciliar sem depender do nosso banco.
    externalReference: faturaId,
  };
}

/**
 * O cadastro do motorista no gateway.
 *
 * Devolve `null` quando o documento não é válido — quem chama transforma isso
 * na frase que o dono lê. O DOCUMENTO É OBRIGATÓRIO E O APP NÃO O COLETA: ver
 * o cabeçalho de `asaasCobranca.js`.
 */
function dadosDoCliente({ motorista, cpfCnpj, tioUid }) {
  const documento = documentoValido(cpfCnpj);
  if (!documento) return null;
  const telefone = String(motorista?.phone || '').replace(SO_DIGITOS, '');
  return {
    name: String(motorista?.name || '').trim(),
    cpfCnpj: documento,
    email: motorista?.email || undefined,
    mobilePhone: telefone || undefined,
    // Mesmo papel do `externalReference` da cobrança: o uid amarra o cliente
    // do gateway ao motorista do app sem depender do nome, que repete.
    externalReference: tioUid,
  };
}

module.exports = {
  documentoValido,
  podeCobrar,
  dadosDaCobranca,
  dadosDoCliente,
  rotuloDoMes,
  paraDiaISO,
};
