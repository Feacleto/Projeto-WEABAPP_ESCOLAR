/**
 * O FUNDO DO LOGIN NÃO PROMETE UMA TELA QUE NÃO EXISTE.
 *
 * ── POR QUE ESTE ARQUIVO EXISTE
 * O fundo da coluna direita do login mostra o app funcionando — nove cartões
 * recriados, com dados fictícios. E como o login é a tela mais acessada do
 * produto, ele é a peça de marketing mais vista que existe aqui.
 *
 * ⚠️ **FUNDO QUE MOSTRA A INTERFACE ERRADA É PIOR QUE FUNDO ABSTRATO.** Ele
 * promete uma tela, e quem cobra a promessa é quem acabou de se cadastrar. A
 * lista do que não pode aparecer (bloco 2) não é estilo: cada item é um número
 * ou rótulo que EXISTIU no app e SAIU por decisão registrada — o "a receber"
 * que era previsão, a contagem de inadimplentes que virou nome e valor, o ETA
 * que era linha reta dividida por 18 km/h.
 *
 * Sem este arquivo, a defesa contra qualquer um deles voltar num cartão novo
 * seria alguém lembrar de reler um comentário.
 *
 * ── E O BLOCO 4 É O QUE MAIS VAI PEGAR ALGUÉM
 * A regra número um do fundo é nunca ficar atrás do formulário, e quem decide
 * isso é o eixo X. O bloco 4 REFAZ A CONTA a partir dos arquivos reais —
 * largura do cartão, padding, fração da coluna, breakpoint. Alguém que alargue
 * o formulário em 60px não vê nada de errado na própria alteração: o defeito
 * aparece do outro lado da tela, num cartão de fundo cortado. Aqui ele falha
 * na hora, com a conta na mensagem.
 *
 * COMO RODAR
 *   node scripts/testar-fundo.mjs      (ou: npm run testar:fundo)
 */

import { readFileSync, readdirSync } from 'node:fs';
import { TRIOS, SLOTS, ASSUNTOS, BLOCOS, textosDoFundo } from '../src/marca/fundoDoLogin.js';

let ok = 0;
let bad = 0;
const falhas = [];

function checar(nome, esperado, obtido) {
  const passou = JSON.stringify(esperado) === JSON.stringify(obtido);
  console.log(`${passou ? '  ok ' : ' FALHA'} ${nome}`);
  if (passou) ok += 1;
  else {
    bad += 1;
    falhas.push(`${nome} — esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`);
  }
}
function bloco(t) {
  console.log(`\n\x1b[1m${t}\x1b[0m`);
}

const ler = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

const fonteLogin = ler('src/pages/Login.jsx');
const fonteFirst = ler('src/pages/FirstAccess.jsx');
const fonteFundo = ler('src/components/auth/FundoDoLogin.jsx');
const fonteRota = ler('src/components/route/OperacaoDaRota.jsx');
const fonteStatus = ler('src/services/routeStatusService.js');
const fontePresenca = ler('src/dominio/rota/routePresence.js');

const textos = textosDoFundo();
const juntos = textos.join(' | ').toLowerCase();

// ─────────────────────────────────────────────────────────────────────────
bloco('1. Os tres trios estao inteiros');

checar('ha um trio por assunto', ASSUNTOS.length, Object.keys(TRIOS).length);
for (const a of ASSUNTOS) {
  checar(`o trio "${a}" tem tres cartoes`, 3, (TRIOS[a] || []).length);
  const slots = (TRIOS[a] || []).map((c) => c.slot).sort();
  checar(`e ocupa os slots 1, 2 e 3 sem repetir`, [1, 2, 3], slots);
}
checar('ha nove cartoes no total', 9, Object.values(TRIOS).flat().length);
checar('e o teste tem texto para medir', true, textos.length > 20);

// Bloco com nome errado não quebra nada: o `switch` cai no `default` e a peça
// simplesmente não aparece. É a falha mais silenciosa possível aqui.
const usados = [...new Set(Object.values(TRIOS).flat().flatMap((c) => c.blocos.map((b) => b.b)))];
checar('todo bloco usado existe no renderizador', [],
  usados.filter((u) => !BLOCOS.includes(u)));
