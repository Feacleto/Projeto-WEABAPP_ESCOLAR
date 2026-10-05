const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions/v2');
const LIMITES = require('./limites');
const { apagarEmPaginas } = require('./reguaDasVarreduras');
const { corteDoRegistro, DIAS_DO_REGISTRO } = require('./reguaDoRegistroDaRota');
const { corteDoRecado, DIAS_DO_RECADO } = require('./reguaDoRecadoDoDia');

const REGION = 'southamerica-east1';

/**
 * ⚠️ O PRAZO, E DE ONDE ELE VEM.
 *
 * 60 dias, e o número foi decidido pelo dono em 11/09/2026 — não derivado de
 * nada. O argumento: a discussão sobre entrega é sempre sobre esta semana ou
 * o mês passado; ninguém discute março em outubro. Guardar para sempre é
 * arquivo que ninguém lê e todo mundo responde por; apagar no dia seguinte
 * tira a defesa do motorista na única janela em que ela serve.
 *
 * ⚠️ SE MUDAR AQUI, MUDA NA POLÍTICA DE PRIVACIDADE na mesma alteração — a
 * seção de retenção promete exatamente "60 (sessenta) dias", e das duas
 * versões a que vale contra a plataforma é a escrita. Mesmo acordo de
 * `RETENTION_MONTHS` em `billing.js`.
 */
const DIAS_DE_RETENCAO = 60;

/** O Firestore recusa lotes acima de 500. 400 deixa folga. */
const LOTE = 400;

/**
 * APAGA AS VIAGENS ANTIGAS — `children/{id}/rides/{AAAA-MM-DD}`.
 *
 * ── O QUE ESSES DOCUMENTOS GUARDAM
 * Um por criança por dia, com a hora de cada marco (embarcou, chegou na
 * escola, entregue) e a posição dela na fila. **Nenhum dado de localização**:
 * o mapa de `checkpoints` saiu em 11/09/2026.
 *
 * ── POR QUE APAGAR, SE NÃO TEM LOCALIZAÇÃO
 * Porque nada os lê depois do dia. A única tela que abre uma viagem é o
 * painel do responsável, e ela pede **o dia de hoje** (`useRide(child.id,
 * todayKey)`). A página pública de acompanhar também só lê o dia. Um
 * documento por criança por dia letivo, para sempre, é arquivo que cresce
 * sozinho e que ninguém consulta.
 *
 * ⚠️ O QUE SE PERDE, DITO POR INTEIRO: é o único registro que sabe se a
 * criança REALMENTE rodou num dia. O calendário de faltas mostra o que foi
 * AVISADO (`absenceDeclarations`), e ele próprio confessa a diferença na
 * tela: *"só aparece aqui o que foi avisado pelo app"*. Fechar esse buraco —
 * distinguir "avisou que ia faltar" de "não apareceu" — só é possível dentro
 * da janela de retenção.
 *
 * ⚠️ E ELE NÃO TOCA NO CALENDÁRIO. `absenceDeclarations` é outra coleção e
 * não tem prazo nenhum: o histórico de faltas do responsável continua andando
 * meses para trás, intacto.
 *
 * ── POR QUE `collectionGroup`
 * `rides` é subcoleção de cada criança. Varrer criança por criança seria uma
 * consulta por documento, e a conta cresce com o CALENDÁRIO, não com a turma.
 *
 * ── ⚠️ EM PÁGINAS, E COM O TETO DAS AGENDADAS PESADAS (03/10/2026)
 * Era um `.get()` só, sem `limit`, no padrão de 60 s e 256 MiB: o lote de 400
 * protegia a ESCRITA, mas a leitura já tinha posto a cauda inteira na
 * memória. Com 3.000 crianças são ~60 mil viagens a cada dois meses de dias
 * letivos, e qualquer noite em que ela não rodasse somava à seguinte — até o
 * dia em que morre por memória sem apagar nada, e daí em diante toda noite.
 * Agora lê 400, apaga 400, e repete (`apagarEmPaginas`, testada em
 * `npm run testar:varreduras`).
 *
 * ⚠️ E ELA PRECISA DE UM ÍNDICE QUE NÃO NASCE SOZINHO. Índice de campo único
 * é automático só no escopo de COLEÇÃO; consulta em `collectionGroup` com
 * desigualdade pede a isenção `rides.dateKey` em COLLECTION_GROUP no
 * `firestore.indexes.json` (`fieldOverrides`). Sem ela, a consulta falha com
 * FAILED_PRECONDITION — e o `throw` abaixo é o que faz isso aparecer no log
 * de erro em vez de passar por "0 apagadas".
 */
