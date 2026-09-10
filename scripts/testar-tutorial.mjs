/**
 * O TOUR GUIADO — as frases que ele cita e os toques que ele pede.
 *
 * ── POR QUE ESTE ARQUIVO EXISTE
 * O tour do motorista foi reescrito pra falar com as MESMAS FRASES da landing.
 * O motorista chega tendo lido *"a rota do dia pronta, na ordem dos horários"*
 * e *"sem caderno, sem planilha e sem cobrar de boca"*; cada passo agora cita
 * a frase que ele fecha e mostra onde ela virou tela.
 *
 * Isso cria uma dependência entre dois arquivos que ninguém edita junto: a
 * landing é HTML estático, sem build, e o tour é JSX. Trocar uma linha do
 * marketing faz o app citar algo que a pessoa nunca leu — e ela não tem como
 * perceber que a citação envelheceu. O bloco 1 é essa costura.
 *
 * ── ⚠️ E A SEGUNDA INVARIANTE É A QUE PROTEGE GENTE, NÃO TEXTO
 * `interact: true` faz o tour esperar o toque no elemento DE VERDADE — é o
 * que ensina o gesto em vez de descrever o gesto. Só que quatro botões deste
 * app fazem coisas no mundo:
 *
 *   `start-route`       liga o GPS, publica a perua pra todas as famílias e
 *                       ESCREVE `trialInicio`: o toque do tutorial gastaria
 *                       o primeiro dia dos três meses de teste
 *   `avancar-status`    muda o estado da criança e avisa a família
 *   `buzinar`           faz o celular de um responsável tocar
 *   `lista-pagamentos`  dá baixa em dinheiro que talvez não tenha entrado
 *
 * Nenhum deles pode ser interativo. O erro é fácil de cometer e invisível na
 * revisão — `interact: true` é uma linha, e a consequência aparece no
 * primeiro acesso de um desconhecido, não no teste manual de quem escreveu.
 *
 * ── SONDA POSITIVA (bloco 5)
 * Os conferidores rodam também contra um roteiro FALSO, feito pra violar as
 * duas regras. Sem isso, um conferidor que não confere nada passa: foi assim
 * que um teste deste projeto já aprovou o comentário em vez do código.
 *
 * COMO RODAR
 *   node scripts/testar-tutorial.mjs      (ou: npm run testar:tutorial)
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';

let ok = 0;
let bad = 0;
const falhas = [];

function checar(nome, esperado, obtido) {
  const passou = JSON.stringify(esperado) === JSON.stringify(obtido);
  console.log(`${passou ? '  ok ' : ' FALHA'} ${nome}`);
  if (passou) ok += 1;
  else {
    bad += 1;
    falhas.push(
      `${nome} — esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`
    );
  }
}
function bloco(t) {
  console.log(`\n\x1b[1m${t}\x1b[0m`);
}

const raiz = new URL('../', import.meta.url);
/* O RETORNO DE CARRO SAI NA LEITURA. O repositório recebe sessões de
   Windows e de Linux, e o leitor de passos parte a lista pela quebra de
   linha seguida de dois espaços e uma chave — num arquivo CRLF ele achava
   ZERO passos e o teste PASSAVA VAZIO, que é a pior falha possível num
   teste. Foi assim que este arquivo reprovou na primeira execução, e é por
   isso que o bloco 1 confere a CONTAGEM antes de conferir qualquer frase. */
const ler = (rel) =>
  readFileSync(new URL(rel, raiz), 'utf8').split('\r').join('');

// ─────────────────────────────────────────────────────────────────────────
// LEITURA POR TEXTO, e não por import.
//
// `interactiveSteps.js` importa ícones do lucide-react, que é React. Um teste
// que carrega React pra ler uma lista de strings amarra a bateria ao pacote
// de interface — e a bateria já morreu inteira uma vez por causa de um
// require que não existia no CI. O mesmo caminho de `testar-fundo`: refazer a
// conta a partir dos arquivos.
// ─────────────────────────────────────────────────────────────────────────
const FONTE_PASSOS = ler('src/components/tutorial/interactiveSteps.js');
const FONTE_BALAO = ler('src/components/tutorial/InteractiveTour.jsx');
const APP = ler('src/App.jsx');
const LANDING = ler('landing/index.html');

