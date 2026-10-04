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
caso('tem o botão Salvar', /'Salvar'/.test(input) || />\s*Salvar\s*</.test(input));
// O CAMPO DIZ QUE VALEU (04/10/2026): quem tem 40+ precisa ver o sinal.
caso('depois do Salvar o botão diz "Pronto" com o visto', /<Check\b[^>]*\/>\s*Pronto/.test(input));
caso('o campo confirmado ganha borda verde e o visto dentro',
  /mostraPronto(?: \|\| ditado\.ouvindo)? \? 'border-primary'/.test(input) && /<CheckCircle2/.test(input));
caso('o Salvar, o Enter e o sair do campo confirmam', (input.match(/confirmar\(\)/g) || []).length >= 3);
caso('mudar o texto desfaz a confirmação', /aoMudar = \(e\) => \{\s*setConfirmado\(false\)/.test(input));
caso('nunca diz "Salvo" (no passo a passo nada foi ao banco ainda)', !/['>]\s*Salvo\s*['<]/.test(input));
caso('o leitor de tela também ouve "pronto"', /role="status"/.test(input));
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

console.log('6. onde o "Salvar" do campo NÃO aparece (04/10/2026, decisão do dono)');
// O botão avança, não grava. Onde a tela já tem o botão de verdade, ou um
// campo só, quem tem 40+ toca nele achando que guardou e sai.
caso('data e senha nunca levam o botão',
  /type !== 'date'/.test(input) && /type !== 'password'/.test(input));
caso('existe o jeito de esconder só o botão (o Enter continua)', /semSalvar = false/.test(input));
const SEM_SALVAR = {
  'src/pages/Login.jsx': 1, 'src/pages/DriverSignup.jsx': 3, 'src/components/landing/LoginSheet.jsx': 1, 'src/components/auth/AuthSheet.jsx': 1,
  'src/components/acesso/PedirAcesso.jsx': 1, 'src/components/children/TelefoneDaEscola.jsx': 1,
  'src/components/payments/PixForm.jsx': 1, 'src/components/contract/EditarCombinadoSheet.jsx': 1,
  'src/pages/Profile.jsx': 3, 'src/pages/tio/TioAbastecer.jsx': 1, 'src/components/financeiro/FolhaDeDespesa.jsx': 3,
};
for (const [arq, n] of Object.entries(SEM_SALVAR)) {
  // A ordem dos atributos não importa (`<Input falar="nome" semSalvar`).
  const achou = (ler(arq).match(/<Input\b[^>\n]*\bsemSalvar\b/g) || []).length;
  caso(`${arq}: sem o botão nos campos de texto (${n})`, achou >= n, `achou ${achou}`);
}
// Sonda: o padrão reconhece o atributo.
caso('sonda: o padrão acha "<Input semSalvar"', /<Input semSalvar\b/.test('<Input semSalvar label="x" />'));

console.log('7. a jornada do primeiro acesso: um protagonista por tela (04/10/2026, aprovado pelo dono)');
// As escolhas são PARADA do Salvar: sem isto o Salvar do nome enviava o
// formulário e a pessoa recebia "Escolha uma opção." sem ter errado nada.
for (const arq of ['src/pages/tio/PrimeiroAcesso.jsx', 'src/components/children/ChildForm.jsx']) {
  caso(`${arq}: o grupo de escolha é parada do Salvar`,
    /data-campo-escolha\s+tabIndex=\{-1\}/.test(ler(arq)));
}
const loginTela = ler('src/pages/Login.jsx');
caso('login no celular: "Começar com Google"', loginTela.includes('Começar com Google'));
caso('login no celular: "Primeira vez? Criar conta" com 48 px',
  /min-h-12[^"]*"\s*>\s*<Plus[^>]*\/> Primeira vez\? Criar conta/.test(loginTela));
caso('as abas do login têm 48 px e letra de 16', /tap min-h-12 rounded-lg px-2 py-2 text-base font-bold/.test(loginTela));
const convite = ler('src/components/children/InviteShare.jsx');
caso('o convite mandado vira "Enviado ✓"', convite.includes("'Enviado ✓'"));
const fimDoCadastro = ler('src/components/children/ChildForm.jsx');
caso('e o destaque passa para "Cadastrar outra criança"',
  /variant=\{enviado \|\| jaEntrou \? 'primary' : 'secondary'\}/.test(fimDoCadastro));
caso('o joinha é verde, não âmbar', !/bg-perua/.test(fimDoCadastro));
caso('a pergunta do PIX vem depois do convite', fimDoCadastro.includes('onEnviado={() => perguntarPixDepois()}'));
caso('a folha Nova escola tem o próprio data-avancar',
  /<Button\s+data-avancar/.test(ler('src/components/children/NovaEscolaSheet.jsx')));

console.log(`\n  ${ok} passaram, ${bad} falharam\n`);
process.exit(bad ? 1 : 0);
