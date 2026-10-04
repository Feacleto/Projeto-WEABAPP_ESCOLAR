/**
 * ESPELHO de src/dominio/identidade/nivel.js — a régua dos níveis do
 * motorista, para o servidor (`calcularNiveis` e `recalcularMeuNivel`).
 *
 * ⚠️ SEM REQUIRE NENHUM. Régua de functions/lib não requer firebase-admin nem
 * firebase-functions: `npm run testar:imports` falha se requerer, e a bateria
 * inteira cai junto (ver CLAUDE.md). Quem lê o banco e grava `niveis/{uid}` é
 * outro arquivo.
 *
 * ⚠️ DUPLICAR SÓ VALE COM O TESTE QUE COMPARA. `npm run testar:nivel` roda os
 * dois numa matriz de cenários e exige o mesmo resultado caso a caso. O deploy
 * das functions não alcança `src/`, então mexeu lá, mexe aqui na mesma
 * alteração. A especificação é docs/niveis.md; o formato de `fatos` e do
 * retorno está documentado no cabeçalho do original.
 *
 * O dia é o de Brasília nos dois lados (deslocamento fixo de −3h): o servidor
 * roda em UTC, e "mês corrente" e "prazo" medidos no fuso da máquina fariam
 * o selo oficial discordar da tela perto da meia-noite do dia 1.
 */

'use strict';

// ─── Datas ──────────────────────────────────────────────────────────────────

const FUSO_MS = 3 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;
const SO_DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Qualquer forma de data → Date, ou null. */
function paraData(v) {
  if (v === null || v === undefined || v === '' || v === false) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') return Number.isFinite(v) ? new Date(v) : null;
  if (typeof v === 'string') {
    // 'AAAA-MM-DD' sozinho é um DIA de Brasília, não meia-noite UTC — senão
    // ele viraria o dia anterior às 21h.
    const t = SO_DATA.test(v) ? Date.parse(`${v}T00:00:00-03:00`) : Date.parse(v);
    return Number.isNaN(t) ? null : new Date(t);
  }
  if (typeof v === 'object') {
    if (typeof v.toDate === 'function') return paraData(v.toDate());
    if (typeof v.seconds === 'number') return new Date(v.seconds * 1000);
    if (typeof v._seconds === 'number') return new Date(v._seconds * 1000);
  }
  return null;
}

/** O dia civil em Brasília, como 'AAAA-MM-DD'. */
function diaCivil(v) {
  if (typeof v === 'string' && SO_DATA.test(v)) return v;
  const d = paraData(v);
  if (!d) return null;
  return new Date(d.getTime() - FUSO_MS).toISOString().slice(0, 10);
}

