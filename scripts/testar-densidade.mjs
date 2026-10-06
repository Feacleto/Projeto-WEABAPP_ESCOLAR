/**
 * A DENSIDADE NO CELULAR (05/10/2026, aprovada pelo dono).
 *
 *   node scripts/testar-densidade.mjs
 *   (ou: npm run testar:densidade)
 *
 * Medido a 360×740, o Início do motorista e o da família davam 69% da tela ao
 * conteúdo: o menu tinha 95 px e o botão verde flutuava num cartão acima dele.
 * O que este teste trava é o que faz a tela caber, e que voltaria sem ninguém
 * ver porque cada peça parece um detalhe sozinha:
 *
 *   1. uma altura só para o menu (`--altura-do-menu`), lida pelo menu, pelas
 *      barras de ação e pela reserva dos layouts — nenhum número solto;
 *   2. o botão verde do momento é a `BarraDaAcao` (colada no menu), não o
 *      cartão `sticky … shadow-float` que flutuava;
 *   3. puxar a tela não estica nem recarrega (`overscroll-behavior-y: none`);
 *   4. os menus decididos: tio Início · Comunidade · Carteira (na rota,
 *      Início · Comunidade · Rota); família Início · Novidades · Mensalidade;
 *   5. a saudação usa o nome curto (`nomeDaSaudacao`).
 *
 * As medidas do navegador (69% → 84%) estão no artifact "Densidade no
 * celular"; aqui fica o que dá para conferir lendo os arquivos.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nomeDaSaudacao } from '../src/marca/greeting.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ler = (rel) => readFileSync(resolve(RAIZ, rel), 'utf8');
/** Tira os comentários: é neles que a decisão antiga é explicada. */
const semComentario = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

let ok = 0;
let bad = 0;
function checar(nome, esperado, obtido) {
  const passou = JSON.stringify(esperado) === JSON.stringify(obtido);
  if (passou) ok += 1;
  else bad += 1;
  console.log(`  ${passou ? 'ok ' : 'FALHOU'}  ${nome}${passou ? '' : `  (esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)})`}`);
}
const bloco = (t) => console.log(`\n${t}`);

