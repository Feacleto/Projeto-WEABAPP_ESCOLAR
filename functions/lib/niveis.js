/**
 * OS NÍVEIS DO MOTORISTA, NO SERVIDOR — quem lê o banco e grava o selo oficial.
 *
 * A especificação é docs/niveis.md. A conta é pura e mora em
 * `reguaDoNivel.js` (espelho de `src/dominio/identidade/nivel.js`, comparado
 * caso a caso por `npm run testar:nivel`). Este arquivo faz o que a régua não
 * pode: ler `users`, `children`, `acessosTemporarios`, `configFinanceiro`,
 * `expenses` e `payments`, e gravar `niveis/{uid}`.
 *
 * ⚠️ ELE REQUER O SDK, então nenhum script da bateria pode importá-lo —
 * `testar:imports` guarda isso. Régua nova vai para `reguaDoNivel.js`, nunca
 * para cá.
 *
 * ── O QUE É GRAVADO, E O QUE NÃO É
 * `niveis/{uid}` = `{ nivel, desde, atualizadoEm }` — SÓ o rótulo. As famílias
 * do motorista leem este documento (é o selo no cabeçalho do /pai), e regra
 * não esconde campo: missão, atividade vencida ou trilha aqui dentro seria o
 * MOTIVO do nível na mão da família, que a seção 7 proíbe. O checklist da
 * tela "Meu nível" é recalculado no aparelho dele, com a mesma régua.
 *
 * ── DUAS PORTAS
 * `calcularNiveis` (agendada, todo dia às 5h30 de Brasília) é o que faz a
 * Platina CAIR quando um prazo vence sem ninguém abrir o app. A callable
 * `recalcularMeuNivel` é o que faz o selo SUBIR na hora: o motorista a chama
 * ao encerrar a rota e ao abrir "Meu nível" — esperar a madrugada para
 * ganhar o Bronze da primeira rota seria a recompensa chegando no dia seguinte.
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions/v2');
const { FieldPath, FieldValue } = require('firebase-admin/firestore');
const LIMITES = require('./limites');
const { exigirMotorista } = require('./papeis');
const {
  calcularNivel, paraData, anotarFeitas, proximaMissao, progressoDoNivel,
} = require('./reguaDoNivel');

const REGION = 'southamerica-east1';

/** Quantos motoristas por página da varredura, e quantos ao mesmo tempo. */
const TAMANHO_DA_PAGINA = 200;
const AO_MESMO_TEMPO = 10;

const FUSO_MS = 3 * 60 * 60 * 1000;

/** O dia civil em Brasília ('AAAA-MM-DD') — o mesmo deslocamento da régua. */
function diaDeBrasilia(v) {
  const d = paraData(v);
  return d ? new Date(d.getTime() - FUSO_MS).toISOString().slice(0, 10) : null;
}

/**
 * O que a régua lê de cada criança — e NADA além disso. `select` não é só
 * economia de banda: endereço, telefone da família e dado de saúde não têm o
 * que fazer dentro de uma conta de nível, e o que não é lido não vaza em log.
 */
const CAMPOS_DA_CRIANCA = [
  'active', 'photoURL', 'parentUid', 'conviteEnviadoEm', 'schoolPhone',
  'turma', 'professora', 'contratoAguardando', 'contratoVigente',
];

/** Contagem por agregação: uma leitura por mil documentos, nenhum baixado. */
async function contar(consulta) {
  const snap = await consulta.count().get();
  return Number(snap.data().count) || 0;
}

/**
 * MONTA OS FATOS de um motorista no formato do cabeçalho de `nivel.js`.
 * Devolve `null` se não houver documento em `users` (conta órfã não tem
 * nível, e calcular sobre `{}` daria `sem_nivel` com cara de resposta).
 *
 * ⚠️ TODA CONSULTA É ESCOPADA PELO uid — nunca por nada que veio do cliente.
 */
