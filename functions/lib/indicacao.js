/**
 * A INDICAÇÃO, DO LADO DO SERVIDOR — espelho de
 * `src/dominio/identidade/indicacao.js`.
 *
 * ── POR QUE EXISTE UMA CÓPIA
 * O deploy das functions leva só a pasta `functions/`, então nada aqui pode
 * importar de `src/`. É o mesmo motivo — e o mesmo formato — de
 * `functions/lib/contratacao.js`, que espelha a régua de preço.
 *
 * ⚠️ **SÓ REGRA PURA E DADOS, NENHUMA ARITMÉTICA NOVA.** Quem muda a decisão
 * muda os DOIS arquivos, e `npm run testar:indicacao` compara os dois — caso
 * por caso, não por leitura. Se este arquivo divergir do outro, o teste falha.
 *
 * ── POR QUE O SERVIDOR PRECISOU DISSO (09/09/2026)
 * `casarEAtivar` existia só no cliente, chamada depois da baixa MANUAL da
 * fatura. O casamento da indicação acontece "na baixa" — e no dia em que a
 * baixa passasse a vir do GATEWAY, o gatilho desapareceria em silêncio para
 * 100% dos indicadores.
 *
 * A queixa que isso produz — *"indiquei e não recebi"* — é a que, numa rede de
 * indicação, viaja mais rápido que a própria indicação.
 */

/** Os quatro estados de uma indicação. `encerrada` entrou em 10/09/2026. */
const ESTADO = {
  PENDENTE: 'pendente',
  CADASTRADO: 'cadastrado',
  ATIVA: 'ativa',
  ENCERRADA: 'encerrada',
};

/**
 * A CHAVE do telefone: só dígitos, sem país, com o nono dígito quando for
 * celular. `null` quando não é telefone.
 *
 * Espelho exato da função do cliente — inclusive a ORDEM das operações, que é
 * o que faz `055 11 …` e `011 98765-4321` chegarem ao mesmo lugar.
 */
function chaveDoTelefone(telefone) {
  let d = String(telefone || '').replace(/\D/g, '');

  // O ZERO DA FRENTE SAI PRIMEIRO, e a ordem importa. Ele aparece nos dois
  // lugares — antes do DDI e antes do DDD — e nenhum telefone brasileiro
  // começa com zero. Tirar o 55 antes deixaria `05511…` intacto.
  d = d.replace(/^0+/, '');
  if (d.length >= 12 && d.startsWith('55')) d = d.slice(2);

  if (d.length === 11) return d;

  if (d.length === 10) {
    const local = d.slice(2);
    // 6–9 é celular no formato antigo: ganha o nono dígito. 2–5 é fixo, e
    // acrescentar o 9 nele criaria um número que não existe.
    if (/^[6-9]/.test(local)) return `${d.slice(0, 2)}9${local}`;
    return d;
  }

  return null;
}

/**
 * QUAL INDICAÇÃO GANHA O CRÉDITO, dado um indicado que acabou de pagar.
 *
 * As duas regras, nesta ordem — e a explicação longa está no gêmeo do
 * cliente, que é a fonte:
 *
 *   1. uma já casada com este uid ganha de qualquer pendente;
 *   2. entre as pendentes, vale quem indicou PRIMEIRO.
 *
 * Quem já está `ativa` fica fora (reativar contaria duas vezes), e a
 * auto-indicação é barrada aqui também — é o último ponto antes de o desconto
 * virar dinheiro.
 *
 * `em` é lido de três formas porque o Timestamp do Admin SDK, o do cliente e
 * um número simples não são o mesmo objeto.
 */
function escolherParaAtivar({ indicacoes = [], indicadoUid, chave } = {}) {
  if (!indicadoUid || !chave) return null;
  const lista = Array.isArray(indicacoes) ? indicacoes : [];

  const minhas = lista.filter(
    (i) =>
      (i?.estado === ESTADO.PENDENTE && i?.chave === chave) ||
      (i?.estado === ESTADO.CADASTRADO && i?.indicadoUid === indicadoUid)
  );
  if (!minhas.length) return null;

  const ms = (i) => {
    const v = i?.em;
    if (v?.toMillis) return v.toMillis();
    if (v instanceof Date) return v.getTime();
    return Number(v) || 0;
  };
  const porData = (a, b) => ms(a) - ms(b);

  const jaCasada = minhas
    .filter((i) => i.estado === ESTADO.CADASTRADO && i.indicadoUid === indicadoUid)
    .sort(porData)[0];
  const escolhida =
    jaCasada || minhas.filter((i) => i.estado === ESTADO.PENDENTE).sort(porData)[0];
  if (!escolhida) return null;

  if (escolhida.indicadorUid === indicadoUid) return null;
  return escolhida;
}

