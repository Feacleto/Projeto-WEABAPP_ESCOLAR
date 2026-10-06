/**
 * O USO DO APP NO SERVIDOR — espelho de `src/dominio/associacao/usoDoApp.js`.
 *
 * ── POR QUE EXISTE
 * O dono precisa saber que recurso o motorista usa e qual ninguém toca, para
 * decidir o que manter e o que melhorar. A resposta já está gravada: cada
 * recurso deixa um documento com o `adminUid` e uma data. Contar de noite, no
 * servidor, dispensa rastrear clique no cliente — nada novo sai do aparelho.
 *
 * ── ⚠️ SÓ NÚMEROS, NUNCA UM UID
 * `contarRecurso` junta os motoristas distintos num Set EM MEMÓRIA e devolve só
 * o tamanho dele. O documento gravado tem contagens por recurso e mais nada.
 * E o número pequeno também identifica: "1 motorista usou a substituta" aponta
 * uma pessoa numa base pequena, então `motoristasParaMostrar` esconde 1 e 2
 * ("menos de 3"). A escolha é feita aqui, na régua, não na tela.
 *
 * ── RÉGUA PURA
 * Sem `firebase-admin` nem `firebase-functions` (ver `testar:imports`): quem lê
 * o banco é `usoDoApp.js`. Duplicada em `src/` porque o deploy das functions
 * não alcança aquela pasta; `testar:uso-do-app` compara as duas.
 */

const DIAS_DO_USO = 30;
const DIA_MS = 24 * 60 * 60 * 1000;
const FUSO = 'America/Sao_Paulo';

/** Abaixo disto a contagem não é mostrada: identifica a pessoa. */
const MINIMO_PARA_MOSTRAR = 3;
/** Base menor que isto: ainda é cedo para chamar qualquer coisa de pouco usada. */
const BASE_MINIMA = 10;
/** A partir de metade da base usando, o recurso é parte do app. */
const CORTE_MANTER = 0.5;
/** Entre 20% e metade: usado, mas por poucos. Abaixo: ninguém sente falta. */
const CORTE_MELHORAR = 0.2;

/**
 * A LISTA FECHADA. `campoUid` é quem fez; `campoData` diz quando — `tipoData`
 * 'dia' é a string 'AAAA-MM-DD' de `rides`, 'hora' é Timestamp; sem `campoData`
 * o recurso vale "agora" (a auxiliar ativa). `filtro` separa o abastecer das
 * despesas, que moram na mesma coleção.
 */
const RECURSOS = [
  { id: 'rotas', rotulo: 'Rota iniciada', colecao: 'users', campoUid: '__id', campoData: 'ultimaRota', tipoData: 'hora', soMotoristas: true, contaVezes: false },
  { id: 'marcacoes', rotulo: 'Embarque e entrega marcados', colecao: 'rides', grupo: true, campoUid: 'adminUid', campoData: 'dateKey', tipoData: 'dia', contaVezes: true },
  { id: 'baixas', rotulo: 'Baixa de mensalidade', colecao: 'payments', campoUid: 'adminUid', campoData: 'paidAt', tipoData: 'hora', filtro: { campo: 'status', valor: 'paid' }, contaVezes: true },
  { id: 'buzina', rotulo: 'Buzina', colecao: 'pendingCalls', campoUid: 'adminUid', campoData: 'createdAt', tipoData: 'hora', contaVezes: true },
  { id: 'recado', rotulo: 'Recado no caderno', colecao: 'agendaEntries', campoUid: 'adminUid', campoData: 'createdAt', tipoData: 'hora', contaVezes: true },
  { id: 'despesas', rotulo: 'Despesa lançada', colecao: 'expenses', campoUid: 'adminUid', campoData: 'createdAt', tipoData: 'hora', contaVezes: true },
  { id: 'abastecer', rotulo: 'Abastecimento', colecao: 'expenses', campoUid: 'adminUid', campoData: 'createdAt', tipoData: 'hora', filtro: { campo: 'category', valor: 'fuel' }, contaVezes: true },
  { id: 'fotoDaTurma', rotulo: 'Foto da turma', colecao: 'fotosDaTurma', campoUid: 'adminUid', campoData: 'criadaEm', tipoData: 'hora', contaVezes: true },
  { id: 'acesso24h', rotulo: 'Acesso de 24 horas', colecao: 'acessosTemporarios', campoUid: 'adminUid', campoData: 'criadoEm', tipoData: 'hora', contaVezes: true },
  { id: 'auxiliar', rotulo: 'Auxiliar ativa', colecao: 'auxiliares', campoUid: 'motoristaUid', campoData: null, tipoData: null, filtro: { campo: 'ativa', valor: true }, contaVezes: false },
];

