/**
 * Testes do modelo de horários (src/services/horariosService.js).
 *
 * POR QUE UM SCRIPT E NÃO UM FRAMEWORK
 * O projeto não tem runner de teste, e trazer um só pra isto custaria mais que
 * o teste. `node scripts/testar-horarios.mjs` roda em qualquer máquina, sem
 * dependência nova e sem emulador — a mesma escolha do `auditar-regras.cjs`.
 *
 * O QUE ELE PROTEGE
 * As garantias que o modelo antigo não dava e que são caras de reaprender:
 * criança que muda de horário não fica em dois lugares, criança nova aparece
 * sozinha, quem faltou continua VISÍVEL em vez de sumir, e o dia nunca fica
 * sem bloco por causa de um buraco no relógio.
 */

import {
  normalizaHora, emMinutos, deMinutos, horaCurta,
  horariosCombinados, semHorarioCombinado, horaNaDirecao,
  estadoNoDia, ESTADOS, precisaDaPerua,
  blocosDaDirecao, diaCompleto, blocoDoMomento, esperaAte,
  avisosDeTempo, proporCascata,
} from '../src/services/horariosService.js';
import { chaveDoNome, proporEscolasDasCriancas } from '../src/utils/nomeEscola.js';
import { diasUteis, rotuloDoPeriodo, parseDia, MAX_DIAS } from '../src/utils/intervaloDeDias.js';

let ok = 0;
let fail = 0;
const falhas = [];

function t(nome, fn) {
  try {
    fn();
    ok += 1;
    console.log('  \x1b[32m✓\x1b[0m ' + nome);
  } catch (e) {
    fail += 1;
    falhas.push(nome);
    console.log('  \x1b[31m✗\x1b[0m ' + nome + '\n      ' + e.message);
  }
}
function eq(a, b, msg) {
  const A = JSON.stringify(a);
  const B = JSON.stringify(b);
  if (A !== B) throw new Error(`${msg || ''}\n      esperado: ${B}\n      obtido:   ${A}`);
}
function assert(c, msg) {
  if (!c) throw new Error(msg || 'condição falsa');
}
const sec = (s) => console.log('\n\x1b[1m' + s + '\x1b[0m');
const nomes = (paradas) => paradas.map((p) => p.child.name);

// ─────────────────────────── mundo de teste ───────────────────────────
const BASE_LAT = -23.55;
const BASE_LNG = -46.63;
const pt = (xKm, yKm) => ({
  lat: BASE_LAT - yKm * 0.009,
  lng: BASE_LNG + xKm * 0.0098,
});

const ESCOLAS = {
  rui: { nome: 'EM Rui Barbosa', ...pt(3.3, 0.8) },
  lua: { nome: 'Colégio Luar', ...pt(6.4, 1.2) },
};

const C = (id, name, schoolId, horaPega, horaEntrega, x, y, extra = {}) => ({
  id, name, schoolId, horaPega, horaEntrega, active: true, ...pt(x, y), ...extra,
});

// A turma que o motorista descreveu: ida compartilhada, voltas separadas.
const BASE = [
  C('ana', 'Ana', 'rui', '06:20', '12:35', 1.0, 3.3),
  C('caio', 'Caio', 'rui', '06:28', '17:20', 2.1, 4.4),   // integral
  C('duda', 'Duda', 'rui', '06:35', '12:42', 3.7, 3.0),
  C('theo', 'Theo', 'lua', '12:20', '18:30', 5.0, 4.6),
  C('mel', 'Mel', 'lua', '12:30', '18:40', 6.0, 2.7),
];

// ─────────────────────────── 1. horas ───────────────────────────
sec('1. Hora — a fonte silenciosa de lista fora de ordem');

t("'7:00' e '07:00' são a mesma hora", () => {
  eq(normalizaHora('7:00'), '07:00');
  eq(normalizaHora('7h00'), '07:00');
  eq(normalizaHora('0700'), '07:00');
  eq(normalizaHora(' 6 : 20 '), '06:20');
});

t('hora inválida vira null, nunca 0', () => {
  eq(normalizaHora('25:00'), null);
  eq(normalizaHora('07:99'), null);
  eq(normalizaHora(''), null);
  eq(normalizaHora(null), null);
  eq(normalizaHora('manhã'), null);
});

t('ordena por minutos, não por string', () => {
  const horas = ['13:00', '07:00', '09:30'];
  eq(horas.slice().sort((a, b) => emMinutos(a) - emMinutos(b)), ['07:00', '09:30', '13:00']);
  eq(deMinutos(emMinutos('06:20')), '06:20');
  eq(deMinutos(-30), '23:30');
  eq(deMinutos(1500), '01:00');
});

