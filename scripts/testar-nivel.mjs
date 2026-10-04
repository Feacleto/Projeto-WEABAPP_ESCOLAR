/**
 * OS NÍVEIS DO MOTORISTA — a régua e o espelho dela (03/10/2026).
 *
 * A especificação é docs/niveis.md. Este script trava o que ela diz e, no
 * fim, compara src/dominio/identidade/nivel.js com functions/lib/reguaDoNivel.js
 * caso a caso: o deploy das functions não alcança `src/`, e o selo oficial
 * (servidor) diferente do checklist da tela (cliente) seria o motorista vendo
 * "Platina" num lugar e "Ouro" no outro.
 *
 * Rode: npm run testar:nivel
 */
import { createRequire } from 'node:module';
import * as nivel from '../src/dominio/identidade/nivel.js';
import { PROIBIDAS } from '../src/marca/promessas.js';

const require = createRequire(import.meta.url);
const espelho = require('../functions/lib/reguaDoNivel.js');

const {
  calcularNivel, prazoDaAtividade, diasRestantes, FRASE_PARA_FAMILIA,
  NIVEIS, MISSOES, CATALOGO_PLATINA, TRILHA,
} = nivel;

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

const AGORA = new Date('2026-10-15T12:00:00-03:00');

// ─── Fatos de exemplo, um degrau por vez ────────────────────────────────────

const crianca = (extra = {}) => ({
  id: 'c1', active: true, contratoAguardando: '1', ...extra,
});

/** Primeiro acesso feito, uma criança, nada além. */
function cru() {
  return {
    usuario: { name: 'João', marcaNome: 'Tio João', city: 'São Paulo', marcos: {} },
    criancas: [crianca()],
    acessosTemporariosCriados: 0,
    config: {},
    despesas: [],
    baixas: 0,
  };
}
function bronze() {
  const f = cru();
  f.usuario.ultimaRota = { seconds: Date.parse('2026-10-10T07:00:00-03:00') / 1000 };
  return f;
}
function prata() {
  const f = bronze();
  f.usuario.marcaLogoURL = 'https://x/logo.png';
  f.usuario.fcmTokens = ['tok'];
  f.usuario.marcos.appInstalado = '2026-10-11T08:00:00Z';
  f.criancas[0].photoURL = 'https://x/foto.png';
  return f;
}
function ouro() {
  const f = prata();
  f.criancas = [crianca({
    photoURL: 'https://x/foto.png', conviteEnviadoEm: new Date('2026-10-11T10:00:00Z'),
    schoolPhone: '1133334444', turma: '3º B',
  })];
  f.acessosTemporariosCriados = 1;
  return f;
}
function ouroCompleto() {
  const f = ouro();
  f.config = { temSenha: true, usoDaPerua: 'so_rota' };
  f.usuario.pixKey = 'joao@x.com';
  f.despesas = [{ date: '2026-10-02', category: 'fuel', tanqueCheio: false }];
  f.baixas = 2;
  f.usuario.verificacao = 'verificada';
  f.usuario.alvaraValidade = '2027-03-01';
  return f;
}
/** Uma segunda criança completa, mas SEM foto — para a atividade fotoDeTodas. */
function comSegundaSemFoto(f) {
  f.criancas.push(crianca({
    id: 'c2', conviteEnviadoEm: '2026-10-12', schoolPhone: '1133335555', professora: 'Ana',
  }));
  return f;
}
function trilhaCompleta(f) {
  f.despesas = [
    { date: '2026-09-20', category: 'fuel', tanqueCheio: true },
    { date: new Date('2026-10-05T15:00:00Z'), category: 'fuel', tanqueCheio: true },
  ];
  f.config.planoDaTroca = { valorHoje: 120000, anos: 5, valorFinal: 40000, criadoEm: '2026-10-01' };
  f.config.guardado = { troca: { valor: 500, em: '2026-10-03T10:00:00Z' } };
  return f;
}

const ATIV_DESPESAS = { id: 'a1', titulo: 'Lançar as despesas de outubro', verificacao: 'despesasDoMes', lancadaEm: '2026-10-01T09:00:00-03:00', ativa: true };
const ATIV_FOTO = { id: 'a2', titulo: 'Foto em todas', verificacao: 'fotoDeTodas', lancadaEm: '2026-10-01T09:00:00-03:00', ativa: true };
const ATIV_HORARIO = { id: 'a3', verificacao: 'horarioDeCostumeVisto', lancadaEm: '2026-08-01T09:00:00-03:00', ativa: true };

