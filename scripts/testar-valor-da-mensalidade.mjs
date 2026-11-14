/**
 * Testes de "VALOR ZERO NÃO" — Node puro, sem runner.
 * Rodar: node scripts/testar-valor-da-mensalidade.mjs
 *
 * Decisão do dono (14/11/2026): o valor da mensalidade é obrigatório. Sem ele o
 * contrato não é emitido e o servidor nem gera a mensalidade. Três coisas aqui:
 *   1. a RÉGUA pura (`dominio/cobranca/valorDaMensalidade.js`);
 *   2. as TRANCAS, provadas por leitura de arquivo (serviço, formulário, telas);
 *   3. MUTAÇÃO: cada prova roda também contra uma cópia ESTRAGADA da régua ou do
 *      arquivo, e tem de reprovar — teste que passa com a trava arrancada não
 *      protege nada.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  valorDaMensalidade,
  valorDoCampoFalta,
  valorDaMensalidadeFalta,
} from '../src/dominio/cobranca/valorDaMensalidade.js';
import { FALTA_O_VALOR, DIGA_O_VALOR, ATALHO_DO_VALOR } from '../src/marca/valorDoConvite.js';
import { promessaProibida } from '../src/marca/promessas.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ler = (p) => fs.readFileSync(path.join(raiz, p), 'utf8');
const semComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const codigo = (p) => semComentarios(ler(p));

let ok = 0, falhou = 0;
const eq = (nome, a, b) => {
  const bateu = JSON.stringify(a) === JSON.stringify(b);
  bateu ? ok++ : falhou++;
  console.log(`  ${bateu ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${nome}` +
    (bateu ? '' : `\n      esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`));
};

// ── 1. A RÉGUA ─────────────────────────────────────────────────────────────
/** Os casos da régua, contra qualquer implementação de `falta(valor)`. */
const CASOS = [
  [undefined, true], [null, true], ['', true], ['   ', true], [0, true], ['0', true],
  ['0.00', true], [-5, true], ['-1', true], ['abc', true], [NaN, true], [Infinity, true],
  [{}, true], [[], true],
  [350, false], ['350', false], ['350.00', false], ['350,00', false], [0.01, false], ['1200.5', false],
];
const falhasDa = (falta) => CASOS.filter(([v, esperado]) => falta(v) !== esperado).length;

console.log('\n\x1b[1m1. A régua\x1b[0m');
for (const [v, esperado] of CASOS) {
  eq(`valorDoCampoFalta(${JSON.stringify(v)}) = ${esperado}`, valorDoCampoFalta(v), esperado);
}
eq('a criança sem monthlyFee está sem valor', valorDaMensalidadeFalta({ name: 'Ana' }), true);
eq('a criança sem objeto está sem valor', valorDaMensalidadeFalta(null), true);
eq('a criança com 350 tem valor', valorDaMensalidadeFalta({ monthlyFee: 350 }), false);
eq('o valor com vírgula vira número', valorDaMensalidade('350,50'), 350.5);
eq('sem valor utilizável, 0', valorDaMensalidade('abc'), 0);

console.log('\n\x1b[1m1b. Mutação da régua: cada estrago é pego\x1b[0m');
const mutantes = {
  'aceita zero (>= 0)': (v) => !(Number(v) >= 0),
  'só olha o tipo número': (v) => typeof v !== 'number' || !(v > 0),
  'ignora a vírgula': (v) => !(parseFloat(String(v ?? '')) > 0),
  'aceita negativo (!= 0)': (v) => !(Number(v) !== 0 && Number.isFinite(Number(v))),
  'nunca falta': () => false,
};
for (const [nome, falta] of Object.entries(mutantes)) {
  eq(`mutante "${nome}" reprova`, falhasDa(falta) > 0, true);
}
eq('a régua verdadeira não reprova nenhum caso', falhasDa(valorDoCampoFalta), 0);