async function montarFatos(db, uid) {
  const userSnap = await db.doc(`users/${uid}`).get();
  if (!userSnap.exists) return null;
  const d = userSnap.data() || {};

  const [criancasSnap, acessos, configSnap, despesasSnap, baixas] = await Promise.all([
    db.collection('children').where('adminUid', '==', uid).select(...CAMPOS_DA_CRIANCA).get(),
    // "Um acesso de 24h mandado" é o GESTO dele (regra 3): o acesso que a
    // FAMÍLIA gerou também carrega o `adminUid` dele, e não conta. O campo é
    // `criadoPor` ('motorista' | 'familia'), gravado em `acompanhamento.js`.
    contar(
      db.collection('acessosTemporarios')
        .where('adminUid', '==', uid)
        .where('criadoPor', '==', 'motorista')
    ),
    db.doc(`configFinanceiro/${uid}`).get(),
    // Só a DATA, a categoria e o tanque cheio — nunca o valor (regra 8).
    db.collection('expenses').where('adminUid', '==', uid).select('date', 'category', 'tanqueCheio').get(),
    contar(
      db.collection('payments')
        .where('adminUid', '==', uid)
        .where('status', '==', 'paid')
    ),
  ]);

  const config = configSnap.exists ? configSnap.data() || {} : {};

  return {
    usuario: {
      name: d.name,
      marcaNome: d.marcaNome,
      city: d.city,
      ultimaRota: d.ultimaRota,
      marcaLogoURL: d.marcaLogoURL,
      fcmTokens: Array.isArray(d.fcmTokens) ? d.fcmTokens : [],
      pixKey: d.pixKey,
      verificacao: d.verificacao,
      alvaraValidade: d.alvaraValidade,
      marcos: d.marcos || {},
    },
    criancas: criancasSnap.docs.map((c) => ({ id: c.id, ...c.data() })),
    acessosTemporariosCriados: acessos,
    config: {
      temSenha: config.temSenha,
      usoDaPerua: config.usoDaPerua,
      planoDaTroca: config.planoDaTroca,
      // Só as DATAS das caixas: o valor guardado não entra (regra 8).
      guardado: {
        troca: config.guardado?.troca?.em ? { em: config.guardado.troca.em } : undefined,
        manutencao: config.guardado?.manutencao?.em ? { em: config.guardado.manutencao.em } : undefined,
      },
      marcosDeclarados: config.marcosDeclarados || {},
    },
    despesas: despesasSnap.docs.map((e) => e.data()),
    baixas,
  };
}

/** As atividades de Platina em vigor (`ativa == true`), com o id. */
async function lerAtividades(db) {
  const snap = await db.collection('atividadesDaPlatina').where('ativa', '==', true).get();
  return snap.docs.map((a) => ({ id: a.id, ...a.data() }));
}

/**
 * CALCULA E GRAVA o nível de um motorista. Devolve `{ nivel, gravou }`.
 *
 * `atividades` é opcional: a agendada lê a coleção UMA vez e passa para todos;
 * a callable deixa este módulo ler.
 *
 * ⚠️ QUANDO ESCREVE (decisão, 04/10/2026):
 *   - o nível MUDOU → grava `nivel`, `desde` e `atualizadoEm`;
 *   - não mudou, mas a última conferência é de OUTRO DIA (Brasília) → grava só
 *     `atualizadoEm`. É o que deixa o dono ver que a agendada passou por ele;
 *   - não mudou e já foi conferido hoje → NÃO escreve. A callable roda a cada
 *     rota encerrada e a cada abertura de "Meu nível": escrever ali todo
 *     toque dispararia a escuta de todas as famílias dele sem nada novo.
 *   - `sem_nivel` sem documento → NÃO cria. Documento ausente já É "sem
 *     nível" para quem lê, e criar um por motorista recém-cadastrado seria
 *     escrita sem informação nenhuma.
 *
 * `desde` só muda quando o nível muda — é a data da conquista (ou da queda).
 * Transação porque a agendada e a callable podem cruzar no mesmo motorista, e
 * a que chega depois não pode reescrever `desde` com base num nível velho.
 */
/** Os níveis que dão o adesivo (o primeiro em que ele chega vale para sempre). */
const NIVEIS_DO_ADESIVO = ['platina', 'diamante'];

async function calcularEGravar(db, uid, agora = new Date(), atividades = null) {
  const fatos = await montarFatos(db, uid);
  if (!fatos) return { nivel: 'sem_nivel', gravou: false };
  const lista = atividades || (await lerAtividades(db));
  const ref = db.doc(`niveis/${uid}`);

  return db.runTransaction(async (tx) => {
    const atual = await tx.get(ref);
    const gravado = atual.exists ? atual.data() || {} : null;
    // O nível gravado é o PISO do que já foi aprendido: a criança nova sem
    // telefone da escola não derruba da Prata quem já tinha subido.
    const conquistado = gravado?.nivel || null;
    const { nivel, missoes } = calcularNivel(fatos, { atividades: lista, agora, conquistado });

    // O RESUMO QUE O MENU DO PERFIL LÊ (04/10/2026): quando cada missão foi
    // vista feita, a próxima e o progresso. Mora aqui para o menu abrir com
    // UMA leitura — a régua inteira no aparelho pede a turma e um ano de
    // despesas. Ver `anotarFeitas` sobre o `null` da primeira vez.
    const agoraMs = (paraData(agora) || new Date()).getTime();
    const { mapa: feitasEm, mudou: mudouFeitas } = anotarFeitas(missoes, gravado?.feitasEm, agoraMs);
    const proxima = proximaMissao(missoes, nivel);
    const progresso = progressoDoNivel(missoes, nivel);
    const resumo = { feitasEm, proxima, progresso };
    // O ADESIVO DA PERUA É PRÊMIO DA PRIMEIRA PLATINA (04/10/2026, decisão do
    // dono). A Platina oscila, o prêmio não: `platinaEm` é gravado UMA vez e
    // atravessa toda troca de nível (os `tx.set` abaixo substituem o
    // documento inteiro, e sem carregar o campo a queda para o Ouro apagaria
    // o direito ao adesivo). As rules de `pedidosAdesivo` leem este campo.
    const chegouNaPlatina = NIVEIS_DO_ADESIVO.includes(nivel);
    const marcoDoAdesivo = gravado?.platinaEm
      ? { platinaEm: gravado.platinaEm }
      : chegouNaPlatina
        ? { platinaEm: FieldValue.serverTimestamp() }
        : {};
    const mudouResumo = mudouFeitas
      || JSON.stringify(gravado?.proxima ?? null) !== JSON.stringify(proxima)
      || JSON.stringify(gravado?.progresso ?? null) !== JSON.stringify(progresso);

    if (!gravado) {
      if (nivel === 'sem_nivel') return { nivel, gravou: false };
      tx.set(ref, {
        nivel,
        ...resumo,
        ...marcoDoAdesivo,
        desde: FieldValue.serverTimestamp(),
        atualizadoEm: FieldValue.serverTimestamp(),
      });
      return { nivel, gravou: true };
    }

    if (gravado.nivel !== nivel) {
      tx.set(ref, {
        nivel,
        ...resumo,
        ...marcoDoAdesivo,
        desde: FieldValue.serverTimestamp(),
        atualizadoEm: FieldValue.serverTimestamp(),
      });
      return { nivel, gravou: true };
    }

    // Quem já era Platina antes de o prêmio existir ganha o marco aqui.
    const faltaMarco = chegouNaPlatina && !gravado.platinaEm;
    if (faltaMarco || mudouResumo || diaDeBrasilia(gravado.atualizadoEm) !== diaDeBrasilia(agora)) {
      tx.update(ref, { ...resumo, ...marcoDoAdesivo, atualizadoEm: FieldValue.serverTimestamp() });
      return { nivel, gravou: true };
    }
    return { nivel, gravou: false };
  });
}

