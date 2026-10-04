/**
 * FALAR EM VEZ DE ESCREVER — o microfone dos campos (04/10/2026).
 *
 * POR QUE ESTE TESTE
 * O dono pediu o microfone para quem desiste de cadastrar quando vê muito
 * texto para digitar. Três coisas precisam continuar verdade depois que
 * alguém mexer nos formulários:
 *
 *   1. o texto falado entra na FORMA do campo (nome com iniciais, telefone só
 *      com números, recado somado ao que já estava escrito);
 *   2. o microfone está onde o dono aprovou — e NUNCA onde ditar é risco:
 *      senha, login, CPF/CNPJ, chave PIX, CEP, km, data e saúde da criança;
 *   3. a Política declara para onde vai o áudio (Google/Apple).
 *
 * COMO RODAR
 *   node scripts/testar-ditado.mjs      (ou: npm run testar:ditado)
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  frase,
  juntarTexto,
  nomeProprio,
  soDigitos,
  textoDitado,
} from '../src/compartilhado/ditado.js';

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
const bloco = (t) => console.log(`\n${t}`);
const ler = (p) => readFileSync(p, 'utf8');

// ───────────────────────────── 1. o texto ──────────────────────────────────
bloco('1. O QUE FOI FALADO VIRA TEXTO NA FORMA DO CAMPO');
checar('nome: iniciais maiúsculas', 'Maria da Silva', nomeProprio('maria da silva'));
checar('nome: "da/de/do/dos/das/e" minúsculos no meio', 'João dos Santos e Souza', nomeProprio('JOÃO DOS SANTOS E SOUZA'));
checar('nome: a primeira palavra sempre maiúscula, mesmo "da"', 'Da Costa', nomeProprio('da costa'));
checar('nome: espaços sobrando somem', 'Ana Paula', nomeProprio('  ana    paula '));
checar('nome: acento preservado', 'Érica Antônia', nomeProprio('érica antônia'));
checar('nome: vazio', '', nomeProprio(''));
checar('nome: nulo', '', nomeProprio(null));
checar('telefone: só os números', '11987654321', soDigitos('11 98765-4321'));
checar('telefone: nada de número', '', soDigitos('não sei'));
checar('frase: primeira letra maiúscula', 'Ele chega mais tarde hoje', frase('ele chega mais tarde hoje'));
checar('frase: vazio', '', frase('   '));
checar('textoDitado nome', 'Rua das Flores', textoDitado('rua das flores', 'nome'));
checar('textoDitado telefone', '1133334444', textoDitado('11 3333 4444', 'telefone'));
checar('textoDitado texto', 'Portão azul', textoDitado('portão azul', 'texto'));
checar('textoDitado sem tipo vale texto', 'Oi', textoDitado('oi'));
checar('juntar: campo vazio recebe a frase', 'Chego às sete', juntarTexto('', 'chego às sete'));
checar('juntar: soma com ponto entre as frases', 'Chego às sete. Avise a mãe', juntarTexto('Chego às sete', 'avise a mãe'));
checar('juntar: não duplica a pontuação', 'Chego às sete. Avise a mãe', juntarTexto('Chego às sete.', 'avise a mãe'));
checar('juntar: ditado vazio não mexe no texto', 'Já escrito', juntarTexto('Já escrito', '  '));
checar('juntar: nulo vira vazio', 'Oi', juntarTexto(null, 'oi'));

// ───────────────────────────── 2. o campo ──────────────────────────────────
bloco('2. O CAMPO COM MICROFONE');
const input = ler('src/components/common/Input.jsx');
// `\r?` porque o checkout do Windows grava CRLF: sem ele o teste passava no
// disco de quem desenvolve e reprovava numa cópia limpa.
checar('o Input aceita `falar`', true, /\n\s*falar,\r?\n/.test(input));
checar('senha e data nunca têm microfone', true,
  /comMicrofone =[\s\S]{0,200}type !== 'password' && type !== 'date'/.test(input));
checar('o texto passa por textoDitado', true, input.includes('textoDitado(bruto, falar)'));
checar('"Ouvindo… pode falar" é estado parado (sem animate-)', true,
  input.includes('Ouvindo… pode falar') && !/animate-/.test(input));
const botao = ler('src/components/common/BotaoDeFalar.jsx');
checar('o botão dos textos longos SOMA ao que já está escrito', true, botao.includes('juntarTexto(valor'));
checar('sem suporte, o botão não existe', true, /if \(!suportado\) return null/.test(botao));
checar('o botão dos textos longos não pulsa', false, /animate-/.test(botao));
const hook = ler('src/hooks/useDitado.js');
checar('a escuta é em português do Brasil', true, hook.includes("r.lang = 'pt-BR'"));
checar('sair da tela fecha o microfone', true, /useEffect\(\(\) => \(\) => atual\.current\?\.abort/.test(hook));

// ───────────────────────────── 3. onde ─────────────────────────────────────
bloco('3. ONDE O DONO APROVOU');
const COM_MICROFONE = {
  'src/components/children/ChildForm.jsx': 9,
  'src/components/children/NovaEscolaSheet.jsx': 2,
  'src/pages/tio/TioEscolas.jsx': 4,
  'src/components/children/EditarOndeSheet.jsx': 2,
  'src/components/children/EditarResponsavelSheet.jsx': 2,
  'src/components/altpickup/AltPickupSheet.jsx': 2,
  'src/pages/tio/PrimeiroAcesso.jsx': 3,
  'src/pages/pai/PrimeiroAcessoDoPai.jsx': 4,
  'src/components/contract/DadosDoContratoForm.jsx': 2,
  'src/components/financeiro/FolhaDeDespesa.jsx': 2,
  'src/components/financeiro/EscolherPostoSheet.jsx': 1,
  'src/pages/tio/TioAbastecer.jsx': 1,
};
for (const [arq, n] of Object.entries(COM_MICROFONE)) {
  checar(`${arq}: ${n} campo(s) com microfone`, true, (ler(arq).match(/<Input[^>]*\bfalar="/g) || []).length >= n);
}
const TEXTOS_LONGOS = [
  'src/components/agenda/TioAgendaFAB.jsx',
  'src/components/route/RecadoDaRota.jsx',
  'src/components/broadcasts/SchoolBroadcastSheet.jsx',
  'src/components/route/AvisosDaViagem.jsx',
  'src/components/children/EditarNotasSheet.jsx',
  'src/components/support/SupportSheet.jsx',
  'src/components/children/ChildForm.jsx',
  'src/components/feedback/CartaoDeAvaliacao.jsx',
];
for (const arq of TEXTOS_LONGOS) {
  checar(`${arq}: o texto longo tem "Falar"`, true, ler(arq).includes('<BotaoDeFalar '));
}
checar('a busca da rua tem microfone', true, ler('src/components/endereco/BuscaDeRua.jsx').includes('useDitado()'));

// ───────────────────────────── 4. onde nunca ───────────────────────────────
bloco('4. ONDE O MICROFONE NUNCA ENTRA');
function jsx(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? jsx(p) : /\.jsx$/.test(n) ? [p] : [];
  });
}
const PROIBIDO = /senha|e-?mail|cpf|cnpj|cep|chave|km|hodômetro|vencimento|saúde|alerg/i;
const proibidos = [];
for (const arq of jsx('src')) {
  const fonte = ler(arq);
  for (const m of fonte.matchAll(/<Input[^>]*\bfalar="[^"]*"([\s\S]*?)\/>/g)) {
    const label = (m[0].match(/label=(?:"([^"]*)"|\{([^}]*)\})/) || [])[1] || '';
    if (PROIBIDO.test(label)) proibidos.push(`${arq}: ${label}`);
  }
}
checar('nenhum campo de senha, login, CPF, CEP, chave, km ou saúde com microfone', [], proibidos);
checar('sonda: o detector reconhece um rótulo proibido', true, PROIBIDO.test('CPF ou CNPJ'));
const saude = ler('src/components/children/SaudeDaCrianca.jsx');
checar('a saúde da criança não tem microfone (dado sensível)', false,
  /BotaoDeFalar|useDitado|falar="/.test(saude));
for (const arq of ['src/pages/Login.jsx', 'src/components/landing/LoginSheet.jsx', 'src/components/auth/AuthSheet.jsx', 'src/pages/AuthAction.jsx', 'src/components/payments/PixForm.jsx']) {
  checar(`${arq}: sem microfone`, false, /\bfalar="|<BotaoDeFalar/.test(ler(arq)));
}

// ───────────────────────────── 5. a política ───────────────────────────────
bloco('5. A POLÍTICA DIZ PARA ONDE VAI O ÁUDIO');
const legal = ler('src/pages/legal/legalContent.js');
checar('declara o ditado por voz', true, legal.includes('Ditado por voz'));
checar('nomeia Google e Apple', true, /Google, no Android; Apple, no iPhone/.test(legal));
checar('diz que o app não guarda o áudio', true, legal.includes('não grava nem guarda o áudio'));

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
