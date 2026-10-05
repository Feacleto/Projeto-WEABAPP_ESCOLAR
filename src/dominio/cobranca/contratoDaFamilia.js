/**
 * O CONTRATO ENTRE O MOTORISTA E A FAMÍLIA — a régua pura (02/10/2026).
 *
 * ── O QUE ERA, E POR QUE MUDOU
 * O contrato não era um documento: era REMONTADO a cada abertura a partir dos
 * campos da criança e do motorista. Três consequências, todas achadas lendo as
 * jornadas no teste do navegador:
 *
 *   1. A vigência era sempre 01/01 a 31/12 do ano CORRENTE, com 12 parcelas —
 *      a família que entrava em outubro assinava doze parcelas de um ano que
 *      já tinha acabado em nove meses.
 *   2. Mudar a mensalidade depois do aceite mudava o texto que ela "aceitou",
 *      sem aviso: o aceite apontava para um documento que não existia mais.
 *   3. O hash do aceite incluía a hora da abertura, então nunca podia ser
 *      conferido depois.
 *
 * Agora cada versão é GRAVADA (`children/{id}/contratos/{numero}`) e nunca
 * mais editada. Mudar o combinado depois do aceite é uma versão nova (o
 * ADITIVO), que só vale quando a família aceita. Quem escolhe a vigência é o
 * motorista.
 *
 * Este arquivo não importa nada: é o que o deixa testável no Node
 * (`npm run testar:combinado`).
 */

/** Data local em 'AAAA-MM-DD' (o formato gravado). */
export function dataISO(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 'AAAA-MM-DD' → 'DD/MM/AAAA'. Texto que não é data volta como veio. */
export function dataBR(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || '');
}

function partes(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return null;
  const [a, me, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(a, me - 1, d);
  // 31/02 vira 03/03 no Date — e isso não é a data que a pessoa digitou.
  if (dt.getFullYear() !== a || dt.getMonth() !== me - 1 || dt.getDate() !== d) return null;
  return { a, me, d };
}

/**
 * A vigência que a tela oferece pronta: de hoje até 31/12.
 *
 * ⚠️ PERTO DO FIM DO ANO ELA PULA PARA O ANO SEGUINTE. Quem fecha uma vaga em
 * novembro está fechando o ano letivo QUE VEM; oferecer "até 31/12" daria um
 * contrato de seis semanas, que vence antes da primeira aula de verdade.
 * Menos de 60 dias para o fim do ano → até 31/12 do ano seguinte.
 */
export function vigenciaPadrao(hoje = new Date()) {
  const inicio = dataISO(hoje);
  const fimDoAno = new Date(hoje.getFullYear(), 11, 31);
  const faltam = Math.round((fimDoAno - new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())) / 86400000);
  const ano = faltam < 60 ? hoje.getFullYear() + 1 : hoje.getFullYear();
  return { inicio, fim: `${ano}-12-31` };
}

/** Mais que isso não é um contrato de transporte escolar, é engano de digitação. */
export const MESES_MAXIMOS = 24;

/**
 * Quantas parcelas cabem na vigência: os MESES DE SERVIÇO, e mês começado
 * conta inteiro. De 02/10 a 31/12 são três; de 01/01 a 31/12, doze — o caso
 * que o contrato antigo escrevia para todos.
 *
 * ⚠️ NÃO É "OS MESES DO CALENDÁRIO QUE ELA TOCA". De 10/03 a 09/03 do ano
 * seguinte são doze meses de serviço que tocam TREZE meses do calendário —
 * contar o calendário poria uma parcela a mais no contrato de quem fechou o
 * ano certinho. A conta mede do início até o DIA SEGUINTE ao fim.
 */
export function parcelasDaVigencia(inicio, fim) {
  const i = partes(inicio);
  const f = partes(fim);
  if (!i || !f || fim < inicio) return 0;
  const depois = new Date(f.a, f.me - 1, f.d + 1);
  let n = (depois.getFullYear() - i.a) * 12 + (depois.getMonth() + 1 - i.me);
  if (depois.getDate() > i.d) n += 1;
  return n > 0 ? n : 0;
}

/** Devolve a frase do erro, ou `null` quando a vigência serve. */
export function erroDaVigencia(inicio, fim) {
  if (!partes(inicio)) return 'Escolha a data de início.';
  if (!partes(fim)) return 'Escolha a data de fim.';
  if (fim <= inicio) return 'O fim precisa vir depois do início.';
  if (parcelasDaVigencia(inicio, fim) > MESES_MAXIMOS) {
    return `No máximo ${MESES_MAXIMOS} meses. Para mais tempo, renove depois.`;
  }
  return null;
}

/**
 * A vigência da criança, ou a padrão quando ela ainda não tem uma (criança
 * cadastrada antes de existir o campo).
 */
