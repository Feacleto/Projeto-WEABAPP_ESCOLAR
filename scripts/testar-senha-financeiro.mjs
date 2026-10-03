/**
 * A SENHA DO FINANCEIRO — o teclado de banco e o espelho do servidor
 * (03/10/2026).
 *
 * A régua existe duas vezes: `src/dominio/identidade/tecladoDeBanco.js` (a
 * tela) e `functions/lib/reguaDaSenhaDoFinanceiro.js` (quem confere). O
 * deploy das functions não alcança `src/`, então duplicar só é aceitável com
 * esta comparação caso a caso — as 10 mil senhas, cada uma contra pares
 * gerados pelo próprio teclado.
 *
 * Também trava as 16 candidatas (o servidor guarda só o hash e testa as
 * senhas que os pares descrevem), o limite de tentativas e o login recente
 * do "esqueci a senha".
 *
 * Rode: npm run testar:senha-financeiro
 */
import { readFileSync } from 'node:fs';
import * as CLIENTE from '../src/dominio/identidade/tecladoDeBanco.js';
import SERVIDOR from '../functions/lib/reguaDaSenhaDoFinanceiro.js';

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
const bloco = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);
const ler = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** Sorteio reproduzível (mulberry32). */
function semente(s) {
  let a = s >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TODAS = Array.from({ length: 10000 }, (_, i) => String(i).padStart(4, '0'));

/** Os pares que quem sabe a senha tocaria neste teclado. */
function paresTocados(senha, teclado) {
  return [...senha].map((d) => teclado.find((par) => par.includes(Number(d))));
}

bloco('1 · AS CONSTANTES BATEM');
checar('4 dígitos dos dois lados', CLIENTE.DIGITOS_DA_SENHA, SERVIDOR.DIGITOS_DA_SENHA);

bloco('2 · AS 10 MIL SENHAS: FORMATO E SENHA FÁCIL, CLIENTE × SERVIDOR');
{
  let divergeFormato = 0;
  let divergeFacil = 0;
  let faceis = 0;
  for (const s of TODAS) {
    if (CLIENTE.formatoValido(s) !== SERVIDOR.formatoValido(s)) divergeFormato += 1;
    if (CLIENTE.senhaFacil(s) !== SERVIDOR.senhaFacil(s)) divergeFacil += 1;
    if (SERVIDOR.senhaFacil(s)) faceis += 1;
  }
  checar('formato: nenhuma divergência', 0, divergeFormato);
  checar('senha fácil: nenhuma divergência', 0, divergeFacil);
  // 10 repetidas + 7 crescentes (0123..6789) + 7 decrescentes (9876..3210)
  checar('são 24 as senhas fáceis', 24, faceis);
}
for (const s of ['1111', '0000', '1234', '4321', '0123', '6789', '9876', '3210']) {
  checar(`"${s}" é fácil`, true, SERVIDOR.senhaFacil(s));
}
for (const s of ['1357', '2580', '1235', '9870', '0912', '1122']) {
  checar(`"${s}" não é fácil`, false, SERVIDOR.senhaFacil(s));
}

bloco('3 · FORMATO MALFORMADO');
for (const v of ['123', '12345', '12a4', ' 1234', '1234 ', '', null, undefined, 1234, ['1', '2', '3', '4'], '١٢٣٤']) {
  checar(`${JSON.stringify(v)} recusado nos dois`, [false, false],
    [CLIENTE.formatoValido(v), SERVIDOR.formatoValido(v)]);
}
checar('malformada conta como fácil (nunca é aceita na criação)', true, SERVIDOR.senhaFacil('12'));

bloco('4 · PARES MALFORMADOS');
const PARES_RUINS = [
  null,
  [],
  [[1, 2], [3, 4], [5, 6]],
  [[1, 2], [3, 4], [5, 6], [7, 8], [9, 0]],
  [[1, 1], [3, 4], [5, 6], [7, 8]],
  [[1, 10], [3, 4], [5, 6], [7, 8]],
  [[-1, 2], [3, 4], [5, 6], [7, 8]],
  [[1.5, 2], [3, 4], [5, 6], [7, 8]],
  [['1', '2'], [3, 4], [5, 6], [7, 8]],
  [[1, 2, 3], [3, 4], [5, 6], [7, 8]],
  [[1], [3, 4], [5, 6], [7, 8]],
  '1234',
  [[1, 2], null, [5, 6], [7, 8]],
];
for (const p of PARES_RUINS) {
  checar(`${JSON.stringify(p)}: recusado e sem candidatas`,
    [false, false, []],
    [CLIENTE.conferePares('1357', p), SERVIDOR.conferePares('1357', p), SERVIDOR.candidatasDosPares(p)]);
}

bloco('5 · CONFERIR PARES: AS 10 MIL SENHAS × TECLADOS SORTEADOS');
{
  const rnd = semente(20261003);
  let diverge = 0;
  let acertoRecusado = 0;
  let erroAceito = 0;
  let candidataSemSenha = 0;
  let candidatasErradas = 0;
  for (const senha of TODAS) {
    for (let k = 0; k < 3; k += 1) {
      const teclado = CLIENTE.embaralharPares(rnd);
      const certos = paresTocados(senha, teclado);
      // Errado: troca o primeiro par por outro que não contém o 1º dígito.
      const outro = teclado.find((par) => !par.includes(Number(senha[0])));
      const errados = [outro, ...certos.slice(1)];

      for (const p of [certos, errados]) {
        if (CLIENTE.conferePares(senha, p) !== SERVIDOR.conferePares(senha, p)) diverge += 1;
      }
      if (!SERVIDOR.conferePares(senha, certos)) acertoRecusado += 1;
      if (SERVIDOR.conferePares(senha, errados)) erroAceito += 1;

      const cand = SERVIDOR.candidatasDosPares(certos);
      if (!cand.includes(senha)) candidataSemSenha += 1;
      if (cand.length !== 16 || new Set(cand).size !== 16 || !cand.every((c) => SERVIDOR.conferePares(c, certos))) {
        candidatasErradas += 1;
      }
    }
  }
  checar('30 mil teclados: cliente e servidor nunca divergem', 0, diverge);
  checar('quem sabe a senha sempre passa', 0, acertoRecusado);
  checar('par errado nunca passa', 0, erroAceito);
  checar('a senha está sempre entre as candidatas', 0, candidataSemSenha);
  checar('são sempre 16 candidatas distintas, todas compatíveis', 0, candidatasErradas);
}

bloco('6 · AS 16 CANDIDATAS SÃO EXATAMENTE AS SENHAS COMPATÍVEIS');
{
  const rnd = semente(7);
  let divergencias = 0;
  for (let k = 0; k < 25; k += 1) {
    const teclado = CLIENTE.embaralharPares(rnd);
    const pares = [0, 1, 2, 3].map(() => teclado[Math.floor(rnd() * 5)]);
    const cand = new Set(SERVIDOR.candidatasDosPares(pares));
    for (const s of TODAS) {
      if (cand.has(s) !== SERVIDOR.conferePares(s, pares)) divergencias += 1;
    }
  }
  checar('25 jogos de pares contra as 10 mil senhas: nenhuma sobra nem falta', 0, divergencias);
  checar('ordem determinística', ['1357', '1358', '1367', '1368'],
    SERVIDOR.candidatasDosPares([[1, 2], [3, 4], [5, 6], [7, 8]]).slice(0, 4));
}

bloco('7 · O TECLADO');
{
  const rnd = semente(42);
  let ruins = 0;
  for (let k = 0; k < 2000; k += 1) {
    const t = CLIENTE.embaralharPares(rnd);
    const todos = t.flat().sort((a, b) => a - b);
    if (t.length !== 5 || JSON.stringify(todos) !== JSON.stringify([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
      || !t.every(SERVIDOR.parValido) || !t.every(([a, b]) => a < b)) ruins += 1;
  }
  checar('2000 teclados: cinco pares, os dez números uma vez, crescentes', 0, ruins);
  checar('mesma semente, mesmo teclado', CLIENTE.embaralharPares(semente(1)), CLIENTE.embaralharPares(semente(1)));
}

bloco('8 · AS TENTATIVAS');
{
  const T0 = 1_000_000;
  let e = { erros: 0, bloqueadoAteMs: null };
  const restam = [];
  for (let i = 0; i < 5; i += 1) {
    e = SERVIDOR.depoisDoErro({ ...e, agoraMs: T0 });
    restam.push(e.restam);
  }
  checar('cinco erros: restam 4, 3, 2, 1, 0', [4, 3, 2, 1, 0], restam);
  checar('o quinto tranca por 60 s', T0 + 60_000, e.bloqueadoAteMs);
  checar('trancado aos 59 s', true, SERVIDOR.trancado({ bloqueadoAteMs: e.bloqueadoAteMs, agoraMs: T0 + 59_999 }));
  checar('livre aos 60 s', false, SERVIDOR.trancado({ bloqueadoAteMs: e.bloqueadoAteMs, agoraMs: T0 + 60_000 }));
  const depois = SERVIDOR.depoisDoErro({ ...e, agoraMs: T0 + 61_000 });
  checar('quem esperou o minuto recomeça com cinco (o erro seguinte deixa 4)', 4, depois.restam);
  checar('nunca trancou: livre', false, SERVIDOR.trancado({ bloqueadoAteMs: null, agoraMs: T0 }));
  checar('contador sujo (texto) conta como zero', 4,
    SERVIDOR.depoisDoErro({ erros: 'x', bloqueadoAteMs: null, agoraMs: T0 }).restam);
  checar('MAX_ERROS é 5', 5, SERVIDOR.MAX_ERROS);
}

bloco('9 · O LOGIN RECENTE DO "ESQUECI A SENHA"');
{
  const agoraMs = Date.parse('2026-10-03T10:00:00Z');
  const seg = (ms) => Math.floor(ms / 1000);
  checar('entrou há 1 min: pode trocar', true, SERVIDOR.loginRecente({ authTimeSeg: seg(agoraMs - 60_000), agoraMs }));
  checar('entrou há 4 min 59 s: pode', true, SERVIDOR.loginRecente({ authTimeSeg: seg(agoraMs - 299_000), agoraMs }));
  checar('entrou há 6 min: não pode', false, SERVIDOR.loginRecente({ authTimeSeg: seg(agoraMs - 360_000), agoraMs }));
  checar('entrou ontem: não pode', false, SERVIDOR.loginRecente({ authTimeSeg: seg(agoraMs - 86_400_000), agoraMs }));
  checar('sem auth_time: não pode', false, SERVIDOR.loginRecente({ authTimeSeg: undefined, agoraMs }));
  checar('auth_time no futuro distante: não pode', false, SERVIDOR.loginRecente({ authTimeSeg: seg(agoraMs + 3_600_000), agoraMs }));
}

bloco('10 · O QUE O SERVIDOR NÃO PODE FAZER (leitura de arquivo)');
{
  const callable = ler('functions/lib/senhaDoFinanceiro.js');
  const regua = ler('functions/lib/reguaDaSenhaDoFinanceiro.js');
  const codigo = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  checar('a régua não requer nada', false, /require\s*\(/.test(codigo(regua)));
  checar('compara com timingSafeEqual', true, /timingSafeEqual/.test(codigo(callable)));
  checar('usa scrypt', true, /crypto\.scrypt\(/.test(codigo(callable)));
  checar('não sai do laço na primeira que bate (sem break/return dentro do for)', false,
    /for \(const candidata[\s\S]*?\{[^}]*\b(break|return)\b[^}]*\}/.test(codigo(callable)));
  checar('nunca grava o campo `senha`', false, /\bsenha\s*:/.test(codigo(callable)));
  checar('o escopo é o uid de exigirMotorista, não do payload', false,
    /request\.data\??\.uid/.test(codigo(callable)));
  // Sonda positiva do detector de laço: o código errado tem que ser pego.
  checar('sonda: o detector pegaria um `break` no laço', true,
    /for \(const candidata[\s\S]*?\{[^}]*\b(break|return)\b[^}]*\}/.test(
      'for (const candidata of lista) { if (x) break; }'));
  const rules = ler('firestore.rules');
  checar('as rules fecham senhasDoFinanceiro', true,
    /match \/senhasDoFinanceiro\/\{uid\} \{\s*allow read, write: if false;/.test(rules));
}

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
