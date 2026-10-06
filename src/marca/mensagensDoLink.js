/**
 * AS DUAS MENSAGENS QUE O TIO MANDA COM UM LINK (04/10/2026, texto "Direto"
 * escolhido pelo dono entre três).
 *
 * - O CONVITE vai para a família e leva o cartão do TIO (a prévia com a marca
 *   dele). Quem fala é ele, em primeira pessoa: "parece que foi o tio que
 *   escreveu, e o pai entende rapidinho porque está falando a língua dele".
 * - A INDICAÇÃO vai para outro motorista e leva o cartão do APP (verde, com a
 *   fita "Indicado por …"). Também em primeira pessoa.
 *
 * ⚠️ NENHUMA DAS DUAS FALA EM DESCONTO. O cupom da indicação dá ACESSO (o app
 * completo por um prazo) a quem foi indicado, e nunca preço: dois motoristas
 * que se cadastram no mesmo dia não pagam diferente por conhecerem alguém
 * (a regra do portão, docs/descontos.md). O texto do benefício e o prazo são
 * da sessão do negócio; aqui só entra o código, quando ele existir.
 *
 * ⚠️ NADA DE NÚMERO QUE ENVELHECE (preço, dias de teste): a mensagem fica no
 * WhatsApp por meses.
 *
 * Puro, sem React (`npm run testar:mensagens-do-link`).
 */

/**
 * "o Tio Nino", "a Tia Cida", "Transportes Silva". O artigo só entra quando a
 * marca começa por Tio/Tia: em nome de empresa ele soaria errado com
 * frequência ("o Van do Zé"), e sem artigo a frase continua natural.
 */
export function quemFala(marca) {
  const m = String(marca || '').trim();
  if (!m) return '';
  if (/^tio\b/i.test(m)) return `o ${m}`;
  if (/^tia\b/i.test(m)) return `a ${m}`;
  return m;
}

function primeiroNome(nome) {
  return String(nome || '').trim().split(/\s+/)[0] || '';
}

function doDaCrianca(nome, genero) {
  const artigo = genero === 'female' ? 'da' : genero === 'male' ? 'do' : 'do/da';
  return `${artigo} ${nome}`;
}

/**
 * O convite à família, para quem AINDA NÃO ENTROU.
 *
 * "Oi! Aqui é o Tio Nino, do transporte da Ana. Os avisos da perua agora vão
 * pelo app. Toque no link para entrar: <url>"
 *
 * Sem marca, a frase cai no transporte ("Aqui é do transporte escolar da
 * Ana"), que é o que ela dizia antes.
 */
export function mensagemDoConvite({ marca, nomeCrianca, generoCrianca, url }) {
  const nome = primeiroNome(nomeCrianca);
  const daCrianca = nome ? ` ${doDaCrianca(nome, generoCrianca)}` : '';
  const quem = quemFala(marca);
  const abertura = quem
    ? `Oi! Aqui é ${quem}, do transporte${daCrianca}.`
    : `Oi! Aqui é do transporte escolar${daCrianca}.`;
  return `${abertura} Os avisos da perua agora vão pelo app. Toque no link para entrar: ${url}`;
}

/**
 * A indicação a outro motorista.
 *
 * "Oi! Aqui é o Tio Nino. Estou usando o Alô Buzinou na minha perua: rota,
 * mensalidade e recado das famílias num lugar só. Crie sua conta aqui: <url>"
 *
 * Com cupom, uma linha a mais, ANTES do link (o link fica sempre no fim: é a
 * única ação). O que o cupom dá é texto da sessão do negócio; enquanto o
 * dono não fechar o prazo, a linha diz só para usar o código.
 */
export function mensagemDaIndicacao({ marca, url, cupom }) {
  const quem = quemFala(marca);
  const abertura = quem ? `Oi! Aqui é ${quem}.` : 'Oi!';
  const codigo = String(cupom || '').trim();
  const linhaDoCupom = codigo ? ` Use o cupom ${codigo} quando criar a conta.` : '';
  return (
    `${abertura} Estou usando o Alô Buzinou na minha perua: rota, mensalidade ` +
    `e recado das famílias num lugar só.${linhaDoCupom} Crie sua conta aqui: ${url}`
  );
}

