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
 * ⚠️ O MOMENTO 2 DIZ "o aviso 'Convite pendente' some", E NÃO "aparece Entrou ✓"
 * como a especificação propunha: não existe "Entrou ✓" em tela nenhuma. O que o
 * app faz é tirar a etiqueta "Convite pendente" do cartão da criança quando a
 * família entra (`inviteStatus` deixa de ser `pending`). Prometer um selo que
 * não aparece seria a primeira mentira do cartão que veio explicar o valor.
 */

/** O que o cartão chama o assunto. */
export const TITULO_DO_CARTAO = 'Para que serve o convite';

/** A linha em que o cartão se recolhe depois do primeiro convite. */
export const ROTULO_RECOLHIDO = 'Por que convidar?';

/** Momento 1 — as três linhas. `icone` é só o nome; quem desenha é o componente. */
export const LINHAS_DO_VALOR = [
  {
    id: 'pagamento',
    icone: 'carteira',
    texto: 'Acompanhe o pagamento: quem pagou, avisou ou atrasou',
    sustenta: 'mensalidades-pagas-avisaram-atrasadas',
  },
  {
    id: 'faltas',
    icone: 'calendario',
    texto: 'As faltas chegam sozinhas, sem grupo',
    sustenta: 'falta-avisada-no-painel',
  },
  {
    id: 'embarque',
    icone: 'sino',
    texto: 'A mãe é avisada quando o filho entra na perua',
    sustenta: 'push-de-embarque',
  },
];

/** Momento 1 — a linha menor, embaixo. */
export const LINHA_DO_PIX = {
  texto: 'O dinheiro vai direto para a sua chave PIX.',
  sustenta: 'pix-direto',
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

export const SUSTENTA_DO_ENVIADO = 'inviteUsedAt';

/**
 * Momento 2 — depois de mandar. Com o nome de quem recebe quando há, sem nome
 * quando não há ("a família", nunca "ela" solto). Só o PRIMEIRO nome: é a
 * pessoa que ele vê na conversa do WhatsApp.
 */
export function textoDoEnviado(nome) {
  const primeiro = String(nome || '').trim().split(/\s+/)[0];
  return primeiro
    ? `Enviado para ${primeiro}. Quando ela entrar, o “Convite pendente” some da lista.`
    : 'Enviado. Quando a família entrar, o “Convite pendente” some da lista.';
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
    ...LINHAS_DO_VALOR.map(({ id, texto, sustenta }) => ({ id, texto, sustenta })),
    { id: 'pix', ...LINHA_DO_PIX },
    { id: 'mandarDeNovo', ...O_QUE_FAZER.mandarDeNovo },
    { id: 'semNumero', ...O_QUE_FAZER.semNumero },
    { id: 'enviadoComNome', texto: textoDoEnviado('Ana Clara'), sustenta: SUSTENTA_DO_ENVIADO },
    { id: 'enviadoSemNome', texto: textoDoEnviado(''), sustenta: SUSTENTA_DO_ENVIADO },
    { id: 'bancoNaoVisto', ...AVISO_DO_BANCO },
  ];
}

/**
 * Onde o aparelho lembra o que já foi dito (`compartilhado/lembreteDoAparelho`)
 * e o aviso que faz o cartão do convite se recolher na mesma tela, sem recarga.
 */
export const CHAVE_CONVITE_ENVIADO = 'alobuzinou:valorDoConvite:enviado';
export const EVENTO_CONVITE_ENVIADO = 'alobuzinou:convite-enviado';
export const CHAVE_AVISO_DO_BANCO = 'alobuzinou:valorDoConvite:bancoVisto';