/** Um campo de string do objeto do passo, aceitando quebra de linha depois do `:`. */
function campo(pedaco, nome) {
  const m = pedaco.match(new RegExp(`${nome}:\\s*\\n?\\s*'((?:[^'\\\\]|\\\\.)*)'`));
  return m ? m[1].replace(/\\'/g, "'") : null;
}

function paradasDe(fonte, nomeDoArray) {
  const abre = `export const ${nomeDoArray} = [`;
  if (!fonte.includes(abre)) return [];
  const corpo = fonte.split(abre)[1].split('\n];')[0];
  return corpo
    .split(/\n  \{\n/)
    .slice(1)
    .map((pedaco) => ({
      path: campo(pedaco, 'path'),
      anchor: campo(pedaco, 'anchor'),
      cita: campo(pedaco, 'cita'),
      title: campo(pedaco, 'title'),
      body: campo(pedaco, 'body'),
      interact: /interact:\s*true/.test(pedaco),
    }));
}

/**
 * O texto VISÍVEL da landing, sem tags.
 *
 * Tag some virando ESPAÇO, não vazio: `<b>não aparece</b> pro responsável`
 * colado daria "aparecepro" e a citação certa falharia. Depois o espaço é
 * colapsado, o que também torna a comparação imune a onde a linha quebra no
 * HTML — e ela quebra no meio de frase em vários lugares.
 */
function textoDaLanding(html) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&ldquo;/g, '“')
    .replace(/&rdquo;/g, '”')
    .replace(/&middot;/g, '·')
    .replace(/&hellip;/g, '…')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}
const TEXTO_LANDING = textoDaLanding(LANDING);
const naLanding = (frase) =>
  TEXTO_LANDING.includes(frase.replace(/\s+/g, ' ').toLowerCase());

/**
 * Toda âncora que o app oferece — e ela é escrita de TRÊS jeitos.
 *
 * `data-tour="hero"` é o caso simples, no próprio elemento. Mas duas peças
 * recebem a âncora por PROP, porque quem a escreve é uma lista: as abas
 * (`items: [{ tour: 'nav-finance' }]` no layout) e a linha da folha Meu
 * transporte (`<Linha tour="rota-padrao">`). Procurar só a forma literal
 * dava âncora órfã em duas das três interativas — foi o que este teste
 * reprovou na segunda execução.
 *
 * Aceitar a prop só é honesto se ela CHEGAR no DOM, e é isso que
 * `repassadores` confere logo abaixo.
 */
function ancorasDoApp() {
  const achadas = new Set();
  const varrer = (dir) => {
    for (const nome of readdirSync(new URL(dir, raiz))) {
      const rel = `${dir}/${nome}`;
      if (statSync(new URL(rel, raiz)).isDirectory()) varrer(rel);
      else if (/\.(jsx|js)$/.test(nome)) {
        const fonte = readFileSync(new URL(rel, raiz), 'utf8');
        for (const m of fonte.matchAll(/data-tour="([a-z-]+)"/g)) achadas.add(m[1]);
        for (const m of fonte.matchAll(/\btour="([a-z-]+)"/g)) achadas.add(m[1]);
        for (const m of fonte.matchAll(/\btour: '([a-z-]+)'/g)) achadas.add(m[1]);
      }
    }
  };
  varrer('src');
  return achadas;
}
const ANCORAS = ancorasDoApp();

/** Os botões que fazem coisa no mundo: iluminar sim, pedir o toque nunca. */
const PROIBIDAS_DE_TOCAR = [
  'start-route',
  'avancar-status',
  'buzinar',
  'lista-pagamentos',
];

const TIO = paradasDe(FONTE_PASSOS, 'ADMIN_TOUR');
const PAI = paradasDe(FONTE_PASSOS, 'PARENT_TOUR');

// ═══════════════════════════════════════════════════════════════════════
bloco('1 · AS FRASES SÃO AS DO SITE');
// A landing é o primeiro contato. Se o tour reescreve a promessa com outras
// palavras, o app parece um segundo produto — e a promessa, propaganda.

/* O NÚMERO É CONFERIDO ANTES DE QUALQUER FRASE. Um leitor quebrado devolve
   lista vazia, e "toda frase da lista existe na landing" é VERDADE numa lista
   vazia — o teste passaria sem conferir nada. Já aconteceu aqui, na primeira
   execução deste arquivo (CRLF). São 13: a saudação abre, e as outras doze
   fecham uma promessa cada. */
checar('o tour do motorista tem as treze paradas', 13, TIO.length);
checar('todo passo do motorista cita a landing', 0, TIO.filter((p) => !p.cita).length);

TIO.forEach((p, i) => {
  if (!p.cita) return;
  checar(
    `passo ${i + 1} (${p.title}) cita frase que existe na landing`,
    true,
    naLanding(p.cita)
  );
});

