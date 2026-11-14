/**
 * O PRIMEIRO DIA NÃO TRAVA NA PORTA: o aviso de cookies não cobre o botão de
 * criar a conta, e tocar na frase do aceite marca a caixa.
 *
 * ── POR QUE ESTE TESTE
 * O passeio visual (360x640, toque) achou dois bloqueios antes de a pessoa ver
 * qualquer coisa do produto:
 *
 *  (a) O aviso de cookies cobria "Criar minha conta e entrar". O desenho
 *      prometia uma reserva no fim da página enquanto o aviso estivesse aberto,
 *      mas a reserva era `padding-bottom` no `body` — e `body` e `#root` têm
 *      `height: 100%`: o conteúdo longo transborda a caixa e o padding do pai
 *      NÃO entra no transbordo. Medido no navegador: `scrollHeight` 1200 com ou
 *      sem 200px de padding. A reserva nunca existiu numa página comprida. Um
 *      bloco em fluxo no fim do `#root` entra no transbordo (1360 com 160px).
 *
 *  (b) No aceite legal, o nome do documento era um LINK dentro do `<label>`.
 *      Tocar na frase — onde está o texto — abria os Termos em outra aba e
 *      não marcava a caixa de 24px. Link dentro de label não repassa o toque.
 *
 * ── O QUE ELE AFIRMA
 *  1. O aviso grava a reserva em `--reserva-do-aviso` e a solta ao fechar; o
 *     `index.css` transforma a variável num bloco no fim do `#root`; e ninguém
 *     volta a usar `padding-bottom` no body para isso.
 *  2. Cada linha do aceite tem a caixa com `<label htmlFor>` associado, o link
 *     de leitura FORA do label, com `target="_blank"`, e os dois alvos com
 *     pelo menos 44px de altura.
 *  3. O texto jurídico da frase não mudou.
 *
 * COMO RODAR
 *   node scripts/testar-primeiro-dia.mjs   (ou: npm run testar:primeiro-dia)
 */

import { readFileSync } from 'node:fs';

let ok = 0;
let bad = 0;
const falhas = [];

function checar(nome, passou, detalhe = '') {
  console.log(`${passou ? '  ok ' : ' FALHA'} ${nome}`);
  if (passou) ok += 1;
  else {
    bad += 1;
    falhas.push(detalhe ? `${nome} — ${detalhe}` : nome);
  }
}

function bloco(t) {
  console.log('');
  console.log(t);
}

const ler = (caminho) => readFileSync(new URL(`../${caminho}`, import.meta.url), 'utf8');