t('hora curta é pra ler, não pra ordenar', () => {
  eq(horaCurta('07:00'), '7h');
  eq(horaCurta('06:20'), '6h20');
  eq(horaCurta('lixo'), '');
});

// ────────────────── 2. o combinado com o pai ──────────────────
sec('2. O combinado — e a ponte pro modelo antigo');

t('criança com horário combinado não é presumida', () => {
  eq(horariosCombinados(BASE[0]), { pega: '06:20', entrega: '12:35', presumido: false });
});

t('criança do modelo antigo opera pelo período, MARCADA como presumida', () => {
  const h = horariosCombinados({ pickupPeriod: 'morning', dropoffPeriod: 'afternoon' });
  eq(h.pega, '06:30');
  eq(h.entrega, '17:30');
  eq(h.presumido, true, 'o motorista tem que ser cobrado a confirmar');
});

t('sem dropoffPeriod, a volta segue a IDA — nada de fantasma às 17h30', () => {
  // Regressão: o default 'afternoon' dava entrega 17h30 pra criança da manhã,
  // e ao meio-dia — entregando de verdade — a tela apontava pra essa viagem
  // que não existe.
  const h = horariosCombinados({ pickupPeriod: 'morning' });
  eq(h.pega, '06:30');
  eq(h.entrega, '12:30', 'quem é pego de manhã volta no fim da manhã');
  eq(h.presumido, true);
});

t('horário pela metade continua presumido', () => {
  const h = horariosCombinados({ horaPega: '06:15', dropoffPeriod: 'afternoon' });
  eq(h.pega, '06:15');
  eq(h.presumido, true, 'metade combinado ainda é metade chutado');
});

t('ninguém fica sem horário — a criança sumir é o pior bug possível', () => {
  const h = horariosCombinados({});
  assert(h.pega && h.entrega, 'sem horário = criança fora do dia inteiro');
});

t('a tela consegue cobrar quem falta confirmar', () => {
  const lista = [...BASE, { id: 'x', name: 'Novo', pickupPeriod: 'morning', active: true }];
  eq(semHorarioCombinado(lista).map((c) => c.name), ['Novo']);
});

// ────────────────── 3. estado no dia ──────────────────
sec('3. O dia real — ninguém some da lista');

t('sem declaração, estado normal', () => {
  eq(estadoNoDia(BASE[0], null, 'ida'), ESTADOS.NORMAL);
});

t('falta cheia aparece nas duas direções', () => {
  const d = { type: 'full' };
  eq(estadoNoDia(BASE[0], d, 'ida'), ESTADOS.FALTA);
  eq(estadoNoDia(BASE[0], d, 'volta'), ESTADOS.FALTA);
});

t('"o pai leva de manhã" marca a IDA e deixa a VOLTA normal', () => {
  const d = { type: 'no-pickup' };
  eq(estadoNoDia(BASE[0], d, 'ida'), ESTADOS.PAI_LEVA);
  eq(estadoNoDia(BASE[0], d, 'volta'), ESTADOS.NORMAL, 'o motorista ainda traz ela pra casa');
});

t('"o pai busca à tarde" marca a VOLTA e deixa a IDA normal', () => {
  const d = { type: 'no-dropoff' };
  eq(estadoNoDia(BASE[0], d, 'ida'), ESTADOS.NORMAL);
  eq(estadoNoDia(BASE[0], d, 'volta'), ESTADOS.PAI_BUSCA);
});

t('"já peguei" tem estado PRÓPRIO, e não reescreve a ida que já aconteceu', () => {
  const d = { type: 'picked-up' };
  eq(estadoNoDia(BASE[0], d, 'volta'), ESTADOS.PAI_PEGOU);
  eq(estadoNoDia(BASE[0], d, 'ida'), ESTADOS.NORMAL,
    'quando isto é declarado a ida do dia já foi marcada — mexer nela seria reescrever o passado');
  assert(ESTADOS.PAI_PEGOU !== ESTADOS.PAI_BUSCA,
    '"busca" é plano e "já pegou" é fato: o motorista lê os dois diferente');
});

t('quem o pai já pegou sai da volta mas continua na lista', () => {
  const decl = { ana: { type: 'picked-up' } };
  const blocos = blocosDaDirecao(BASE, 'volta', { declaracoes: decl });
  eq(nomes(blocos[0].paradas), ['Ana', 'Duda'], 'Ana continua visível');
  eq(precisaDaPerua(blocos[0].paradas[0].estado), false, 'mas não é mais parada');
});