// A tira só aparece se o balão souber desenhá-la, e o passo sem `cita` (o
// tour do responsável, hoje) não pode ganhar uma tira vazia.
checar('o balão desenha a citação', true, FONTE_BALAO.includes('step.cita'));
checar(
  'e só quando ela existe',
  true,
  /\{step\.cita && \(/.test(FONTE_BALAO)
);
checar(
  'a tira diz de onde a frase veio',
  true,
  FONTE_BALAO.includes('no site, você leu')
);

// ═══════════════════════════════════════════════════════════════════════
bloco('2 · TODA ÂNCORA APONTA PRA UM ELEMENTO QUE EXISTE');
// Já aconteceu duas vezes neste projeto: a tela mudou, a âncora ficou órfã, e
// o passo virou um balão no rodapé descrevendo um elemento que ninguém vê.

[...TIO, ...PAI].forEach((p) => {
  if (!p.anchor) return;
  checar(`data-tour="${p.anchor}" existe em src/`, true, ANCORAS.has(p.anchor));
});

checar(
  'nenhum passo interativo fica sem âncora',
  [],
  [...TIO, ...PAI].filter((p) => p.interact && !p.anchor).map((p) => p.title)
);

// ═══════════════════════════════════════════════════════════════════════
bloco('3 · O TOQUE QUE O TOUR PEDE NÃO CUSTA NADA A NINGUÉM');

function toquesProibidos(paradas) {
  return paradas
    .filter((p) => p.interact && PROIBIDAS_DE_TOCAR.includes(p.anchor))
    .map((p) => p.anchor);
}

checar('o tour do motorista não pede nenhum toque com efeito', [], toquesProibidos(TIO));
checar('nem o tour do responsável', [], toquesProibidos(PAI));

// O outro lado da mesma regra: os quatro continuam ILUMINADOS. Tirar o
// destaque "pra não dar ideia" devolveria o tour ao passo que descreve um
// botão sem mostrar qual é — o problema que o holofote resolve.
PROIBIDAS_DE_TOCAR.forEach((a) => {
  checar(`"${a}" continua sendo iluminado por algum passo`, true,
    [...TIO, ...PAI].some((p) => p.anchor === a) || !ANCORAS.has(a));
});

// A pedagogia inteira depende de haver toque em algum lugar: o tour antigo
// tinha UM passo interativo em nove, e oito de leia-e-toque-em-Próximo.
checar(
  'o motorista toca em pelo menos três lugares',
  true,
  TIO.filter((p) => p.interact).length >= 3
);

// ═══════════════════════════════════════════════════════════════════════
bloco('4 · CADA PASSO TEM DESTINO');

[...TIO, ...PAI].forEach((p, i) => {
  checar(`passo ${i + 1} declara um path`, true, Boolean(p.path));
});

const destinos = [...new Set([...TIO, ...PAI].map((p) => p.path))].filter(Boolean);
destinos.forEach((d) => {
  // A rota-mãe ('/tio', '/pai') aparece como `path="/tio"`; as filhas
  // aparecem como o trecho depois da barra ('children', 'finance').
  const cauda = d.split('/').slice(2).join('/');
  const declarada = APP.includes(`"${d}"`) || (cauda && APP.includes(`"${cauda}"`));
  checar(`${d} é rota declarada no App.jsx`, true, declarada);
});

// ═══════════════════════════════════════════════════════════════════════
bloco('5 · SONDA POSITIVA — os conferidores reprovam o que deve reprovar');
// Sem este bloco, um conferidor quebrado passa a bateria em silêncio.

const ROTEIRO_FALSO = `export const ADMIN_TOUR = [
  {
    path: '/lugar-que-nao-existe',
    anchor: 'start-route',
    interact: true,
    cita: 'esta frase nunca foi escrita na landing',
    title: 'passo ruim',
    body: 'y',
  },
];`;
const FALSAS = paradasDe(ROTEIRO_FALSO, 'ADMIN_TOUR');

checar('o leitor entende o roteiro falso', 1, FALSAS.length);
checar('e enxerga o interact dele', true, FALSAS[0].interact);
checar('a citação inventada é reprovada', false, naLanding(FALSAS[0].cita));
checar('o toque proibido é pego', ['start-route'], toquesProibidos(FALSAS));
checar(
  'o destino inventado é pego',
  false,
  APP.includes(`"${FALSAS[0].path}"`)
);
// E o contrário: uma frase que ESTÁ na landing tem que passar, senão o
// conferidor do bloco 1 estaria só reprovando tudo.
checar('e uma frase real da landing passa', true, naLanding('A rota roda e todo mundo vê'));

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
