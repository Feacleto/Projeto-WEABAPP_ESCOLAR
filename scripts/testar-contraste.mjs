/**
 * Contraste dos pares de cor do app — Node puro, como o resto de scripts/.
 * Rodar: node scripts/testar-contraste.mjs
 *
 * POR QUE ISTO EXISTE
 * Três pares reprovavam a WCAG em produção e ninguém tinha visto: o valor da
 * mensalidade em âmbar (2,0:1), a mensagem de erro do Input em vermelho
 * (3,8:1) e o `textMuted` sobre o fundo da PÁGINA (4,3:1). Os três foram
 * escolhidos no olho, e no olho eles parecem bons — num monitor caro, num
 * escritório, de manhã. O motorista lê a mesma tela sob sol, num Android
 * barato, em pé na rua.
 *
 * A ARMADILHA QUE ESTE ARQUIVO EXISTE PRA PEGAR não é "escolheram cor feia".
 * É o `textMuted`: ele dava 4,8:1 sobre o branco do cartão — onde alguém
 * testou — e 4,3:1 sobre o fundo cinza, que é onde ele mais aparece. Passou
 * no lugar conferido e reprovou no lugar usado. Por isso aqui cada cor de
 * texto é medida contra TODOS os fundos em que ela realmente cai, e não
 * contra um representante.
 *
 * O piso é o da WCAG 2.1 AA: 4,5:1 pra texto normal, 3:1 pra texto grande
 * (≥18,66px em negrito, ou ≥24px). O projeto costuma ficar muito acima —
 * 15,6:1 no texto principal — e essa folga é decisão, não sobra.
 *
 * Os hex vêm do tailwind.config.js, importado de verdade: cor trocada lá sem
 * medir aqui quebra o teste, que é exatamente o ponto.
 */
import cfg from '../tailwind.config.js';

const C = cfg.theme.extend.colors;

let ok = 0, falhou = 0;

/**
 * O token existe? Um nome removido do config chegava aqui como `undefined` e
 * estourava um TypeError no meio da fórmula — pilha de erro que não diz a
 * ninguém qual cor sumiu. Isto aconteceu de verdade ao renomear `divider`.
 */
function exigir(hex, onde) {
  if (typeof hex !== 'string') {
    console.error(`
[31mToken inexistente em "${onde}".[0m ` +
      'Ele foi renomeado ou removido do tailwind.config.js — ' +
      'atualize o par aqui em vez de apagar a medição.');
    process.exit(1);
  }
  return hex;
}

/** Luminância relativa, fórmula da WCAG 2.1. */
function luminancia(hex) {
  const canais = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * canais[0] + 0.7152 * canais[1] + 0.0722 * canais[2];
}