t('tipo desconhecido não derruba a fila', () => {
  eq(estadoNoDia(BASE[0], { type: 'inventado' }, 'ida'), ESTADOS.NORMAL);
});

t('quem não precisa da perua continua na lista, só que marcado', () => {
  const decl = { ana: { type: 'full' } };
  const blocos = blocosDaDirecao(BASE, 'ida', { declaracoes: decl });
  eq(nomes(blocos[0].paradas), ['Ana', 'Caio', 'Duda'], 'Ana tem que continuar visível');
  eq(blocos[0].paradas[0].estado, ESTADOS.FALTA);
  eq(precisaDaPerua(ESTADOS.FALTA), false);
});

// ────────────────── 4. blocos do dia ──────────────────
sec('4. Blocos — as viagens aparecem sozinhas, sem serem entidade');

t('a manhã é um bloco só', () => {
  const blocos = blocosDaDirecao(BASE, 'ida');
  eq(blocos.length, 2, 'ida da manhã e ida do meio-dia');
  eq(nomes(blocos[0].paradas), ['Ana', 'Caio', 'Duda']);
  eq(nomes(blocos[1].paradas), ['Theo', 'Mel']);
});

t('o integral cai sozinho na volta certa, sem ninguém escrever "integral"', () => {
  const blocos = blocosDaDirecao(BASE, 'volta');
  eq(nomes(blocos[0].paradas), ['Ana', 'Duda'], 'volta do meio-dia');
  eq(nomes(blocos[1].paradas), ['Caio'], 'Caio volta às 17h20, sozinho');
  eq(nomes(blocos[2].paradas), ['Theo', 'Mel']);
});

t('a escola do bloco é derivada e NÃO ganha hora inventada', () => {
  const blocos = blocosDaDirecao(BASE, 'ida', { escolasPorId: ESCOLAS });
  eq(blocos[0].escolas.map((e) => e.nome), ['EM Rui Barbosa']);
  assert(!('hora' in blocos[0].escolas[0]), 'parada de escola com hora traz de volta o número que ninguém combinou');
});

t('duas escolas na mesma viagem, na ordem da primeira criança de cada', () => {
  const misto = [
    C('ana', 'Ana', 'rui', '06:20', '12:35', 1.0, 3.3),
    C('theo', 'Theo', 'lua', '06:28', '12:40', 5.0, 4.6),
    C('duda', 'Duda', 'rui', '06:35', '12:42', 3.7, 3.0),
  ];
  const blocos = blocosDaDirecao(misto, 'ida', { escolasPorId: ESCOLAS });
  eq(blocos.length, 1, 'mesma viagem, ainda que sejam duas escolas');
  eq(blocos[0].escolas.map((e) => e.nome), ['EM Rui Barbosa', 'Colégio Luar']);
});

t('criança nova entra sozinha no bloco certo — não existe lista salva', () => {
  const comNova = [...BASE, C('nina', 'Nina', 'rui', '06:31', '12:38', 4.2, 2.2)];
  const blocos = blocosDaDirecao(comNova, 'ida');
  eq(nomes(blocos[0].paradas), ['Ana', 'Caio', 'Nina', 'Duda'], 'entra na posição da hora dela');
});

t('criança que muda de horário sai do bloco antigo — sem ficar nos dois', () => {
  const depois = BASE.map((c) => (c.id === 'ana' ? { ...c, horaEntrega: '17:10' } : c));
  const blocos = blocosDaDirecao(depois, 'volta');
  eq(nomes(blocos[0].paradas), ['Duda']);
  eq(nomes(blocos[1].paradas), ['Ana', 'Caio']);
});

t('criança desativada não aparece em lugar nenhum', () => {
  const semCaio = BASE.map((c) => (c.id === 'caio' ? { ...c, active: false } : c));
  const blocos = blocosDaDirecao(semCaio, 'volta');
  assert(!blocos.some((b) => b.paradas.some((p) => p.child.id === 'caio')));
});

t('quem faltou não cola nem separa blocos indevidamente', () => {
  // Se Duda faltou, o buraco entre Caio (6h28) e Theo (12h20) continua sendo
  // dois blocos; e Duda continua no bloco da manhã, onde ela estaria.
  const decl = { duda: { type: 'full' } };
  const blocos = blocosDaDirecao(BASE, 'ida', { declaracoes: decl });
  eq(blocos.length, 2);
  eq(nomes(blocos[0].paradas), ['Ana', 'Caio', 'Duda']);
});

