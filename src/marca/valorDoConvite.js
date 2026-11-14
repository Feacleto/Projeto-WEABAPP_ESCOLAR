/**
 * OS TEXTOS QUE FAZEM O TIO ENXERGAR O VALOR DO CONVITE (14/11/2026) —
 * docs/analise/12-textos-que-mostram-valor.md, momentos 1, 2 e 4 e a linha
 * "O que fazer". Puro, sem React (`npm run testar:valor-do-convite`).
 *
 * ── A REGRA: CADA AFIRMAÇÃO CARREGA DE ONDE ELA VEM
 * Todo texto aqui tem um campo `sustenta`, a chave de uma funcionalidade que o
 * app cumpre HOJE. O teste mantém a lista fechada das chaves, aponta o arquivo
 * onde cada uma existe e reprova texto sem origem. Frase bonita sem fonte é
 * como o app passa a prometer o que não faz.
 *
 * ── O QUE NÃO ENTRA, E O TESTE PROCURA
 * Cobrar por ele, saber quando o PIX chega, reduzir atraso, segurança, preço,
 * "grátis", prazo de função nova e número solto. Número, só da régua.
 *
 * ⚠️ O MOMENTO 2 DIZ "sai do aviso 'ainda não entraram' no Início", E NÃO
 * "aparece Entrou ✓" como a especificação propunha: não existe "Entrou ✓" em
 * tela nenhuma. Houve uma versão que dizia "o 'Convite pendente' some da
 * lista", apoiada na etiqueta do `ChildCard` — e o `ChildCard` não é montado
 * por NENHUMA tela: a frase era falsa e o teste não pegou, porque provava que o
 * texto EXISTIA no arquivo, não que alguém o mostrava. O que o tio vê de fato
 * é o aviso "N famílias ainda não entraram" no "Para resolver" do Início
 * (`TioDashboard`), contado pelas crianças com convite pendente; quando a
 * família entra, o número diminui. Por isso o teste agora exige que a tela que
 * sustenta cada frase seja ALCANÇÁVEL a partir do `main.jsx`.
 */

import { primeiroNomeSemTratamento } from '../compartilhado/formatters.js';

/** O que o cartão chama o assunto. */
export const TITULO_DO_CARTAO = 'Para que serve o convite';

/** A linha em que o cartão se recolhe depois do primeiro convite. */
export const ROTULO_RECOLHIDO = 'Por que convidar?';

/**
 * Momento 1 — as três linhas. `icone` é só o nome; quem desenha é o componente.
 *
 * ⚠️ CORRIGIDAS NA 2ª RODADA (docs/analise/13b, seção 3), porque a primeira
 * redação era verdade só para quem já tem a família dentro do app:
 *  - "Acompanhe o pagamento: quem pagou, avisou ou atrasou" — a mensalidade só
 *    NASCE depois que a mãe entra (`billing.js` pula a criança sem
 *    `parentUid`); numa conta nova a Carteira mostra "Nenhum pagamento". O
 *    ganho real do convite é esse: sem a mãe, a mensalidade não existe.
 *  - "A mãe é avisada quando o filho entra na perua" — o aviso de embarque só
 *    sai na VOLTA da escola. De manhã ela recebe "A perua saiu", o "chegando" e
 *    o "chegou na escola".
 * `condicao` diz de que a frase depende para ser verdade, e o teste exige que
 * cada condição exista na lista fechada dele. A condição NÃO vira ressalva na
 * tela: a frase fica curta, e é o texto que já nasce condicional ("Com a mãe no
 * app…", "avisada").
 */
export const LINHAS_DO_VALOR = [
  {
    id: 'pagamento',
    icone: 'carteira',
    texto: 'Com a mãe no app, você acompanha a mensalidade dela',
    sustenta: 'mensalidade-nasce-com-a-mae',
    condicao: 'mae-no-app',
  },
  {
    id: 'faltas',
    icone: 'calendario',
    texto: 'As faltas chegam sozinhas, sem grupo',
    sustenta: 'falta-avisada-no-painel',
    condicao: 'mae-no-app',
  },
  {
    id: 'embarque',
    icone: 'sino',
    texto: 'A mãe é avisada quando a perua sai e quando o filho chega',
    sustenta: 'push-de-saida-e-chegada',
    condicao: 'aviso-no-celular-da-mae',
  },
];

/** Momento 1 — a linha menor, embaixo. */
export const LINHA_DO_PIX = {
  texto: 'O dinheiro vai direto para a sua chave PIX.',
  sustenta: 'pix-direto',
  condicao: 'chave-pix-cadastrada',
};

/** "O que fazer" — a primeira sempre; a segunda só para quem não tem o número. */
export const O_QUE_FAZER = {
  mandarDeNovo: {
    texto: 'Mande uma vez. Se ela não entrar, mande de novo.',
    sustenta: 'reenviar-link',
  },
  semNumero: {
    texto: 'Sem o número dela? No WhatsApp, escolha o contato.',
    sustenta: 'link-sem-numero',
  },
};

export const SUSTENTA_DO_ENVIADO = 'convites-abertos-no-inicio';

/**
 * Momento 2 — depois de mandar. Com o nome de quem recebe quando há, sem nome
 * quando não há ("a família", nunca "ela" solto). Só o PRIMEIRO nome: é a
 * pessoa que ele vê na conversa do WhatsApp. "Dona Marta" é "Marta": o
 * tratamento é pulado, e só tratamento ("Dona") vira a frase sem nome.
 */
export function textoDoEnviado(nome) {
  const primeiro = primeiroNomeSemTratamento(nome);
  return primeiro
    ? `Enviado para ${primeiro}. Quando ela entrar, sai do aviso “ainda não entraram” no Início.`
    : 'Enviado. Quando a família entrar, sai do aviso “ainda não entraram” no Início.';
}