const n = (f, op = {}) => calcularNivel(f, { agora: AGORA, ...op }).nivel;

// ─── 1 · Entrada ────────────────────────────────────────────────────────────

bloco('1 · SEM NÍVEL ATÉ A PRIMEIRA ROTA ENCERRADA');
checar('cadastro completo e turma, sem rota: sem_nivel', 'sem_nivel', n(cru()));
checar('sem nível não tem próximo (nenhuma missão antes da rota)', null, calcularNivel(cru(), { agora: AGORA }).proximo);
checar('fatos vazios não quebram', 'sem_nivel', n({}));
checar('fatos indefinidos não quebram', 'sem_nivel', calcularNivel(undefined).nivel);
checar('primeira rota encerrada: bronze', 'bronze', n(bronze()));
checar('ultimaRota como ISO também vale', 'bronze', n({ ...bronze(), usuario: { ...bronze().usuario, ultimaRota: '2026-10-10T07:00:00Z' } }));
checar('ultimaRota como Timestamp ({toDate}) também vale', 'bronze',
  n({ ...bronze(), usuario: { ...bronze().usuario, ultimaRota: { toDate: () => new Date('2026-10-10') } } }));

// ─── 2 · Subida ─────────────────────────────────────────────────────────────

bloco('2 · BRONZE → PRATA → OURO');
const rb = calcularNivel(bronze(), { agora: AGORA });
checar('bronze: próximo é prata', 'prata', rb.proximo.nivel);
checar('bronze: faltam as 4 missões não-pré do bronze',
  ['logoDaMarca', 'fotoEmUmaCrianca', 'avisosLigados', 'appInstalado'], rb.proximo.faltam.map((x) => x.id));
checar('missões do bronze completas: prata', 'prata', n(prata()));
checar('falta só uma (avisos): continua bronze', 'bronze', n({ ...prata(), usuario: { ...prata().usuario, fcmTokens: [] } }));
checar('missões da prata completas: ouro', 'ouro', n(ouro()));
const rp = calcularNivel(prata(), { agora: AGORA });
checar('prata: faltam convite, telefone, turma e acesso de 24h',
  ['conviteATodas', 'telefoneDaEscola', 'turmaOuProfessora', 'acessoDeUmDia'], rp.proximo.faltam.map((x) => x.id));
{
  const f = ouro();
  f.criancas[0].conviteEnviadoEm = null;
  f.criancas[0].parentUid = 'mae1';
  checar('família que entrou vale como convite mandado', 'ouro', n(f));
}
{
  const f = ouro();
  f.criancas.push(crianca({ id: 'c2', photoURL: 'x' }));
  checar('criança nova sem telefone/turma/convite: volta à prata pela régua…', 'prata', n(f));
  checar('…mas nível conquistado não se perde (conquistado: ouro)', 'ouro', n(f, { conquistado: 'ouro' }));
  checar('platina gravada antes vira piso de ouro, não de platina', 'ouro', n(f, { conquistado: 'platina' }));
}
{
  const f = ouro();
  f.criancas.push(crianca({ id: 'c2', active: false }));
  checar('criança INATIVA sem dados não segura ninguém', 'ouro', n(f));
}
{
  const f = ouro();
  f.criancas = [crianca({ active: false, photoURL: 'p', schoolPhone: '1', turma: 'x', conviteEnviadoEm: '2026-10-01' })];
  f.usuario.marcaLogoURL = 'x';
  checar('sem criança ativa, "todas" é FALSO', 'prata', n(f));
}

// ─── 3 · Pré e progresso antecipado ─────────────────────────────────────────