export function vigenciaDaCrianca(child, hoje = new Date()) {
  if (child?.vigenciaInicio && child?.vigenciaFim) {
    return { inicio: child.vigenciaInicio, fim: child.vigenciaFim };
  }
  return vigenciaPadrao(hoje);
}

/**
 * JSON com as chaves em ordem — o Firestore NÃO devolve um mapa na ordem em
 * que ele foi gravado, então comparar ou tirar hash de `JSON.stringify` cru
 * daria "mudou" para dois documentos iguais. Espelho em
 * `functions/lib/reguaDoContrato.js` (o servidor tira o hash do aceite).
 */
export function jsonCanonico(valor) {
  if (valor === null || typeof valor !== 'object') return JSON.stringify(valor ?? null);
  if (Array.isArray(valor)) return `[${valor.map(jsonCanonico).join(',')}]`;
  const chaves = Object.keys(valor).filter((k) => valor[k] !== undefined).sort();
  return `{${chaves.map((k) => `${JSON.stringify(k)}:${jsonCanonico(valor[k])}`).join(',')}}`;
}

/**
 * Dois contratos dizem a mesma coisa? `issuedAt` fica de fora: é a hora em que
 * cada um foi montado, e dois documentos iguais montados em minutos
 * diferentes não são dois combinados.
 */
export function mesmoConteudo(a, b) {
  if (!a || !b) return false;
  const sem = (o) => {
    const copia = { ...o };
    delete copia.issuedAt;
    return copia;
  };
  return jsonCanonico(sem(a)) === jsonCanonico(sem(b));
}