/** Os comentários não contam: eles explicam o que NÃO se faz e citam o código. */
function semComentarios(fonte) {
  return fonte
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

// ── (a) A reserva do aviso de cookies ──────────────────────────────────────

/** Reserva feita com `padding-bottom` no body: não rola em página longa. */
export function reservaNoBody(fonte) {
  return /document\.body\.style\.paddingBottom\s*=/.test(semComentarios(fonte));
}

/** O `#root::after` que vira a variável em rolagem. */
export function blocoDeReservaNoRoot(css) {
  const m = semComentarios(css).match(/#root::after\s*\{([^}]*)\}/);
  if (!m) return null;
  const corpo = m[1];
  return {
    ehBloco: /display:\s*block/.test(corpo),
    temConteudo: /content:\s*''|content:\s*""/.test(corpo),
    leVariavel: /height:\s*var\(--reserva-do-aviso\s*,\s*0px\)/.test(corpo),
  };
}

bloco('0. Sondas: o detector reprova o que deve e deixa passar o que deve');
checar(
  'padding no body é reprovado',
  reservaNoBody("document.body.style.paddingBottom = `${el.offsetHeight + 12}px`;"),
);
checar(
  'padding no body só citado em comentário não é reprovado',
  !reservaNoBody('// era document.body.style.paddingBottom = x\nraiz.style.setProperty("--reserva-do-aviso", y);'),
);
checar(
  'a variável no `#root::after` é reconhecida',
  blocoDeReservaNoRoot("#root::after { content: ''; display: block; height: var(--reserva-do-aviso, 0px); }")
    ?.leVariavel === true,
);
checar('sem o bloco, não há reserva', blocoDeReservaNoRoot('#root { margin: 0 }') === null);

bloco('1. O aviso de cookies reserva o espaço dele de um jeito que ROLA');
const cookies = ler('src/components/legal/CookieBanner.jsx');
checar('o aviso NÃO usa padding-bottom no body', !reservaNoBody(cookies));
checar(
  'o aviso grava a altura em --reserva-do-aviso',
  /style\.setProperty\(\s*'--reserva-do-aviso'/.test(cookies),
);
checar(
  'o aviso solta a variável ao fechar (removeProperty)',
  /style\.removeProperty\(\s*'--reserva-do-aviso'/.test(cookies),
);
checar('o aviso acompanha a mudança de altura (ResizeObserver)', /new ResizeObserver\(ajustar\)/.test(cookies));
const css = ler('src/index.css');
const raiz = blocoDeReservaNoRoot(css);
checar('index.css tem o `#root::after` da reserva', raiz !== null);
checar('o `#root::after` é um bloco em fluxo com conteúdo', !!raiz && raiz.ehBloco && raiz.temConteudo);
checar('o `#root::after` tem a altura da variável (0px sem aviso)', !!raiz && raiz.leVariavel);
checar(
  'o `#root` continua `h-full` com `body` — a razão de o padding do pai não valer',
  /body,\s*#root\s*\{\s*@apply h-full;/.test(css.replace(/\s+/g, ' ').replace(/\{ @apply/g, '{ @apply')) ||
    /html,\s*body,\s*#root\s*\{\s*@apply h-full;/.test(css.replace(/\s+/g, ' ')),
);

// ── (b) O aceite legal ─────────────────────────────────────────────────────

/** Tudo o que está dentro de cada `<label …>…</label>`. */
export function labelsDe(fonte) {
  return [...fonte.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/g)].map((m) => ({
    abertura: m[0].match(/<label\b[^>]*>/)[0],
    interior: m[1],
  }));
}

/** Link (`<Link` ou `<a`) dentro de um label: o toque nele não marca a caixa. */
export function linkDentroDoLabel(fonte) {
  return labelsDe(fonte).some((l) => /<(Link|a)\b/.test(l.interior));
}

/** `min-h-N` do Tailwind em px (escala de 4px; só os degraus que o app usa). */
export function alturaMinimaPx(classes) {
  const m = classes.match(/(?:^|\s)min-h-(\d+)(?:\s|$|")/);
  return m ? Number(m[1]) * 4 : 0;
}

bloco('2. Sondas do aceite');
checar(
  'link dentro do label é achado e reprovado',
  linkDentroDoLabel('<label><input type="checkbox"/>Li <Link to="/termos" target="_blank">Termos</Link></label>'),
);
checar(
  'link fora do label passa',
  !linkDentroDoLabel('<label htmlFor="a"><input id="a"/>Li</label><Link to="/termos" target="_blank">Ler</Link>'),
);
checar('min-h-12 vale 48px', alturaMinimaPx('flex min-h-12 gap-3') === 48);
checar('sem min-h não há altura mínima', alturaMinimaPx('flex gap-3') === 0);

bloco('3. A linha do aceite: a frase marca, o link lê, os dois com 44px ou mais');
const aceite = ler('src/components/legal/TermsAcceptanceGate.jsx');
const codigo = semComentarios(aceite);
const labels = labelsDe(codigo);
checar('há exatamente um <label> na linha do aceite (o do CheckRow)', labels.length === 1, `achei ${labels.length}`);
checar('nenhum link (<Link>/<a>) mora dentro de um label', !linkDentroDoLabel(codigo));
const abertura = labels[0]?.abertura ?? '';
checar('o label aponta para a caixa (htmlFor={id})', /htmlFor=\{id\}/.test(abertura));
checar('a caixa tem o id que o label aponta (id={id})', /<input\b[^>]*\bid=\{id\}/.test(codigo));
checar(
  'a caixa continua DENTRO do label (o toque nela também marca)',
  /<input\b/.test(labels[0]?.interior ?? ''),
);
checar('o id vem do useId (um por linha, sem repetir)', /const id = useId\(\)/.test(codigo));
checar(
  `o label tem pelo menos 44px de altura (tem ${alturaMinimaPx(abertura)}px)`,
  alturaMinimaPx(abertura) >= 44,
);

const links = [...codigo.matchAll(/<Link\b[\s\S]*?<\/Link>/g)].map((m) => m[0]);
checar('há um <Link> de leitura por linha, fora do label', links.length === 1, `achei ${links.length}`);
const link = links[0] ?? '';
checar('o link abre em outra aba (target="_blank")', /target="_blank"/.test(link));
checar('o link tem rel="noopener noreferrer"', /rel="noopener noreferrer"/.test(link));
checar(
  `o link tem pelo menos 44px de altura (tem ${alturaMinimaPx(link)}px)`,
  alturaMinimaPx(link) >= 44,
);
checar('o link tem pelo menos 44px de largura (min-w-11 ou mais)', /min-w-(11|12|14|16)\b/.test(link));
checar('o link se identifica pelo texto "Ler"', />\s*Ler\s*</.test(link) || /\n\s*Ler\s*\n/.test(link));
checar(
  'o link diz para onde vai a quem usa leitor de tela (sr-only)',
  /sr-only[^>]*>[^<]*abre em outra aba/.test(link),
);
checar(
  'o destino é a rota certa: /termos e /privacidade (via leitura.to)',
  /to=\{leitura\.to\}/.test(link) && /to: '\/termos'/.test(codigo) && /to: '\/privacidade'/.test(codigo),
);

bloco('4. O texto jurídico não mudou');
const texto = codigo.replace(/<[^>]+>/g, ' ').replace(/\{' '\}/g, ' ').replace(/\s+/g, ' ');
for (const trecho of ['Li e aceito os', 'Termos de Uso', 'Li e aceito a', 'Política de Privacidade']) {
  checar(`continua dizendo "${trecho}"`, texto.includes(trecho));
}
checar(
  'a pergunta do portão continua a mesma',
  aceite.includes('Pra usar o app, leia e aceite os Termos de Uso e a Política de Privacidade.'),
);
checar('"Aceitar e continuar" continua exigindo as duas caixas', /canSubmit = acceptedTerms && acceptedPrivacy/.test(codigo));

console.log('');
console.log(`${ok} ok, ${bad} falhas`);
if (bad) {
  for (const f of falhas) console.log(` - ${f}`);
  process.exit(1);
}
