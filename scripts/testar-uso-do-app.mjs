/**
 * O USO DO APP — a régua do servidor e o espelho da tela.
 *
 * O QUE ELE TRAVA
 *   1. a conta de cada recurso (motoristas distintos, vezes, janela de 30
 *      dias, filtro de categoria/status, motorista que não é motorista);
 *   2. os cortes da sugestão (base pequena = 'cedo'; 50% e 20%);
 *   3. "menos de 3": 1 e 2 motoristas nunca aparecem como número;
 *   4. o documento gravado não tem uid, nem lista;
 *   5. o ESPELHO (`src/dominio/associacao/usoDoApp.js`) responde igual ao
 *      servidor, caso a caso.
 *
 * COMO RODAR
 *   node scripts/testar-uso-do-app.mjs
 */
import { createRequire } from 'node:module';
import * as app from '../src/dominio/associacao/usoDoApp.js';

const srv = createRequire(import.meta.url)('../functions/lib/reguaDoUso.js');

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
const bloco = (t) => console.log(`\n${t}`);

const AGORA = new Date('2026-10-06T02:55:00Z'); // 23h55 de 05/10 em Brasília
const dias = (n) => new Date(AGORA.getTime() - n * 24 * 3600 * 1000);
const rec = (id) => srv.RECURSOS.find((r) => r.id === id);

bloco('─── 1. a conta de cada recurso ───');
{
  const buzinas = [
    { adminUid: 'a', createdAt: dias(1) },
    { adminUid: 'a', createdAt: dias(2) },
    { adminUid: 'b', createdAt: dias(29) },
    { adminUid: 'c', createdAt: dias(31) },
    { adminUid: 'd', createdAt: new Date(AGORA.getTime() + 3600e3) },
    { createdAt: dias(1) },
  ];
  checar('motoristas distintos e vezes na janela', { motoristas: 2, vezes: 3 }, srv.contarRecurso(rec('buzina'), buzinas, AGORA));
  const desp = [
    { adminUid: 'a', createdAt: dias(1), category: 'fuel' },
    { adminUid: 'b', createdAt: dias(1), category: 'maintenance' },
    { adminUid: 'b', createdAt: dias(2), category: 'fuel' },
  ];
  checar('despesas conta todas', { motoristas: 2, vezes: 3 }, srv.contarRecurso(rec('despesas'), desp, AGORA));
  checar('abastecer só a categoria de combustível', { motoristas: 2, vezes: 2 }, srv.contarRecurso(rec('abastecer'), desp, AGORA));
  const pag = [
    { adminUid: 'a', status: 'paid', paidAt: dias(2) },
    { adminUid: 'b', status: 'pending', paidAt: dias(2) },
  ];
  checar('baixa só com status paid', { motoristas: 1, vezes: 1 }, srv.contarRecurso(rec('baixas'), pag, AGORA));
  const rides = [
    { adminUid: 'a', dateKey: '2026-10-05' },
    { adminUid: 'a', dateKey: '2026-09-06' },
    { adminUid: 'b', dateKey: '2026-09-05' },
    { adminUid: 'e', dateKey: '2026-09-04' },
    { adminUid: 'c', dateKey: '2026-10-07' },
  ];
  checar('rides pela data AAAA-MM-DD, no dia de Brasília', { motoristas: 2, vezes: 3 }, srv.contarRecurso(rec('marcacoes'), rides, AGORA));
  const users = [
    { id: 'u1', role: 'admin', ultimaRota: dias(3) },
    { id: 'u2', role: 'admin', ultimaRota: dias(40) },
    { id: 'u3', role: 'parent', ultimaRota: dias(1) },
    { id: 'u4', role: 'admin' },
  ];
  checar('rotas: só motorista, só na janela, sem vezes', { motoristas: 1, vezes: null }, srv.contarRecurso(rec('rotas'), users, AGORA));
  checar('a base é quem rodou em 30 dias', 1, srv.baseDoUso(users, AGORA));
  const aux = [
    { motoristaUid: 'a', ativa: true },
    { motoristaUid: 'a', ativa: true },
    { motoristaUid: 'b', ativa: false },
  ];
  checar('auxiliar ativa, sem data', { motoristas: 1, vezes: null }, srv.contarRecurso(rec('auxiliar'), aux, AGORA));
  checar('sem docs é zero', { motoristas: 0, vezes: 0 }, srv.contarRecurso(rec('buzina'), [], AGORA));
}

bloco('─── 2. os cortes da sugestão ───');
{
  checar('base de 9 é cedo', 'cedo', srv.sugestaoDe(9, 9));
  checar('base de 10 já decide', 'manter', srv.sugestaoDe(5, 10));
  checar('49% melhora', 'melhorar', srv.sugestaoDe(49, 100));
  checar('50% mantém', 'manter', srv.sugestaoDe(50, 100));
  checar('20% melhora', 'melhorar', srv.sugestaoDe(20, 100));
  checar('19% avalia', 'avaliar', srv.sugestaoDe(19, 100));
  checar('zero avalia', 'avaliar', srv.sugestaoDe(0, 100));
}

