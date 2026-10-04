/**
 * A cor do motorista — Node puro, como o resto de scripts/.
 * Rodar: npm run testar:cor-da-marca
 *
 * POR QUE ISTO EXISTE
 * O app do motorista e o das famílias dele passam a usar a cor tirada do logo
 * DELE. Qualquer cor do mundo pode chegar aqui, e o que não pode acontecer é
 * uma delas virar texto ilegível: este teste gira o círculo de cores inteiro,
 * em várias luzes e saturações, e reprova a paleta que deixar o branco sobre
 * o botão, o botão como texto ou o texto sobre o chip abaixo do mínimo.
 * E trava a leitura do logo: o fundo branco não é a cor da marca, e a cor
 * pouca e forte não perde para a cor muita e apagada.
 */
import {
  paletaDaMarca,
  opcoesDoLogo,
  coresDoLogo,
  contraste,
  hexParaRgb,
  temCor,
  canais,
  CONTRASTE_MINIMO,
} from '../src/marca/corDaMarca.js';
import cfg from '../tailwind.config.js';

let ok = 0;
let bad = 0;
const falhas = [];
function igual(nome, obtido, esperado) {
  if (JSON.stringify(obtido) === JSON.stringify(esperado)) ok++;
  else {
    bad++;
    falhas.push(`  FALHOU ${nome}\n    esperado: ${JSON.stringify(esperado)}\n    obtido:   ${JSON.stringify(obtido)}`);
  }
}
const FUNDO = hexParaRgb('#EEF1EF');
const BRANCO = [255, 255, 255];

console.log('\n1. cor sem cor fica no verde da casa');
igual('branco', paletaDaMarca('#FFFFFF'), null);
igual('preto', paletaDaMarca('#000000'), null);
igual('cinza', paletaDaMarca('#808080'), null);
igual('hex inválido', paletaDaMarca('azul'), null);
igual('vazio', paletaDaMarca(null), null);
igual('vermelho tem cor', temCor(hexParaRgb('#E53935')), true);

console.log('2. o círculo inteiro, sempre legível');
let combinacoes = 0;
for (let h = 0; h < 360; h += 7) {
  for (const s of [0.3, 0.55, 0.8, 1]) {
    for (const l of [0.2, 0.35, 0.5, 0.65, 0.8]) {
      // monta o hex pela própria conversão do módulo (HSL → RGB)
      const c = (1 - Math.abs(2 * l - 1)) * s;
      const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
      const m = l - c / 2;
      const base = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
      const hex = `#${base.map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('')}`;
      const p = paletaDaMarca(hex);
      if (!p) continue;
      combinacoes++;
      const P = hexParaRgb(p.primary);
      const nome = `${hex} (h${h} s${s} l${l})`;
      if (contraste(P, BRANCO) < CONTRASTE_MINIMO) igual(`${nome}: branco sobre o botão`, false, true);
      else ok++;
      if (contraste(P, FUNDO) < CONTRASTE_MINIMO) igual(`${nome}: botão como texto no fundo`, false, true);
      else ok++;
      if (contraste(P, hexParaRgb(p.primaryChip)) < 4.5) igual(`${nome}: texto sobre o chip`, false, true);
      else ok++;
      if (contraste(P, hexParaRgb(p.primarySoft)) < 4.5) igual(`${nome}: texto sobre o suave`, false, true);
      else ok++;
      if (contraste(hexParaRgb(p.menta), P) < 4.5) igual(`${nome}: rótulo claro sobre o botão`, false, true);
      else ok++;
      // A cor VIVA (04/10/2026): a letra lê nela e no fim do degradê.
      const N = hexParaRgb(p.naMarca);
      if (contraste(hexParaRgb(p.marca), N) < 4.5) igual(`${nome}: letra sobre a cor viva`, false, true);
      else ok++;
      if (contraste(hexParaRgb(p.marcaEscuro), N) < 4.5) igual(`${nome}: letra sobre o fim do degradê`, false, true);
      else ok++;
    }
  }
}
igual('passou por centenas de cores', combinacoes > 300, true);

igual('no máximo duas cores do logo (o verde é a terceira)',
  opcoesDoLogo(['#F7941D', '#1E5BB8', '#D62828']).length, 2);
igual('cor sem cor não entra nas opções', opcoesDoLogo(['#808080', '#1E5BB8']), ['#1E5BB8']);
igual('o laranja do logo continua laranja na cor viva', paletaDaMarca('#F7941D').marca, '#F7941D');
igual('e leva letra escura', paletaDaMarca('#F7941D').naMarca, '#0B1210');
igual('o azul escuro leva letra branca', paletaDaMarca('#1E5BB8').naMarca, '#FFFFFF');

console.log('3. a cor do logo');
function imagem(lista) {
  // lista de [rgb, quantidade, alfa?]
  const px = [];
  for (const [rgb, n, a = 255] of lista) for (let i = 0; i < n; i++) px.push(rgb[0], rgb[1], rgb[2], a);
  return px;
}
igual('fundo branco não conta', coresDoLogo(imagem([[[255, 255, 255], 900], [[30, 90, 200], 100]]))[0]?.slice(0, 3), '#1E');
igual('transparente não conta',
  coresDoLogo(imagem([[[230, 40, 40], 900, 0], [[30, 90, 200], 50]])).length, 1);
igual('só cinza e preto: nenhuma cor', coresDoLogo(imagem([[[20, 20, 20], 500], [[128, 128, 128], 500]])), []);
const dois = coresDoLogo(imagem([[[30, 90, 200], 400], [[230, 40, 40], 300]]));
igual('duas cores, as duas sugeridas', dois.length, 2);
igual('a que mais aparece vem primeiro', dois[0], '#1E5AC8');
igual('tons vizinhos viram uma sugestão só',
  coresDoLogo(imagem([[[30, 90, 200], 300], [[35, 95, 205], 300]])).length, 1);
igual('no máximo três',
  coresDoLogo(imagem([[[230, 40, 40], 100], [[40, 200, 60], 100], [[30, 90, 200], 100], [[240, 200, 30], 100]])).length, 3);

console.log('4. o verde da casa é a fonte do tema');
const C = cfg.coresHex;
igual('coresHex existe no tailwind.config.js', typeof C?.primary, 'string');
igual('primary vira canais', canais('#1F5F3F'), '31 95 63');
igual('o tema do Tailwind lê a variável',
  String(cfg.theme.extend.colors.primary).includes('var(--tema-primary'), true);

falhas.forEach((f) => console.log(f));
console.log(`\n  ${ok} passaram, ${bad} falharam\n`);
process.exit(bad ? 1 : 0);
