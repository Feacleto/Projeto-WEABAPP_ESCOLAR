/**
 * O RETRATO DAS PESSOAS DA PLATAFORMA, PARA O DONO — régua pura (05/10/2026).
 *
 * Famílias, auxiliares e a matriz de contas das abas novas do /admin. Sem
 * Firebase e sem React: o service busca, esta régua conta e agrupa — é o que
 * deixa o Node dos testes alcançar.
 *
 * ⚠️ NULL, NUNCA ZERO ONDE NÃO HÁ DADO. Contagem que falhou, campo que
 * ninguém grava ainda e divisão por nada devolvem `null`, e a tela escreve
 * "—". Zero diria "olhei e não há", que é outra afirmação.
 *
 * ⚠️ O QUE ESTA RÉGUA NUNCA DEVOLVE: endereço, telefone, e-mail, pagamento,
 * valor do pagamento da auxiliar e o nível da família. Os dados da turma são
 * do motorista; o dono vê contagem e conta de acesso. Regra não esconde campo
 * (os documentos chegam inteiros ao aparelho), então as linhas abaixo são
 * montadas por LISTA FECHADA de campos — nunca por spread do documento — e o
 * teste procura esses termos dentro do JSON.
 */

const DIA = 24 * 60 * 60 * 1000;

/** Janela de "motorista ativo" e de "saiu há pouco": 30 dias. */
export const DIAS_DE_ATIVO = 30;