bloco('3 · PRÉ JÁ MARCADA E PROGRESSO ANTECIPADO');
{
  const r = calcularNivel(bronze(), { agora: AGORA });
  const pre = r.missoes.filter((m) => m.pre);
  checar('toda missão pré aparece feita', true, pre.every((m) => m.feita));
  checar('são 6 missões pré (3 do bronze, 1 da prata, 2 do ouro)', ['primeiroAcesso', 'primeiraCrianca', 'primeiraRota', 'contratoDeCada', 'senhaDoFinanceiro', 'chavePix'], pre.map((m) => m.id));
  checar('pré não aparece em "faltam"', false, r.proximo.faltam.some((x) => pre.some((p) => p.id === x.id)));
  checar('chave PIX ausente não segura o ouro (é pré)', 'ouro', n(ouro()));
}
{
  const f = bronze();
  f.despesas = [{ date: '2026-10-02', category: 'other' }];
  f.baixas = 1;
  const r = calcularNivel(f, { agora: AGORA });
  checar('ainda bronze', 'bronze', r.nivel);
  checar('despesa feita no bronze aparece feita', true, r.missoes.find((m) => m.id === 'primeiraDespesa').feita);
  checar('baixa feita no bronze aparece feita', true, r.missoes.find((m) => m.id === 'primeiraBaixa').feita);
}
{
  const f = ouroCompleto();
  f.usuario.alvaraValidade = '2026-10-14';
  const r = calcularNivel(f, { agora: AGORA, atividades: [ATIV_DESPESAS] });
  checar('alvará vencido ontem não vale', false, r.missoes.find((m) => m.id === 'alvaraConferido').feita);
  checar('e segura a platina', 'ouro', r.nivel);
  f.usuario.alvaraValidade = '2026-10-15';
  checar('alvará que vence hoje ainda vale', 'platina', n(f, { atividades: [ATIV_DESPESAS] }));
  f.usuario.verificacao = 'enviada';
  checar('alvará só enviado não vale', 'ouro', n(f, { atividades: [ATIV_DESPESAS] }));
}

// ─── 4 · Platina ────────────────────────────────────────────────────────────

bloco('4 · PLATINA: OURO + MISSÕES DO OURO + ≥1 ATIVIDADE + NENHUMA VENCIDA');
checar('ouro completo sem atividade nenhuma: ouro', 'ouro', n(ouroCompleto()));
checar('ouro completo + atividade feita: platina', 'platina', n(ouroCompleto(), { atividades: [ATIV_DESPESAS] }));
checar('ouro SEM missões do ouro + atividade feita: ouro', 'ouro', n(ouro(), { atividades: [ATIV_DESPESAS] }));
{
  const f = comSegundaSemFoto(ouroCompleto());
  const r = calcularNivel(f, { agora: AGORA, atividades: [ATIV_DESPESAS, ATIV_FOTO] });
  checar('uma feita e outra em prazo: platina', 'platina', r.nivel);
  const foto = r.platina.atividades.find((a) => a.id === 'a2');
  checar('a em prazo não está feita nem vencida', [false, false], [foto.feita, foto.vencida]);
  checar('lançada 01/10, em 15/10 faltam 16 dias', 16, foto.diasRestantes);
}
{
  const f = comSegundaSemFoto(ouroCompleto());
  const depois = new Date('2026-11-05T12:00:00-03:00');
  const r = calcularNivel(f, { agora: depois, atividades: [ATIV_DESPESAS, ATIV_FOTO] });
  checar('a de foto venceu (31/10) — cai para ouro', 'ouro', r.nivel);
  checar('ela aparece vencida', true, r.platina.atividades.find((a) => a.id === 'a2').vencida);
  checar('despesa de outubro continua valendo em novembro (feita no prazo)', true,
    r.platina.atividades.find((a) => a.id === 'a1').feita);
  f.criancas.forEach((c) => { c.photoURL = 'x'; });
  checar('fez a foto atrasado: volta para platina', 'platina', n(f, { agora: depois, atividades: [ATIV_DESPESAS, ATIV_FOTO] }));
}
{
  const f = ouroCompleto();
  f.despesas = [{ date: '2026-09-28', category: 'other' }];
  checar('despesa de setembro NÃO cumpre a atividade lançada em outubro', 'ouro', n(f, { atividades: [ATIV_DESPESAS] }));
  f.despesas.push({ date: { seconds: Date.parse('2026-10-01T01:00:00Z') / 1000 }, category: 'other' });
  checar('despesa 30/09 22h de Brasília (01/10 UTC) ainda é setembro', 'ouro', n(f, { atividades: [ATIV_DESPESAS] }));
  f.despesas.push({ date: '2026-10-01', category: 'other' });
  checar('despesa 01/10 cumpre', 'platina', n(f, { atividades: [ATIV_DESPESAS] }));
}
{
  const f = ouroCompleto();
  f.config.guardado = { manutencao: { valor: 0, em: '2026-10-07T10:00:00Z' } };
  const at = { id: 'r', verificacao: 'reservaAtualizadaNoMes', lancadaEm: '2026-10-01T09:00:00-03:00' };
  checar('reserva atualizada no mês conta pela DATA (valor 0 vale)', 'platina', n(f, { atividades: [at] }));
}
{
  const f = ouroCompleto();
  f.usuario.marcos.horarioDeCostumeVisto = true;
  checar('horário de costume visto cumpre', 'platina', n(f, { atividades: [ATIV_HORARIO] }));
}
{
  const f = ouroCompleto();
  const desconhecida = { id: 'x', verificacao: 'marcadaAMao', lancadaEm: '2026-10-01' };
  checar('atividade com chave fora do catálogo não existe', 0,
    calcularNivel(f, { agora: AGORA, atividades: [desconhecida] }).platina.atividades.length);
  const inativa = { ...ATIV_FOTO, ativa: false };
  checar('atividade inativa não vence ninguém', 'platina', n(f, { atividades: [ATIV_DESPESAS, inativa] }));
  const futura = { ...ATIV_FOTO, lancadaEm: '2026-12-01T09:00:00-03:00' };
  checar('atividade lançada no futuro não aparece', 1,
    calcularNivel(f, { agora: AGORA, atividades: [ATIV_DESPESAS, futura] }).platina.atividades.length);
}