/**
 * A VARREDURA — todo motorista (`role == 'admin'`), em páginas.
 *
 * ⚠️ UM MOTORISTA QUE FALHA NÃO DERRUBA OS OUTROS, como no fechamento: o erro
 * é logado com o uid e a varredura segue. O que lança é só a leitura das
 * atividades ou de uma página — e aí a retentativa da agendada é segura,
 * porque recalcular é idempotente (mesmo dia, mesmo resultado, sem escrita).
 */
async function calcularTodos(db, { agora = new Date() } = {}) {
  const atividades = await lerAtividades(db);
  const resultado = { vistos: 0, gravados: 0, erros: 0 };
  let ultimo = null;

  for (;;) {
    let consulta = db.collection('users')
      .where('role', '==', 'admin')
      .orderBy(FieldPath.documentId())
      .select()
      .limit(TAMANHO_DA_PAGINA);
    if (ultimo) consulta = consulta.startAfter(ultimo);
    const pagina = await consulta.get();
    if (pagina.empty) break;

    const uids = pagina.docs.map((doc) => doc.id);
    for (let i = 0; i < uids.length; i += AO_MESMO_TEMPO) {
      const fatia = uids.slice(i, i + AO_MESMO_TEMPO);
      const saidas = await Promise.allSettled(
        fatia.map((uid) => calcularEGravar(db, uid, agora, atividades))
      );
      saidas.forEach((s, j) => {
        resultado.vistos += 1;
        if (s.status === 'fulfilled') {
          if (s.value.gravou) resultado.gravados += 1;
        } else {
          resultado.erros += 1;
          logger.warn('[niveis] motorista não calculou', {
            uid: fatia[j],
            motivo: s.reason?.message,
          });
        }
      });
    }

    ultimo = pagina.docs[pagina.docs.length - 1];
    if (pagina.size < TAMANHO_DA_PAGINA) break;
  }

  logger.info('[niveis] varredura feita', resultado);
  return resultado;
}

/**
 * A AGENDADA — todo dia às 5h30 de Brasília, antes da primeira rota da manhã:
 * a família que abre o app às 6h vê o selo do dia, e a Platina vencida à
 * meia-noite já caiu.
 */
function makeCalcularNiveis(db) {
  return onSchedule(
    {
      schedule: '30 5 * * *',
      timeZone: 'America/Sao_Paulo',
      region: REGION,
      retryCount: 2,
      maxInstances: LIMITES.AGENDADO,
      concurrency: LIMITES.CONCORRENCIA_AGENDADO,
      timeoutSeconds: LIMITES.TEMPO_AGENDADO,
      memory: LIMITES.MEMORIA_AGENDADO,
    },
    async () => {
      await calcularTodos(db, { agora: new Date() });
    }
  );
}

/**
 * A CALLABLE — o motorista recalcula SÓ o próprio nível. O uid vem da sessão
 * (`exigirMotorista`), nunca de `request.data`: não há parâmetro nenhum.
 */
function makeRecalcularMeuNivel(db) {
  return onCall(
    { ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO },
    async (request) => {
      const uid = await exigirMotorista(db, request);
      const { nivel } = await calcularEGravar(db, uid, new Date());
      return { nivel };
    }
  );
}

module.exports = {
  makeCalcularNiveis,
  makeRecalcularMeuNivel,
  montarFatos,
  calcularEGravar,
  calcularTodos,
};
