/**
 * Quem entrou e quem saiu da turma — Node puro, como o resto de scripts/.
 * Rodar: npm run testar:turma
 *
 * POR QUE ISTO EXISTE
 * "Turma e contratos" diz, mês a mês, quem entrou e quem saiu. A saída só tem
 * data desde outubro de 2026 (`children.inativadoEm`); antes disso a tela não
 * pode afirmar "0 saíram" — ela não sabe. O teste trava as duas metades:
 * a conta do mês e a honestidade sobre o mês sem dado.
 */
import {
  INICIO_DAS_SAIDAS,
  frasesDoMovimento,
  mesDe,
  mesesAte,
  movimentoDaTurma,
  resumoDaTurma,
} from '../src/dominio/identidade/movimentoDaTurma.js';
import {
  linkDoLembreteDoContrato,
  mensagemDoLembreteDoContrato,
} from '../src/marca/lembreteDoContrato.js';
import { readFileSync } from 'node:fs';

let ok = 0;
let bad = 0;
function igual(nome, obtido, esperado) {
  if (JSON.stringify(obtido) === JSON.stringify(esperado)) ok++;
  else {
    bad++;
    console.log(`  FALHOU ${nome}\n    esperado: ${JSON.stringify(esperado)}\n    obtido:   ${JSON.stringify(obtido)}`);
  }
}

const ts = (a, m, d) => ({ toDate: () => new Date(a, m - 1, d, 12) });

console.log('\n1. os meses');
igual('seis para trás', mesesAte('2026-10', 6), ['2026-10', '2026-09', '2026-08', '2026-07', '2026-06', '2026-05']);
igual('vira o ano', mesesAte('2026-02', 3), ['2026-02', '2026-01', '2025-12']);
igual('mês de Timestamp', mesDe(ts(2026, 10, 3)), '2026-10');
igual('mês de nada', mesDe(null), null);
igual('saídas contadas desde', INICIO_DAS_SAIDAS, '2026-10');

console.log('2. entradas e saídas');
const criancas = [
  { name: 'Lucas', active: true, createdAt: ts(2026, 10, 2) },
  { name: 'Helena', active: true, createdAt: ts(2026, 10, 1) },
  { name: 'Bruno', active: false, createdAt: ts(2026, 3, 1), inativadoEm: ts(2026, 10, 2) },
  { name: 'Júlia', active: true, createdAt: ts(2026, 9, 15) },
  { name: 'Rafael', active: false, createdAt: ts(2026, 2, 1) },
  { name: '', active: true, createdAt: ts(2026, 8, 5) },
  { name: 'Ana', active: true },
];
const mov = movimentoDaTurma({ criancas, mesAtual: '2026-10', meses: 4 });
igual('outubro', mov[0], { mes: '2026-10', entraram: ['Helena', 'Lucas'], sairam: ['Bruno'], saidasContadas: true });
igual('setembro: sem dado de saída', mov[1], { mes: '2026-09', entraram: ['Júlia'], sairam: [], saidasContadas: false });
igual('sem nome não some', mov[2].entraram, ['Sem nome']);
igual('mês vazio', mov[3], { mes: '2026-07', entraram: [], sairam: [], saidasContadas: false });
igual('saiu sem data não aparece em mês nenhum', mov.some((m) => m.sairam.includes('Rafael')), false);

console.log('3. o resumo da porta');
igual('outubro', resumoDaTurma({ criancas, mes: '2026-10' }), { ativas: 5, entraram: 2, sairam: 1 });
igual('mês sem dado de saída: null, nunca 0', resumoDaTurma({ criancas, mes: '2026-09' }), { ativas: 5, entraram: 1, sairam: null });
igual('turma vazia', resumoDaTurma({ criancas: [], mes: '2026-10' }), { ativas: 0, entraram: 0, sairam: 0 });

console.log('4. as frases');
igual('singular', frasesDoMovimento({ entraram: 1, sairam: 1 }), { entraram: '1 entrou', sairam: '1 saiu' });
igual('plural', frasesDoMovimento({ entraram: 2, sairam: 3 }), { entraram: '2 entraram', sairam: '3 saíram' });
igual('zero', frasesDoMovimento({ entraram: 0, sairam: 0 }), { entraram: '0 entraram', sairam: '0 saíram' });
igual('saída sem dado não vira frase', frasesDoMovimento({ entraram: 2, sairam: null }), { entraram: '2 entraram', sairam: null });

console.log('5. o lembrete do contrato (item 18)');
{
  const m = mensagemDoLembreteDoContrato({ responsavel: 'Ana Paula Souza', crianca: 'Laura Souza', assinatura: 'Tio Nino' });
  igual('frase de quem já entrou', m,
    'Oi, Ana! O contrato do transporte de Laura está esperando a sua assinatura no app Alô Buzinou. É só abrir o app e assinar. Obrigado! Tio Nino');
  const comLink = mensagemDoLembreteDoContrato({ responsavel: 'Ana', crianca: 'Laura', linkDoConvite: 'https://alobuzinou.com/convite/TNAB23CD' });
  igual('quem não entrou recebe o link do convite', comLink.includes('https://alobuzinou.com/convite/TNAB23CD'), true);
  igual('sem nome, ainda é uma frase', mensagemDoLembreteDoContrato({}).startsWith('Oi! O contrato do transporte está esperando'), true);
  for (const proibida of ['aditivo', 'versão', 'o que muda', 'mudança']) {
    igual(`a família não lê "${proibida}"`, (m + comLink).toLowerCase().includes(proibida), false);
  }
  const link = linkDoLembreteDoContrato({ telefone: '(11) 98765-4321', responsavel: 'Ana', crianca: 'Laura', familiaEntrou: true });
  igual('link do WhatsApp com 55 na frente', link.startsWith('https://wa.me/5511987654321?text='), true);
  igual('a frase vai no link', decodeURIComponent(link.split('text=')[1]).includes('esperando a sua assinatura'), true);
  igual('telefone que já veio com 55 não ganha outro',
    linkDoLembreteDoContrato({ telefone: '+55 11 98765-4321', familiaEntrou: true }).startsWith('https://wa.me/5511987654321?'), true);
  igual('sem telefone, sem botão', linkDoLembreteDoContrato({ telefone: '', familiaEntrou: true }), null);
  igual('telefone curto, sem botão', linkDoLembreteDoContrato({ telefone: '98765', familiaEntrou: true }), null);
  igual('nem conta nem convite: nada a lembrar', linkDoLembreteDoContrato({ telefone: '11987654321' }), null);
  const entrouComConvite = linkDoLembreteDoContrato({ telefone: '11987654321', familiaEntrou: true, linkDoConvite: 'https://x/convite/A' });
  igual('quem já entrou não recebe convite', decodeURIComponent(entrouComConvite).includes('/convite/'), false);

  // A tela usa o lembrete, e ele é o verde da linha — "Cadastrar" desceu.
  const tela = readFileSync(new URL('../src/pages/tio/TioTurma.jsx', import.meta.url), 'utf8');
  igual('TioTurma usa linkDoLembreteDoContrato', tela.includes('linkDoLembreteDoContrato('), true);
  igual('TioTurma diz "Lembrar a família no WhatsApp"', tela.includes('Lembrar a família no WhatsApp'), true);
  igual('"Cadastrar nova criança" é secundário',
    /<Button variant="secondary" icon=\{Plus\}[^\n]*\n\s*Cadastrar nova criança/.test(tela.replace(/\r/g, '')), true);
}

console.log(`\n${ok} ok, ${bad} falharam`);
process.exit(bad ? 1 : 0);