// ─── 5 · Prazo ──────────────────────────────────────────────────────────────

bloco('5 · PRAZO DE 30 DIAS, PAUSANDO NAS FÉRIAS');
const dia = (d) => new Date(d.getTime() - 3 * 3600_000).toISOString().slice(0, 10);
checar('lançada 01/10: vence ao fim de 31/10 (às 00h de 01/11)', '2026-11-01T03:00:00.000Z',
  prazoDaAtividade('2026-10-01T09:00:00-03:00').toISOString());
checar('lançada 03/10: último dia 02/11', '2026-11-03', dia(prazoDaAtividade('2026-10-03T20:00:00-03:00')));
checar('no último dia, 0 dias e ainda vale', 0, diasRestantes('2026-10-01T09:00:00-03:00', new Date('2026-10-31T23:00:00-03:00')));
checar('lançada 20/06: 10 dias de junho, julho pausa, 20 de agosto → último 20/08',
  '2026-08-21', dia(prazoDaAtividade('2026-06-20T09:00:00-03:00')));
checar('no meio de julho a contagem para em 20', 20, diasRestantes('2026-06-20T09:00:00-03:00', new Date('2026-07-15T12:00:00-03:00')));
checar('em 31/07 continua 20', 20, diasRestantes('2026-06-20T09:00:00-03:00', new Date('2026-07-31T12:00:00-03:00')));
checar('em 01/08 já desceu para 19', 19, diasRestantes('2026-06-20T09:00:00-03:00', new Date('2026-08-01T12:00:00-03:00')));
checar('lançada em julho começa a contar em agosto: último 30/08', '2026-08-31',
  dia(prazoDaAtividade('2026-07-10T09:00:00-03:00')));
checar('lançada 10/12: 4 dias de dezembro, pausa até 31/01, 26 de fevereiro → último 26/02/2027',
  '2027-02-27', dia(prazoDaAtividade('2026-12-10T09:00:00-03:00')));
checar('lançada 20/12: último 02/03/2027', '2027-03-03', dia(prazoDaAtividade('2026-12-20T09:00:00-03:00')));
{
  const f = comSegundaSemFoto(ouroCompleto());
  const at = { id: 'f', verificacao: 'fotoDeTodas', lancadaEm: '2026-12-10T09:00:00-03:00' };
  const r = calcularNivel(f, { agora: new Date('2027-01-20T12:00:00-03:00'), atividades: [ATIV_HORARIO, at] });
  checar('em janeiro a atividade de dezembro não venceu', false, r.platina.atividades.find((a) => a.id === 'f').vencida);
  checar('e mostra 26 dias (pausada desde 15/12)', 26, r.platina.atividades.find((a) => a.id === 'f').diasRestantes);
}
checar('data inválida não quebra', [null, 0], [prazoDaAtividade('lixo'), diasRestantes(undefined, AGORA)]);

// ─── 6 · Diamante ───────────────────────────────────────────────────────────