function paraData(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  if (typeof valor?.toDate === 'function') return valor.toDate();
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 'AAAA-MM-DD' de Brasília — o mesmo critério da foto da base. */
function chaveDoDia(agora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(agora);
}

/** O primeiro dia da janela, como 'AAAA-MM-DD' (para `rides.dateKey`). */
function inicioDaJanela(agora = new Date(), dias = DIAS_DO_USO) {
  return chaveDoDia(new Date(agora.getTime() - dias * DIA_MS));
}

function dentroDaJanela(recurso, doc, agora, dias) {
  if (!recurso.campoData) return true;
  const valor = doc?.[recurso.campoData];
  if (recurso.tipoData === 'dia') {
    return typeof valor === 'string' && valor >= inicioDaJanela(agora, dias) && valor <= chaveDoDia(agora);
  }
  const d = paraData(valor);
  if (!d) return false;
  const passou = agora.getTime() - d.getTime();
  return passou >= 0 && passou < dias * DIA_MS;
}

/**
 * Conta UM recurso. `docs` são documentos crus ({ id, ...campos }). Devolve só
 * `{ motoristas, vezes }`; os uids vivem num Set que morre aqui dentro.
 * `vezes` é null onde o campo não permite contar (a última rota é uma data
 * só, não um histórico).
 */
function contarRecurso(recurso, docs, agora = new Date(), dias = DIAS_DO_USO) {
  const quem = new Set();
  let vezes = 0;
  (Array.isArray(docs) ? docs : []).forEach((doc) => {
    if (!doc) return;
    if (recurso.soMotoristas && doc.role !== 'admin') return;
    if (recurso.filtro && doc[recurso.filtro.campo] !== recurso.filtro.valor) return;
    if (!dentroDaJanela(recurso, doc, agora, dias)) return;
    const uid = recurso.campoUid === '__id' ? doc.id : doc[recurso.campoUid];
    if (!uid || typeof uid !== 'string') return;
    quem.add(uid);
    vezes += 1;
  });
  return { motoristas: quem.size, vezes: recurso.contaVezes ? vezes : null };
}

/** Quantos motoristas rodaram na janela — a base da fração. */
function baseDoUso(usuarios, agora = new Date(), dias = DIAS_DO_USO) {
  return contarRecurso(RECURSOS[0], usuarios, agora, dias).motoristas;
}

/** 1 e 2 viram "menos de 3": numa base pequena o número aponta uma pessoa. */
function motoristasParaMostrar(n) {
  const v = Number(n) || 0;
  if (v > 0 && v < MINIMO_PARA_MOSTRAR) return 'menos de 3';
  return String(v);
}

function sugestaoDe(motoristas, base) {
  if (!(base >= BASE_MINIMA)) return 'cedo';
  const fracao = motoristas / base;
  if (fracao >= CORTE_MANTER) return 'manter';
  if (fracao >= CORTE_MELHORAR) return 'melhorar';
  return 'avaliar';
}

/**
 * Ordena do mais usado ao menos usado (empate: mais vezes, depois a ordem da
 * lista) e sugere. A ORDEM usa o número real; o que sai para mostrar já passa
 * por `motoristasParaMostrar` — com percentual e vezes escondidos junto,
 * senão "menos de 3" ao lado de "2%" desfaria o esconder.
 */
function resumoDoUso(contagens, base) {
  const b = Number(base) || 0;
  return RECURSOS.map((r, i) => {
    const c = contagens?.[r.id] || {};
    const motoristas = Number(c.motoristas) || 0;
    const vezes = c.vezes === null || c.vezes === undefined ? null : Number(c.vezes) || 0;
    const escondido = motoristas > 0 && motoristas < MINIMO_PARA_MOSTRAR;
    return {
      id: r.id,
      rotulo: r.rotulo,
      motoristas,
      motoristasTexto: motoristasParaMostrar(motoristas),
      vezes: escondido ? null : vezes,
      fracao: b > 0 && !escondido ? Math.min(1, motoristas / b) : null,
      sugestao: sugestaoDe(motoristas, b),
      indice: i,
    };
  })
    .sort((a, b2) => b2.motoristas - a.motoristas || (b2.vezes || 0) - (a.vezes || 0) || a.indice - b2.indice)
    .map((l) => {
      delete l.indice;
      return l;
    });
}

/** O documento gravado: LISTA FECHADA, só números. Nenhum uid. */
function usoDoDia(contagens, base, agora = new Date()) {
  const recursos = {};
  RECURSOS.forEach((r) => {
    const c = contagens?.[r.id] || {};
    recursos[r.id] = {
      motoristas: Number(c.motoristas) || 0,
      vezes: c.vezes === null || c.vezes === undefined ? null : Number(c.vezes) || 0,
    };
  });
  return { dia: chaveDoDia(agora), janelaDias: DIAS_DO_USO, baseMotoristas: Number(base) || 0, recursos };
}

module.exports = {
  DIAS_DO_USO,
  MINIMO_PARA_MOSTRAR,
  BASE_MINIMA,
  CORTE_MANTER,
  CORTE_MELHORAR,
  RECURSOS,
  chaveDoDia,
  inicioDaJanela,
  contarRecurso,
  baseDoUso,
  motoristasParaMostrar,
  sugestaoDe,
  resumoDoUso,
  usoDoDia,
};
