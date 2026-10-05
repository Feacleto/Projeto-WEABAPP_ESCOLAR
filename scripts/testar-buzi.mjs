/**
 * O BUZI FALA DA PERUA E DA SOBRA (04/10/2026) — `npm run testar:buzi`.
 *
 * Mede `src/dominio/cobranca/buziDaPerua.js` com as regras do dono para o
 * Buzi, as mesmas que `testar:boletim` cobra dos três temas das mensalidades:
 * um assunto por pergunta, nada de comparar com mês passado, nada de conversa
 * de amigo — e nenhum número inventado nem valor à mostra com o olho fechado.
 *
 * Desde 05/10/2026 também o BUZI CHAT: os assuntos do dia e da semana
 * (`rota/buziDoDia.js`), da turma (`identidade/buziDaTurma.js`) e a conversa
 * que liga tudo (`cobranca/buziConversa.js`): nunca mais de três botões, o
 * escrito/falado achando a pergunta pronta, e a voz que não fala valor com o
 * olho fechado.
 */
import {
  TEMA_DA_PERUA,
  quantoSobrou,
  responderDaPerua,
  sobreCombustivel,
  sobreManutencao,
} from '../src/dominio/cobranca/buziDaPerua.js';
import {
  TEMA_DO_DIA,
  aniversariosDoMes,
  faltasDaSemana,
  feriadoDaSemana,
  quandoEuSaio,
  quemNaoVaiHoje,
  quemVaiHoje,
  responderDoDia,
  semanaDe,
} from '../src/dominio/rota/buziDoDia.js';
import {
  TEMA_DA_TURMA,
  quemEstaSemHorario,
  quemFaltaAssinar,
  quemNaoEntrou,
  responderDaTurma,
} from '../src/dominio/identidade/buziDaTurma.js';
import {
  ASSUNTOS,
  BOLETIM_PADRAO,
  PERGUNTAS,
  PRIMEIROS,
  TEMAS,
  VAI_PARA_O_BOLETIM,
  assuntoDoTema,
  entenderPergunta,
  falaDaResposta,
  partesDoBoletim,
} from '../src/dominio/cobranca/buziConversa.js';
import { quemEstaAtrasado } from '../src/dominio/cobranca/boletim.js';

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

console.log('5. Hoje');
// Quarta, 14 de outubro de 2026, 6h da manhã.
const QUARTA = new Date(2026, 9, 14, 6, 0).getTime();
const TURMA = [
  { id: 'ju', name: 'Júlia Souza', gender: 'female', horaPega: '06:40', horaEntrega: '12:10', school: 'Monteiro Lobato', birthDate: '2017-10-18', inviteStatus: 'pending', inviteCriadoEm: QUARTA - 14 * 864e5 },
  { id: 'pe', name: 'Pedro Alves', gender: 'male', horaPega: '06:55', horaEntrega: '12:10', school: 'Monteiro Lobato', contratoAguardando: 1, inviteStatus: 'accepted' },
  { id: 'li', name: 'Lívia Rocha', gender: 'female', horaPega: '06:50', horaEntrega: '12:10', school: 'Santa Inês', birthDate: '2016-10-27', contratoAguardando: 2, contratoVigente: 1 },
  { id: 'ra', name: 'Rafael', gender: 'male', school: 'Santa Inês' },
  { id: 'xx', name: 'Saiu da Turma', active: false, horaPega: '06:30', inviteStatus: 'pending', birthDate: '2017-10-02' },
];
const DECL = { pe: { type: 'no-pickup' } };
const vai = quemVaiHoje(TURMA, { declaracoes: DECL, agora: QUARTA });
checar('vai: quantas crianças vão hoje (sem a inativa)', /Hoje vão 4 crianças/.test(texto(vai)), texto(vai));
checar('vai: uma linha por viagem, com a hora', vai.linhas.some((l) => /^Ida às 6h/.test(l.nome)) && vai.linhas.some((l) => /^Volta às 12h10/.test(l.nome)), JSON.stringify(vai.linhas));
checar('vai: quem o pai leva não conta na ida', vai.linhas.find((l) => /^Ida/.test(l.nome))?.valor === '3 crianças', JSON.stringify(vai.linhas));
regrasDoDono('quem vai', vai, /falt|anivers|contrato|mensalidade/i);
const naoVai = quemNaoVaiHoje(TURMA, { declaracoes: DECL, agora: QUARTA });
checar('não vai: quem tem aviso e o que foi avisado', naoVai.linhas.length === 1 && naoVai.linhas[0].detalhe === 'o pai leva', JSON.stringify(naoVai.linhas));
checar('não vai: diz que só aparece o que foi avisado', /só o que foi avisado/.test(texto(naoVai)), texto(naoVai));
const vazio = quemNaoVaiHoje(TURMA, { declaracoes: {}, agora: QUARTA });
checar('não vai, sem aviso: diz que ninguém avisou', /Ninguém avisou/.test(texto(vazio)), texto(vazio));
const sai = quandoEuSaio(TURMA, { declaracoes: DECL, agora: QUARTA });
checar('que horas saio: a primeira parada da próxima viagem', /ida: a primeira parada é às 6h/.test(texto(sai)), texto(sai));
const saiTarde = quandoEuSaio(TURMA, { declaracoes: DECL, agora: new Date(2026, 9, 14, 10, 0).getTime() });
checar('às 10h: a próxima é a volta, na escola', /volta.*12h10, na /.test(texto(saiTarde)), texto(saiTarde));
const saiNoite = quandoEuSaio(TURMA, { agora: new Date(2026, 9, 14, 20, 0).getTime() });
checar('à noite: não tem mais viagem', /não tem mais viagem/.test(texto(saiNoite)), texto(saiNoite));
const sabado = new Date(2026, 9, 17, 7, 0).getTime();
checar('sábado: diz que não tem rota, nos três', [quemVaiHoje, quemNaoVaiHoje, quandoEuSaio]
  .every((fn) => /sábado\. Não tem rota/.test(texto(fn(TURMA, { agora: sabado })))));