/**
 * INDICAR UM PARCEIRO PARA UMA FAMÍLIA (etapa 2 da Comunidade, 05/10/2026).
 *
 * É INDICAÇÃO, não transferência: o tio manda à família o nome e o WhatsApp
 * do colega, e ela decide se chama. Nada dela vai para o outro tio — se ela
 * quiser, ele cadastra a criança e manda o convite dele, como sempre.
 *
 * "Oi! Aqui é o Tio Nino. Quero te indicar o Zé da Van (Zona Sul), que também
 * usa o Alô Buzinou. O WhatsApp dele é (11) 98765-4321. Se chamar, diz que
 * fui eu que indiquei."
 */
export function mensagemDeIndicarParceiro({ marca, parceiro }) {
  const quem = quemFala(marca);
  const abertura = quem ? `Oi! Aqui é ${quem}.` : 'Oi!';
  const nome = String(parceiro?.marca || '').trim() || 'um colega';
  const lugar = parceiro?.lugar ? ` (${parceiro.lugar})` : '';
  const fone = formatarWhatsApp(parceiro?.whatsapp);
  const contato = fone ? ` O WhatsApp é ${fone}.` : '';
  return `${abertura} Quero te indicar ${quemFala(nome)}${lugar}, que também usa o Alô Buzinou.${contato} Se chamar, diz que fui eu que indiquei.`;
}

/**
 * O CARTÃO DO TIO PARA UMA FAMÍLIA NOVA (05/10/2026, texto aprovado pelo
 * dono). É para CONHECER o tio, não para entrar no app — a família só entra
 * pelo convite de uma criança cadastrada. Por isso a mensagem não fala em
 * "entrar": ela abre a conversa sobre vaga, e o link (`/conheca/<uid>`)
 * mostra o cartão dele.
 *
 * "Oi! Aqui é o Tio Nino, transporte escolar. Na minha perua os avisos para
 * as famílias vão pelo app Alô Buzinou. Quer conversar sobre vaga? É só me
 * responder aqui. <url>"
 */
export function mensagemDoCartaoDoTio({ marca, url }) {
  const quem = quemFala(marca);
  const abertura = quem ? `Oi! Aqui é ${quem}, transporte escolar.` : 'Oi! Aqui é do transporte escolar.';
  return `${abertura} Na minha perua os avisos para as famílias vão pelo app Alô Buzinou. Quer conversar sobre vaga? É só me responder aqui. ${url}`;
}

/**
 * "do Tio Nino", "da Tia Rosa", "de Transportes Silva" — o mesmo critério de
 * `quemFala` para o artigo.
 */
export function deQuem(marca) {
  const m = String(marca || '').trim();
  if (!m) return 'do motorista';
  if (/^tio\b/i.test(m)) return `do ${m}`;
  if (/^tia\b/i.test(m)) return `da ${m}`;
  return `de ${m}`;
}

/**
 * A PÁGINA `/conheca/<uid>`: a frase sobre o app, o botão e a mensagem que a
 * família manda ao tocar nele. Cada promessa da frase existe no app: "a
 * perua saiu" (`saidaDaViagem`), "está chegando" (`avisarAproximacao`) e a
 * criança chegou (a entrega marcada avisa a família).
 */
export function fraseDoCartaoDoTio(marca) {
  return `Na perua ${deQuem(marca)}, os avisos vão pelo app Alô Buzinou: quando a perua sai, quando está chegando e quando a criança chega.`;
}

export function botaoDoCartaoDoTio(marca) {
  const quem = quemFala(marca) || 'o motorista';
  return `Falar com ${quem} no WhatsApp`;
}

export const MENSAGEM_DE_QUEM_VIU_O_CARTAO = 'Oi! Vi o seu cartão e quero conversar sobre vaga na perua.';

function formatarWhatsApp(digitos) {
  const d = String(digitos || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d || '';
}

/** O link do cadastro com o cupom, quando houver. */
export function linkDaIndicacao(base, cupom) {
  const codigo = String(cupom || '').trim();
  if (!codigo) return base;
  const junta = base.includes('?') ? '&' : '?';
  return `${base}${junta}cupom=${encodeURIComponent(codigo)}`;
}
