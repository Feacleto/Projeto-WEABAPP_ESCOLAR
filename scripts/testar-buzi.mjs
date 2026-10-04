/**
 * O BUZI FALA DA PERUA E DA SOBRA (04/10/2026) — `npm run testar:buzi`.
 *
 * Mede `src/dominio/cobranca/buziDaPerua.js` com as regras do dono para o
 * Buzi, as mesmas que `testar:boletim` cobra dos três temas das mensalidades:
 * um assunto por pergunta, nada de comparar com mês passado, nada de conversa
 * de amigo — e nenhum número inventado nem valor à mostra com o olho fechado.
 */
import {
  TEMA_DA_PERUA,
  quantoSobrou,
  responderDaPerua,
  sobreCombustivel,
  sobreManutencao,
} from '../src/dominio/cobranca/buziDaPerua.js';

let ok = 0;
let falhas = 0;
function checar(nome, condicao, detalhe = '') {
  if (condicao) ok += 1;
  else falhas += 1;
  console.log(`  ${condicao ? 'ok ' : 'FALHOU'}  ${nome}${condicao ? '' : ` — ${detalhe}`}`);
}
const texto = (r) => r.frases.join(' ');

const AGORA = new Date(2026, 9, 20, 10).getTime(); // 20 de outubro
const desp = (id, category, amount, data, extra = {}) => ({
  id, category, amount, date: data, monthKey: `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`, ...extra,
});
const DESPESAS = [
  desp('c1', 'fuel', 280, new Date(2026, 9, 18), { litros: 50, posto: 'Posto Shell', kmContador: 41000 }),
  desp('c2', 'fuel', 260, new Date(2026, 9, 3), { litros: 47 }),
  desp('c3', 'fuel', 250, new Date(2026, 8, 20), { litros: 46 }),
  desp('m1', 'maintenance', 420, new Date(2026, 7, 12), { description: 'Troca de óleo', kmContador: 38000, kmPainel: 98000 }),
  desp('a1', 'monitor', 900, new Date(2026, 9, 1)),
];
const CONFIG = { usoDaPerua: 'so_rota', kmDasRotas: 41412, guardado: { manutencao: { valor: 350 } } };
const pago = (id, amount, dia, month = '2026-10') => ({ id, amount, month, status: 'paid', paidAt: new Date(2026, 9, dia) });
const PAGAMENTOS = [pago('p1', 350, 3), pago('p2', 350, 5), pago('p3', 320, 2), pago('p4', 300, 4, '2026-09')];

// As regras que valem para as três respostas.
const PROIBIDO_COMPARAR = /m[eê]s passado|m[eê]s anterior|subiu|desceu|aumentou|diminuiu| a mais que | a menos que /i;
const PROIBIDO_AMIGO = /^(oi|olá|que bom|parabéns|eba)/i;
function regrasDoDono(nome, r, outrosAssuntos) {
  checar(`${nome}: não compara com outro mês`, !PROIBIDO_COMPARAR.test(texto(r)), texto(r));
  checar(`${nome}: não é conversa de amigo`, !r.frases.some((f) => PROIBIDO_AMIGO.test(f.trim())), r.frases[0]);
  checar(`${nome}: um assunto só`, !outrosAssuntos.test(texto(r)), texto(r));
}

console.log('1. Combustível');
const c = sobreCombustivel(DESPESAS, { config: CONFIG, agora: AGORA });
checar('gasto do mês e quantos abastecimentos', /custou R\$\s?540,00 em 2 abastecimentos/.test(texto(c)), texto(c));
checar('litros do mês', /97 litros/.test(texto(c)), texto(c));
checar('o último, com o posto e o valor', /dia 18\/10.*Posto Shell.*R\$\s?280,00/.test(texto(c)), texto(c));
checar('km desde o último, pelas rotas', /rodou 412 km nas rotas/.test(texto(c)), texto(c));
checar('preço médio do litro do mês', /litro saiu a R\$ 5,57/.test(texto(c)), texto(c));
regrasDoDono('combustível', c, /manuten|sobr|auxiliar/i);
const cVazio = sobreCombustivel([], { config: {}, agora: AGORA });
checar('sem abastecimento: diz que não há e onde lançar', /nenhum abastecimento/.test(texto(cVazio)) && /Lance/.test(texto(cVazio)), texto(cVazio));
checar('sem dado, nenhum número inventado', !/R\$|km|litro saiu/.test(texto(cVazio)), texto(cVazio));
const cOculto = sobreCombustivel(DESPESAS, { config: CONFIG, agora: AGORA, mostrar: false });
checar('olho fechado: nenhum valor em reais', !/R\$\s?\d/.test(texto(cOculto)), texto(cOculto));
checar('olho fechado: o preço do litro também some', !/litro saiu/.test(texto(cOculto)), texto(cOculto));
const cPainel = sobreCombustivel(DESPESAS, { config: { usoDaPerua: 'tambem_fora' }, agora: AGORA });
checar('pelo painel, sem leitura de agora: não inventa km', !/rodou/.test(texto(cPainel)), texto(cPainel));
checar('nunca recomenda posto', !/recomend|mais barato|melhor posto/i.test(texto(c)), texto(c));