/** Milissegundos de um Timestamp do Firestore, Date, número ou nulo. */
export function paraMs(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  if (typeof valor.toMillis === 'function') return valor.toMillis();
  if (valor instanceof Date) {
    const t = valor.getTime();
    return Number.isNaN(t) ? null : t;
  }
  if (typeof valor === 'object') {
    return Number.isFinite(valor.seconds) ? valor.seconds * 1000 : null;
  }
  if (typeof valor === 'string') {
    const t = Date.parse(valor);
    return Number.isNaN(t) ? null : t;
  }
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

/** "Maria Souza Lima" vira "Maria L." — o dono não precisa do nome inteiro. */
export function nomeAbreviado(nome) {
  const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return 'Sem nome';
  if (partes.length === 1) return partes[0];
  return `${partes[0]} ${partes[partes.length - 1][0].toUpperCase()}.`;
}

/** Como as famílias chamam o motorista: a marca; sem ela, o nome civil. */
export function marcaDoMotorista(motorista) {
  if (!motorista) return null;
  const marca = String(motorista.marcaNome || '').trim();
  if (marca) return marca;
  const nome = String(motorista.name || '').trim();
  return nome || null;
}

function mapaPorUid(motoristas) {
  const m = {};
  for (const p of Array.isArray(motoristas) ? motoristas : []) {
    if (p && p.uid) m[p.uid] = p;
  }
  return m;
}

/** Contagem válida (inteiro >= 0) ou null. */
function contagem(v) {
  return Number.isFinite(v) && v >= 0 ? v : null;
}

// ───────────────────────────── FAMÍLIAS ────────────────────────────────────

/** As fichas do topo: cada uma vem de um `count()`; a que falhou fica `null`. */
export function fichasDeFamilias({ responsaveis, criancasComFamilia, convitesSemResposta, pedidosEsperando } = {}) {
  return {
    responsaveis: contagem(responsaveis),
    criancasComFamilia: contagem(criancasComFamilia),
    convitesSemResposta: contagem(convitesSemResposta),
    pedidosEsperando: contagem(pedidosEsperando),
  };
}

/**
 * ONDE A FAMÍLIA TRAVA — quatro degraus, cada um com a taxa (em %) sobre o
 * anterior: criança cadastrada → família criou conta (convite usado) →
 * aceitou o contrato → ligou os avisos. Degrau sem contagem fica `null`, e a
 * taxa dele e a do seguinte também: não dá para dizer quanto passou de um
 * número que não existe.
 */
export function funilDaFamilia({ cadastradas, comConta, aceitaram, comAvisos } = {}) {
  const valores = [cadastradas, comConta, aceitaram, comAvisos].map(contagem);
  const rotulos = [
    ['cadastradas', 'Criança cadastrada'],
    ['comConta', 'Família criou conta'],
    ['aceitaram', 'Aceitou o contrato'],
    ['comAvisos', 'Ligou os avisos'],
  ];
  return rotulos.map(([chave, rotulo], i) => {
    const valor = valores[i];
    const anterior = i === 0 ? null : valores[i - 1];
    const taxa = i === 0 || valor === null || anterior === null || anterior === 0
      ? null
      : Math.round((valor / anterior) * 100);
    return { chave, rotulo, valor, taxa };
  });
}

/**
 * A lista de responsáveis, por lista FECHADA de campos. `avisos` é "tem algum
 * token de push", nunca o token. Mais recentes primeiro.
 */
export function linhasDeResponsaveis(usuarios, motoristas) {
  const porUid = mapaPorUid(motoristas);
  const lista = (Array.isArray(usuarios) ? usuarios : [])
    .filter((u) => u && u.role === 'parent')
    .map((u) => ({
      uid: u.uid || u.id || null,
      nome: nomeAbreviado(u.name),
      motorista: marcaDoMotorista(u.adminUid ? porUid[u.adminUid] : null),
      filhos: Array.isArray(u.childIds) ? u.childIds.length : 0,
      entrouMs: paraMs(u.createdAt),
      avisos: Array.isArray(u.fcmTokens) && u.fcmTokens.length > 0,
      // Só o grau e o prazo (o motivo nunca mora em users). Quem decide se
      // ainda vale é `bloqueioVigente`, na tela.
      bloqueio: u.bloqueio && u.bloqueio.grau ? { grau: u.bloqueio.grau, ate: u.bloqueio.ate || null } : null,
    }));
  return lista.sort((a, b) => (b.entrouMs || 0) - (a.entrouMs || 0));
}

// ───────────────────────────── AUXILIARES ──────────────────────────────────

/**
 * O resumo e as linhas da aba Auxiliares, a partir de `auxiliares/*`.
 * ⚠️ `valorMensal` existe no documento (o que o tio combinou pagar) e NÃO
 * entra no retorno. `saiuEm30` é `null` quando há quem saiu mas nenhum
 * documento guarda a data — não dá para dizer "30 dias" sem ela.
 */
export function retratoDeAuxiliares(vinculos, motoristas, agoraMs) {
  const porUid = mapaPorUid(motoristas);
  const linhas = (Array.isArray(vinculos) ? vinculos : []).filter(Boolean).map((v) => {
    const periodos = Array.isArray(v.periodos) ? v.periodos : [];
    const ultimo = periodos[periodos.length - 1];
    return {
      nome: nomeAbreviado(v.nome),
      motorista: marcaDoMotorista(porUid[v.motoristaUid]) || v.marcaDoMotorista || null,
      motoristaUid: v.motoristaUid || null,
      desdeMs: paraMs(ultimo?.de) ?? paraMs(v.aceitoEm),
      encerradoMs: v.ativa ? null : paraMs(v.encerradoEm) ?? paraMs(ultimo?.ate),
      ativa: !!v.ativa,
    };
  });
  const ativas = linhas.filter((l) => l.ativa);
  const sairam = linhas.filter((l) => !l.ativa);
  const comData = sairam.filter((l) => l.encerradoMs != null);
  let saiuEm30 = null;
  if (sairam.length === 0) saiuEm30 = 0;
  else if (comData.length > 0 && Number.isFinite(agoraMs)) {
    saiuEm30 = comData.filter((l) => l.encerradoMs <= agoraMs && agoraMs - l.encerradoMs <= DIAS_DE_ATIVO * DIA).length;
  }
  const ordenadas = [...linhas].sort((a, b) => {
    if (a.ativa !== b.ativa) return a.ativa ? -1 : 1;
    return (b.desdeMs || 0) - (a.desdeMs || 0);
  });
  return {
    ativas: ativas.length,
    motoristasComAuxiliar: new Set(ativas.map((l) => l.motoristaUid).filter(Boolean)).size,
    saiuEm30,
    linhas: ordenadas,
  };
}

// ───────────────────────────── CONTAS ──────────────────────────────────────

/** O motorista rodou nos últimos 30 dias? Sem `ultimaRota`, não. */
export function motoristaAtivo(motorista, agoraMs) {
  const t = paraMs(motorista?.ultimaRota);
  if (t == null || !Number.isFinite(agoraMs)) return false;
  return t <= agoraMs && agoraMs - t <= DIAS_DE_ATIVO * DIA;
}

/**
 * A matriz Papel × Ativas / Inativas / Suspensas. Motorista: suspenso tem
 * prioridade (não é ativo nem inativo), depois ativo pela rota. Família e
 * auxiliar: só o total; o resto `null`, porque o último acesso delas ainda
 * não é gravado. Os totais vêm de contagem no servidor e podem ser `null`.
 */
export function matrizDeContas({ motoristas, totalFamilias, totalAuxiliares } = {}, agoraMs) {
  const lista = Array.isArray(motoristas) ? motoristas : [];
  let ativas = 0;
  let inativas = 0;
  let suspensas = 0;
  for (const m of lista) {
    if (m?.suspenso === true) suspensas += 1;
    else if (motoristaAtivo(m, agoraMs)) ativas += 1;
    else inativas += 1;
  }
  return [
    { papel: 'motorista', rotulo: 'Motoristas', total: lista.length, ativas, inativas, suspensas },
    { papel: 'familia', rotulo: 'Famílias', total: contagem(totalFamilias), ativas: null, inativas: null, suspensas: null },
    { papel: 'auxiliar', rotulo: 'Auxiliares', total: contagem(totalAuxiliares), ativas: null, inativas: null, suspensas: null },
  ];
}

/** Os motoristas suspensos: marca e desde quando. Mais recentes primeiro. */
export function motoristasSuspensos(motoristas) {
  return (Array.isArray(motoristas) ? motoristas : [])
    .filter((m) => m?.suspenso === true)
    .map((m) => ({
      uid: m.uid || null,
      marca: marcaDoMotorista(m) || 'Sem nome',
      desdeMs: paraMs(m.suspensoEm),
    }))
    .sort((a, b) => (b.desdeMs || 0) - (a.desdeMs || 0));
}

// ───────────────────────────── JORNADA ─────────────────────────────────────

/**
 * Resumo de `niveis/{uid}` para o bloco "Jornada no app" da ficha: nível,
 * próxima missão e há quantos dias a última foi vista feita. Documento
 * ausente é `null`. Datas `null` em `feitasEm` são missões feitas antes de o
 * app anotar a data: não contam.
 */
export function jornadaDoMotorista(doc, agoraMs) {
  if (!doc || typeof doc !== 'object') return null;
  const datas = Object.values(doc.feitasEm && typeof doc.feitasEm === 'object' ? doc.feitasEm : {})
    .map(paraMs)
    .filter((t) => t != null);
  const ultima = datas.length ? Math.max(...datas) : null;
  const dias = ultima != null && Number.isFinite(agoraMs) && agoraMs >= ultima
    ? Math.floor((agoraMs - ultima) / DIA)
    : null;
  const p = doc.progresso;
  return {
    nivel: typeof doc.nivel === 'string' ? doc.nivel : null,
    proxima: doc.proxima?.titulo ? String(doc.proxima.titulo) : null,
    diasDesdeAUltima: dias,
    feitas: Number.isFinite(p?.feitas) ? p.feitas : null,
    total: Number.isFinite(p?.total) ? p.total : null,
  };
}
