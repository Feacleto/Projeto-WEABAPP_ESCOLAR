/**
 * LEITURA ANTES DE ESCRITA, EM TODA TRANSAÇÃO DO SERVIDOR.
 *
 * ── POR QUE ESTE ARQUIVO EXISTE
 * O Admin SDK do Firestore exige que TODAS as leituras de uma transação venham
 * antes de TODAS as escritas. Quando a ordem inverte, ele lança
 * `Firestore transactions require all reads to be executed before all writes.`
 *
 * Em 09/09/2026 uma auditoria achou isso em `redeemInvite`: `ligarRelogio` fazia
 * um `tx.get()` DEPOIS de um `tx.update(childRef, …)`. O erro era engolido por
 * um `catch` deliberadamente silencioso (o relógio do teste não pode impedir
 * um convite de ser resgatado), então:
 *
 *   - o convite era resgatado normalmente,
 *   - `trialInicio` NUNCA era gravado por aquele caminho,
 *   - dos "três gatilhos" que o CLAUDE.md descreve, só dois funcionavam,
 *   - e metade do buraco de graça ilimitada voltou, sem ninguém sentir nada.
 *
 * ── POR QUE ESTRUTURAL, E NÃO UM CASO
 * Testar o comportamento exigiria `firebase-admin`, que só existe em
 * `functions/node_modules` — e a CI instala apenas a raiz. Um teste que se pula
 * no CI é verde pelo motivo errado, que é justamente o defeito que este arquivo
 * persegue.
 *
 * Então a invariante é medida no TEXTO: dentro do corpo de cada
 * `runTransaction`, nenhuma leitura pode aparecer depois da primeira escrita.
 * Pega o caso que passou, e pega o próximo — inclusive num arquivo novo.
 *
 * ── O QUE CONTA COMO LEITURA
 * `tx.get(...)` e `tx.getAll(...)`, mais as funções auxiliares que fazem a
 * leitura por dentro. Essas últimas precisam ser declaradas em
 * `AUXILIARES_QUE_LEEM` — não há como o texto adivinhar, e é por isso que a
 * lista tem um comentário pedindo para ser mantida.
 *
 * COMO RODAR
 *   node scripts/testar-transacoes.mjs
 */

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const RAIZ = path.join(import.meta.dirname, '..', 'functions');

/**
 * Auxiliares que fazem `tx.get()` por dentro e, portanto, contam como LEITURA
 * no lugar onde são chamadas.
 *
 * ⚠️ MANTENHA ESTA LISTA. Função nova que receba `tx` e leia algo entra aqui,
 * senão este teste fica verde sobre o mesmo defeito de antes. A convenção que
 * evita o problema é a de `relogioDoTeste`: quem já está dentro de uma
 * transação com escritas recebe o SNAPSHOT, não a transação — e a função que
 * recebe snapshot não é `async`, o que torna a inversão difícil de escrever.
 */
const AUXILIARES_QUE_LEEM = ['ligarRelogio'];