function makeApagarViagensAntigas(db) {
  return onSchedule(
    {
      // 4h30 — antes do fechamento do mês (5h) e bem longe das duas rotas do
      // dia. Varredura de escrita não divide a manhã com a operação.
      schedule: '30 4 * * *',
      timeZone: 'America/Sao_Paulo',
      region: REGION,
      maxInstances: LIMITES.AGENDADO,
      concurrency: LIMITES.CONCORRENCIA_AGENDADO,
      timeoutSeconds: LIMITES.TEMPO_AGENDADO,
      memory: LIMITES.MEMORIA_AGENDADO,
    },
    async () => {
      const resultado = await apagarViagensAntigas(db);
      logger.info('[retencao] viagens antigas apagadas', resultado);
      // O registro da rota ("O que a Cida marcou") vai na mesma noite, DEPOIS
      // das viagens já logadas: se ele falhar, o log das viagens já saiu.
      const registro = await apagarRegistrosAntigos(db);
      logger.info('[retencao] registros da rota antigos apagados', registro);
      // O recado do dia da família (05/10/2026): 7 dias, na mesma noite.
      const recados = await apagarRecadosAntigos(db);
      logger.info('[retencao] recados do dia antigos apagados', recados);
      return null;
    }
  );
}

/** O dia de corte: viagens com `dateKey` ANTES dele são apagadas. */
function corteDaRetencao(agora = new Date()) {
  const limite = new Date(agora);
  limite.setDate(limite.getDate() - DIAS_DE_RETENCAO);
  // O id do documento é a data — comparar STRING 'AAAA-MM-DD' é comparar
  // data. É a mesma propriedade que torna a viagem idempotente.
  return limite.toISOString().slice(0, 10);
}

async function apagarViagensAntigas(db, { agora = new Date() } = {}) {
  const corte = corteDaRetencao(agora);

  // `dateKey` é gravado em todo documento por `anotarMarco`, então a
  // consulta é por campo e não por id — `__name__` num collectionGroup
  // compara o caminho inteiro, não o último segmento.
  const { apagados, paginas, interrompido } = await apagarEmPaginas({
    tamanho: LOTE,
    buscar: async (tamanho) => {
      const snap = await db
        .collectionGroup('rides')
        .where('dateKey', '<', corte)
        .limit(tamanho)
        .get();
      return snap.docs;
    },
    apagar: async (docs) => {
      const lote = db.batch();
      docs.forEach((d) => lote.delete(d.ref));
      await lote.commit();
    },
  });

  if (interrompido) {
    // Não é erro: o que sobrou sai amanhã. Mas se aparecer duas noites
    // seguidas, a consulta está devolvendo o que o lote não consegue apagar.
    logger.warn('[retencao] parou no teto de páginas; o resto sai na próxima noite', {
      corte,
      apagados,
    });
  }
  return { corte, apagados, paginas, interrompido, diasDeRetencao: DIAS_DE_RETENCAO };
}

/**
 * APAGA O REGISTRO DA ROTA COM MAIS DE 7 DIAS — `registroDaRota/{tio}_{dia}`
 * (05/10/2026, decisão do dono; o porquê do prazo mora em
 * `reguaDoRegistroDaRota.js`).
 *
 * Coleção de RAIZ e campo único em desigualdade: o índice é o automático, sem
 * `fieldOverrides` (a viagem precisa dele por ser `collectionGroup`). Em
 * páginas, pelo mesmo motivo das viagens.
 */
async function apagarRegistrosAntigos(db, { agora = new Date() } = {}) {
  const corte = corteDoRegistro(agora);
  const { apagados, paginas, interrompido } = await apagarEmPaginas({
    tamanho: LOTE,
    buscar: async (tamanho) => {
      const snap = await db
        .collection('registroDaRota')
        .where('dateKey', '<', corte)
        .limit(tamanho)
        .get();
      return snap.docs;
    },
    apagar: async (docs) => {
      const lote = db.batch();
      docs.forEach((d) => lote.delete(d.ref));
      await lote.commit();
    },
  });
  return { corte, apagados, paginas, interrompido, diasDeRetencao: DIAS_DO_REGISTRO };
}

/**
 * APAGA OS RECADOS DO DIA ANTIGOS — `recadosDoDia` com mais de 7 dias
 * (decisão do dono, 05/10/2026). O recado serve no dia; depois é texto livre
 * de uma família parado num lugar que ninguém lê. Coleção de raiz, consulta
 * por um campo só (índice automático), em páginas como as viagens.
 */
async function apagarRecadosAntigos(db, { agora = new Date() } = {}) {
  const corte = corteDoRecado(agora);
  const { apagados, paginas, interrompido } = await apagarEmPaginas({
    tamanho: LOTE,
    buscar: async (tamanho) => {
      const snap = await db
        .collection('recadosDoDia')
        .where('dateKey', '<', corte)
        .limit(tamanho)
        .get();
      return snap.docs;
    },
    apagar: async (docs) => {
      const lote = db.batch();
      docs.forEach((d) => lote.delete(d.ref));
      await lote.commit();
    },
  });
  return { corte, apagados, paginas, interrompido, diasDeRetencao: DIAS_DO_RECADO };
}

module.exports = {
  makeApagarViagensAntigas,
  apagarRecadosAntigos,
  apagarViagensAntigas,
  apagarRegistrosAntigos,
  corteDaRetencao,
  DIAS_DE_RETENCAO,
};