t('lista vazia devolve nada sem quebrar', () => {
  eq(blocosDaDirecao([], 'ida'), []);
  eq(blocosDaDirecao(null, 'volta'), []);
});

t('o dia junta as duas direções na ordem do relógio', () => {
  const dia = diaCompleto(BASE);
  eq(dia.map((b) => `${b.direcao} ${deMinutos(b.inicio)}`),
    ['ida 06:20', 'ida 12:20', 'volta 12:35', 'volta 17:20', 'volta 18:30']);
});

// ────────────────── 5. o relógio ──────────────────
sec('5. O relógio — sem o buraco das 14h às 16h');

const em = (hh, mm) => new Date(2026, 7, 24, hh, mm);
const DIA = diaCompleto(BASE);

t('às 6h10 ele já está no bloco da manhã (a porta é às 6h20)', () => {
  const b = blocoDoMomento(DIA, em(6, 10));
  eq(`${b.direcao} ${deMinutos(b.inicio)}`, 'ida 06:20');
});

t('às 12h38 está na volta do meio-dia', () => {
  const b = blocoDoMomento(DIA, em(12, 38));
  eq(`${b.direcao} ${deMinutos(b.inicio)}`, 'volta 12:35');
});

t('às 15h — buraco do modelo antigo — devolve o PRÓXIMO, não null', () => {
  const b = blocoDoMomento(DIA, em(15, 0));
  assert(b != null, 'o modelo antigo devolvia null e a tela ficava sem turno');
  eq(`${b.direcao} ${deMinutos(b.inicio)}`, 'volta 17:20');
});

// ── o relógio sozinho trocava de viagem com as crianças na calçada ──
//
// `fim` é a hora da ÚLTIMA porta. Um minuto depois dela o bloco deixava de
// ser o atual e a tela pulava pra próxima viagem, sozinha, com a fila cheia.
// Atrasar um minuto numa rota escolar é o caso normal.
const TUDO_PENDENTE = () => true;
const NADA_PENDENTE = () => false;

t('1 min depois da última porta, com fila cheia, NÃO troca de viagem', () => {
  const b = blocoDoMomento(DIA, em(6, 36), TUDO_PENDENTE);
  eq(`${b.direcao} ${deMinutos(b.inicio)}`, 'ida 06:20',
    'o motorista atrasado 5 min continua vendo quem falta embarcar');
});

t('com a viagem toda resolvida, o relógio volta a mandar', () => {
  const b = blocoDoMomento(DIA, em(6, 36), NADA_PENDENTE);
  eq(`${b.direcao} ${deMinutos(b.inicio)}`, 'ida 12:20');
});

t('a porta do próximo bloco vence a pendência do anterior', () => {
  // Às 12h00 (12h20 menos a margem de partida) ele está atrasado pra viagem
  // seguinte — e é ela que precisa aparecer, mesmo com pendência atrás.
  const b = blocoDoMomento(DIA, em(12, 0), TUDO_PENDENTE);
  eq(`${b.direcao} ${deMinutos(b.inicio)}`, 'ida 12:20');
});

t('sem callback, o comportamento antigo é preservado', () => {
  const b = blocoDoMomento(DIA, em(6, 36));
  eq(`${b.direcao} ${deMinutos(b.inicio)}`, 'ida 12:20');
});

t('às 23h devolve o último do dia em vez de nada', () => {
  const b = blocoDoMomento(DIA, em(23, 0));
  eq(`${b.direcao} ${deMinutos(b.inicio)}`, 'volta 18:30');
});

t('sem blocos devolve null sem quebrar', () => {
  eq(blocoDoMomento([], em(7, 0)), null);
  eq(blocoDoMomento(null, em(7, 0)), null);
});

t('diz quanto falta pra próxima viagem — é o que fecha a rota', () => {
  const manha = DIA[0];
  const espera = esperaAte(DIA, manha, em(6, 55));
  eq(espera.hora, '12:20');
  eq(espera.minutos, 325);
});

t('no último bloco não há próxima', () => {
  eq(esperaAte(DIA, DIA[DIA.length - 1], em(19, 0)), null);
});

// ────────────────── 6. dá tempo? ──────────────────
sec('6. "Dá tempo?" — o aviso fala do combinado, não de prazo inventado');

