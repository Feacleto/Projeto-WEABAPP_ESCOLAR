/**
 * DE ONDE ESSA PESSOA VEIO — a atribuição de canal, resolvida da URL.
 *
 * ── POR QUE NÃO É UM FORMULÁRIO
 * A primeira ideia foi perguntar na landing: "de onde você veio?", com uma
 * lista de canais. Formulário voluntário de atribuição é respondido por uma
 * fração dos visitantes, e por uma fração ENVIESADA — quem já gosta responde,
 * quem estava avaliando vai embora. O número sairia pequeno e pareceria dado.
 *
 * O canal já vem de graça, para todo mundo que clica, em dois lugares:
 *   1. a UTM que a própria casa põe no link que publica (`?utm_source=...`);
 *   2. o referrer, quando a pessoa chegou por um link de terceiro (Google).
 *
 * A landing não decide nada disso: ela só REPASSA os dois valores crus no
 * link para o app (`?o=` e `?r=`), e quem resolve é este módulo. Assim a
 * lista de canais existe num lugar só — se ela fosse escrita também na
 * landing, os dois lados divergiriam no primeiro canal novo.
 *
 * ── O QUE ENTRA AQUI É TEXTO DE URL, LOGO É NÃO CONFIÁVEL
 * Qualquer pessoa edita `?o=` na barra de endereço. Por isso a saída é sempre
 * um `canal` da lista fechada abaixo — nunca o texto recebido. O texto cru
 * sobrevive em `detalhe`, truncado, só para o dono conseguir distinguir duas
 * campanhas do mesmo canal ("instagram-bio" e "instagram-stories").
 *
 * ── GUARDE A CHAVE, NUNCA O RÓTULO
 * O que vai para o banco é `canal: 'rua'`, não `'Vi na rua'`. Rótulo muda com
 * o marketing, e no dia em que "Vi na rua" virar "Vi um adesivo" o histórico
 * racha em duas categorias que são a mesma coisa — e ninguém percebe até
 * tentar somar o ano.
 *
 * Puro de propósito: sem Firebase, sem React, sem `window`. Quem lê a URL é a
 * tela; quem grava é o service. `npm run testar:origem`.
 */

/**
 * A LISTA FECHADA. `id` é o que vai para o banco, `rotulo` é o que a tela do
 * dono mostra. A ordem é a da tabela do painel.
 *
 * `direto` NÃO É UM CANAL, é a ausência de informação — quem digitou o
 * endereço, salvou nos favoritos, ou clicou num link sem UTM. ⚠️ E é ele que
 * carrega o que este módulo NÃO alcança: quem viu o adesivo na van e quem
 * ouviu de um colega não têm link nenhum para trazer, e caem aqui. É a
 * limitação a declarar sempre que alguém ler esta contagem: `direto` grande
 * não significa "ninguém indicou", significa "não havia como saber".
 */
export const CANAIS = [
  { id: 'indicacao', rotulo: 'Indicação de motorista' },
  { id: 'whatsapp', rotulo: 'WhatsApp' },
  { id: 'instagram', rotulo: 'Instagram' },
  { id: 'facebook', rotulo: 'Facebook' },
  { id: 'tiktok', rotulo: 'TikTok' },
  { id: 'youtube', rotulo: 'YouTube' },
  { id: 'google', rotulo: 'Busca no Google' },
  { id: 'rua', rotulo: 'Viu na rua' },
  { id: 'outro', rotulo: 'Outro' },
  { id: 'direto', rotulo: 'Sem origem' },
];

const IDS = CANAIS.map((c) => c.id);

/** O rótulo do canal, ou o próprio id se for um valor desconhecido. */
export function rotuloDoCanal(id) {
  const achado = CANAIS.find((c) => c.id === id);
  return achado ? achado.rotulo : String(id || 'direto');
}

/** `true` se o id está na lista fechada. */
export function canalValido(id) {
  return IDS.includes(id);
}

/* Texto de URL vira comparável: sem acento, sem espaço nas pontas, minúsculo.
 * Não uso `normalize('NFD')` com regex de bloco Unicode porque este arquivo
 * roda no Node dos testes E no browser, e a forma abaixo funciona igual nos
 * dois sem depender de flag. */
function limpar(txt) {
  return String(txt || '')
    .trim()
    .toLowerCase();
}

/**
 * APELIDOS DE CANAL — porque ninguém digita `utm_source=instagram` na pressa.
 *
 * Quem monta o link do post é uma pessoa, às vezes no celular, e ela escreve
 * `ig`, `insta`, `zap`. Sem esta tabela cada abreviação viraria um canal
 * próprio na contagem, e a soma do Instagram apareceria dividida em três.
 */
const APELIDOS = {
  ig: 'instagram',
  insta: 'instagram',
  instagram: 'instagram',
  face: 'facebook',
  fb: 'facebook',
  facebook: 'facebook',
  zap: 'whatsapp',
  wpp: 'whatsapp',
  wa: 'whatsapp',
  whats: 'whatsapp',
  whatsapp: 'whatsapp',
  tt: 'tiktok',
  tik: 'tiktok',
  tiktok: 'tiktok',
  yt: 'youtube',
  youtube: 'youtube',
  google: 'google',
  busca: 'google',
  adesivo: 'rua',
  van: 'rua',
  rua: 'rua',
  indicacao: 'indicacao',
  indicação: 'indicacao',
  tio: 'indicacao',
  colega: 'indicacao',
};

/**
 * O canal a partir do `utm_source` que a casa publicou.
 * Devolve `null` quando não reconhece — e `null` é diferente de `'outro'`:
 * quem não reconheceu ainda pode tentar o referrer.
 */