bloco('6 · DIAMANTE: PLATINA + TRILHA 1–3');
{
  const f = trilhaCompleta(ouroCompleto());
  checar('platina + trilha completa: diamante', 'diamante', n(f, { atividades: [ATIV_DESPESAS] }));
  checar('trilha completa sem platina: ouro', 'ouro', n(f));
  const r = calcularNivel(f, { agora: AGORA, atividades: [ATIV_DESPESAS] });
  checar('diamante não tem próximo', null, r.proximo);
  checar('a fase 4 não conta', false, r.trilha.fases[3].contaParaDiamante);
  const g = trilhaCompleta(ouroCompleto());
  g.despesas = g.despesas.map((d) => ({ ...d, date: '2026-10-05' }));
  checar('despesas num mês só: fase 1 incompleta → platina', 'platina', n(g, { atividades: [ATIV_DESPESAS] }));
  const h = trilhaCompleta(ouroCompleto());
  h.despesas[0].category = 'maintenance';
  checar('tanque cheio só vale em combustível', 'platina', n(h, { atividades: [ATIV_DESPESAS] }));
  const i = trilhaCompleta(ouroCompleto());
  i.config.planoDaTroca = { valorHoje: 0, anos: 5, valorFinal: 0 };
  checar('plano da troca inválido não conta', 'platina', n(i, { atividades: [ATIV_DESPESAS] }));
  const j = trilhaCompleta(ouroCompleto());
  j.config.marcosDeclarados = { revisaoDaPerua: true, temContador: true, cnpj: true };
  const rj = calcularNivel(j, { agora: AGORA, atividades: [ATIV_DESPESAS] });
  checar('marcos declarados aparecem…', true, rj.trilha.fases[1].marcos[0].declarado);
  const k = trilhaCompleta(ouroCompleto());
  delete k.config.guardado;
  k.config.marcosDeclarados = { revisaoDaPerua: true, temContador: true, cnpj: true };
  checar('…mas não contam: sem reserva, declarar tudo não dá diamante', 'platina', n(k, { atividades: [ATIV_DESPESAS] }));
  const vencendo = calcularNivel(f, { agora: new Date('2026-11-05T12:00:00-03:00'), atividades: [ATIV_DESPESAS, ATIV_FOTO] });
  comSegundaSemFoto(f);
  checar('diamante com atividade vencida cai para ouro', 'ouro',
    calcularNivel(f, { agora: new Date('2026-11-05T12:00:00-03:00'), atividades: [ATIV_DESPESAS, ATIV_FOTO] }).nivel);
  checar('(com a foto em dia continuava diamante)', 'diamante', vencendo.nivel);
}

// ─── 7 · Família ────────────────────────────────────────────────────────────

bloco('7 · O QUE A FAMÍLIA LÊ');
checar('sem_nivel e bronze: família não vê nada', [null, null], [FRASE_PARA_FAMILIA.sem_nivel, FRASE_PARA_FAMILIA.bronze]);
checar('prata', 'Seu tio usa o Alô Buzinou no dia a dia.', FRASE_PARA_FAMILIA.prata);
checar('ouro', 'Seu tio é engajado no Alô Buzinou.', FRASE_PARA_FAMILIA.ouro);
checar('platina', 'Seu tio é muito engajado e está em dia com as novidades.', FRASE_PARA_FAMILIA.platina);
checar('diamante', 'Seu tio é dos mais engajados do Alô Buzinou.', FRASE_PARA_FAMILIA.diamante);
const norm = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
for (const [k, frase] of Object.entries(FRASE_PARA_FAMILIA)) {
  if (!frase) continue;
  const achou = PROIBIDAS.filter((r) => norm(frase).includes(r));
  checar(`frase de ${k} não afirma segurança`, [], achou);
}
checar('sonda: a checagem pega uma frase proibida', ['segur'],
  PROIBIDAS.filter((r) => norm('Seu tio é Seguro').includes(r)));
checar('toda frase tem um nível que existe', true, Object.keys(FRASE_PARA_FAMILIA).every((k) => NIVEIS.includes(k)));

bloco('8 · CATÁLOGOS');
checar('toda missão sai de bronze, prata ou ouro', true, MISSOES.every((m) => ['bronze', 'prata', 'ouro'].includes(m.nivel)));
checar('ids de missão únicos', MISSOES.length, new Set(MISSOES.map((m) => m.id)).size);
checar('toda missão tem destino /tio', true, MISSOES.every((m) => m.destino.startsWith('/tio')));
checar('catálogo da platina tem as 4 chaves',
  ['despesasDoMes', 'reservaAtualizadaNoMes', 'fotoDeTodas', 'horarioDeCostumeVisto'], Object.keys(CATALOGO_PLATINA));
checar('trilha tem 4 fases, só 1–3 contam', [true, true, true, false], TRILHA.map((f) => f.contaParaDiamante));

// ─── 9 · Espelho ────────────────────────────────────────────────────────────