/** Quantas indicações de uma lista estão ativas. */
function contarAtivas(indicacoes = []) {
  return (Array.isArray(indicacoes) ? indicacoes : []).filter(
    (i) => i?.estado === ESTADO.ATIVA
  ).length;
}

/**
 * A RECONCILIAÇÃO — espelho de `reconciliarIndicacoes` do cliente.
 *
 * ⚠️ ELA MORA NO SERVIDOR PORQUE QUEM A CHAMA É O FECHAMENTO MENSAL
 * (`fechamento.js`), que já varre todo motorista no dia 1. O cliente tem a
 * mesma função para poder testá-la e para a tela do dono conferir — e
 * `npm run testar:indicacao` compara as duas caso a caso, como faz com
 * `escolherParaAtivar`.
 *
 * O raciocínio inteiro (por que `encerrada` existe, por que atraso não
 * derruba, e por que a contagem inclui os zeros) está no cliente. Aqui só o
 * código, sem aritmética nova.
 */
function reconciliarIndicacoes({ indicacoes = [], indicadosPagantes = [] } = {}) {
  const lista = Array.isArray(indicacoes) ? indicacoes : [];
  const pagantes = new Set(
    (Array.isArray(indicadosPagantes) ? indicadosPagantes : []).filter(Boolean)
  );

  const encerrar = [];
  const reabrir = [];

  for (const i of lista) {
    if (!i || !i.id || !i.indicadoUid) continue;
    const paga = pagantes.has(i.indicadoUid);
    if (i.estado === ESTADO.ATIVA && !paga) encerrar.push(i.id);
    if (i.estado === ESTADO.ENCERRADA && paga) reabrir.push(i.id);
  }

  const vaiEncerrar = new Set(encerrar);
  const vaiReabrir = new Set(reabrir);

  const ativasPorIndicador = {};
  for (const i of lista) {
    const uid = i && i.indicadorUid;
    if (!uid) continue;
    if (ativasPorIndicador[uid] === undefined) ativasPorIndicador[uid] = 0;

    let estado = i.estado;
    if (vaiEncerrar.has(i.id)) estado = ESTADO.ENCERRADA;
    else if (vaiReabrir.has(i.id)) estado = ESTADO.ATIVA;

    if (estado === ESTADO.ATIVA) ativasPorIndicador[uid] += 1;
  }

  return { encerrar, reabrir, ativasPorIndicador };
}

/**
 * A indicação pendente que corresponde a este telefone, no CADASTRO.
 *
 * ── ⚠️ POR QUE ELA MORA AQUI, E NÃO EM `casarNoCadastro.js`
 * Ela nasceu lá, junto do gatilho que a usa — e `npm run testar:imports`
 * derrubou a bateria na hora, que é exatamente o trabalho dele. O gatilho
 * requer `firebase-functions` e `firebase-admin`, pacotes que só existem em
 * `functions/node_modules`; num checkout limpo, o teste de indicação morreria
 * e o `&&` do encadeamento levaria os seguintes junto.
 *
 * É a regra da casa: **módulo de `functions/lib/` que é RÉGUA não requer o
 * SDK.** Quem precisa do SDK é o gatilho, e ele mora noutro arquivo.
 *
 * ── AS DUAS REGRAS, E ELAS ESPELHAM `escolherParaAtivar`
 * 1. ⚠️ VALE QUEM INDICOU PRIMEIRO. Se dois colegas indicaram a mesma
 *    pessoa, marcar o segundo aqui e o primeiro na baixa faria a tela de um
 *    deles contar uma história que o dinheiro depois desmente.
 * 2. ⚠️ A AUTO-INDICAÇÃO É BARRADA AQUI TAMBÉM. `validarIndicacao` já barra
 *    na criação, mas as rules não sabem comparar telefone — e este é o
 *    segundo ponto em que o mesmo uid poderia aparecer dos dois lados.
 *
 * ⚠️ E ELA NÃO ATIVA NADA. `cadastrado` não vale desconto: a carência
 * continua sendo o primeiro mês PAGO do indicado. Quem move o dinheiro é
 * `escolherParaAtivar`, na baixa da fatura.
 */
function escolherParaCadastrar(indicacoes, { indicadoUid, chave } = {}) {
  if (!indicadoUid || !chave) return null;

  const ms = (i) => {
    const v = i && i.em;
    if (v && typeof v.toMillis === 'function') return v.toMillis();
    if (v instanceof Date) return v.getTime();
    return Number(v) || 0;
  };

  return (
    (Array.isArray(indicacoes) ? indicacoes : [])
      .filter((i) => i && i.estado === ESTADO.PENDENTE && i.chave === chave)
      .filter((i) => i.indicadorUid !== indicadoUid)
      .sort((a, b) => ms(a) - ms(b))[0] || null
  );
}

module.exports = {
  ESTADO,
  chaveDoTelefone,
  escolherParaAtivar,
  escolherParaCadastrar,
  contarAtivas,
  reconciliarIndicacoes,
};