function razao(a, b) {
  const x = luminancia(a);
  const y = luminancia(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/**
 * @param piso  4.5 = texto normal · 3 = texto grande · 0 = só informativo
 */
const par = (nome, frente, fundo, piso = 4.5) => {
  const r = razao(exigir(frente, nome), exigir(fundo, nome));
  const passou = r >= piso;
  passou ? ok++ : falhou++;
  const marca = passou ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
  console.log(`  ${marca} ${nome.padEnd(46)} ${r.toFixed(1).padStart(5)}:1` +
    (passou ? '' : `   \x1b[31mpiso é ${piso}:1\x1b[0m`));
};

/** Cor com alfa sobre um fundo opaco — o chip de accent/10, por exemplo. */
const sobre = (hex, alfa, fundo) => {
  const mistura = (i) => Math.round(
    parseInt(hex.slice(i, i + 2), 16) * alfa +
    parseInt(fundo.slice(i, i + 2), 16) * (1 - alfa));
  return '#' + [1, 3, 5].map((i) => mistura(i).toString(16).padStart(2, '0')).join('').toUpperCase();
};

console.log('\n\x1b[1mCONTRASTE DO SISTEMA DE COR\x1b[0m');

console.log('\n\x1b[1m1. Texto principal — onde a folga é decisão de projeto\x1b[0m');
par('text sobre bg (o fundo da página)', C.text, C.bg);
par('text sobre card', C.text, C.card);
par('text sobre surface', C.text, C.surface);
par('text sobre sunken', C.text, C.sunken);

console.log('\n\x1b[1m2. Texto secundário — o par que reprovava\x1b[0m');
// Ele cai em quatro superfícies claras. Medir só contra o cartão foi o erro
// original: no cartão ele passava.
par('textMuted sobre bg', C.textMuted, C.bg);
par('textMuted sobre card', C.textMuted, C.card);
par('textMuted sobre surface', C.textMuted, C.surface);
par('textMuted sobre sunken', C.textMuted, C.sunken);
par('textMuted sobre neutro (chip neutro)', C.textMuted, C.neutro);

console.log('\n\x1b[1m3. Marca e ação\x1b[0m');
par('primary sobre bg', C.primary, C.bg);
par('primary sobre card', C.primary, C.card);
par('branco sobre primary (o botão)', C.card, C.primary);
par('branco sobre primaryDark (pressionado)', C.card, C.primaryDark);

console.log('\n\x1b[1m4. Os sinais como PALAVRA\x1b[0m');
// A regra que estes pares defendem: verde e âmbar são tinta de PREENCHIMENTO.
// Quando precisam ser palavra, existem accentText e warningText.
par('warningText sobre card', C.warningText, C.card);
par('warningText sobre warningSoft', C.warningText, C.warningSoft);
par('warningText sobre bg', C.warningText, C.bg);
par('dangerText sobre card', C.dangerText, C.card);
par('dangerText sobre dangerSoft', C.dangerText, C.dangerSoft);
par('dangerText sobre bg', C.dangerText, C.bg);
par('accentText sobre card', C.accentText, C.card);
par('accentText sobre bg', C.accentText, C.bg);
// O chip real onde o accentText vive: accent a 10% sobre branco.
par('accentText sobre chip de accent/10', C.accentText, sobre(C.accent, 0.1, C.card));

console.log('\n\x1b[1m5. A escola — legenda, e por isso precisa ser lida\x1b[0m');
par('escola sobre card', C.escola, C.card);
par('escola sobre escolaSoft', C.escola, C.escolaSoft);
par('branco sobre escola (o pin)', C.card, C.escola);

console.log('\n\x1b[1m6. A porta escura do motorista\x1b[0m');
par('onNight sobre night', C.onNight, C.night);
par('onNightMuted sobre night (rodapé legal)', C.onNightMuted, C.night);
par('accent sobre night (as ondas da marca)', C.accent, C.night, 3);

console.log('\n\x1b[1m7. O QUE NÃO PODE SER TEXTO — a regra, medida\x1b[0m');
// Estas linhas passam quando REPROVAM: é o motivo de accentText e
// warningText existirem. Se um dia alguém "consertar" o accent pra ele
// funcionar como texto, terá mudado a cor das ondas da marca.
const proibido = (nome, frente, fundo) => {
  const r = razao(exigir(frente, nome), exigir(fundo, nome));
  const certo = r < 4.5;
  certo ? ok++ : falhou++;
  console.log(`  ${certo ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${nome.padEnd(46)} ` +
    `${r.toFixed(1).padStart(5)}:1` + (certo ? '   (ilegível, como esperado)' :
      '   \x1b[31mvirou legível — accentText/warningText perderam o motivo\x1b[0m'));
};
proibido('accent como texto sobre card', C.accent, C.card);
proibido('warning como texto sobre card', C.warning, C.card);

console.log('\n' + '─'.repeat(66));
console.log(`\x1b[1m${ok} passaram, ${falhou} falharam\x1b[0m`);
process.exit(falhou ? 1 : 0);