// ── 2. AS TRANCAS, POR LEITURA DE ARQUIVO ──────────────────────────────────
/** Cada prova recebe o TEXTO do arquivo (sem comentários) e devolve true/false. */
const PROVAS = {
  servico: {
    arquivo: 'src/services/contratosDaFamiliaService.js',
    checagens: {
      'emitir recusa valor zero ANTES de montar o lote': (t) => {
        const i = t.indexOf('async function emitir(');
        const g = t.indexOf('valorDoCampoFalta(dados?.finance?.monthlyFee)', i);
        const b = t.indexOf('writeBatch(db)', i);
        return i >= 0 && g > i && b > g && /throw new Error\(FALTA_O_VALOR\)/.test(t.slice(g, g + 120));
      },
      'garantirContrato não emite sem valor': (t) => {
        const i = t.indexOf('export async function garantirContrato');
        const g = t.indexOf('valorDaMensalidadeFalta(child)) return null', i);
        const e = t.indexOf('await emitir(', i);
        return i >= 0 && g > i && e > g;
      },
      'salvarCombinado recusa antes de gravar ou emitir': (t) => {
        const i = t.indexOf('export async function salvarCombinado');
        const g = t.indexOf('valorDaMensalidadeFalta({ ...child, ...novos })', i);
        const u = t.indexOf('updateDoc(', i);
        const e = t.indexOf('await emitir(', i);
        return i >= 0 && g > i && g < u && g < e;
      },
      'só `emitir` escreve versões do contrato': (t) =>
        (t.match(/batch\.set\(doc\(db, 'children', child\.id, 'contratos'/g) || []).length === 1,
    },
  },
  hook: {
    arquivo: 'src/hooks/useGarantirContrato.js',
    checagens: {
      'a emissão automática usa a régua': (t) => /!valorDaMensalidadeFalta\(child\)/.test(t),
    },
  },
  formulario: {
    arquivo: 'src/components/children/ChildForm.jsx',
    checagens: {
      'o passo 4 exige o valor com a frase do catálogo': (t) => {
        const i = t.indexOf('if (s === 4) {');
        const fim = t.indexOf('setErrors(errs)', i);
        return i >= 0 && fim > i && /valorDoCampoFalta\(form\.monthlyFee\)\) errs\.monthlyFee = DIGA_O_VALOR/.test(t.slice(i, fim));
      },
      'não sobrou a validação que deixava vazio passar': (t) =>
        !/String\(form\.monthlyFee\)\.trim\(\) && \(!fee/.test(t),
      '"Salvar e completar depois" continua, só nos passos antes do último': (t) =>
        /canSaveEarly && step < TOTAL_STEPS/.test(t) && /Salvar e completar depois/.test(t),
      'o rascunho não valida o passo 4 (a criança fica sem valor)': (t) => {
        const i = t.indexOf('const canSaveEarly');
        return i >= 0 && /step >= 2/.test(t.slice(i, i + 120)) && !/step >= 4/.test(t.slice(i, i + 120));
      },
      'o campo usa a máscara de dinheiro que mostra o valor por extenso': (t) =>
        /<CampoDeValor[\s\S]*?value=\{form\.monthlyFee\}/.test(t),
      'a mãe sem valor não tem o "Mandar" morto na lista': (t) =>
        /!\(aoVivo && valorDaMensalidadeFalta\(aoVivo\)\)/.test(t),
    },
  },
  folha: {
    arquivo: 'src/components/contract/EditarCombinadoSheet.jsx',
    checagens: {
      'a folha exige o valor com a régua e a frase do catálogo': (t) =>
        /valorDoCampoFalta\(fee\)\) e\.fee = DIGA_O_VALOR/.test(t),
      'a folha mostra o motivo quando o serviço recusa': (t) => /err\.message === FALTA_O_VALOR/.test(t),
    },
  },
  cartao: {
    arquivo: 'src/components/contract/CartaoDoCombinado.jsx',
    checagens: {
      'o cartão diz o que falta quando não há contrato e não há valor': (t) =>
        /valorDaMensalidadeFalta\(child\)/.test(t) && /texto: FALTA_O_VALOR/.test(t),
      'o cartão tem o atalho que abre a folha do valor': (t) => {
        const i = t.indexOf('{faltaValor && (');
        return i >= 0 && /setEditando\(true\)/.test(t.slice(i, i + 300)) && /ATALHO_DO_VALOR/.test(t.slice(i, i + 500));
      },
    },
  },
  convite: {
    arquivo: 'src/components/children/InviteShare.jsx',
    checagens: {
      'o botão do convite NÃO é alcançável com valor zero': (t) => {
        const trava = t.indexOf('return <FaltaOValor');
        const botao = t.indexOf('data-convite-whatsapp', t.indexOf('export default function InviteShare'));
        return trava > 0 && botao > trava && /valorDaMensalidadeFalta\(criancaDoConvite\)/.test(t.slice(trava - 120, trava));
      },
      'enquanto a criança não chega, nem o botão nem a fresta': (t) =>
        /!jaEntrou && !criancaDoConvite && childId\) \{\s*return <div aria-hidden/.test(t),
      'o cartão do valor tem o atalho para a folha': (t) =>
        /ATALHO_DO_VALOR/.test(t) && /<EditarCombinadoSheet/.test(t),
      'quem já entrou não é travado (é o link de volta)': (t) => /!jaEntrou && criancaDoConvite && valorDaMensalidadeFalta/.test(t),
    },
  },
  contratoTela: {
    arquivo: 'src/pages/tio/TioContract.jsx',
    checagens: {
      'sem valor não há prévia nem impressão do contrato': (t) =>
        /if \(valorDaMensalidadeFalta\(child\)\) return null/.test(t) &&
        /const semValor = !mostrada && valorDaMensalidadeFalta\(child\)/.test(t) &&
        /\{!semValor && \(\s*<Button variant="secondary" icon=\{Printer\}/.test(t) &&
        /\{semValor \? null : dados \?/.test(t),
    },
  },
};

console.log('\n\x1b[1m2. As trancas existem no código\x1b[0m');
for (const { arquivo, checagens } of Object.values(PROVAS)) {
  const t = codigo(arquivo);
  for (const [nome, checar] of Object.entries(checagens)) {
    eq(`${arquivo}: ${nome}`, checar(t), true);
  }
}

console.log('\n\x1b[1m2b. Mutação dos arquivos: sem a trava, a prova reprova\x1b[0m');
/** Estragos que arrancam cada trava do TEXTO do arquivo. */
const ESTRAGOS = [
  ['servico', 'emitir recusa valor zero ANTES de montar o lote', (t) => t.replace('valorDoCampoFalta(dados?.finance?.monthlyFee)', 'false')],
  ['servico', 'garantirContrato não emite sem valor', (t) => t.replace('valorDaMensalidadeFalta(child)) return null', 'false) return null')],
  ['servico', 'salvarCombinado recusa antes de gravar ou emitir', (t) => t.replace('valorDaMensalidadeFalta({ ...child, ...novos })', 'false')],
  ['hook', 'a emissão automática usa a régua', (t) => t.replace('!valorDaMensalidadeFalta(child)', 'true')],
  ['formulario', 'o passo 4 exige o valor com a frase do catálogo', (t) => t.replace('valorDoCampoFalta(form.monthlyFee)', 'false')],
  ['formulario', '"Salvar e completar depois" continua, só nos passos antes do último', (t) => t.replace('canSaveEarly && step < TOTAL_STEPS', 'false')],
  ['folha', 'a folha exige o valor com a régua e a frase do catálogo', (t) => t.replace('valorDoCampoFalta(fee)', 'false')],
  ['cartao', 'o cartão tem o atalho que abre a folha do valor', (t) => t.replace('{faltaValor && (', '{false && (')],
  ['convite', 'o botão do convite NÃO é alcançável com valor zero', (t) => t.replace('return <FaltaOValor', 'return null; <FaltaOValor')],
  ['contratoTela', 'sem valor não há prévia nem impressão do contrato', (t) => t.replace('{!semValor && (', '{true && (')],
];
for (const [chave, nome, estragar] of ESTRAGOS) {
  const { arquivo, checagens } = PROVAS[chave];
  const t = codigo(arquivo);
  const estragado = estragar(t);
  eq(`o estrago existe em ${arquivo} (${nome})`, estragado !== t, true);
  eq(`  e a prova reprova sem a trava`, checagens[nome](estragado), false);
}

console.log('\n\x1b[1m3. Nenhum outro caminho escreve contrato ou combinado sem passar pela régua\x1b[0m');
function arquivosDe(dir) {
  return fs.readdirSync(path.join(raiz, dir), { withFileTypes: true }).flatMap((d) => {
    const rel = `${dir}/${d.name}`;
    if (d.isDirectory()) return d.name === 'node_modules' ? [] : arquivosDe(rel);
    return /\.(jsx?|mjs|cjs)$/.test(d.name) ? [rel] : [];
  });
}
const todos = arquivosDe('src');
const escrevemContratos = todos.filter((f) => /collection\(db, 'children', [^)]*'contratos'|doc\(db, 'children', [^)]*'contratos'/.test(codigo(f)));
eq('só o serviço de contratos toca a subcoleção (leitura ou escrita)',
  escrevemContratos.filter((f) => f !== 'src/services/contratosDaFamiliaService.js'), []);
const chamadores = todos.filter((f) => /\b(garantirContrato|salvarCombinado)\b/.test(codigo(f)) && f !== 'src/services/contratosDaFamiliaService.js');
eq('quem chama garantirContrato/salvarCombinado são exatamente estes', chamadores.sort(),
  ['src/components/contract/EditarCombinadoSheet.jsx', 'src/hooks/useGarantirContrato.js']);

console.log('\n\x1b[1m4. Os textos\x1b[0m');
eq('a frase de falta de valor, palavra por palavra', FALTA_O_VALOR,
  'Falta o valor da mensalidade. Sem ele, o contrato não pode ser emitido e a mensalidade não é gerada.');
eq('o erro do formulário', DIGA_O_VALOR, 'Diga o valor da mensalidade.');
eq('o atalho', ATALHO_DO_VALOR, 'Preencher o valor');
for (const [nome, texto] of [['FALTA_O_VALOR', FALTA_O_VALOR], ['DIGA_O_VALOR', DIGA_O_VALOR], ['ATALHO_DO_VALOR', ATALHO_DO_VALOR]]) {
  eq(`${nome} não promete segurança, preço nem cobrança`, promessaProibida(texto), null);
  eq(`${nome} não tem número solto nem "grátis"`, /\d|gr[áa]tis|automátic/i.test(texto), false);
}
eq('os textos antigos não voltam em src/',
  todos.filter((f) => /Valor precisa ser maior que zero|Escreva o valor da mensalidade|Sem valor, esta criança não entra/.test(codigo(f))), []);

console.log(`\n${falhou ? '\x1b[31m' : '\x1b[32m'}${ok} ok, ${falhou} falharam\x1b[0m\n`);
process.exit(falhou ? 1 : 0);