const feriado = quemVaiHoje(TURMA, { agora: new Date(2026, 9, 12, 7, 0).getTime() });
checar('feriado nacional: diz o nome', /feriado: Nossa Senhora Aparecida/.test(texto(feriado)), texto(feriado));

console.log('6. Semana');
const sem = semanaDe(QUARTA);
checar('a semana vai de segunda a domingo', sem.de === '2026-10-12' && sem.ate === '2026-10-18', JSON.stringify(sem));
const AVISOS = [
  { dateKey: '2026-10-15', childId: 'ju', type: 'full' },
  { dateKey: '2026-10-14', childId: 'li', type: 'no-dropoff' },
  { dateKey: '2026-10-20', childId: 'ju', type: 'full' },
  { dateKey: '2026-10-16', childId: 'xx', type: 'full' },
];
const f = faltasDaSemana(AVISOS, TURMA, { agora: QUARTA });
checar('faltas: só os desta semana e da turma ativa', f.linhas.length === 2, JSON.stringify(f.linhas));
checar('faltas: em ordem de dia, com o dia e o motivo', f.linhas[0].detalhe === 'quarta · o pai busca' && f.linhas[1].detalhe === 'quinta · faltou', JSON.stringify(f.linhas));
checar('faltas: diz que só aparece o que foi avisado', /só o que foi avisado/.test(texto(f)), texto(f));
regrasDoDono('faltas', f, /anivers|feriado|contrato|mensalidade/i);
const fe = feriadoDaSemana({ agora: QUARTA });
checar('feriado: acha Nossa Senhora Aparecida na segunda', fe.linhas.length === 1 && /segunda, dia 12/.test(fe.linhas[0].detalhe), JSON.stringify(fe.linhas));
checar('feriado: diz que o da cidade o app não sabe', /da cidade o app não sabe/.test(texto(fe)), texto(fe));
const feVazio = feriadoDaSemana({ agora: new Date(2026, 9, 21, 7).getTime() });
checar('semana sem feriado: diz que não tem', /não tem feriado nacional/.test(texto(feVazio)), texto(feVazio));
const an = aniversariosDoMes(TURMA, { agora: QUARTA });
checar('aniversário: os do mês, em ordem, sem a inativa', an.linhas.map((l) => l.nome).join(',') === 'Júlia,Lívia', JSON.stringify(an.linhas));
checar('aniversário: o dia e o dia da semana', an.linhas[0]?.detalhe === 'dia 18, domingo', an.linhas[0]?.detalhe);
checar('aniversário: não diz a idade', !/anos/.test(JSON.stringify(an)), JSON.stringify(an));
checar('a porta do dia responde os seis temas', Object.values(TEMA_DO_DIA)
  .every((t) => responderDoDia(t, { children: TURMA, agora: QUARTA })?.tema === t));