console.log('2. Manutenção');
const m = sobreManutencao(DESPESAS, { config: CONFIG, agora: AGORA });
checar('a última, com o que foi e o valor', /dia 12\/08.*Troca de óleo.*R\$\s?420,00/.test(texto(m)), texto(m));
checar('km desde ela, pelas rotas', /rodou 3\.412 km nas rotas/.test(texto(m)), texto(m));
checar('quanto custou no período', /custou R\$\s?420,00/.test(texto(m)), texto(m));
checar('o guardado anotado', /anotou R\$\s?350,00 guardado/.test(texto(m)), texto(m));
regrasDoDono('manutenção', m, /combust|abasteci|sobr/i);
const mPainel = sobreManutencao(DESPESAS, { config: { usoDaPerua: 'tambem_fora' }, agora: AGORA });
checar('pelo painel: diz quanto marcava naquele dia', /painel marcava 98\.000 km/.test(texto(mPainel)), texto(mPainel));
const mVazio = sobreManutencao([], { config: {}, agora: AGORA });
checar('sem manutenção: diz e mostra onde lançar', /Nenhuma manutenção/.test(texto(mVazio)) && /Lance/.test(texto(mVazio)), texto(mVazio));
checar('nunca manda trocar óleo nem revisar', !/deveria|precisa trocar|está na hora|revis/i.test(texto(m) + texto(mVazio)), texto(m));
checar('olho fechado: nenhum valor', !/R\$\s?\d/.test(texto(sobreManutencao(DESPESAS, { config: CONFIG, agora: AGORA, mostrar: false }))));

console.log('3. Quanto sobrou');
const s = quantoSobrou(PAGAMENTOS, DESPESAS, { agora: AGORA });
checar('entrou = baixas do mês (inclui atrasado pago agora)', s.entrou === 1320, String(s.entrou));
checar('saiu = despesas do mês', s.saiu === 1440, String(s.saiu));
checar('saiu mais: diz quanto falta', /faltam R\$\s?120,00/.test(texto(s)), texto(s));
checar('a maior despesa nomeada', /mais pesou foi a auxiliar: R\$\s?900,00/.test(texto(s)), texto(s));
checar('diz que a taxa do app não entra', /taxa do app não entra/.test(texto(s)), texto(s));
const s2 = quantoSobrou([...PAGAMENTOS, pago('p5', 500, 6)], DESPESAS, { agora: AGORA });
checar('sobrou: diz quanto', /Sobraram R\$\s?380,00/.test(texto(s2)), texto(s2));
regrasDoDono('sobra', s, /abasteci|litro|troca de óleo/i);
checar('olho fechado: nenhum valor', !/R\$\s?\d/.test(texto(quantoSobrou(PAGAMENTOS, DESPESAS, { agora: AGORA, mostrar: false }))));

console.log('4. A porta');
checar('responde os três temas', [TEMA_DA_PERUA.COMBUSTIVEL, TEMA_DA_PERUA.MANUTENCAO, TEMA_DA_PERUA.SOBROU]
  .every((t) => responderDaPerua(t, { pagamentos: PAGAMENTOS, despesas: DESPESAS, config: CONFIG, agora: AGORA })?.tema === t));
checar('tema desconhecido: null', responderDaPerua('outro', {}) === null);

console.log(`\n${ok} ok, ${falhas} falha(s)`);
if (falhas) process.exit(1);