bloco('9 · O ESPELHO DO SERVIDOR DÁ O MESMO RESULTADO, CASO A CASO');
checar('mesmos exports', Object.keys(nivel).sort(), Object.keys(espelho).sort());
checar('mesmos NIVEIS', NIVEIS, espelho.NIVEIS);
checar('mesmas frases', FRASE_PARA_FAMILIA, espelho.FRASE_PARA_FAMILIA);
checar('mesmas missões (id, nível, pré, destino, título)',
  MISSOES.map(({ cumprida, ...m }) => m), espelho.MISSOES.map(({ cumprida, ...m }) => m));

const bases = {
  cru, bronze, prata, ouro, ouroCompleto,
  ouroSemFotoNaSegunda: () => comSegundaSemFoto(ouroCompleto()),
  diamante: () => trilhaCompleta(ouroCompleto()) };
const variacoes = {
  nada: (f) => f,
  semCriancaAtiva: (f) => { f.criancas = (f.criancas || []).map((c) => ({ ...c, active: false })); return f; },
  criancaNova: (f) => { f.criancas = [...(f.criancas || []), crianca({ id: 'c9' })]; return f; },
  fotoEmTodas: (f) => { f.criancas = (f.criancas || []).map((c) => ({ ...c, photoURL: 'p' })); return f; },
  horario: (f) => { f.usuario.marcos = { ...(f.usuario.marcos || {}), horarioDeCostumeVisto: '2026-09-01' }; return f; },
  alvaraVencido: (f) => { f.usuario.verificacao = 'verificada'; f.usuario.alvaraValidade = '2026-01-01'; return f; },
};
const momentos = [
  '2026-10-15T12:00:00-03:00', '2026-11-05T12:00:00-03:00', '2026-07-20T12:00:00-03:00',
  '2026-12-31T23:30:00-03:00', '2027-01-31T23:59:00-03:00', '2027-03-10T08:00:00-03:00',
].map((s) => new Date(s));
const conjuntos = [
  [], [ATIV_DESPESAS], [ATIV_FOTO], [ATIV_HORARIO], [ATIV_DESPESAS, ATIV_FOTO],
  [{ id: 'r', verificacao: 'reservaAtualizadaNoMes', lancadaEm: '2026-12-20T09:00:00-03:00' }],
  [{ id: 'j', verificacao: 'fotoDeTodas', lancadaEm: { seconds: Date.parse('2026-06-25T12:00:00Z') / 1000 } }],
];
const conquistas = [null, 'prata', 'ouro', 'diamante'];
let casos = 0;
const divergentes = [];
for (const [nb, base] of Object.entries(bases)) {
  for (const [nv, varia] of Object.entries(variacoes)) {
    for (const agora of momentos) {
      for (const atividades of conjuntos) {
        for (const conquistado of conquistas) {
          const a = calcularNivel(varia(base()), { agora, atividades, conquistado });
          const b = espelho.calcularNivel(varia(base()), { agora, atividades, conquistado });
          casos += 1;
          if (JSON.stringify(a) !== JSON.stringify(b)) divergentes.push(`${nb}/${nv}/${agora.toISOString()}/${atividades.length}/${conquistado}`);
        }
      }
    }
  }
}
checar(`${casos} cenários, nenhum diverge`, [], divergentes.slice(0, 5));
checar('a matriz cobre todos os níveis', NIVEIS.slice().sort(), [...new Set(
  Object.values(bases).flatMap((b) => momentos.flatMap((agora) => conjuntos.map((atividades) =>
    calcularNivel(b(), { agora, atividades }).nivel))),
)].sort());
for (const lancada of ['2026-06-20T09:00:00-03:00', '2026-12-10', '2026-10-03T23:59:00-03:00', 1790000000000]) {
  checar(`prazo igual nos dois (${lancada})`, prazoDaAtividade(lancada)?.toISOString(), espelho.prazoDaAtividade(lancada)?.toISOString());
  for (const agora of momentos) {
    if (diasRestantes(lancada, agora) !== espelho.diasRestantes(lancada, agora)) {
      checar(`dias restantes iguais (${lancada} em ${agora.toISOString()})`, diasRestantes(lancada, agora), espelho.diasRestantes(lancada, agora));
    }
  }
}

console.log(`\n${ok} ok, ${bad} falha(s)`);
if (bad > 0) {
  console.log('\nFalhas:');
  for (const f of falhas) console.log(`  - ${f}`);
  process.exit(1);
}
