/**
 * O TOUR GUIADO — curto, com a tela à vista, e sem toque que custe algo.
 *
 * ── O TOUR DO MOTORISTA SÃO QUATRO PARADAS (02/10/2026)
 * Eram treze, citando frases da landing, e metade apontava para botões que
 * quem acabou de criar a conta não tem. O dono pediu simples, curto e
 * memorável: quatro balões, título curto e uma frase, a tela inteira à vista
 * e o botão da vez pulsando. O bloco 1 trava o tamanho e o tom; o bloco 4
 * trava que a tela não volta a escurecer.
 *
 * A COSTURA COM A LANDING SAIU junto com a `cita`. O que ficou dela é a
 * lição: quem confere frase confere a CONTAGEM antes — lista vazia aprova
 * qualquer "toda frase da lista…".
 *
 * ── ⚠️ A SEGUNDA INVARIANTE É A QUE PROTEGE GENTE, NÃO TEXTO
 * `interact: true` faz o tour esperar o toque no elemento DE VERDADE. Quatro
 * botões deste app fazem coisas no mundo:
 *
 *   `start-route`       liga o GPS, publica a perua pra todas as famílias e
 *                       ESCREVE `trialInicio`
 *   `avancar-status`    muda o estado da criança e avisa a família
 *   `buzinar`           faz o celular de um responsável tocar
 *   `lista-pagamentos`  dá baixa em dinheiro que talvez não tenha entrado
 *
 * Nenhum deles pode ser interativo — e o tour do motorista não tem passo
 * interativo nenhum: ele avança só por "Próximo".
 *
 * ── SONDA POSITIVA (bloco 6)
 * Os conferidores rodam também contra um roteiro FALSO, feito pra violar as
 * regras. Sem isso, um conferidor que não confere nada passa.
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
      prefer: campo(pedaco, 'prefer'),
      cita: campo(pedaco, 'cita'),
      title: campo(pedaco, 'title'),
      body: campo(pedaco, 'body'),
      interact: /interact:\s*true/.test(pedaco),
    }));
}

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
bloco('1 · O DO MOTORISTA É CURTO');
/* A CONTAGEM VEM ANTES DE QUALQUER FRASE. Um leitor quebrado devolve lista
   vazia, e "todo passo é curto" é VERDADE numa lista vazia. Já aconteceu
   aqui, com CRLF. */
checar('o tour do motorista tem quatro paradas', 4, TIO.length);
checar(
  'nenhum passo cita a landing (a tira saiu)',
  [],
  TIO.filter((p) => p.cita).map((p) => p.title)
);
/* Uma frase por balão. 60 caracteres cabem em duas linhas do balão num
   celular estreito — mais que isso é parágrafo, e parágrafo ninguém lê de
   pé no ponto. */
TIO.forEach((p, i) => {
  checar(`passo ${i + 1} tem título`, true, Boolean(p.title));
  checar(
    `passo ${i + 1} (${p.title}) diz uma frase só`,
    true,
    Boolean(p.body) && p.body.length <= 60
  );
});
checar('o balão não desenha mais citação', false, FONTE_BALAO.includes('step.cita'));

/* O DO RESPONSÁVEL SEGUE O MESMO MOLDE (02/10/2026) — o dono pediu os dois
   primeiros acessos parecidos: quatro paradas, uma frase, e só "Próximo". */
checar('o tour do responsável tem quatro paradas', 4, PAI.length);
PAI.forEach((p, i) => {
  checar(
    `responsável, passo ${i + 1} (${p.title}) diz uma frase só`,
    true,
    Boolean(p.body) && p.body.length <= 60
  );
});
checar(
  'o tour do responsável também avança só por Próximo',
  [],
  PAI.filter((p) => p.interact).map((p) => p.title)
);

// ═══════════════════════════════════════════════════════════════════════
bloco('2 · TODA ÂNCORA APONTA PRA UM ELEMENTO QUE EXISTE');
// Já aconteceu duas vezes neste projeto: a tela mudou, a âncora ficou órfã, e
// o passo virou um balão no rodapé descrevendo um elemento que ninguém vê.

[...TIO, ...PAI].forEach((p) => {
  for (const a of [p.anchor, p.prefer]) {
    if (!a) continue;
    checar(`data-tour="${a}" existe em src/`, true, ANCORAS.has(a));
  }
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

checar('o tour do responsável não pede toque com efeito', [], toquesProibidos(PAI));
/* O do motorista é mais estrito: ele não pede toque NENHUM. O app fica
   travado por baixo e só "Próximo" anda — é o que deixa o tour mostrar
   "Cadastrar a primeira criança" sem que um toque leve a pessoa embora no passo 1. */
checar(
  'o tour do motorista avança só por Próximo',
  [],
  TIO.filter((p) => p.interact).map((p) => p.title)
);
checar(
  'e o app por baixo não recebe toque fora do passo interativo',
  true,
  /!step\.interact && <div className="absolute inset-0 pointer-events-auto"/.test(FONTE_BALAO)
);

// ═══════════════════════════════════════════════════════════════════════
bloco('4 · A TELA FICA À VISTA');
/* Era uma sombra de 62% em volta do recorte. O dono pediu a tela inteira
   visível e só o botão pulsando. Quem tentar devolver o escurecido esbarra
   aqui — o idioma dele é a sombra gigante. */
checar('nenhuma sombra gigante escurece a tela', false, /9999px/.test(FONTE_BALAO));
checar('nem fundo escuro cobrindo tudo', false, /background:\s*DIM/.test(FONTE_BALAO));
checar('o anel pulsa', true, FONTE_BALAO.includes('animate-tour-pulso'));
checar('a perua anda na estradinha', true, FONTE_BALAO.includes('paradaEm(stepIndex)'));

// ═══════════════════════════════════════════════════════════════════════
bloco('5 · CADA PASSO TEM DESTINO');

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
bloco('6 · SONDA POSITIVA — os conferidores reprovam o que deve reprovar');

const ROTEIRO_FALSO = `export const ADMIN_TOUR = [
  {
    path: '/lugar-que-nao-existe',
    anchor: 'start-route',
    prefer: 'ancora-que-nao-existe',
    interact: true,
    title: 'passo ruim',
    body: 'Um parágrafo inteiro que explica demais e que ninguém vai ler de pé no ponto.',
  },
];`;
const FALSAS = paradasDe(ROTEIRO_FALSO, 'ADMIN_TOUR');

checar('o leitor entende o roteiro falso', 1, FALSAS.length);
checar('e enxerga o interact dele', true, FALSAS[0].interact);
checar('o toque proibido é pego', ['start-route'], toquesProibidos(FALSAS));
checar('a âncora preferida órfã é pega', false, ANCORAS.has(FALSAS[0].prefer));
checar('o texto longo é pego', true, FALSAS[0].body.length > 60);
checar(
  'o destino inventado é pego',
  false,
  APP.includes(`"${FALSAS[0].path}"`)
);
checar(
  'o escurecido antigo seria pego',
  true,
  /9999px/.test('boxShadow: `0 0 0 3px #fff, 0 0 0 9999px ${DIM}`')
);

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