/**
 * Momento 4 — uma vez, junto da lista de quem avisou que pagou.
 *
 * ⚠️ O BOTÃO SE CHAMA "Dar baixa", NÃO "Confirmar" (como a especificação
 * escrevia): o app unificou o verbo ("Era 'Confirmar' aqui e 'Dar baixa' logo
 * abaixo, pra exatamente a mesma operação"), e mandar tocar numa palavra que
 * não está na tela é pior que não explicar. O teste confere que o rótulo
 * citado existe em `AguardandoVoce`.
 */
export const AVISO_DO_BANCO = {
  texto: 'O app não vê o seu banco. Confira e toque em Dar baixa.',
  sustenta: 'claimed-paid',
};

/**
 * Todas as afirmações com a sua origem, para o teste varrer. O momento 2 entra
 * nas duas formas (com e sem nome).
 */
export function todasAsAfirmacoes() {
  return [
    ...LINHAS_DO_VALOR.map(({ id, texto, sustenta, condicao }) => ({ id, texto, sustenta, condicao })),
    { id: 'pix', ...LINHA_DO_PIX },
    { id: 'mandarDeNovo', ...O_QUE_FAZER.mandarDeNovo },
    { id: 'semNumero', ...O_QUE_FAZER.semNumero },
    { id: 'enviadoComNome', texto: textoDoEnviado('Ana Clara'), sustenta: SUSTENTA_DO_ENVIADO },
    { id: 'enviadoSemNome', texto: textoDoEnviado(''), sustenta: SUSTENTA_DO_ENVIADO },
    { id: 'bancoNaoVisto', ...AVISO_DO_BANCO },
    { id: 'carteiraVazia', texto: CARTEIRA_VAZIA, sustenta: 'mensalidade-nasce-com-a-mae' },
    { id: 'avisosNoCelular', texto: AVISOS_NO_CELULAR, sustenta: 'push-ao-motorista' },
    { id: 'avisouQuePagouComNome', texto: textoDeQuemAvisouQuePagou('Ana Clara'), sustenta: 'claimed-paid' },
    { id: 'avisouQuePagouSemNome', texto: textoDeQuemAvisouQuePagou(''), sustenta: 'claimed-paid' },
    { id: 'rotaIniciada', texto: ROTA_INICIADA, sustenta: 'rota-iniciada' },
    { id: 'rotaIniciadaSemMapa', texto: ROTA_INICIADA_SEM_MAPA, sustenta: 'rota-iniciada' },
  ];
}

/**
 * ── 2ª RODADA: os textos que afirmavam o que o app não cumpre (13b, seção 2) ──
 */

/**
 * Carteira vazia. Era "Os pagamentos do mês são gerados quando você cadastra
 * crianças." — falso: a mensalidade nasce quando a família ENTRA no app. Ele
 * cadastrava, continuava vendo "Nenhum pagamento" e não sabia o que faltava.
 */
export const CARTEIRA_VAZIA = 'A mensalidade de cada família aparece depois que ela entra no app.';

/**
 * O convite para ligar o aviso no celular DO MOTORISTA. Era "chegada da
 * criança, recado de escola e cobrança" — o aviso de chegada vai para a mãe. O
 * tio recebe, de fato, a falta avisada e a família que avisou que pagou.
 */
export const AVISOS_NO_CELULAR =
  'Hoje eles só aparecem quando você abre o app. Ligando, chegam no celular: quem avisou que vai faltar e quem avisou que pagou.';

/**
 * Quem avisou que pagou. Era o nome da CRIANÇA ("Lucas avisou que pagou"), e
 * isso põe uma criança de seis anos fazendo PIX. O sujeito é a família; o nome
 * é só o endereço da conversa. Sem nome, "Uma família".
 */
export function textoDeQuemAvisouQuePagou(nomeDaCrianca) {
  const primeiro = String(nomeDaCrianca || '').trim().split(/\s+/)[0];
  return primeiro ? `A família de ${primeiro} avisou que pagou` : 'Uma família avisou que pagou';
}

/**
 * O aviso ao iniciar a rota. Era "Rota começou! GPS ligado." — exclamação e
 * jargão. Calmo e sem sigla; o segundo diz o que as famílias NÃO veem quando
 * ele desliga o mapa.
 */
export const ROTA_INICIADA = 'Rota iniciada.';
export const ROTA_INICIADA_SEM_MAPA = 'Rota iniciada. A perua não aparece no mapa das famílias.';

/**
 * Onde o aparelho lembra o que já foi dito (`compartilhado/lembreteDoAparelho`)
 * e o aviso que faz o cartão do convite se recolher na mesma tela, sem recarga.
 */
export const CHAVE_CONVITE_ENVIADO = 'alobuzinou:valorDoConvite:enviado';
export const EVENTO_CONVITE_ENVIADO = 'alobuzinou:convite-enviado';
export const CHAVE_AVISO_DO_BANCO = 'alobuzinou:valorDoConvite:bancoVisto';

/**
 * ── 4ª RODADA: o valor da mensalidade é obrigatório (decisão do dono) ──
 * Sem ele o contrato não é emitido e o servidor não gera a mensalidade.
 * A frase diz só isso: não promete cobrança, prazo nem o que acontece depois.
 */
export const FALTA_O_VALOR =
  'Falta o valor da mensalidade. Sem ele, o contrato não pode ser emitido e a mensalidade não é gerada.';
export const DIGA_O_VALOR = 'Diga o valor da mensalidade.';
export const ATALHO_DO_VALOR = 'Preencher o valor';