export function canalDeUtm(utmSource) {
  const v = limpar(utmSource);
  if (!v) return null;
  if (APELIDOS[v]) return APELIDOS[v];
  // `instagram-bio`, `instagram_stories`, `yt-descricao`: o canal é o
  // primeiro pedaço, e o resto é campanha — que vive em `detalhe`.
  const raiz = v.split(/[-_.\s/]/)[0];
  return APELIDOS[raiz] || null;
}

/**
 * DOMÍNIOS QUE ENTREGAM TRÁFEGO, e o canal de cada um.
 *
 * Os encurtadores dos próprios aplicativos são a parte que se erra: o link
 * clicado dentro do Instagram chega como `l.instagram.com`, o do Facebook
 * como `lm.facebook.com`, e o do Twitter/X como `t.co`. Comparar só por
 * "instagram.com" perderia todos eles.
 */
const HOSTS = [
  ['instagram.', 'instagram'],
  ['facebook.', 'facebook'],
  ['fb.', 'facebook'],
  ['whatsapp.', 'whatsapp'],
  ['wa.me', 'whatsapp'],
  ['tiktok.', 'tiktok'],
  ['youtube.', 'youtube'],
  ['youtu.be', 'youtube'],
  ['google.', 'google'],
  ['bing.', 'google'],
  ['duckduckgo.', 'google'],
];

/**
 * O canal a partir do referrer. Recebe host OU URL inteira — a tela às vezes
 * tem só o host (repassado pela landing), às vezes o `document.referrer`.
 *
 * `null` quando não reconhece, e também quando o referrer é a PRÓPRIA casa:
 * navegação interna não é aquisição, e contá-la faria cada clique dentro do
 * site parecer um canal novo.
 */
export function canalDeReferrer(referrer, hostsDaCasa = ['alobuzinou.com', 'alobuzinou.com.br']) {
  let host = limpar(referrer);
  if (!host) return null;
  // aceita URL completa
  const semEsquema = host.replace(/^[a-z]+:\/\//, '');
  host = semEsquema.split('/')[0].split('?')[0].replace(/^www\./, '');
  if (!host) return null;
  if (hostsDaCasa.some((h) => host === h || host.endsWith('.' + h))) return null;
  const achado = HOSTS.find(([fragmento]) => host.includes(fragmento));
  return achado ? achado[1] : 'outro';
}

/** Só o que cabe: `detalhe` é dica para o dono, não campo de texto livre. */
const MAX_DETALHE = 60;

/**
 * A DECISÃO, numa função: UTM ganha do referrer, e referrer ganha do vazio.
 *
 * A ordem não é arbitrária. A UTM é o que a CASA escreveu no link que ela
 * mesma publicou — é a única fonte que ela controla, e por isso é a mais
 * confiável. O referrer é o que o navegador conta, e ele mente por omissão:
 * app de mensagem costuma abrir link sem referrer nenhum, e é justamente o
 * WhatsApp, que é o canal principal deste negócio. Por isso UTM primeiro.
 *
 * Devolve sempre `{ canal, detalhe }`, com `canal` na lista fechada.
 */
export function resolverOrigem({ utmSource = '', referrer = '', hostsDaCasa } = {}) {
  const cru = limpar(utmSource);

  const porUtm = canalDeUtm(utmSource);
  if (porUtm) {
    // O texto cru só vale como detalhe quando diz mais que o canal — senão
    // seria a mesma informação duas vezes no banco.
    const detalhe = cru && cru !== porUtm ? cru.slice(0, MAX_DETALHE) : '';
    return { canal: porUtm, detalhe };
  }

  const porRef = canalDeReferrer(referrer, hostsDaCasa);
  if (porRef) {
    const host = limpar(referrer)
      .replace(/^[a-z]+:\/\//, '')
      .split('/')[0];
    return { canal: porRef, detalhe: host.slice(0, MAX_DETALHE) };
  }

  // UTM presente mas irreconhecível: o canal é 'outro' e o texto vira detalhe.
  // Isso é diferente de 'direto' — houve uma campanha, ela só não está na
  // tabela ainda, e o `detalhe` é o que permite descobrir qual.
  if (cru) return { canal: 'outro', detalhe: cru.slice(0, MAX_DETALHE) };

  return { canal: 'direto', detalhe: '' };
}

/**
 * A CONTAGEM PARA O PAINEL — quantos associados por canal.
 *
 * Recebe a lista de docs de `users` (só precisa de `origem.canal`) e devolve
 * as linhas na ordem de `CANAIS`, já com o rótulo pronto.
 *
 * ⚠️ Devolve `null` quando não há nenhum associado, e é de propósito: a regra
 * da casa é que onde o número não existe a tela diz "—", nunca zero. Uma
 * tabela de dez canais zerados parece medição e não é.
 */
export function contarPorCanal(usuarios = []) {
  const lista = Array.isArray(usuarios) ? usuarios : [];
  if (!lista.length) return null;

  const conta = new Map();
  for (const u of lista) {
    const bruto = u?.origem?.canal;
    const canal = canalValido(bruto) ? bruto : 'direto';
    conta.set(canal, (conta.get(canal) || 0) + 1);
  }

  const total = lista.length;
  const linhas = CANAIS.filter((c) => conta.has(c.id)).map((c) => ({
    canal: c.id,
    rotulo: c.rotulo,
    quantos: conta.get(c.id),
    // arredonda para inteiro: décimo de ponto percentual sobre base de dez
    // pessoas é precisão inventada.
    percentual: Math.round((conta.get(c.id) / total) * 100),
  }));

  // Maior primeiro — a pergunta é "de onde vem a maioria", e ordem alfabética
  // obriga a pessoa a varrer a tabela para responder isso.
  linhas.sort((a, b) => b.quantos - a.quantos);
  return { total, linhas };
}
