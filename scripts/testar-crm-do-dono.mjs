/**
 * O CRM DO DONO — a coluna de cada motorista e o "retomar hoje".
 *
 * POR QUE ESTE TESTE
 * Um quadro errado não dá erro: ele põe o motorista na coluna que não é a
 * dele e o dono liga para quem está bem, ou deixa de ligar para quem está de
 * saída. A ordem das regras é a parte frágil.
 *
 * COMO RODAR
 *   node scripts/testar-crm-do-dono.mjs
 */

import { createRequire } from 'node:module';
import {
  CANAIS,
  agruparCorrecoes,
  colunaDo,
  contatosPorMotorista,
  erroDoContato,
  hojeEmBrasilia,
  montarQuadro,
  retomarHoje,
  situacaoDoRetomar,
} from '../src/dominio/associacao/crmDoDono.js';

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
function bloco(t) {
  console.log(`\n${t}`);
}

const dia = (iso) => new Date(`${iso}T12:00:00`);
const HOJE = dia('2026-09-15');
const col = (motorista, extra = {}) => colunaDo({ motorista, agora: HOJE, ...extra });

bloco('1. A coluna de cada motorista');
checar('sem rota nenhuma: cadastrou', 'cadastrou', col({ uid: 'a' }));
checar('suspenso vence tudo', 'suspenso', col({ suspenso: true, trialInicio: dia('2026-09-10'), ultimaRota: dia('2026-09-14') }));
checar('rodou ontem, sem plano: rodando', 'rodando', col({ trialInicio: dia('2026-09-10'), ultimaRota: dia('2026-09-14') }));
checar('parado há 7 dias depois de rodar: risco', 'risco', col({ trialInicio: dia('2026-09-01'), ultimaRota: dia('2026-09-08') }));
checar('parado há 6 dias ainda não é risco', 'rodando', col({ trialInicio: dia('2026-09-01'), ultimaRota: dia('2026-09-09') }));
checar('plano válido e rodando: assinante', 'assinante', col({ plano: 'mensal', trialInicio: dia('2026-06-01'), assinaturaAte: dia('2026-10-30'), ultimaRota: dia('2026-09-14') }));
checar('assinante parado: risco', 'risco', col({ plano: 'mensal', trialInicio: dia('2026-06-01'), assinaturaAte: dia('2026-10-30'), ultimaRota: dia('2026-09-01') }));
checar('teste vencido sem plano (bloqueado, não suspenso): risco', 'risco', col({ trialInicio: dia('2026-01-01'), ultimaRota: dia('2026-09-14') }));
checar('fatura vencida de assinante: risco', 'risco', col(
  { plano: 'mensal', trialInicio: dia('2026-06-01'), assinaturaAte: dia('2026-10-30'), ultimaRota: dia('2026-09-14') },
  { faturas: [{ status: 'aberta', mes: '2026-09', vencimento: dia('2026-09-10') }] }
));
checar('entrada vazia não quebra', 'cadastrou', colunaDo());

bloco('2. Datas e retomar');
checar('hoje em Brasília, meia-noite UTC ainda é ontem', '2026-09-14', hojeEmBrasilia(new Date('2026-09-15T01:00:00Z')));
checar('data passada: atrasado', 'atrasado', situacaoDoRetomar('2026-09-14', HOJE));
checar('hoje', 'hoje', situacaoDoRetomar('2026-09-15', HOJE));
checar('futuro: nada', null, situacaoDoRetomar('2026-09-16', HOJE));
checar('sem data: nada', null, situacaoDoRetomar(null, HOJE));

bloco('3. Histórico por motorista');
const contatos = [
  { motoristaUid: 'a', canal: 'whatsapp', texto: 'velho', retomarEm: '2026-09-10', em: dia('2026-09-01') },
  { motoristaUid: 'a', canal: 'ligacao', texto: 'novo', retomarEm: '2026-09-20', em: dia('2026-09-12') },
  { motoristaUid: 'b', canal: 'email', texto: 'x', retomarEm: '2026-09-15', em: dia('2026-09-05') },
  { motoristaUid: 'b', canal: 'presencial', texto: 'sem data', retomarEm: null, em: dia('2026-09-06') },
  { motoristaUid: 'c', canal: 'email', texto: 'y', retomarEm: '2026-09-01', em: dia('2026-09-02') },
];
const por = contatosPorMotorista(contatos);
checar('o último contato é o mais novo', 'novo', por.a.ultimo.texto);
checar('retomar novo substitui o antigo', '2026-09-20', por.a.retomarEm);
checar('contato sem data não cancela o retomar', '2026-09-15', por.b.retomarEm);
checar('retomar hoje: b (hoje) e c (atrasado), a não', 2, retomarHoje(contatos, HOJE));
checar('sem contatos: zero', 0, retomarHoje([], HOJE));
checar('lista inválida não quebra', 0, retomarHoje(null, HOJE));