// ── 1. A altura do menu ─────────────────────────────────────────────────
bloco('1. Uma altura só para o menu');
const css = ler('src/index.css');
checar('index.css declara --altura-do-menu: 4rem', true, /--altura-do-menu:\s*4rem/.test(css));
const nav = semComentario(ler('src/components/layout/BottomNav.jsx'));
checar('o menu tem a altura da variável', true, /height:\s*'calc\(var\(--altura-do-menu\)/.test(nav));
checar('o menu não tem padding próprio que o faça crescer', false, /pt-2 pb-3/.test(nav));
for (const layout of ['src/pages/tio/TioLayout.jsx', 'src/pages/pai/PaiLayout.jsx']) {
  const s = semComentario(ler(layout));
  checar(`${layout.split('/').pop()} reserva a altura do menu`, true, /paddingBottom:\s*'calc\(var\(--altura-do-menu\)/.test(s));
  checar(`${layout.split('/').pop()} não reserva 8rem`, false, /8rem \+ env/.test(s));
}

// ── 2. O botão verde colado no menu ─────────────────────────────────────
bloco('2. A barra da ação colada no menu');
checar('.barra-da-acao pousa na altura do menu', true,
  /\.barra-da-acao\s*\{[^}]*bottom:\s*calc\(env\(safe-area-inset-bottom, 0px\) \+ var\(--altura-do-menu\)\)/.test(css));
const FLUTUANTE = /sticky z-20 mx-3[^"]*shadow-float/;
for (const arq of [
  'src/pages/tio/TioDashboard.jsx',
  'src/components/route/OperacaoDaRota.jsx',
  'src/pages/pai/PaiDashboard.jsx',
  'src/pages/pai/PaiFaltas.jsx',
]) {
  const s = semComentario(ler(arq));
  const nome = arq.split('/').pop();
  checar(`${nome} usa a BarraDaAcao`, true, /<BarraDaAcao>/.test(s));
  checar(`${nome} não tem o cartão flutuante`, false, FLUTUANTE.test(s));
  checar(`${nome} não tem a altura antiga do menu (5.75rem)`, false, /5\.75rem/.test(s));
}
checar('sonda: o detector pegaria o cartão flutuante antigo', true,
  FLUTUANTE.test('className="sticky z-20 mx-3 mt-2 rounded-2xl bg-card p-2 shadow-float"'));

// ── 3. Puxar a tela ─────────────────────────────────────────────────────
bloco('3. Puxar não estica nem recarrega');
checar('html e body seguram o puxão', true, /html,\s*body\s*\{\s*overscroll-behavior-y:\s*none;/.test(css));

// ── 4. Os menus ─────────────────────────────────────────────────────────
bloco('4. Os menus decididos');
const tio = ler('src/pages/tio/TioLayout.jsx');
const abaCom = /const ABA_DA_COMUNIDADE = \{ to: '\/tio\/comunidade', label: 'Comunidade'/.test(tio);
checar('tio: a aba Comunidade existe', true, abaCom);
const navTio = tio.slice(tio.indexOf('const NAV_ITEMS'), tio.indexOf('];', tio.indexOf('const NAV_ITEMS')));
checar('tio: Início · Comunidade · Carteira, nessa ordem', true,
  /'Início'[\s\S]*ABA_DA_COMUNIDADE[\s\S]*'Carteira'/.test(navTio));
const rotaTio = tio.slice(tio.indexOf('const ITENS_EM_ROTA'), tio.indexOf('];', tio.indexOf('const ITENS_EM_ROTA')));
checar('tio na rota: Início · Comunidade · Rota', true, /NAV_ITEMS\[0\][\s\S]*ABA_DA_COMUNIDADE[\s\S]*'Rota'/.test(rotaTio));
const pai = ler('src/pages/pai/PaiLayout.jsx');
const navPai = pai.slice(pai.indexOf('const NAV_ITEMS'), pai.indexOf('];', pai.indexOf('const NAV_ITEMS')));
checar('família: Início · Novidades · Mensalidade, nessa ordem', true,
  /'Início'[\s\S]*'Novidades'[\s\S]*'Mensalidade'/.test(navPai));
checar('família: Novidades é a página de notificações', true, /to: '\/pai\/notifications', label: 'Novidades'/.test(navPai));
checar('família: Mensalidade com o ícone de carteira', true, /label: 'Mensalidade',\s*icon: Wallet/.test(navPai));
checar('família: o menu não diz mais "Financeiro"', false, /'Financeiro'/.test(navPai));
checar('a tela da família se chama Mensalidade', true, /title="Mensalidade"/.test(ler('src/pages/pai/PaiFinance.jsx')));
checar('as fotos da turma moram em Novidades', true, /navigate\('\/pai\/comunidade'\)/.test(ler('src/pages/Notifications.jsx')));
checar('o Início do tio não tem mais a linha Comunidade (está no menu)', false,
  /LinhaComunidade/.test(semComentario(ler('src/pages/tio/TioDashboard.jsx'))));

// ── 4b. Minha turma é para gerenciar ─────────────────────────────────
bloco('4b. Minha turma é para gerenciar, não para acompanhar a rota');
const turma = semComentario(ler('src/pages/tio/TioChildren.jsx'));
checar('a turma não mostra mais o status da rota (ChildCard)', false, /<ChildCard/.test(turma));
checar('cada criança tem o "···" das ações', true, /aria-label=\{`O que fazer com/.test(turma));
checar('a folha tem mandar recado, abrir a ficha e desativar', true,
  /Mandar recado/.test(turma) && /Abrir a ficha/.test(turma) && /Desativar criança/.test(turma));
checar('passar para outro tio é a mesma peça da ficha (decide quando aparece)', true, /<PassarParaOutroTio child=\{child\} \/>/.test(turma));
checar('cadastrar criança mora na barra colada no menu', true, /<BarraDaAcao>[\s\S]*Cadastrar criança[\s\S]*<\/BarraDaAcao>/.test(turma));

// ── 5. A saudação ───────────────────────────────────────────────────────
bloco('5. O nome curto da saudação');
checar('"Transporte Tio Zé" → "Tio Zé"', 'Tio Zé', nomeDaSaudacao({ marcaNome: 'Transporte Tio Zé', name: 'José Aparecido Lima' }));
checar('"Van da Tia Rosa" → "Tia Rosa"', 'Tia Rosa', nomeDaSaudacao({ marcaNome: 'Van da Tia Rosa', name: 'Rosa Maria' }));
checar('"tio nino" (minúsculo) → "tio nino"', 'tio nino', nomeDaSaudacao({ marcaNome: 'tio nino', name: 'Nino' }));
checar('marca sem Tio/Tia → o primeiro nome', 'Lúcia', nomeDaSaudacao({ marcaNome: 'Escolar Express', name: 'Lúcia Ferraz' }));
checar('sem nome → a marca', 'Escolar Express', nomeDaSaudacao({ marcaNome: 'Escolar Express' }));
checar('sem nada → "Tio"', 'Tio', nomeDaSaudacao({}));
checar('"Titio Carlos" não vira "Tio …" pela metade da palavra', 'Carlos', nomeDaSaudacao({ marcaNome: 'Titio Carlos', name: 'Carlos Souza' }));

console.log(`\n  ${ok} passaram, ${bad} falharam`);
if (bad) process.exit(1);
