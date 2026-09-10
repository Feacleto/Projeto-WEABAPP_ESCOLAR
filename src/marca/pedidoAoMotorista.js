/**
 * O PEDIDO QUE A RESPONSÁVEL FAZ AO MOTORISTA — e a saída de um beco.
 *
 * ── O BECO
 * `/first-access` existe só para quem NÃO tem o link do convite: quem tem
 * abre o link e `Invite.jsx` resolve tudo, sem passar por aqui. E até
 * 09/09/2026 a única coisa que a tela oferecia a essa pessoa era digitar um
 * **código de 8 caracteres** — que ela quase sempre também não tem, porque
 * link e código viajam na MESMA mensagem: se a conversa sumiu, sumiram os
 * dois.
 *
 * Então a tela pedia a chave a quem tinha acabado de perder o chaveiro.
 *
 * ── POR QUE PEDIR AO MOTORISTA É MELHOR QUE UM CAMPO DE CÓDIGO
 * Não é só simplificação. O pedido devolve um **link novo, que funciona**. O
 * campo devolvia a chance de errar uma letra num código lido por telefone —
 * e um código errado é indistinguível, para ela, de um convite que não existe.
 *
 * ⚠️ E há um caso que só o pedido resolve: **o motorista que ainda não usa o
 * app.** Ela não perdeu convite nenhum, nunca houve um. O campo de código
 * nunca teve resposta para ela; a mensagem tem.
 *
 * ── O QUE A MENSAGEM PODE DIZER
 * Ela é escrita por ela e lida por ele, mas sai da nossa mão — então vale a
 * mesma régua de qualquer peça pública:
 *
 * - **Não promete segurança.** A plataforma não inspeciona van, não confere
 *   CNH e não treina ninguém. `npm run testar:selo` bate esta string contra
 *   as raízes proibidas de [promessas.js](promessas.js).
 * - **Não fala de preço.** Quanto ele paga é conversa com o consultor; número
 *   solto vira âncora antes de existir proposta.
 * - **Não promete prazo nem facilidade** ("em 2 minutos", "sem burocracia").
 *   Quem vai descobrir o trabalho é ele, na tela de cadastro.
 * - **Diz o que ELA ganha**, porque é ela quem está pedindo, e o pedido fica
 *   honesto: ele não está fazendo um favor abstrato.
 *
 * ⚠️ E ela não diz "cadastre meu filho". Quem decide se aquela criança entra
 * na perua é ele — o app não cria vínculo por pedido de fora, e prometer isso
 * numa mensagem produziria a mãe cobrando um cadastro que ninguém aceitou.
 */

/**
 * ONDE ELA MANDA ELE — o CADASTRO, no domínio do app.
 *
 * ⚠️ ISTO ERA A LANDING (`alobuzinou.com.br`), e a mensagem diz "você cria a
 * sua conta aqui". Ela mandava para a página onde não se cria conta nenhuma:
 * ele lia um pedido pessoal, clicava, e caía numa apresentação institucional
 * que responde a pergunta que a mensagem dela já tinha respondido.
 *
 * Escrito à mão, e não importado de `config/vitrine.js`, porque `marca/` é
 * puro — o mesmo motivo pelo qual o endereço antigo também morava aqui.
 */
const SITE = 'https://alobuzinou.com/quero-fazer-parte';

/**
 * A mensagem que ela manda. Uma linha por parágrafo do WhatsApp.
 *
 * O nome dela vai no fim quando existir — mensagem de número desconhecido sem
 * assinatura é a forma de um golpe, e ele vai abrir um link depois de lê-la.
 */
export function mensagemAoMotorista({ nome = '' } = {}) {
  const assinatura = nome.trim() ? `\n\nÉ a ${nome.trim()}.` : '';
  return (
    'Oi! Queria acompanhar a perua pelo Alô Buzinou — dá pra ver quando ela ' +
    'está chegando, avisar quando meu filho não vai e acertar a mensalidade ' +
    'por lá.\n\n' +
    `Você cria a sua conta aqui: ${SITE}\n\n` +
    'Depois é você que me manda o convite pelo WhatsApp.' +
    assinatura
  );
}

/**
 * A PEÇA QUE VAI JUNTO DA MENSAGEM — e por que ela existe.
 *
 * É a mesma imagem que a landing anexa no botão de indicar: 221 KB com o
 * ENDEREÇO ESCRITO dentro, e o texto "pra quem dirige perua escolar" — que é
 * exatamente quem ela está convidando aqui.
 *
 * ⚠️ ELA SÓ CHEGA PELA BANDEJA DO SISTEMA. `wa.me` transporta texto e nada
 * mais: anexar arquivo por link não existe no protocolo. Quem consegue é
 * `navigator.share` com `files`, no Chrome do Android e no Safari do iPhone.
 * No computador a bandeja quase sempre recusa arquivo, e aí vai o texto
 * sozinho — o endereço está escrito nele também, então nada se perde.
 *
 * ⚠️ O ARQUIVO ESTÁ DUPLICADO: `public/brand/convite.jpg` no app e
 * `landing/brand/convite.jpg` na landing. São dois domínios e dois deploys —
 * a landing é HTML estático e não alcança o `public/` do app. Trocar a peça
 * é trocar os dois.
 */
export const PECA_DO_PEDIDO = '/brand/convite.jpg';

/** O `wa.me` sem destinatário: quem escolhe o contato é o WhatsApp dela. */
export function linkDoPedido(opcoes) {
  return `https://wa.me/?text=${encodeURIComponent(mensagemAoMotorista(opcoes))}`;
}

/** Só para o teste ter o que medir sem montar a URL. */
export const TEXTO_DO_PEDIDO = mensagemAoMotorista();
