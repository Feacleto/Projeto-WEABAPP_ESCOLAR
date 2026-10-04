/**
 * Os formulários — Node puro, como o resto de scripts/.
 * Rodar: npm run testar:formularios
 *
 * POR QUE ISTO EXISTE
 * O exemplo cinza dentro do campo ("Ex: Pedro Silva", "00000-000", "06:40")
 * era lido como resposta já dada: o motorista passava adiante com o campo
 * vazio (03/10/2026, pedido do dono). Todo campo diz "Digite aqui", e este
 * teste reprova exemplo novo em qualquer tela — é a coisa mais fácil do mundo
 * de voltar, porque cada tela nova nasce copiando a vizinha.
 *
 * E trava o "Salvar" ao lado do campo: ele leva ao próximo, e no último
 * aciona o avanço da tela (`data-avancar` no passo a passo do cadastro).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ler = (p) => readFileSync(join(raiz, p), 'utf8');
let ok = 0;
let bad = 0;
function caso(nome, passou, detalhe = '') {
  if (passou) ok++;
  else {
    bad++;
    console.log(`  FALHOU ${nome}${detalhe ? `\n    ${detalhe}` : ''}`);
  }
}

function jsx(dir) {
  return readdirSync(join(raiz, dir), { withFileTypes: true }).flatMap((e) => {
    const p = `${dir}/${e.name}`;
    return e.isDirectory() ? jsx(p) : e.name.endsWith('.jsx') ? [p] : [];
  });
}

console.log('\n1. nenhum exemplo dentro de campo');
const achados = [];
for (const arq of jsx('src')) {
  const fonte = ler(arq);
  for (const m of fonte.matchAll(/placeholder="([^"]*)"/g)) {
    if (m[1] !== 'Digite aqui') achados.push(`${arq}: "${m[1]}"`);
  }
}
caso('todo placeholder literal é "Digite aqui"', achados.length === 0, achados.slice(0, 8).join('\n    '));
// Sonda: a regra pega um exemplo de verdade.
caso('sonda: o padrão acha um exemplo', /placeholder="([^"]*)"/.test('placeholder="Ex: Pedro"'));

console.log('2. o campo padrão');
const input = ler('src/components/common/Input.jsx');
const depoisDoRest = input.slice(input.indexOf('{...rest}'));
caso('o "Digite aqui" vem DEPOIS do {...rest} (o chamador não sobrescreve)',
  /\{\.\.\.rest\}[\s\S]*placeholder=\{textoGuia\}/.test(depoisDoRest.slice(0, 200)));
caso('o texto-guia é "Digite aqui"', input.includes("'Digite aqui'"));
caso('tem o botão Salvar', />\s*Salvar\s*</.test(input));
caso('o Salvar e o Enter usam o mesmo avanço', (input.match(/avancarDoCampo\(/g) || []).length >= 2);

console.log('3. o avanço da tela');
const avancar = ler('src/compartilhado/avancarCampo.js');
caso('procura o botão data-avancar', avancar.includes('[data-avancar]'));
caso('ou envia o formulário', avancar.includes('requestSubmit'));
caso('o "Avançar" do cadastro da criança é o avanço da tela',
  /onClick=\{onAdvance\}\s*\n[^\n]*\n\s*data-avancar/.test(ler('src/components/children/ChildForm.jsx')));

console.log('4. tela nova abre no topo');
const app = ler('src/App.jsx');
caso('o App monta TelaNovaNoTopo antes das rotas', /<TelaNovaNoTopo \/>\s*\n\s*<Routes>/.test(app));
const topo = ler('src/components/common/TelaNovaNoTopo.jsx');
caso('ela rola ao topo a cada caminho', topo.includes('window.scrollTo(0, 0)') && topo.includes('[pathname]'));
caso('e desliga a restauração do navegador', topo.includes("scrollRestoration = 'manual'"));
caso('o cadastro da criança sobe a cada passo',
  /useEffect\(\(\) => \{\s*window\.scrollTo\(0, 0\);\s*\}, \[step\]\)/.test(ler('src/components/children/ChildForm.jsx')));

console.log('5. o voltar');
const header = ler('src/components/layout/Header.jsx');
caso('o voltar das telas diz "Voltar", nunca o nome da tela',
  />\s*Voltar\s*<\/span>/.test(header) && !/\{backLabel\}\s*<\/span>/.test(header));
for (const arq of ['src/components/common/AppSheet.jsx', 'src/components/common/Sheet.jsx', 'src/components/common/ConfirmDialog.jsx']) {
  caso(`${arq}: o voltar do celular fecha`, ler(arq).includes('useVoltarFechaFolha('));
}
const appSheet = ler('src/components/common/AppSheet.jsx');
caso('folha de tela cheia tem "← Voltar" e não o X',
  /size === 'full' && \([\s\S]{0,400}Voltar/.test(appSheet) && appSheet.includes("size !== 'full' && ("));

console.log(`\n  ${ok} passaram, ${bad} falharam\n`);
process.exit(bad ? 1 : 0);