const LEITURAS = [
  /\btx\.get\s*\(/g,
  /\btx\.getAll\s*\(/g,
  /\btransaction\.get\s*\(/g,
  ...AUXILIARES_QUE_LEEM.map((n) => new RegExp(`\\b${n}\\s*\\(`, 'g')),
];

const ESCRITAS = [
  /\btx\.set\s*\(/g,
  /\btx\.update\s*\(/g,
  /\btx\.delete\s*\(/g,
  /\btx\.create\s*\(/g,
  /\btransaction\.set\s*\(/g,
  /\btransaction\.update\s*\(/g,
  /\btransaction\.delete\s*\(/g,
];

let ok = 0;
let bad = 0;
const falhas = [];

function checar(nome, condicao, detalhe) {
  if (condicao) {
    ok += 1;
    console.log(`  ok   ${nome}`);
  } else {
    bad += 1;
    falhas.push(`${nome} — ${detalhe}`);
    console.log(`  FALHA ${nome}`);
    console.log(`        ${detalhe}`);
  }
}

/** Fatia o corpo do callback a partir do `{` que segue `runTransaction(`. */
function corpoDaTransacao(texto, inicio) {
  const abre = texto.indexOf('{', inicio);
  if (abre === -1) return null;
  let nivel = 0;
  for (let i = abre; i < texto.length; i += 1) {
    const c = texto[i];
    if (c === '{') nivel += 1;
    else if (c === '}') {
      nivel -= 1;
      if (nivel === 0) return { de: abre, ate: i, corpo: texto.slice(abre, i + 1) };
    }
  }
  return null;
}

function linhaDe(texto, indice) {
  return texto.slice(0, indice).split('\n').length;
}

/** Remove comentários e strings, pra citação em comentário não virar achado. */
function semComentariosNemStrings(corpo) {
  return corpo
    .replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length))
    .replace(/`(?:\\.|[^`\\])*`/g, (m) => ' '.repeat(m.length))
    .replace(/'(?:\\.|[^'\\])*'/g, (m) => ' '.repeat(m.length))
    .replace(/"(?:\\.|[^"\\])*"/g, (m) => ' '.repeat(m.length));
}

function primeiroDe(corpo, padroes) {
  let menor = Infinity;
  let qual = null;
  for (const re of padroes) {
    re.lastIndex = 0;
    const m = re.exec(corpo);
    if (m && m.index < menor) {
      menor = m.index;
      qual = m[0];
    }
  }
  return qual ? { indice: menor, texto: qual } : null;
}

function ultimoDe(corpo, padroes) {
  let maior = -1;
  let qual = null;
  for (const re of padroes) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(corpo)) !== null) {
      if (m.index > maior) {
        maior = m.index;
        qual = m[0];
      }
    }
  }
  return qual ? { indice: maior, texto: qual } : null;
}

async function arquivosDoServidor() {
  const lista = [path.join(RAIZ, 'index.js')];
  const libs = await readdir(path.join(RAIZ, 'lib'));
  for (const f of libs) {
    if (f.endsWith('.js')) lista.push(path.join(RAIZ, 'lib', f));
  }
  return lista;
}

console.log('\n═══ LEITURA ANTES DE ESCRITA, EM TODA TRANSAÇÃO ═══\n');

const arquivos = await arquivosDoServidor();
let transacoes = 0;

for (const arquivo of arquivos) {
  const texto = await readFile(arquivo, 'utf8');
  const rel = path.relative(path.join(RAIZ, '..'), arquivo).replace(/\\/g, '/');

  const re = /runTransaction\s*\(/g;
  let m;
  while ((m = re.exec(texto)) !== null) {
    const bloco = corpoDaTransacao(texto, m.index);
    if (!bloco) continue;
    transacoes += 1;

    const linha = linhaDe(texto, m.index);
    const limpo = semComentariosNemStrings(bloco.corpo);

    const ultimaLeitura = ultimoDe(limpo, LEITURAS);
    const primeiraEscrita = primeiroDe(limpo, ESCRITAS);

    const nome = `${rel}:${linha}`;

    if (!ultimaLeitura || !primeiraEscrita) {
      // Transação só de leitura, ou só de escrita: não há ordem a violar.
      checar(`${nome} (sem par leitura/escrita)`, true, '');
      continue;
    }

    const ordemOk = ultimaLeitura.indice < primeiraEscrita.indice;
    const linhaLeitura = linha + limpo.slice(0, ultimaLeitura.indice).split('\n').length - 1;
    const linhaEscrita = linha + limpo.slice(0, primeiraEscrita.indice).split('\n').length - 1;

    checar(
      nome,
      ordemOk,
      `\`${ultimaLeitura.texto}\` na linha ~${linhaLeitura} vem DEPOIS de ` +
        `\`${primeiraEscrita.texto}\` na linha ~${linhaEscrita}. ` +
        'O Admin SDK lança nesse caso. Se um `catch` engolir, o efeito é ' +
        'silencioso — foi assim que o gatilho do relógio do teste ficou morto.'
    );
  }
}

// SONDA POSITIVA — sem ela, este arquivo fica verde no dia em que o casamento
// dos padrões parar de funcionar (um `await db.runTransaction` renomeado, por
// exemplo) e nenhuma transação for encontrada.
checar(
  'o teste encontrou transação para medir',
  transacoes > 0,
  'nenhum `runTransaction` foi localizado — o padrão de busca quebrou, e este ' +
    'arquivo passaria a aprovar qualquer coisa'
);

// E uma sonda que prova que o detector DETECTA: código inventado, com a ordem
// invertida, tem que reprovar. Sem isto, um bug nos regex deixa tudo verde.
{
  const invertido = `{
    tx.update(ref, { a: 1 });
    const snap = await tx.get(outro);
    return snap.exists;
  }`;
  const limpo = semComentariosNemStrings(invertido);
  const leitura = ultimoDe(limpo, LEITURAS);
  const escrita = primeiroDe(limpo, ESCRITAS);
  checar(
    'o detector reprova uma ordem invertida de propósito',
    leitura && escrita && leitura.indice > escrita.indice,
    'o detector não viu a inversão num exemplo montado para ser inválido'
  );
}

console.log('\n════════════════════════════════════════════════════════════════');
console.log(`  ${ok} passaram, ${bad} falharam`);
console.log('════════════════════════════════════════════════════════════════\n');

if (bad > 0) {
  console.error('FALHAS:');
  for (const f of falhas) console.error('  - ' + f);
  process.exit(1);
}