t('promessas impossíveis são acusadas com o número das duas', () => {
  const apertado = [
    C('ana', 'Ana', 'rui', '06:20', '12:35', 1.0, 3.3),
    C('caio', 'Caio', 'rui', '06:22', '12:40', 5.0, 4.4), // ~4,3 km em 2 min
  ];
  const avisos = avisosDeTempo(blocosDaDirecao(apertado, 'ida'));
  eq(avisos.length, 1);
  eq(avisos[0].de.name, 'Ana');
  eq(avisos[0].para.name, 'Caio');
  assert(avisos[0].minutosNecessarios > avisos[0].minutosDisponiveis);
  console.log(`      → ${avisos[0].horaDe} → ${avisos[0].horaPara}: ${avisos[0].km} km precisam de ${avisos[0].minutosNecessarios} min, tem ${avisos[0].minutosDisponiveis}`);
});

t('rota folgada não acusa nada', () => {
  eq(avisosDeTempo(blocosDaDirecao(BASE, 'ida')), []);
});

t('quem faltou não atrasa ninguém', () => {
  const apertado = [
    C('ana', 'Ana', 'rui', '06:20', '12:35', 1.0, 3.3),
    C('caio', 'Caio', 'rui', '06:22', '12:40', 5.0, 4.4),
  ];
  const decl = { caio: { type: 'full' } };
  eq(avisosDeTempo(blocosDaDirecao(apertado, 'ida', { declaracoes: decl })), []);
});

t('criança sem coordenada não inventa aviso', () => {
  const semGeo = [
    C('ana', 'Ana', 'rui', '06:20', '12:35', 1.0, 3.3),
    { id: 'x', name: 'X', horaPega: '06:21', horaEntrega: '12:40', active: true, lat: null, lng: null },
  ];
  eq(avisosDeTempo(blocosDaDirecao(semGeo, 'ida')), []);
});

// ────────────────── 7. cascata ──────────────────
sec('7. Cascata — propõe, nunca aplica sozinho');

t('atrasar uma criança empurra as seguintes do mesmo bloco', () => {
  const p = proporCascata(BASE, 'ana', '06:40', 'ida');
  eq(p.map((x) => `${x.child.name} ${x.de}→${x.para}`),
    ['Ana 06:20→06:40', 'Caio 06:28→06:48', 'Duda 06:35→06:55']);
});

t('adiantar NÃO obriga ninguém a sair mais cedo de casa', () => {
  const p = proporCascata(BASE, 'ana', '06:10', 'ida');
  eq(p.map((x) => x.child.name), ['Ana'], 'só a própria Ana muda');
});

t('a cascata não vaza pro bloco seguinte', () => {
  const p = proporCascata(BASE, 'duda', '06:50', 'ida');
  const afetados = p.map((x) => x.child.name);
  assert(!afetados.includes('Theo'), 'Theo é da viagem do meio-dia, não pode ser arrastado');
  assert(!afetados.includes('Mel'));
});

t('mover pra mesma hora não propõe nada', () => {
  eq(proporCascata(BASE, 'ana', '06:20', 'ida'), []);
});

t('hora inválida ou criança inexistente não propõe nada', () => {
  eq(proporCascata(BASE, 'ana', 'lixo', 'ida'), []);
  eq(proporCascata(BASE, 'ninguem', '07:00', 'ida'), []);
});

t('horaNaDirecao devolve o campo certo de cada direção', () => {
  eq(horaNaDirecao(BASE[0], 'ida'), '06:20');
  eq(horaNaDirecao(BASE[0], 'volta'), '12:35');
});


// ────────────────── 8. casamento de nomes de escola ──────────────────
sec('8. Migração das escolas — juntar grafias sem juntar escolas diferentes');

t('a mesma escola escrita de jeitos diferentes casa', () => {
  eq(chaveDoNome('E.M. Rui Barbosa'), chaveDoNome('EM Rui Barbosa'));
  eq(chaveDoNome('  em   rui  barbosa '), chaveDoNome('EM Rui Barbosa'));
  eq(chaveDoNome('Creche São José'), chaveDoNome('creche sao jose'));
});

t('escolas diferentes continuam diferentes', () => {
  assert(chaveDoNome('Creche Sol') !== chaveDoNome('Creche Lua'));
  assert(chaveDoNome('EM Rui Barbosa') !== chaveDoNome('EE Rui Barbosa'));
});

t('nome vazio ou lixo não vira chave', () => {
  eq(chaveDoNome(''), '');
  eq(chaveDoNome(null), '');
  eq(chaveDoNome('...'), '');
});