checar('e o renderizador tem um case para cada um', [],
  usados.filter((u) => !fonteFundo.includes(`case '${u}'`)));

// ─────────────────────────────────────────────────────────────────────────
bloco('2. Nada que o produto tirou fora volta pelo fundo');

// Cada entrada: [o que buscar, por que saiu do produto]
const PROIBIDO = [
  ['a receber', 'previsao no dia 3 do mes e quase o faturamento inteiro'],
  ['pra receber', 'mesma previsao, outro rotulo'],
  ['a receber r$', 'o heroi do TioFinance tem UM numero: Recebido'],
  ['abertas', 'quem deve virou bloco com NOME e VALOR, nao contagem'],
  ['atrasad', 'idem: "1 atrasado" pode ser R$ 100 ou R$ 800 preso'],
  ['chega em', 'ETA arrancado do produto — era linha reta / 18 km/h'],
  ['minutos', 'nenhum ETA em minutos; so distancia MEDIDA'],
  ['na perua', 'vocabulario que nunca existiu no app'],
  ['motoristas', 'a marca combinou nao publicar numero de cliente'],
  ['âmbar', 'warning e AVISO no app; como enfeite queima o sinal'],
];
for (const [termo, porque] of PROIBIDO) {
  checar(`nao ha "${termo}" (${porque})`, false, juntos.includes(termo));
}

// A SONDA POSITIVA: sem ela este bloco fica verde no dia em que
// `textosDoFundo()` parar de achatar a estrutura e devolver lista vazia.
// Verde por nao ter medido nada e o defeito que este arquivo combate.
checar('o detector detecta (sonda positiva)', true,
  [...textos, 'A receber R$ 4.200'].join(' | ').toLowerCase().includes('a receber'));

// Foto e nome completo de crianca sao dado sensivel (LGPD art. 5, II) — e e
// justamente o que torna estes cartoes possiveis: eles sao RECRIADOS.
checar('o fundo nao le foto de crianca', false,
  fonteFundo.includes('photoURL') || fonteFundo.includes('Avatar'));
checar('nem usa cor de aviso como enfeite', false,
  /\b(warning|amber|secondary)\b/.test(fonteFundo));

// ─────────────────────────────────────────────────────────────────────────
bloco('3. As frases copiadas do app continuam existindo na fonte');

// ⚠️ Este bloco e o que impede o fundo de citar um app que nao fala mais
// assim. As frases foram COPIADAS da fonte, nao parafraseadas; se a fonte
// mudar e o fundo nao, o cartao passa a mostrar vocabulario aposentado.
const CITACOES = [
  ['Trazendo pra casa', fonteRota, 'OperacaoDaRota'],
  ['já foram entregues', fonteRota, 'OperacaoDaRota (o verbo da volta)'],
  ['Buzinar faz o celular do responsável tocar', fonteRota, 'OperacaoDaRota'],
  ['ENTREGUEI', fonteStatus, 'routeStatusService'],
  ['Avisamos quando estiver perto.', fontePresenca, 'routePresence'],
];
for (const [frase, fonte, onde] of CITACOES) {
  checar(`"${frase}" ainda esta em ${onde}`, true, fonte.includes(frase));
  checar(`e o fundo a imprime`, true, textos.some((t) => t.includes(frase)));
}

// Estas duas sao MONTADAS por template na fonte, entao o teste mede os
// fragmentos literais em volta do valor.
checar('o molde "A perua está a … daqui" ainda existe', true,
  fontePresenca.includes('A perua está a ') && fontePresenca.includes(' daqui'));
checar('e o cartao usa esse molde', true,
  textos.some((t) => t.startsWith('A perua está a ') && t.endsWith(' daqui')));
checar('o molde de frescor ainda diz "segundos"', true,
  fontePresenca.includes('segundos'));
checar('e o cartao diz "atualizado há"', true,
  textos.some((t) => t.startsWith('atualizado há ')));

// A distancia e MEDIDA, nunca convertida em tempo. Um numero com "km" e o
// unico formato aceito nessa frase.
checar('a frase da perua traz distancia, nao tempo', true,
  textos.some((t) => /A perua está a [\d,]+ km daqui/.test(t)));