bloco('4. O quadro');
const parceiros = [
  { uid: 'a', name: 'Ana' },
  { uid: 'b', marcaNome: 'Tio Beto', trialInicio: dia('2026-09-10'), ultimaRota: dia('2026-09-14') },
  { uid: 'c', name: 'Cris', suspenso: true },
];
const q = montarQuadro({ parceiros, contatos, agora: HOJE });
checar('uma coluna por motorista', 3, Object.values(q.colunas).flat().length);
checar('a em cadastrou, b em rodando, c em suspenso', [['a'], ['b'], ['c']],
  [q.colunas.cadastrou, q.colunas.rodando, q.colunas.suspenso].map((l) => l.map((x) => x.uid)));
checar('para retomar hoje conta só quem está no quadro (b e c)', 2, q.retomarHoje);
checar('marca vence o nome civil', 'Tio Beto', q.colunas.rodando[0].nome);
checar('cartão traz a situação do retomar', 'hoje', q.colunas.rodando[0].situacao);
checar('o cartão não carrega telefone nem e-mail', false,
  Object.values(montarQuadro({ parceiros: [{ uid: 'z', name: 'Zé', phone: '1', email: 'a@b' }], agora: HOJE }).colunas)
    .flat().some((c) => 'phone' in c || 'email' in c));
checar('quem pede conversa hoje vem primeiro na coluna', ['y', 'x'],
  montarQuadro({
    parceiros: [
      { uid: 'x', name: 'X', createdAt: dia('2026-01-01') },
      { uid: 'y', name: 'Y', createdAt: dia('2026-09-14') },
    ],
    contatos: [{ motoristaUid: 'y', canal: 'email', texto: 't', retomarEm: '2026-09-15', em: dia('2026-09-14') }],
    agora: HOJE,
  }).colunas.cadastrou.map((c) => c.uid));

bloco('5. O que a folha pode gravar');
const base = { motoristaUid: 'a', canal: 'whatsapp', texto: 'oi', retomarEm: null };
checar('quatro canais', ['whatsapp', 'ligacao', 'email', 'presencial'], CANAIS.map((c) => c.id));
checar('contato completo passa', null, erroDoContato(base));
checar('sem motorista', 'Escolha o motorista.', erroDoContato({ ...base, motoristaUid: '' }));
checar('canal fora da lista', 'Escolha o canal.', erroDoContato({ ...base, canal: 'sms' }));
checar('texto vazio', 'Escreva o que foi combinado.', erroDoContato({ ...base, texto: '   ' }));
checar('1000 letras passa', null, erroDoContato({ ...base, texto: 'a'.repeat(1000) }));
checar('1001 letras não passa', true, erroDoContato({ ...base, texto: 'a'.repeat(1001) }) !== null);
checar('data errada', true, erroDoContato({ ...base, retomarEm: '15/09/2026' }) !== null);
checar('data certa', null, erroDoContato({ ...base, retomarEm: '2026-09-20' }));

bloco('6. Correção (append-only)');
const hist = [
  { id: '3', motoristaUid: 'a', texto: 'certo', corrige: '1' },
  { id: '2', motoristaUid: 'a', texto: 'outro' },
  { id: '1', motoristaUid: 'a', texto: 'errado' },
  { id: '9', motoristaUid: 'a', texto: 'alvo fora', corrige: '404' },
];
const g = agruparCorrecoes(hist);
checar('correção sai da lista principal', ['2', '1', '9'], g.map((c) => c.id));
checar('correção fica sob a anotação', ['3'], g.find((c) => c.id === '1').correcoes.map((c) => c.id));
checar('alvo ausente: aparece sozinha', [], g.find((c) => c.id === '9').correcoes);

bloco('7. Prazo de 5 anos (reguaDosContatos)');
const R = createRequire(import.meta.url)('../functions/lib/reguaDosContatos.js');
const AG = new Date('2026-10-05T12:00:00Z');
const c1 = { em: new Date('2020-01-01') };
const c2 = { em: new Date('2025-01-01') };
checar('sem documento, contato de 6 anos: sai', true, R.deveSair({ contato: c1, motorista: null, agora: AG }));
checar('sem documento, contato recente: fica', false, R.deveSair({ contato: c2, motorista: null, agora: AG }));
checar('sem em: fica', false, R.deveSair({ contato: {}, motorista: null, agora: AG }));
checar('conta ativa: fica', false, R.deveSair({ contato: c1, motorista: { assinaturaAte: new Date('2019-01-01') }, agora: AG }));
checar('encerrou há 6 anos: sai', true, R.deveSair({ contato: c2, motorista: { renovacaoAutomatica: false, assinaturaAte: new Date('2020-06-01') }, agora: AG }));
checar('encerrou há 2 anos: fica', false, R.deveSair({ contato: c1, motorista: { renovacaoAutomatica: false, assinaturaAte: new Date('2024-10-01') }, agora: AG }));
checar('encerrou sem data: fica', false, R.deveSair({ contato: c1, motorista: { renovacaoAutomatica: false }, agora: AG }));
checar('Timestamp do Firestore', true, R.deveSair({ contato: c2, motorista: { renovacaoAutomatica: false, assinaturaAte: { toDate: () => new Date('2019-01-01') } }, agora: AG }));

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
