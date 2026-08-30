/**
 * Testes do aviso do responsável — Node puro, como o resto de scripts/.
 * Rodar: node scripts/testar-aviso.mjs
 *
 * Lógica de RELÓGIO é onde o erro não aparece: a tela parece certa às 10h da
 * manhã em que se está programando, e mente às 6h40 de uma terça. Aqui a hora
 * é injetada, então todo caso é reprodutível.
 */
import { avisoDoMomento } from '../src/utils/avisoDoMomento.js';

let ok = 0, falhou = 0;
const eq = (nome, a, b) => {
  const bateu = JSON.stringify(a) === JSON.stringify(b);
  bateu ? ok++ : falhou++;
  console.log(`  ${bateu ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${nome}` +
    (bateu ? '' : `\n      esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`));
};

// Criança com horário DEFINIDO pelo motorista: pega 06:20, entrega 12:35.
const crianca = { horaPega: '06:20', horaEntrega: '12:35' };
const semRota = { kind: 'no-route' };
const emRota = { kind: 'moving' };
const as = (h, m) => new Date(2026, 7, 27, h, m); // quinta-feira

const nivel = (r) => r?.nivel ?? null;

console.log('\n\x1b[1m1. Rota não iniciada — só depois da hora de pegar\x1b[0m');
eq('05:00, muito antes', nivel(avisoDoMomento({
  child: crianca, status: 'home', presence: semRota, agora: as(5, 0) })), null);
eq('06:20, na hora exata', nivel(avisoDoMomento({
  child: crianca, status: 'home', presence: semRota, agora: as(6, 20) })), null);
eq('06:25, dentro da folga de 10min', nivel(avisoDoMomento({
  child: crianca, status: 'home', presence: semRota, agora: as(6, 25) })), null);
eq('06:35, passou da folga', nivel(avisoDoMomento({
  child: crianca, status: 'home', presence: semRota, agora: as(6, 35) })), 'atencao');
eq('com a rota rodando, nunca avisa', nivel(avisoDoMomento({
  child: crianca, status: 'home', presence: emRota, agora: as(7, 30) })), null);

console.log('\n\x1b[1m2. Na perua muito depois da hora de chegar\x1b[0m');
eq('12:30, antes da entrega', nivel(avisoDoMomento({
  child: crianca, status: 'onboard', presence: emRota, agora: as(12, 30) })), null);
eq('12:50, dentro da folga de 20min', nivel(avisoDoMomento({
  child: crianca, status: 'onboard', presence: emRota, agora: as(12, 50) })), null);
eq('13:05, passou da folga', nivel(avisoDoMomento({
  child: crianca, status: 'onboard', presence: emRota, agora: as(13, 5) })), 'grave');
eq('já entregue, nunca avisa', nivel(avisoDoMomento({
  child: crianca, status: 'delivered', presence: emRota, agora: as(14, 0) })), null);

console.log('\n\x1b[1m3. O que SEMPRE cala o aviso\x1b[0m');
// Falta declarada: ela sabe que a criança não vai. Avisar seria alarmar
// sobre uma ausência que a própria pessoa criou.
eq('falta declarada', nivel(avisoDoMomento({
  child: crianca, status: 'home', presence: semRota, absence: { type: 'full' },
  agora: as(8, 0) })), null);
// Horário presumido é chute do app — a tela dela nunca usa pra nada, e
// alarmar sobre um chute é inventar o problema E a régua.
eq('horário presumido', nivel(avisoDoMomento({
  child: { period: 'morning' }, status: 'home', presence: semRota,
  agora: as(9, 0) })), null);
eq('sem criança', nivel(avisoDoMomento({ agora: as(9, 0) })), null);

console.log('\n\x1b[1m4. O grave vence o de atenção quando os dois valem\x1b[0m');
eq('onboard atrasado E sem rota', nivel(avisoDoMomento({
  child: crianca, status: 'onboard', presence: semRota, agora: as(13, 30) })), 'grave');

console.log('\n' + '─'.repeat(66));
console.log(`\x1b[1m${ok} passaram, ${falhou} falharam\x1b[0m`);
process.exit(falhou ? 1 : 0);