/** 'AAAA-MM-DD' → ms do meio-dia UTC daquele dia (para andar dia a dia sem fuso). */
function diaParaMs(dia) {
  return Date.parse(`${dia}T12:00:00Z`);
}
function msParaDia(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * As férias escolares PAUSAM o prazo: 1 a 31 de julho e 15 de dezembro a 31
 * de janeiro. Motorista escolar tem calendário — cobrar atividade nova de quem
 * está sem rota é cobrar de quem não está usando o app por motivo legítimo.
 */
function diaPausado(dia) {
  const mes = Number(dia.slice(5, 7));
  const d = Number(dia.slice(8, 10));
  return mes === 7 || mes === 1 || (mes === 12 && d >= 15);
}

const PRAZO_DA_ATIVIDADE_DIAS = 30;

/**
 * O último dia do prazo ('AAAA-MM-DD'): o dia da publicação não conta, e cada
 * dia fora das férias depois dele conta um. Lançada em 03/10, o 30º dia é 02/11.
 */
function ultimoDiaDoPrazo(lancadaEm) {
  const inicio = diaCivil(lancadaEm);
  if (!inicio) return null;
  let ms = diaParaMs(inicio);
  let contados = 0;
  while (contados < PRAZO_DA_ATIVIDADE_DIAS) {
    ms += DIA_MS;
    if (!diaPausado(msParaDia(ms))) contados += 1;
  }
  return msParaDia(ms);
}

/**
 * O instante em que a atividade vence: a meia-noite (Brasília) que encerra o
 * último dia do prazo. Antes dele ela está em dia; a partir dele, vencida.
 */
function prazoDaAtividade(lancadaEm) {
  const ultimo = ultimoDiaDoPrazo(lancadaEm);
  if (!ultimo) return null;
  return new Date(Date.parse(`${ultimo}T00:00:00-03:00`) + DIA_MS);
}

/**
 * Quantos dias CONTADOS faltam: os dias fora das férias depois de hoje até o
 * último. No último dia, 0 (ainda vale). Nas férias o número para — é isso
 * que "pausar" quer dizer na tela. Vencida, 0.
 */
function diasRestantes(lancadaEm, agora = new Date()) {
  const ultimo = ultimoDiaDoPrazo(lancadaEm);
  const hoje = diaCivil(agora);
  if (!ultimo || !hoje || hoje >= ultimo) return 0;
  let ms = diaParaMs(hoje);
  const fim = diaParaMs(ultimo);
  let n = 0;
  while (ms < fim) {
    ms += DIA_MS;
    if (!diaPausado(msParaDia(ms))) n += 1;
  }
  return n;
}

// ─── Leitura dos fatos ──────────────────────────────────────────────────────

const texto = (v) => typeof v === 'string' && v.trim() !== '';
const lista = (v) => (Array.isArray(v) ? v : []);
const u = (f) => (f && f.usuario) || {};
const cfg = (f) => (f && f.config) || {};
const marcos = (f) => u(f).marcos || {};

/** Só as crianças ATIVAS contam para "todas" e para percentuais. */
function ativas(f) {
  return lista(f && f.criancas).filter((c) => c && c.active === true);
}

/**
 * "Todas as crianças" com zero crianças é FALSO. Verdade vazia daria a
 * missão de graça a quem desativou a turma inteira.
 */
function todasAtivas(f, pred) {
  const cs = ativas(f);
  return cs.length > 0 && cs.every(pred);
}

const temContrato = (c) => !!(c.contratoAguardando || c.contratoVigente);

/** O mês ('AAAA-MM') a partir do qual um fato "do mês" vale. */
function mesDeReferencia(agora, lancadaEm) {
  const base = diaCivil(lancadaEm) || diaCivil(agora);
  return base ? base.slice(0, 7) : null;
}

/**
 * Um fato datado "do mês" vale se aconteceu do mês de lançamento em diante e
 * não depois de agora. Sem `lancadaEm`, o mês corrente.
 *
 * ⚠️ Não é "o mês de AGORA" puro: feita em outubro, a atividade passaria a
 * contar como não feita em novembro, ficaria vencida e derrubaria da Platina
 * quem cumpriu no prazo. E o mês inteiro do lançamento entra porque atividade
 * feita antes conta (seção 2, regra 5).
 */
function datadoNoMes(datas, agora, lancadaEm) {
  const desde = mesDeReferencia(agora, lancadaEm);
  const hoje = diaCivil(agora);
  if (!desde || !hoje) return false;
  return datas.some((v) => {
    const d = diaCivil(v);
    return !!d && d.slice(0, 7) >= desde && d <= hoje;
  });
}

function datasDaReserva(f) {
  const g = cfg(f).guardado || {};
  return Object.values(g).map((x) => x && x.em).filter((x) => x !== undefined && x !== null);
}

/** Cópia de `planoValido` (cobranca/reservaDaPerua.js) — o espelho não alcança src/. */
function planoDaTrocaFeito(p) {
  if (!p || typeof p !== 'object') return false;
  const num = (n) => typeof n === 'number' && Number.isFinite(n);
  return num(p.valorHoje) && p.valorHoje > 0 && Number.isInteger(p.anos) &&
    p.anos >= 1 && p.anos <= 20 && num(p.valorFinal) && p.valorFinal >= 0;
}

// ─── Catálogos ──────────────────────────────────────────────────────────────

const NIVEIS = ['sem_nivel', 'bronze', 'prata', 'ouro', 'platina', 'diamante'];

/**
 * As missões (seção 4). `nivel` é o nível de onde ela SAI: as do Bronze levam
 * à Prata. `pre` = a jornada já obriga — aparece marcada e não segura degrau
 * (regra 6: não é missão).
 */
const MISSOES = [
  // Bronze → Prata
  {
    id: 'primeiroAcesso', nivel: 'bronze', pre: true, titulo: 'Primeiro acesso completo',
    destino: '/tio/profile',
    cumprida: (f) => texto(u(f).name) && texto(u(f).marcaNome) && texto(u(f).city),
  },
  {
    id: 'primeiraCrianca', nivel: 'bronze', pre: true, titulo: 'Primeira criança cadastrada',
    destino: '/tio/children',
    cumprida: (f) => ativas(f).length > 0,
  },
  {
    id: 'primeiraRota', nivel: 'bronze', pre: true, titulo: 'Primeira rota encerrada',
    destino: '/tio',
    cumprida: (f) => !!paraData(u(f).ultimaRota),
  },
  {
    id: 'logoDaMarca', nivel: 'bronze', pre: false, titulo: 'Pôr o logo da sua marca',
    destino: '/tio/profile',
    cumprida: (f) => texto(u(f).marcaLogoURL),
  },
  {
    id: 'fotoEmUmaCrianca', nivel: 'bronze', pre: false, titulo: 'Pôr a foto de uma criança',
    destino: '/tio/children',
    cumprida: (f) => lista(f && f.criancas).some((c) => c && texto(c.photoURL)),
  },
  {
    id: 'avisosLigados', nivel: 'bronze', pre: false, titulo: 'Ligar os avisos no celular',
    destino: '/tio/notifications',
    cumprida: (f) => lista(u(f).fcmTokens).length > 0,
  },
  {
    id: 'appInstalado', nivel: 'bronze', pre: false, titulo: 'Pôr o app na tela de início',
    destino: '/tio',
    cumprida: (f) => !!marcos(f).appInstalado,
  },
  // Prata → Ouro
  {
    id: 'contratoDeCada', nivel: 'prata', pre: true, titulo: 'Contrato emitido para cada criança',
    destino: '/tio/children',
    cumprida: (f) => todasAtivas(f, temContrato),
  },
  {
    id: 'conviteATodas', nivel: 'prata', pre: false, titulo: 'Mandar o convite a todas as famílias',
    destino: '/tio/children',
    // Conta o GESTO dele (mandou), nunca o da família (entrou) — regra 3. O
    // `parentUid` entra só porque família que entrou prova que o convite foi.
    cumprida: (f) => todasAtivas(f, (c) => texto(c.parentUid) || !!paraData(c.conviteEnviadoEm)),
  },
  {
    id: 'telefoneDaEscola', nivel: 'prata', pre: false, titulo: 'Telefone da escola de todas as crianças',
    destino: '/tio/children/escolas',
    cumprida: (f) => todasAtivas(f, (c) => texto(c.schoolPhone)),
  },
  {
    id: 'turmaOuProfessora', nivel: 'prata', pre: false, titulo: 'Turma ou professora de todas as crianças',
    destino: '/tio/children',
    cumprida: (f) => todasAtivas(f, (c) => texto(c.turma) || texto(c.professora)),
  },
  {
    id: 'acessoDeUmDia', nivel: 'prata', pre: false, titulo: 'Mandar um acesso de 24 horas',
    destino: '/tio/children',
    cumprida: (f) => Number(f && f.acessosTemporariosCriados) > 0,
  },
  // Ouro → Platina
  {
    id: 'senhaDoFinanceiro', nivel: 'ouro', pre: true, titulo: 'Senha do Financeiro',
    destino: '/tio/finance',
    cumprida: (f) => cfg(f).temSenha === true,
  },
  {
    id: 'chavePix', nivel: 'ouro', pre: true, titulo: 'Chave PIX',
    destino: '/tio/pix',
    cumprida: (f) => texto(u(f).pixKey),
  },
  {
    id: 'primeiraDespesa', nivel: 'ouro', pre: false, titulo: 'Lançar a primeira despesa',
    destino: '/tio/finance/expenses',
    cumprida: (f) => lista(f && f.despesas).length > 0,
  },
  {
    id: 'usoDaPerua', nivel: 'ouro', pre: false, titulo: 'Responder "a perua roda só nas rotas?"',
    destino: '/tio/finance/expenses',
    cumprida: (f) => texto(cfg(f).usoDaPerua),
  },
  {
    id: 'primeiraBaixa', nivel: 'ouro', pre: false, titulo: 'Dar baixa numa mensalidade',
    destino: '/tio/finance',
    cumprida: (f) => Number(f && f.baixas) > 0,
  },
  {
    id: 'alvaraConferido', nivel: 'ouro', pre: false, titulo: 'Enviar o alvará para conferir',
    destino: '/tio/selo',
    // Vencido deixa de valer sozinho — o mesmo critério do selo.
    cumprida: (f, agora = new Date()) => {
      if (u(f).verificacao !== 'verificada') return false;
      const validade = diaCivil(u(f).alvaraValidade);
      const hoje = diaCivil(agora);
      return !!validade && !!hoje && validade >= hoje;
    },
  },
];

/**
 * As chaves que uma atividade de Platina pode verificar (seção 5). Atividade
 * cuja `verificacao` não está aqui NÃO EXISTE — nada é marcado à mão.
 * `cumprida(fatos, agora, lancadaEm)`.
 */
const CATALOGO_PLATINA = {
  despesasDoMes: {
    titulo: 'Lançar as despesas do mês',
    cumprida: (f, agora = new Date(), lancadaEm) =>
      datadoNoMes(lista(f && f.despesas).map((d) => d && d.date), agora, lancadaEm),
  },
  reservaAtualizadaNoMes: {
    // A DATA da atualização, nunca o valor — regra 8.
    titulo: 'Atualizar a reserva no mês',
    cumprida: (f, agora = new Date(), lancadaEm) => datadoNoMes(datasDaReserva(f), agora, lancadaEm),
  },
  fotoDeTodas: {
    titulo: 'Foto em todas as crianças',
    cumprida: (f) => todasAtivas(f, (c) => texto(c.photoURL)),
  },
  horarioDeCostumeVisto: {
    titulo: 'Ver o horário de costume',
    cumprida: (f) => !!marcos(f).horarioDeCostumeVisto,
  },
};

/**
 * A trilha do negócio (seção 6). Só as fases 1–3 contam para o Diamante; a 4
 * existe para a tela mostrar o caminho, e não conta na v1 (seguro e subconta
 * só existem em 2028). Marco particular é DECLARADO — mora aqui para a tela,
 * e nunca entra na conta (regra 2).
 */
const TRILHA = [
  {
    numero: 1, id: 'organizado', titulo: 'Organizado', contaParaDiamante: true,
    itens: [
      {
        id: 'despesasEmDoisMeses', titulo: 'Despesas em 2 meses diferentes',
        cumprida: (f) => new Set(lista(f && f.despesas)
          .map((d) => diaCivil(d && d.date)).filter(Boolean).map((d) => d.slice(0, 7))).size >= 2,
      },
      {
        id: 'tanqueCheioDuasVezes', titulo: 'Encher o tanque 2 vezes',
        cumprida: (f) => lista(f && f.despesas)
          .filter((d) => d && d.category === 'fuel' && d.tanqueCheio === true).length >= 2,
      },
      { id: 'usoDaPerua', titulo: 'Responder se a perua roda só nas rotas', cumprida: (f) => texto(cfg(f).usoDaPerua) },
    ],
    marcos: [],
  },
  {
    numero: 2, id: 'planejado', titulo: 'Planejado', contaParaDiamante: true,
    itens: [
      { id: 'planoDaTroca', titulo: 'Fazer o plano da troca da perua', cumprida: (f) => planoDaTrocaFeito(cfg(f).planoDaTroca) },
      { id: 'reservaCriada', titulo: 'Criar a reserva', cumprida: (f) => datasDaReserva(f).some((v) => !!paraData(v)) },
    ],
    marcos: [{ id: 'revisaoDaPerua', titulo: 'Revisão da perua feita' }],
  },
  {
    numero: 3, id: 'formalizado', titulo: 'Formalizado', contaParaDiamante: true,
    itens: [
      { id: 'contratoEmTodas', titulo: 'Contrato no app em todas as crianças', cumprida: (f) => todasAtivas(f, temContrato) },
    ],
    // CNPJ é opcional e NÃO exigido: o motorista não precisa de MEI.
    marcos: [{ id: 'temContador', titulo: 'Tenho contador' }, { id: 'cnpj', titulo: 'Tenho CNPJ' }],
  },
  {
    numero: 4, id: 'protegido', titulo: 'Protegido e conectado', contaParaDiamante: false,
    itens: [],
    marcos: [],
  },
];

/**
 * O que a FAMÍLIA lê ao tocar no selo (seção 7). Bronze e sem nível: nada —
 * a família só vê a partir da Prata. Nenhuma frase afirma segurança
 * (`marca/promessas.js`, conferido no teste).
 */
const FRASE_PARA_FAMILIA = {
  sem_nivel: null,
  bronze: null,
  prata: 'Seu tio usa o Alô Buzinou no dia a dia.',
  ouro: 'Seu tio é engajado no Alô Buzinou.',
  platina: 'Seu tio é muito engajado e está em dia com as novidades.',
  diamante: 'Seu tio é dos mais engajados do Alô Buzinou.',
};

// ─── A conta ────────────────────────────────────────────────────────────────

const indice = (n) => NIVEIS.indexOf(n);

/**
 * O piso de aprendizado: Bronze, Prata e Ouro conquistados NÃO se perdem
 * (seção 1). Platina e Diamante gravados viram Ouro — o que oscila é só o
 * "em dia".
 */
function pisoDe(conquistado) {
  const i = indice(conquistado);
  if (i < 0) return 0;
  return Math.min(i, indice('ouro'));
}

function avaliarAtividades(fatos, atividades, agora) {
  const momento = paraData(agora) || new Date();
  return lista(atividades)
    .filter((a) => a && a.ativa !== false && CATALOGO_PLATINA[a.verificacao] && paraData(a.lancadaEm))
    .filter((a) => paraData(a.lancadaEm).getTime() <= momento.getTime())
    .map((a) => {
      const cat = CATALOGO_PLATINA[a.verificacao];
      const feita = !!cat.cumprida(fatos, momento, a.lancadaEm);
      const prazo = prazoDaAtividade(a.lancadaEm);
      const vencida = !feita && momento.getTime() >= prazo.getTime();
      return {
        id: a.id,
        titulo: a.titulo || cat.titulo,
        feita,
        diasRestantes: feita ? 0 : diasRestantes(a.lancadaEm, momento),
        vencida,
      };
    });
}

function avaliarTrilha(fatos) {
  const fases = TRILHA.map((fase) => {
    const declarados = cfg(fatos).marcosDeclarados || {};
    const itens = fase.itens.map((i) => ({ id: i.id, titulo: i.titulo, feito: !!i.cumprida(fatos) }));
    return {
      numero: fase.numero,
      id: fase.id,
      titulo: fase.titulo,
      contaParaDiamante: fase.contaParaDiamante,
      itens,
      marcos: fase.marcos.map((m) => ({ id: m.id, titulo: m.titulo, declarado: !!declarados[m.id] })),
      completa: fase.contaParaDiamante ? itens.every((i) => i.feito) : false,
    };
  });
  const completa = fases.filter((f) => f.contaParaDiamante).every((f) => f.completa);
  return { fases, completa };
}

/**
 * O nível de hoje. `atividades` são os documentos de `atividadesDaPlatina`
 * ({ id, titulo, verificacao, lancadaEm, ativa }). `conquistado` é o nível
 * gravado antes (opcional) — é ele que impede que a criança nova sem telefone
 * da escola derrube da Prata quem já tinha subido.
 */
function calcularNivel(fatos, { atividades = [], agora = new Date(), conquistado = null } = {}) {
  const momento = paraData(agora) || new Date();
  const missoes = MISSOES.map((m) => ({
    id: m.id, nivel: m.nivel, titulo: m.titulo, pre: m.pre, destino: m.destino,
    // Pré aparece JÁ MARCADA: a jornada a obriga, não é missão (regra 6).
    feita: m.pre ? true : !!m.cumprida(fatos, momento),
  }));
  const faltamDe = (nivel) => missoes
    .filter((m) => m.nivel === nivel && !m.pre && !m.feita)
    .map((m) => ({ tipo: 'missao', id: m.id, titulo: m.titulo }));

  const platinaAtividades = avaliarAtividades(fatos, atividades, momento);
  const trilha = avaliarTrilha(fatos);
  const resultado = (nivel, proximo) => ({ nivel, missoes, proximo, platina: { atividades: platinaAtividades }, trilha });

  // Antes da primeira rota encerrada não há selo nem missão (seção 3).
  if (!paraData(u(fatos).ultimaRota)) return resultado('sem_nivel', null);

  // Aprender: Bronze → Prata → Ouro, com piso no que já foi conquistado.
  let aprendido = indice('bronze');
  if (faltamDe('bronze').length === 0) {
    aprendido = indice('prata');
    if (faltamDe('prata').length === 0) aprendido = indice('ouro');
  }
  aprendido = Math.max(aprendido, pisoDe(conquistado));

  if (aprendido < indice('ouro')) {
    const nivel = NIVEIS[aprendido];
    return resultado(nivel, { nivel: NIVEIS[aprendido + 1], faltam: faltamDe(nivel) });
  }

  // Em dia: Ouro + missões do Ouro + ≥1 atividade feita + nenhuma vencida.
  const faltamOuro = faltamDe('ouro');
  const feitas = platinaAtividades.filter((a) => a.feita);
  const vencidas = platinaAtividades.filter((a) => a.vencida);
  const emDia = faltamOuro.length === 0 && feitas.length > 0 && vencidas.length === 0;

  if (!emDia) {
    const faltam = [
      ...faltamOuro,
      ...platinaAtividades.filter((a) => !a.feita).map((a) => ({ tipo: 'atividade', id: a.id, titulo: a.titulo })),
    ];
    return resultado('ouro', { nivel: 'platina', faltam });
  }

  if (trilha.completa) return resultado('diamante', null);

  const faltamTrilha = [];
  for (const fase of trilha.fases) {
    if (!fase.contaParaDiamante) continue;
    for (const i of fase.itens) if (!i.feito) faltamTrilha.push({ tipo: 'trilha', id: i.id, titulo: i.titulo });
  }
  return resultado('platina', { nivel: 'diamante', faltam: faltamTrilha });
}

module.exports = {
  paraData,
  diaPausado,
  PRAZO_DA_ATIVIDADE_DIAS,
  prazoDaAtividade,
  diasRestantes,
  NIVEIS,
  MISSOES,
  CATALOGO_PLATINA,
  TRILHA,
  FRASE_PARA_FAMILIA,
  calcularNivel,
};
