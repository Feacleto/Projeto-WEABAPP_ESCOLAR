/**
 * A INDICAÇÃO — quem trouxe quem, e quando isso vira desconto.
 *
 * ── HOJE EXISTIA SÓ A CONTA
 * `users.indicacoesAtivas` era um número que só o dono escrevia, à mão. Não
 * havia registro de quem indicou quem: nenhuma forma de conferir, nenhuma de o
 * motorista acompanhar, e nenhuma de saber se a indicação foi real.
 *
 * ── ⚠️ AS DUAS FALHAS POSSÍVEIS PRODUZEM A MESMA QUEIXA
 * *"Indiquei e não recebi."* Ela pode vir de um telefone que não bateu
 * (normalização) ou de uma indicação que não devia valer (auto-indicação) — e
 * numa rede de indicação a reclamação viaja mais rápido que a indicação.
 *
 * Por isso este arquivo vem com teste ANTES de qualquer tela, e por isso a
 * normalização do telefone é a primeira coisa aqui.
 *
 * ── O TELEFONE É A CHAVE, E ELE MUDA DE FORMA
 * A mesma pessoa é `(11) 98765-4321`, `11987654321`, `+55 11 98765-4321` e —
 * este é o traiçoeiro — `(11) 8765-4321`, o número antigo, sem o nono dígito,
 * que muita gente ainda dita de cabeça. Comparar texto perde a indicação, e
 * quem perde é quem indicou.
 *
 * A regra do nono dígito: celular brasileiro tem 9 dígitos e começa com 9. O
 * formato antigo tinha 8 e começava com 6, 7, 8 ou 9. Fixo começa com 2 a 5 e
 * continua com 8. Então: 10 dígitos cuja parte local comece em 6–9 é celular
 * antigo, e ganha o 9 na frente.
 *
 * ── A CARÊNCIA NÃO É BUROCRACIA
 * O desconto entra quando o indicado **paga o primeiro mês** — não quando se
 * cadastra. Sem isso, cinco cadastros de teste dariam 50% de desconto real
 * sobre receita que nunca entrou, e o indicador teria zerado a conta dele com
 * gente que nunca pagou nada.
 *
 * ESTE ARQUIVO NÃO IMPORTA NADA (`npm run testar:indicacao`).
 */

/**
 * Os três estados, e o que separa um do outro.
 *
 *   pendente    ele indicou um telefone; ninguém se cadastrou ainda
 *   cadastrado  alguém entrou com aquele telefone — ainda não vale desconto
 *   ativa       o indicado pagou o primeiro mês; AGORA vale
 */
export const ESTADO = {
  PENDENTE: 'pendente',
  CADASTRADO: 'cadastrado',
  ATIVA: 'ativa',
};

/**
 * A CHAVE do telefone: só dígitos, sem país, com o nono dígito quando for
 * celular. `null` quando não é telefone.
 *
 * ⚠️ É ELA QUE DECIDE SE UMA INDICAÇÃO É PAGA. Comparar a string digitada
 * perderia a indicação de quem ditou o número antigo — e o queixoso seria
 * quem trouxe cliente.
 */