bloco('─── 3. "menos de 3" ───');
{
  checar('0 é 0', '0', srv.motoristasParaMostrar(0));
  checar('1 esconde', 'menos de 3', srv.motoristasParaMostrar(1));
  checar('2 esconde', 'menos de 3', srv.motoristasParaMostrar(2));
  checar('3 aparece', '3', srv.motoristasParaMostrar(3));
  const r = srv.resumoDoUso({ buzina: { motoristas: 2, vezes: 5 }, recado: { motoristas: 40, vezes: 90 } }, 50);
  checar('ordena do mais usado ao menos', ['recado', 'buzina'], r.slice(0, 2).map((l) => l.id));
  const b = r.find((l) => l.id === 'buzina');
  checar('1 ou 2: sem percentual, sem vezes', [null, null, 'menos de 3'], [b.fracao, b.vezes, b.motoristasTexto]);
  checar('o recurso comum mostra percentual', 0.8, r[0].fracao);
}

bloco('─── 4. o documento não tem uid ───');
{
  const cont = {};
  srv.RECURSOS.forEach((x, i) => {
    cont[x.id] = { motoristas: i, vezes: x.contaVezes ? i * 2 : null };
  });
  const doc = srv.usoDoDia(cont, 12, AGORA);
  checar('o dia é o de Brasília', '2026-10-05', doc.dia);
  checar('chaves da lista fechada', ['baseMotoristas', 'dia', 'janelaDias', 'recursos'], Object.keys(doc).sort());
  checar('um item por recurso, só motoristas e vezes', true, srv.RECURSOS.every((x) => Object.keys(doc.recursos[x.id]).sort().join() === 'motoristas,vezes'));
  const texto = JSON.stringify(doc);
  checar('nenhum array no documento', false, texto.includes('['));
  checar('nenhum uid no documento', false, /uid/i.test(texto));
  const sujo = srv.contarRecurso(rec('buzina'), [{ adminUid: 'uid-secreto-123', createdAt: dias(1) }], AGORA);
  checar('a contagem não carrega o uid', false, JSON.stringify(sujo).includes('secreto'));
}

bloco('─── 5. o espelho responde igual ───');
{
  checar('a mesma lista de recursos', srv.RECURSOS, app.RECURSOS);
  checar(
    'os mesmos cortes',
    [srv.MINIMO_PARA_MOSTRAR, srv.BASE_MINIMA, srv.CORTE_MANTER, srv.CORTE_MELHORAR, srv.DIAS_DO_USO],
    [app.MINIMO_PARA_MOSTRAR, app.BASE_MINIMA, app.CORTE_MANTER, app.CORTE_MELHORAR, app.DIAS_DO_USO]
  );
  let igual = true;
  for (const base of [0, 5, 9, 10, 30, 100]) {
    for (const m of [0, 1, 2, 3, 5, 9, 10, 19, 20, 29, 50, 100]) {
      if (srv.sugestaoDe(m, base) !== app.sugestaoDe(m, base)) igual = false;
      if (srv.motoristasParaMostrar(m) !== app.motoristasParaMostrar(m)) igual = false;
    }
  }
  checar('sugestão e "menos de 3" iguais na grade', true, igual);
  const cont = {
    buzina: { motoristas: 2, vezes: 4 },
    recado: { motoristas: 30, vezes: 80 },
    despesas: { motoristas: 12, vezes: 12 },
    auxiliar: { motoristas: 3, vezes: null },
  };
  checar('resumo igual', srv.resumoDoUso(cont, 40), app.resumoDoUso(cont, 40));
  checar('resumo igual em base pequena', srv.resumoDoUso(cont, 6), app.resumoDoUso(cont, 6));
  checar('resumo sem dado igual', srv.resumoDoUso({}, 0), app.resumoDoUso({}, 0));
  checar('documento igual', srv.usoDoDia(cont, 40, AGORA), app.usoDoDia(cont, 40, AGORA));
  const docs = [
    { adminUid: 'a', createdAt: dias(2) },
    { adminUid: 'b', createdAt: dias(40) },
  ];
  checar('contagem igual', srv.contarRecurso(rec('buzina'), docs, AGORA), app.contarRecurso(app.RECURSOS.find((r) => r.id === 'buzina'), docs, AGORA));
  checar('janela igual', srv.inicioDaJanela(AGORA), app.inicioDaJanela(AGORA));
}

console.log(`\n${ok} ok, ${bad} falhas`);
if (bad) {
  falhas.forEach((f) => console.log(` - ${f}`));
  process.exit(1);
}