t('agrupa as crianças por escola e mostra as grafias encontradas', () => {
  const turma = [
    { id: 'a', name: 'Ana', school: 'EM Rui Barbosa', active: true },
    { id: 'b', name: 'Caio', school: 'E.M. Rui Barbosa', schoolLat: -23.5, schoolLng: -46.6, schoolAddress: 'Rua X, 1', active: true },
    { id: 'c', name: 'Duda', school: 'Colégio Luar', active: true },
  ];
  const p = proporEscolasDasCriancas(turma);
  eq(p.length, 2);
  eq(p[0].criancas.map((c) => c.name), ['Ana', 'Caio']);
  eq(p[0].variacoes, ['E.M. Rui Barbosa', 'EM Rui Barbosa']);
  eq(p[0].lat, -23.5, 'fica com a grafia que o motorista chegou a geocodificar');
  eq(p[0].endereco, 'Rua X, 1');
  eq(p[1].criancas.map((c) => c.name), ['Duda']);
});

t('quem já tem schoolId fica fora da proposta', () => {
  const turma = [
    { id: 'a', name: 'Ana', school: 'EM Rui Barbosa', schoolId: 'esc1', active: true },
    { id: 'b', name: 'Caio', school: 'EM Rui Barbosa', active: true },
  ];
  const p = proporEscolasDasCriancas(turma);
  eq(p.length, 1);
  eq(p[0].criancas.map((c) => c.name), ['Caio']);
});

t('criança sem escola e criança inativa não entram', () => {
  const turma = [
    { id: 'a', name: 'Ana', school: '', active: true },
    { id: 'b', name: 'Caio', school: 'EM Rui', active: false },
    { id: 'c', name: 'Duda', active: true },
  ];
  eq(proporEscolasDasCriancas(turma), []);
});

t('lista vazia não quebra', () => {
  eq(proporEscolasDasCriancas([]), []);
  eq(proporEscolasDasCriancas(null), []);
});


// ────────────────── 9. intervalo de dias do aviso ──────────────────
sec('9. Aviso "sem aula" — em que dias a ausência é gravada');

t('um dia só devolve um dia', () => {
  eq(diasUteis('2026-08-24'), ['2026-08-24']);          // segunda
  eq(diasUteis('2026-08-24', '2026-08-24'), ['2026-08-24']);
});

t('intervalo pula sábado e domingo — a perua não roda', () => {
  // 2026-08-24 é segunda; 28 é sexta; 29 e 30 são fim de semana.
  eq(diasUteis('2026-08-24', '2026-08-31'), [
    '2026-08-24', '2026-08-25', '2026-08-26', '2026-08-27', '2026-08-28',
    '2026-08-31',
  ]);
});

t('intervalo só de fim de semana não gera dia nenhum', () => {
  eq(diasUteis('2026-08-29', '2026-08-30'), []);
});

t('intervalo invertido não gera nada em vez de explodir', () => {
  eq(diasUteis('2026-08-28', '2026-08-24'), []);
});

t('data inválida não vira dia', () => {
  eq(diasUteis('2026-02-31'), [], 'fevereiro com 31 rolaria pra março');
  eq(diasUteis('lixo'), []);
  eq(diasUteis(null), []);
  eq(diasUteis(''), []);
  eq(parseDia('2026-13-01'), null);
});

t('o teto segura o dedo escorregando no ano', () => {
  const dias = diasUteis('2026-01-01', '2027-01-01');
  assert(dias.length <= MAX_DIAS, `devolveu ${dias.length} dias`);
});

t('atravessa a virada do mês e do ano', () => {
  eq(diasUteis('2026-12-31', '2027-01-01'), ['2026-12-31', '2027-01-01']);
});

t('o rótulo é legível em cada tamanho de intervalo', () => {
  eq(rotuloDoPeriodo(['2026-08-24']), '24/08');
  eq(rotuloDoPeriodo(['2026-08-24', '2026-08-25']), '24/08 e 25/08');
  eq(rotuloDoPeriodo(diasUteis('2026-08-24', '2026-08-28')), 'de 24/08 a 28/08');
  eq(rotuloDoPeriodo([]), '');
});

// ─────────────────────────── relatório ───────────────────────────
console.log('\n' + '─'.repeat(66));
console.log(`\x1b[1m${ok} passaram, ${fail} falharam\x1b[0m`);
if (fail) {
  console.log('falhas: ' + falhas.join(', '));
  process.exit(1);
}