const brl = (n) =>
  `R$ ${Number(n || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

/**
 * O QUE MUDOU de um contrato para o outro, em linhas que a família entende.
 *
 * É a lista que o aditivo mostra em destaque antes do texto inteiro: ninguém
 * relê nove cláusulas para achar o número que mudou, e um aditivo que obriga a
 * isso é um aditivo que se aceita sem ler.
 */
export function mudancasEntre(antes, depois) {
  if (!antes || !depois) return [];
  const linhas = [
    ['Mensalidade', brl(antes.finance?.monthlyFee), brl(depois.finance?.monthlyFee)],
    ['Dia do vencimento', `dia ${antes.finance?.dueDay}`, `dia ${depois.finance?.dueDay}`],
    ['Início do contrato', antes.period?.startDate, depois.period?.startDate],
    ['Fim do contrato', antes.period?.endDate, depois.period?.endDate],
    ['Endereço de casa', antes.student?.homeAddress, depois.student?.homeAddress],
    ['Escola', antes.student?.school, depois.student?.school],
  ];
  return linhas
    .filter(([, de, para]) => String(de ?? '') !== String(para ?? ''))
    .map(([rotulo, de, para]) => ({ rotulo, de: de || '—', para: para || '—' }));
}

/**
 * EM QUE PÉ ESTÁ O CONTRATO desta criança — a pergunta que a ficha, a tela do
 * contrato e o portão da família fazem.
 *
 *   'sem-contrato'      nada emitido ainda
 *   'aguardando'        o primeiro contrato espera o aceite
 *   'aceito'            vale um contrato aceito, e não há mudança pendente
 *   'mudanca'           vale um contrato aceito E há um aditivo esperando
 *
 * O aceite ANTIGO (anterior a esta régua, só com `contractAcceptedAt`) conta
 * como aceito: a família assinou, e apagar isso agora seria pedir a todo
 * mundo de novo algo que já foi feito.
 */
export function estadoDoContrato(child) {
  if (!child) return 'sem-contrato';
  const aceito = !!child.contratoVigente || !!child.contractAcceptedAt;
  const aguardando = child.contratoAguardando != null;
  if (aceito) return aguardando ? 'mudanca' : 'aceito';
  return aguardando ? 'aguardando' : 'sem-contrato';
}

/**
 * ── A VERSÃO DO TEXTO (05/10/2026) ──────────────────────────────────────────
 *
 * ⚠️ O HASH DO ACEITE PROVA OS DADOS, NÃO AS CLÁUSULAS. O que é gravado em
 * `children/{id}/contratos/{n}.dados` são os VALORES (partes, mensalidade,
 * vigência); o TEXTO das cláusulas é desenhado pelo `ContractView` a partir
 * do código. Sem esta marca, mudar uma cláusula no código mudava o que um
 * contrato JÁ ACEITO mostra — a família abriria "o contrato que assinou" e
 * leria outro, com o mesmo hash embaixo.
 *
 * A saída mais simples: o número do texto vai DENTRO de `dados`
 * (`versaoDoTexto`), então entra no hash sozinho (o servidor tira o hash de
 * `dados` inteiro — nada muda em `aceitarContrato`), e a tela desenha o texto
 * DAQUELA versão. Ausente = 1 = o texto que existia antes da marca: é o que
 * todo contrato emitido até aqui mostrou e foi aceito lendo.
 *
 * ⚠️ UM TEXTO PUBLICADO NUNCA É EDITADO. Corrigir cláusula é criar a versão
 * seguinte aqui e no `ContractView`; o número antigo continua desenhando
 * exatamente o que desenhava. Por isso os números que as cláusulas citam
 * (multa, prazos, o canal do titular) moram NESTA tabela, por versão, e não
 * em constantes soltas que alguém atualizaria "para todos".
 *
 * Mudar o texto também faz `mesmoConteudo` dar "mudou" para quem ainda não
 * aceitou — e é isso que faz `garantirContrato` reemitir sozinho o contrato
 * pendente no texto novo. O aceito fica como está: ninguém é chamado a
 * assinar de novo por causa de uma redação.
 */
export const VERSAO_DO_TEXTO = 2;

export const TEXTOS_DO_CONTRATO = {
  // O texto de antes da marca. Multa de 10% (acima do teto do CDC art. 52,
  // § 1º, que os tribunais aplicam à mensalidade) — fica como estava porque
  // é o que foi aceito; os contratos novos saem na 2.
  1: {
    multa: { pct: 10, extenso: 'dez por cento' },
    juros: null,
    diasDeArrependimento: null,
    diasDeAvisoAntesDeSuspender: null,
    canalDoTitular: null,
  },
  // 05/10/2026: multa de 2% + juros de 1% ao mês + correção (CDC art. 52,
  // § 1º); arrependimento de 7 dias (CDC art. 49 — o aceite é eletrônico,
  // fora do estabelecimento); aviso de 10 dias antes de suspender ou
  // rescindir por atraso; cláusula de dados pessoais (LGPD); foro do
  // domicílio do consumidor (CDC art. 101, I); preâmbulo para CPF ou CNPJ.
  2: {
    multa: { pct: 2, extenso: 'dois por cento' },
    juros: { pctAoMes: 1, extenso: 'um por cento' },
    diasDeArrependimento: { n: 7, extenso: 'sete' },
    diasDeAvisoAntesDeSuspender: { n: 10, extenso: 'dez' },
    // CONGELADO no texto, não importado de `COMPANY_INFO`: se o canal mudar
    // amanhã, o contrato que ela aceitou continua dizendo o que dizia.
    canalDoTitular: 'contato@alobuzinou.com',
  },
};

/** Qual texto esta versão gravada usa. Ausente (ou desconhecido) = 1. */
export function versaoDoTexto(dados) {
  const v = Number(dados?.versaoDoTexto);
  return TEXTOS_DO_CONTRATO[v] ? v : 1;
}

/** Os números que as cláusulas daquela versão citam. */
export function regrasDoTexto(dados) {
  return TEXTOS_DO_CONTRATO[versaoDoTexto(dados)];
}

/**
 * A linha "Se atrasar" do resumo — lida da MESMA versão que a cláusula 8ª,
 * § 1º, desenha. Um resumo que dissesse 2% em cima de uma cláusula de 10%
 * seria a segunda verdade sobre o mesmo dinheiro.
 */
export function seAtrasar(dados) {
  const { multa, juros } = regrasDoTexto(dados);
  return juros
    ? `Multa de ${multa.pct}% e juros de ${juros.pctAoMes}% ao mês`
    : `Multa de ${multa.pct}%`;
}

/**
 * COMO A CONTRATADA SE IDENTIFICA NO PREÂMBULO (texto 2).
 *
 * O motorista pode ser pessoa física (CPF) ou ter empresa (CNPJ), e o texto 1
 * dizia sempre "devidamente inscrita no C.N.P.J./C.P.F. ... neste ato
 * representada por seu representante legal" — para o autônomo, um
 * representante de si mesmo. O tipo sai do NÚMERO de dígitos (11 = CPF, 14 =
 * CNPJ); o representante só aparece com CNPJ, e só quando é uma pessoa de
 * verdade: o `'Representante legal'` de reserva de `buildContractData` não é
 * nome de ninguém, e repetir a razão social como representante também não.
 */
export function identificacaoDaContratada(company) {
  const digitos = String(company?.document || '').replace(/\D/g, '');
  const tipo = digitos.length === 14 ? 'CNPJ' : digitos.length === 11 ? 'CPF' : null;
  const rep = String(company?.representative || '').trim();
  const representante =
    tipo === 'CNPJ' &&
    rep &&
    rep.toLowerCase() !== 'representante legal' &&
    rep.toLowerCase() !== String(company?.name || '').trim().toLowerCase()
      ? rep
      : null;
  return { tipo, representante };
}