// ─────────────────────────────────────────────────────────────────────────
bloco('4. O fundo nunca fica atras do formulario (a conta refeita)');

const num = (fonte, re, nome) => {
  const m = fonte.match(re);
  if (!m) throw new Error(`nao achei ${nome}`);
  return Number(m[1]);
};

// A largura do cartao de fundo sai do proprio componente, para nao existir
// uma segunda copia do numero aqui.
const larguraCartao = num(fonteFundo, /absolute w-\[(\d+)px\]/, 'a largura do cartao de fundo');
checar('o cartao de fundo tem 244px', 244, larguraCartao);

// O alcance horizontal e o slot que avanca mais — hoje o do meio, que e
// desalinhado de propósito (alinhamento perfeito le como coluna de conteudo).
const alcance = Math.max(...Object.values(SLOTS).map((s) => s.left)) + larguraCartao;
checar('o slot do meio e o que avanca mais', 40 + 244, alcance);

const TELAS = [
  {
    nome: 'login',
    fonte: fonteLogin,
    fracao: num(fonteLogin, /minmax\(0,(\d+)fr\)\]/, 'a fracao da coluna do login') / 100,
    cartao: num(fonteLogin, /z-10 w-full max-w-\[(\d+)px\]/, 'o cartao do login'),
    gate: num(fonteLogin, /min-\[(\d+)px\]:justify-end/, 'o breakpoint do login'),
    padding: num(fonteLogin, /min-\[\d+px\]:pr-\[(\d+)px\]/, 'o padding do login'),
  },
  {
    nome: 'first-access',
    fonte: fonteFirst,
    fracao: num(fonteFirst, /minmax\(0,(\d+)fr\)\]/, 'a fracao da coluna do first-access') / 100,
    cartao: num(fonteFirst, /mx-auto flex w-full max-w-\[(\d+)px\]/, 'o cartao do first-access'),
    gate: num(fonteFirst, /min-\[(\d+)px\]:ml-auto/, 'o breakpoint do first-access'),
    padding: num(fonteFirst, /min-\[\d+px\]:pr-\[(\d+)px\]/, 'o padding do first-access'),
  },
];

for (const t of TELAS) {
  // A esquerda do formulario, na largura exata em que o fundo liga.
  const bordaDoForm = t.fracao * t.gate - t.padding - t.cartao;
  const folga = Math.round((bordaDoForm - alcance) * 10) / 10;
  console.log(
    `       ${t.nome}: coluna ${Math.round(t.fracao * 100)}% · cartao ${t.cartao}px · ` +
    `liga em ${t.gate}px → folga de ${folga}px`
  );
  checar(`${t.nome}: o fundo NAO encosta no formulario no proprio breakpoint`,
    true, folga >= 4);

  // E o fundo tem que ligar no MESMO numero em que o formulario se move: se
  // o cartao vai pra direita e o fundo nao aparece, sobra uma faixa vazia de
  // 300px que nao le como respiro — le como coisa que nao carregou.
  // E o fundo tem que ligar no MESMO numero em que o formulario se move.
  // Entre um e outro existiria a faixa vazia de 300px que nao le como
  // respiro, ou pior: o fundo visivel com o cartao ainda centrado.
  const declarado = num(t.fonte, /desde=\{(\d+)\}/, `o desde= do ${t.nome}`);
  checar(`${t.nome}: o desde= bate com o breakpoint do layout`, t.gate, declarado);
  checar(`${t.nome}: e o componente conhece essa porteira`, true,
    fonteFundo.includes(`  ${declarado}: 'hidden min-[${declarado}px]:block'`));
}