export function chaveDoTelefone(telefone) {
  let d = String(telefone || '').replace(/\D/g, '');

  // O ZERO DA FRENTE SAI PRIMEIRO, e a ordem importa. Ele aparece nos dois
  // lugares — antes do DDI (`055 11 ...`, seleção de operadora) e antes do DDD
  // (`011 98765-4321`) —, e nenhum telefone brasileiro começa com zero. Tirar o
  // 55 antes deixaria `05511...` intacto, porque a string não começa com 55.
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

/** Duas formas do mesmo número? */
export function mesmaPessoa(a, b) {
  const ka = chaveDoTelefone(a);
  const kb = chaveDoTelefone(b);
  // Sem chave não há igualdade — dois inválidos não são "a mesma pessoa".
  return Boolean(ka && kb && ka === kb);
}

/**
 * Esta indicação pode existir? `{ ok, erro }`.
 *
 * ⚠️ A AUTO-INDICAÇÃO É RECUSADA PELOS DOIS LADOS: pelo telefone (ele indica o
 * próprio número, com outra máscara) e pelo uid (ele indica uma conta que já é
 * dele). Barrar só um dos dois deixa a porta aberta — e o custo de deixá-la
 * aberta é o desconto inteiro, para quem não trouxe ninguém.
 */
export function validarIndicacao({ indicador, telefone, jaIndicados = [] } = {}) {
  const chave = chaveDoTelefone(telefone);
  if (!chave) return { ok: false, erro: 'Confira o telefone — faltam dígitos.' };

  if (!indicador?.uid) return { ok: false, erro: 'Sem quem indicou.' };

  if (mesmaPessoa(indicador.phone, telefone)) {
    return { ok: false, erro: 'Esse é o seu próprio número.' };
  }

  // Indicar o mesmo telefone duas vezes contaria em dobro por uma pessoa só.
  if ((Array.isArray(jaIndicados) ? jaIndicados : []).some((t) => mesmaPessoa(t, telefone))) {
    return { ok: false, erro: 'Você já indicou esse número.' };
  }

  return { ok: true, erro: null, chave };
}

/**
 * O registro, pronto para gravar. Guarda a CHAVE, não o que foi digitado — é
 * ela que será comparada no cadastro do indicado.
 *
 * O texto digitado vai junto em `telefoneDigitado` porque é o que o indicador
 * reconhece na tela dele: mostrar `11987654321` para quem digitou
 * `(11) 8765-4321` faz ele achar que indicou outra pessoa.
 */
export function montarIndicacao({ indicador, telefone, nome, agora = new Date() } = {}) {
  const { ok, erro, chave } = validarIndicacao({ indicador, telefone });
  if (!ok) throw new Error(erro);
  return {
    indicadorUid: indicador.uid,
    indicadorNome: indicador.name || '',
    chave,
    telefoneDigitado: String(telefone).trim(),
    nome: String(nome || '').trim(),
    estado: ESTADO.PENDENTE,
    em: agora,
  };
}

/**
 * As transições, e nenhuma delas é do indicador.
 *
 * ⚠️ QUEM MOVE É O SISTEMA, e é o ponto inteiro da carência. Se o indicador
 * pudesse marcar `ativa`, a carência não existiria — ele indicaria cinco
 * cadastros de teste e zeraria a conta com receita que nunca entrou.
 *
 * `cadastrado` acontece quando alguém se cadastra com aquele telefone;
 * `ativa`, quando a primeira fatura desse alguém é quitada.
 */
export function podeTransitar(de, para) {
  const atual = de || ESTADO.PENDENTE;
  if (para === ESTADO.CADASTRADO) return atual === ESTADO.PENDENTE;
  if (para === ESTADO.ATIVA) return atual === ESTADO.CADASTRADO;
  return false;
}

/** Quantas indicações DESTE indicador já valem desconto. */
/**
 * QUAL INDICAÇÃO GANHA O CRÉDITO, dado um indicado que acabou de pagar.
 *
 * ── POR QUE ISTO SAIU DO SERVICE
 * A regra vivia dentro de `casarEAtivar`, no cliente. Quando a baixa da fatura
 * passou a poder vir do GATEWAY (webhook, servidor), o casamento precisou
 * existir nos dois lados — e regra de dinheiro escrita duas vezes é regra que
 * diverge. Aqui ela é pura e testável; a cópia do servidor está em
 * `functions/lib/indicacao.js`, e `npm run testar:indicacao` compara as duas.
 *
 * ── AS DUAS REGRAS, NESTA ORDEM
 *
 * 1. UMA JÁ CASADA COM ESTE UID GANHA DE QUALQUER PENDENTE. Ela já foi
 *    resolvida antes; reabrir a disputa entregaria o crédito a quem apenas
 *    indicou mais cedo, depois de outro já ter sido reconhecido.
 *
 * 2. ⚠️ ENTRE AS PENDENTES, VALE QUEM INDICOU PRIMEIRO. Premiar os dois
 *    pagaria 20% por um cliente; premiar o último premiaria quem chegou depois
 *    de o trabalho estar feito.
 *
 * Quem já está `ativa` fica FORA: reativar contaria a mesma indicação duas
 * vezes, e é o erro que aparece quando o webhook e a baixa manual quitam a
 * mesma fatura.
 *
 * ⚠️ E A AUTO-INDICAÇÃO É BARRADA AQUI TAMBÉM, no último ponto antes de o
 * desconto virar dinheiro. `validarIndicacao` já barra na criação, mas as
 * rules não sabem comparar telefone.
 *
 * `em` é lido por `.toMillis?.()` ou como número/Date, porque o Timestamp do
 * cliente e o do Admin SDK não são o mesmo objeto.
 */
export function escolherParaAtivar({ indicacoes = [], indicadoUid, chave } = {}) {
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

export function contarAtivas(indicacoes = []) {
  return (Array.isArray(indicacoes) ? indicacoes : []).filter(
    (i) => i?.estado === ESTADO.ATIVA
  ).length;
}

/**
 * O que a tela do motorista mostra sobre as indicações dele.
 *
 * ⚠️ OS TRÊS NÚMEROS SÃO SEPARADOS DE PROPÓSITO. "Indiquei 5" e "5 valem
 * desconto" são frases diferentes, e juntá-las numa só é exatamente como nasce
 * o *"indiquei e não recebi"*: ele conta as cinco que mandou e a conta dele
 * mostra uma. A tela precisa dizer em que pé está cada uma.
 */
export function resumoDoIndicador(indicacoes = []) {
  const lista = Array.isArray(indicacoes) ? indicacoes : [];
  return {
    total: lista.length,
    pendentes: lista.filter((i) => i?.estado === ESTADO.PENDENTE).length,
    cadastrados: lista.filter((i) => i?.estado === ESTADO.CADASTRADO).length,
    ativas: contarAtivas(lista),
  };
}

/**
 * A frase que explica o estado de UMA indicação, para o indicador.
 *
 * Ela diz o que FALTA, não só onde está. "Cadastrado" sozinho parece que já
 * deu certo, e o desconto não veio — e é aí que nasce a reclamação.
 */
export function situacaoDaIndicacao(indicacao) {
  const estado = indicacao?.estado || ESTADO.PENDENTE;
  if (estado === ESTADO.ATIVA) return 'já está valendo no seu desconto';
  if (estado === ESTADO.CADASTRADO) return 'se cadastrou — vale quando pagar o primeiro mês';
  return 'ainda não se cadastrou';
}

/**
 * A indicação pendente que corresponde a este telefone, se houver.
 *
 * É o que o cadastro do indicado consulta: ele digita o telefone dele, e esta
 * função diz se alguém já o tinha indicado.
 */
export function acharIndicacao(indicacoes = [], telefone) {
  const chave = chaveDoTelefone(telefone);
  if (!chave) return null;
  return (
    (Array.isArray(indicacoes) ? indicacoes : []).find(
      (i) => i?.chave === chave && i?.estado === ESTADO.PENDENTE
    ) || null
  );
}