console.log('7. Turma');
const cv = quemNaoEntrou(TURMA, { agora: QUARTA });
checar('convite: só quem ainda não entrou e está ativo', cv.linhas.length === 1 && cv.linhas[0].nome === 'Júlia', JSON.stringify(cv.linhas));
checar('convite: avisa que vence amanhã', cv.linhas[0]?.detalhe === 'o convite vence amanhã', cv.linhas[0]?.detalhe);
const cvVencido = quemNaoEntrou(TURMA, { agora: QUARTA + 3 * 864e5 });
checar('convite vencido: manda um link novo', /venceu: mande um link novo/.test(cvVencido.linhas[0]?.detalhe), cvVencido.linhas[0]?.detalhe);
const ct = quemFaltaAssinar(TURMA);
checar('contrato: quem tem versão esperando', ct.linhas.map((l) => l.nome).join(',') === 'Lívia,Pedro', JSON.stringify(ct.linhas));
checar('contrato: separa o primeiro do novo', ct.linhas.find((l) => l.nome === 'Lívia')?.detalhe === 'contrato novo esperando', JSON.stringify(ct.linhas));
const sh = quemEstaSemHorario(TURMA);
checar('sem horário: quem não tem a hora combinada', sh.linhas.map((l) => l.nome).join(',') === 'Rafael', JSON.stringify(sh.linhas));
checar('turma: nenhum valor de mensalidade', ![cv, ct, sh].some((r) => /R\$/.test(JSON.stringify(r))));
for (const [nome, r] of [['convite', cv], ['contrato', ct], ['sem horário', sh]]) regrasDoDono(nome, r, /mensalidade|combust|falt/i);
checar('a porta da turma responde os três temas', Object.values(TEMA_DA_TURMA)
  .every((t) => responderDaTurma(t, { children: TURMA, agora: QUARTA })?.tema === t));

console.log('8. A conversa');
checar('primeiro nível: três assuntos', PRIMEIROS.length === 3);
checar('nunca mais de três botões por assunto', Object.values(ASSUNTOS).every((a) => (a.temas || a.assuntos).length <= 3));
checar('todo tema tem pergunta e assunto', TEMAS.every((t) => PERGUNTAS[t] && assuntoDoTema(t)), TEMAS.filter((t) => !assuntoDoTema(t)).join(','));
checar('nenhuma pergunta diz IA nem inteligência', !/\bIA\b|intelig/i.test(Object.values(PERGUNTAS).join(' ') + Object.values(ASSUNTOS).map((a) => a.pergunta).join(' ')));
checar('o Boletim só aceita o dinheiro do negócio', [...VAI_PARA_O_BOLETIM].every((t) => ['mensalidades', 'perua'].includes(assuntoDoTema(t))));
checar('partes: na ordem, sem repetir, sem o que não é Boletim', partesDoBoletim(['vai', 'entrou', 'combustivel', 'entrou', 'xx']).join(',') === 'entrou,combustivel');
checar('o Boletim padrão é o de sempre', BOLETIM_PADRAO.join(',') === 'entrou,atrasados,avisaram');
const CASOS = [
  ['quem ainda não pagou?', ['atrasados']],
  ['quem já pagou', ['avisaram']],
  ['quanto entrou esse mês', ['entrou']],
  ['quanto gastei de diesel', ['combustivel']],
  ['quanto sobrou', ['sobrou']],
  ['quem não vai hoje', ['naoVai']],
  ['que horas eu saio', ['horario']],
  ['quem não entrou no app', ['convite']],
  ['quem falta assinar o contrato', ['contrato']],
  ['tem feriado', ['feriado']],
  ['quem avisou falta', ['faltas']],
  ['quem não pagou e quanto gastei de gasolina', ['atrasados', 'combustivel']],
];
for (const [frase, esperado] of CASOS) {
  const achou = entenderPergunta(frase);
  checar(`entende "${frase}"`, achou.join(',') === esperado.join(','), achou.join(','));
}
checar('o que não sabe: nada (nunca palpite)', entenderPergunta('qual a cor do céu').length === 0);
checar('no máximo três respostas por frase', entenderPergunta('atrasado pagou entrou diesel óleo sobrou feriado').length <= 3);
const PAG_ATRASO = [{ id: 'x', childName: 'Lucas', amount: 380, status: 'pending', dueDate: new Date(2026, 9, 10), month: '2026-10' }];
const atrasoOculto = quemEstaAtrasado(PAG_ATRASO, { agora: QUARTA, mostrar: false });
const voz = falaDaResposta(atrasoOculto, { mostrar: false });
checar('voz com o olho fechado: nenhum valor', !/R\$|••••|\d+,\d{2}/.test(voz), voz);
checar('voz com o olho fechado: diz que estão escondidos', /valores estão escondidos/.test(voz), voz);
const vozAberta = falaDaResposta(quemEstaAtrasado(PAG_ATRASO, { agora: QUARTA }), { mostrar: true });
checar('voz com o olho aberto: fala o total', /380,00/.test(vozAberta), vozAberta);

console.log(`\n${ok} ok, ${falhas} falha(s)`);
if (falhas) process.exit(1);