// O componente esconde, nunca aperta: `hidden` + `min-[…]:block`.
checar('abaixo do breakpoint o fundo nao existe (hidden)', true,
  /hidden[^"']*min-\[\d+px\]:block/.test(fonteFundo));
checar('e ele e inerte ao toque', true, fonteFundo.includes('pointer-events-none'));
checar('e invisivel para leitor de tela', true, fonteFundo.includes('aria-hidden'));

// ─────────────────────────────────────────────────────────────────────────
// -----------------------------------------------------------------------
bloco('4b. Nenhuma classe de largura minima e montada em tempo de execucao');

// ⚠️ ESTE BLOCO EXISTE POR UM DEFEITO QUE APAGOU A TELA INTEIRA E NAO DEU
// ERRO NENHUM.
//
// O Tailwind gera classe lendo o TEXTO dos arquivos, e ele nao sabe o que e
// comentario. Um comentario deste projeto trazia o exemplo
// "min-[<interpolacao>px]:block" escrito por extenso, para explicar por que a
// classe precisa ser literal. O extrator leu aquilo como candidato com valor
// invalido e DERRUBOU A GERACAO INTEIRA da variante de largura minima —
// inclusive as classes validas do proprio arquivo e as do Login.jsx.
//
// Resultado: o fundo do login nunca apareceu, o build passou, o lint passou,
// os 56 casos deste arquivo passaram, e a unica pista era o CSS publicado nao
// ter nenhuma media query de 1340px.
//
// A regra que fica: `min-[` em `src/` so aceita um comprimento literal.
const arquivosSrc = [];
(function varrer(dir) {
  for (const nome of readdirSync(dir, { withFileTypes: true })) {
    const caminho = `${dir}/${nome.name}`;
    if (nome.isDirectory()) varrer(caminho);
    else if (/[.](jsx?|css)$/.test(nome.name)) arquivosSrc.push(caminho);
  }
})(new URL('../src', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1'));

checar('o varredor achou arquivos', true, arquivosSrc.length > 50);

const suspeitos = [];
for (const caminho of arquivosSrc) {
  const texto = readFileSync(caminho, 'utf8');
  // A classe de uma variante nunca atravessa linha. Sem o fim-de-linha na
  // classe negada, uma MENCAO em prosa a `min-` seguida de colchete aberto
  // casava ate o proximo colchete fechado do arquivo, varios paragrafos
  // abaixo — e este teste reprovava o comentario que explica o proprio
  // teste. Foi a segunda vez na mesma hora que a prosa reprovou a decisao.
  for (const m of texto.matchAll(/min-\[([^\]\n]*)\]/g)) {
    // Vale so um comprimento literal: digitos + unidade.
    if (!/^[0-9]+(px|rem|em)$/.test(m[1])) {
      suspeitos.push(`${caminho.split('/src/')[1]}: min-[${m[1]}]`);
    }
  }
}
checar('nenhum min-[] com valor nao literal', [], suspeitos);

// A sonda positiva: o detector precisa reconhecer a forma que quebrou.
const formaQueQuebrou = 'min-[' + '${n}' + 'px]:block';
checar('o detector reconhece a forma que quebrou (sonda positiva)', true,
  [...formaQueQuebrou.matchAll(/min-\[([^\]\n]*)\]/g)]
    .some((m) => !/^[0-9]+(px|rem|em)$/.test(m[1])));

bloco('5. A animacao e tempero, nao estrutura');

const fonteCss = ler('src/index.css');
checar('a flutuacao existe', true, fonteCss.includes('@keyframes fundo-flutua'));
checar('o halo existe', true, fonteCss.includes('@keyframes fundo-halo'));
checar('e as duas param com prefers-reduced-motion', true,
  /prefers-reduced-motion[\s\S]*fundo-flutua[\s\S]*fundo-halo/.test(fonteCss));

// Os tres cartoes nao podem respirar juntos: mesmo atraso e o que denuncia
// que aquilo e enfeite.
const atrasos = Object.values(SLOTS).map((s) => s.atraso);
checar('os tres atrasos sao diferentes', 3, new Set(atrasos).size);

// O ciclo longo e deliberado: movimento rapido num fundo rouba o olho de quem
// esta digitando uma senha, que e a unica coisa que a pessoa veio fazer aqui.
const duracoes = [...fonteCss.matchAll(/animation-duration:\s*([\d.]+)s/g)].map((m) => Number(m[1]));
const ciclo = Number((fonteCss.match(/fundo-flutua\s+([\d.]+)s/) || [])[1]);
const todas = [ciclo, ...duracoes].filter(Boolean);
checar('ha ciclos declarados', true, todas.length >= 3);
checar('e todos entre 11 e 14 segundos', [], todas.filter((d) => d < 11 || d > 14));

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
