/**
 * A SUBSTITUTA DE UM DIA — a régua (F3, 05/10/2026).
 *
 * ── O PROBLEMA
 * A auxiliar faltou e o tio chamou alguém da lista de substitutas
 * (`substitutasDoTio`). Essa pessoa não tem conta, vai trabalhar UM dia, e
 * precisa saber a ordem: quem pega, a que horas, em que escola. Hoje isso ia
 * por foto do caderno ou de cabeça.
 *
 * ── A DECISÃO: UM LINK QUE VALE SÓ HOJE, NUNCA UMA CONTA
 * O tio toca "Chamar hoje" e manda pelo WhatsApp dela um link
 * `/substituta/s_{id}.{SEGREDO}`. Não há login nem sessão do Firebase: a
 * página chama a callable pública `verRotaDaSubstituta`, que confere o hash
 * do segredo e devolve um RECORTE FECHADO. Ela só VÊ — não marca nada.
 *
 *   acessosDeSubstituta/{id} = { motoristaUid, substitutaId, nome, dateKey,
 *     segredoHash, criadoEm, encerradoEm, encerradoPor }
 *
 * O segredo NUNCA fica no documento (só o SHA-256 dele), e só o tio dono lê o
 * documento (rules; nem o dono da plataforma).
 *
 * ── QUANDO O LINK MORRE
 *   - à meia-noite de Brasília: `dateKey` diferente de hoje, decidido NA
 *     LEITURA (não há agendada apagando nada);
 *   - quando o tio encerra (`encerradoEm`);
 *   - quando a ROTA DO DIA acaba: a rota foi encerrada DEPOIS de o link nascer,
 *     e encerrada perto da última parada do dia (`rotaDoDiaAcabou`). ⚠️ A ida
 *     e a volta costumam ser duas rotas: encerrar a ida às 7h30 não pode
 *     matar o link de quem ainda vai fazer a volta às 17h.
 *
 * ── AS TRÊS RECUSAS SÃO UMA FRASE SÓ
 * Dia vencido, encerrado e segredo errado respondem "Este link não vale
 * mais." — diferenciar diria a quem sonda que o endereço existe.
 *
 * ── ⚠️ O QUE ELA NUNCA VÊ
 * Sobrenome, foto, telefone, endereço, coordenada, mensalidade, contrato,
 * saúde. O recorte é uma LISTA DE CAMPOS (`CAMPOS_DA_PARADA`), nunca um
 * spread, e `npm run testar:substituta-de-um-dia` procura cada valor
 * sensível dentro do JSON. Só o PRIMEIRO nome: escola + nome completo é a
 * criança identificada para qualquer um que receba o print.
 *
 * PURA: sem `require` (`npm run testar:imports`). Quem lê e escreve é
 * `substitutaDeUmDia.js`.
 */

'use strict';

const PREFIXO = 's_';
const FRASE_DO_LINK_MORTO = 'Este link não vale mais.';
const FUSO = 'America/Sao_Paulo';

/** Os campos de cada parada que saem para a substituta. A lista é o contrato. */
const CAMPOS_DA_PARADA = Object.freeze([
  'chave', 'nome', 'horaPega', 'horaEntrega',
  'period', 'pickupPeriod', 'dropoffPeriod',
  'escola', 'status', 'falta',
]);

const STATUS_VALIDOS = ['home', 'onboard', 'atSchool', 'delivered'];
const TIPOS_DE_FALTA = ['full', 'no-pickup', 'no-dropoff', 'picked-up'];
const PERIODOS = ['morning', 'afternoon', 'evening'];

/**
 * A rota encerrada a menos disto da ÚLTIMA parada do dia é "a rota do dia".
 * Antes disso é a ida (ou um "Cancelar" nos 10 s do início) — o dia continua.
 */
const MARGEM_DO_FIM_DO_DIA_MIN = 90;

function emMs(valor) {
  if (valor == null) return null;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  if (typeof valor.toMillis === 'function') return valor.toMillis();
  if (valor instanceof Date) return valor.getTime();
  if (typeof valor.seconds === 'number') return valor.seconds * 1000;
  return null;
}

/** 'AAAA-MM-DD' em Brasília. */
function chaveDoDia(ms = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(new Date(ms));
}

/** Minutos desde a meia-noite, em Brasília. */
function minutoDeBrasilia(ms = Date.now()) {
  const partes = new Intl.DateTimeFormat('en-GB', {
    timeZone: FUSO, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(ms));
  const h = Number(partes.find((p) => p.type === 'hour')?.value);
  const m = Number(partes.find((p) => p.type === 'minute')?.value);
  return h * 60 + m;
}

/**
 * "07:05" → 425; aceita as formas de `normalizaHora` (src/dominio/rota/
 * horarios.js): '7:05', '7h05', '0705'. Lixo → null.
 */
function minutosDaHora(hhmm) {
  if (hhmm == null) return null;
  const m = String(hhmm).trim().match(/^(\d{1,2})\s*[:hH]?\s*(\d{2})?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] == null ? 0 : Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** "Ana Beatriz Souza" → "Ana". */
function primeiroNome(nome) {
  return String(nome || '').trim().split(/\s+/)[0].slice(0, 30);
}

// ─────────────────────────────────────────────────────────────────────────
// O token
// ─────────────────────────────────────────────────────────────────────────

/** `s_{id}.{segredo}` → { id, segredo }; qualquer outra forma é `null`. */
function lerTokenDaSubstituta(bruto) {
  const texto = String(bruto || '').trim();
  if (!texto.startsWith(PREFIXO)) return null;
  const ponto = texto.indexOf('.');
  if (ponto < 0 || ponto === texto.length - 1) return null;
  const id = texto.slice(PREFIXO.length, ponto);
  const segredo = texto.slice(ponto + 1);
  // O id vira caminho (`acessosDeSubstituta/${id}`): o formato é o de
  // `reguaDosIds` (sem barra), e o segredo é base64url.
  if (!/^[A-Za-z0-9_-]{10,60}$/.test(id)) return null;
  if (!/^[A-Za-z0-9_-]{20,200}$/.test(segredo)) return null;
  return { id, segredo };
}

function montarToken(id, segredo) {
  return `${PREFIXO}${id}.${segredo}`;
}

/**
 * Compara dois hashes em tempo constante (para o mesmo tamanho). `===` num
 * hash vaza pelo tempo quantos caracteres bateram, e o caminho é público.
 */
function hashesIguais(a, b) {
  const x = String(a || '');
  const y = String(b || '');
  if (!x || x.length !== y.length) return false;
  let diferenca = 0;
  for (let i = 0; i < x.length; i += 1) diferenca |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diferenca === 0;
}

// ─────────────────────────────────────────────────────────────────────────
// Vivo ou morto
// ─────────────────────────────────────────────────────────────────────────

/** A última parada do dia, em minutos — de quem a perua ainda leva. */
function ultimaParadaDoDia(paradas) {
  let ultima = null;
  for (const p of paradas || []) {
    if (p.falta === 'full') continue;
    for (const h of [p.horaPega, p.horaEntrega]) {
      const min = minutosDaHora(h);
      if (min != null && (ultima == null || min > ultima)) ultima = min;
    }
  }
  return ultima;
}

/**
 * A rota DO DIA acabou depois de o link nascer?
 *
 * `rota` é o `liveLocation/{tio}`: `routeActive`, `updatedAt` (o "Encerrar"
 * grava junto) e `closedAt` (o `closeStaleRoutes`). Encerrada antes de o link
 * nascer não conta — o tio pode chamar a substituta depois da ida.
 * ⚠️ Sem nenhuma hora combinada na turma, qualquer encerramento conta: o app
 * não sabe se há outra viagem, e a meia-noite segue de rede.
 */
function rotaDoDiaAcabou({ criadoEmMs, rota, ultimaParadaMin }) {
  if (!rota || rota.routeActive !== false) return false;
  const fim = Math.max(emMs(rota.updatedAt) || 0, emMs(rota.closedAt) || 0);
  if (!fim || criadoEmMs == null || fim <= criadoEmMs) return false;
  if (chaveDoDia(fim) !== chaveDoDia(criadoEmMs)) return false;
  if (ultimaParadaMin == null) return true;
  return minutoDeBrasilia(fim) >= ultimaParadaMin - MARGEM_DO_FIM_DO_DIA_MIN;
}

/**
 * O acesso vale agora? `{ ok, motivo }`. A ordem importa pouco — a frase é a
 * mesma —, mas o hash vem primeiro: sem o segredo, nada mais é olhado.
 *   'inexistente' | 'hash' | 'dia' | 'encerrado' | 'conta' | 'rota'
 */
function acessoVale({ acesso, hashDoSegredo, hojeChave, contaOpera = true, rota = null, paradas = null }) {
  if (!acesso) return { ok: false, motivo: 'inexistente' };
  if (!hashesIguais(acesso.segredoHash, hashDoSegredo)) return { ok: false, motivo: 'hash' };
  if (acesso.dateKey !== hojeChave) return { ok: false, motivo: 'dia' };
  if (acesso.encerradoEm) return { ok: false, motivo: 'encerrado' };
  // ⚠️ CONTA TRANCADA NÃO MOSTRA A TURMA A UM TERCEIRO: o link morre quando
  // a conta do tio deixa de operar (suspensa, ou teste vencido sem assinatura
  // com a cobrança ligada). `contaOpera` vem de `contaDoMotoristaOpera`
  // (reguaDoAuxiliar.js), o MESMO predicado do `isAdmin()` das rules.
  if (contaOpera !== true) return { ok: false, motivo: 'conta' };
  if (rota && rotaDoDiaAcabou({
    criadoEmMs: emMs(acesso.criadoEm),
    rota,
    ultimaParadaMin: ultimaParadaDoDia(paradas),
  })) {
    return { ok: false, motivo: 'rota' };
  }
  return { ok: true, motivo: null };
}

/**
 * Quem errou o SEGREDO está sondando; quem tem o segredo certo e o link
 * morreu é a própria substituta. Só a sondagem conta no limite por IP — a
 * página dela, aberta depois da rota, não pode trancar o IP da operadora.
 */
function recusaDeSondagem(motivo) {
  return motivo === 'inexistente' || motivo === 'hash' || motivo === 'formato';
}

/** Gerar de novo encerra os anteriores AINDA ABERTOS do tio (qualquer dia). */
function anterioresParaEncerrar(acessos) {
  return (acessos || []).filter((a) => a && !a.encerradoEm).map((a) => a.id);
}

// ─────────────────────────────────────────────────────────────────────────
// O recorte
// ─────────────────────────────────────────────────────────────────────────

function statusDeHoje(crianca, hojeChave) {
  const status = STATUS_VALIDOS.includes(crianca?.status) ? crianca.status : 'home';
  const em = emMs(crianca?.statusUpdatedAt);
  if (em == null) return status;
  return chaveDoDia(em) === hojeChave ? status : 'home';
}

/**
 * A lista que sai para a substituta. `criancas` é `[{ id, ...dados }]` — da
 * `turmaDaAuxiliar/{tio}/criancas` ou de `children` do tio, as duas pela
 * MESMA função. `faltas` é `[{ childId, dateKey, type }]` (o recado nunca
 * entra). A ordem da viagem é da tela (`diaCompleto`); aqui a ordem é só a
 * da hora de pegar, para a resposta ser estável.
 *
 * ⚠️ A `chave` é a POSIÇÃO, não o id da criança: o id é caminho no banco, e
 * não há por que um terceiro o carregar num print.
 */
function recorteDaSubstituta({ criancas, faltas, hojeChave }) {
  const faltaPorCrianca = {};
  for (const f of faltas || []) {
    if (!f || f.dateKey !== hojeChave || !f.childId) continue;
    if (TIPOS_DE_FALTA.includes(f.type)) faltaPorCrianca[f.childId] = f.type;
  }
  const ativas = (criancas || [])
    .filter((c) => c && c.active === true)
    .map((c) => ({
      id: c.id,
      nome: primeiroNome(c.name),
      horaPega: minutosDaHora(c.horaPega) != null ? c.horaPega : null,
      horaEntrega: minutosDaHora(c.horaEntrega) != null ? c.horaEntrega : null,
      period: PERIODOS.includes(c.period) ? c.period : null,
      pickupPeriod: PERIODOS.includes(c.pickupPeriod) ? c.pickupPeriod : null,
      dropoffPeriod: PERIODOS.includes(c.dropoffPeriod) ? c.dropoffPeriod : null,
      escola: String(c.school || '').trim().slice(0, 80) || null,
      status: statusDeHoje(c, hojeChave),
      falta: faltaPorCrianca[c.id] || null,
    }))
    .filter((c) => c.nome)
    .sort((a, b) => {
      const x = minutosDaHora(a.horaPega) ?? 9999;
      const y = minutosDaHora(b.horaPega) ?? 9999;
      return x - y || a.nome.localeCompare(b.nome);
    });
  // A lista fechada, campo a campo: nada do documento passa por espalhamento.
  return ativas.map((c, i) => {
    const saida = {};
    const comChave = { ...c, chave: `p${i + 1}` };
    for (const k of CAMPOS_DA_PARADA) saida[k] = comChave[k] ?? null;
    return saida;
  });
}

/**
 * A marca do tio: só o nome que ele escolheu, o logo e o artigo ("Fale com
 * a Tia Lene"). Nunca o nome civil. Sem marca, `nome: null` — a página diz
 * "quem te mandou".
 */
function marcaParaSubstituta(motorista) {
  const nome = String(motorista?.marcaNome || '').trim().slice(0, 60);
  const logo = String(motorista?.marcaLogoURL || '');
  return {
    nome: nome || null,
    artigo: motorista?.gender === 'female' ? 'a' : 'o',
    logoURL: /^https:\/\//.test(logo) ? logo : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// O aviso ao tio
// ─────────────────────────────────────────────────────────────────────────

const TIPO_DO_AVISO = 'acesso_substituta_encerrado';

/** "Acesso da Joana encerrado." — sem contagem nem detalhe do dia. */
function avisoDeEncerrado({ nome, por }) {
  const quem = primeiroNome(nome) || 'substituta';
  return {
    type: TIPO_DO_AVISO,
    title: `Acesso da ${quem} encerrado.`,
    body: por === 'rota' ? 'A rota de hoje acabou e o link parou de abrir.' : 'O link de hoje parou de abrir.',
  };
}

module.exports = {
  PREFIXO,
  FRASE_DO_LINK_MORTO,
  CAMPOS_DA_PARADA,
  MARGEM_DO_FIM_DO_DIA_MIN,
  TIPO_DO_AVISO,
  chaveDoDia,
  minutoDeBrasilia,
  minutosDaHora,
  primeiroNome,
  lerTokenDaSubstituta,
  montarToken,
  hashesIguais,
  ultimaParadaDoDia,
  rotaDoDiaAcabou,
  acessoVale,
  recusaDeSondagem,
  anterioresParaEncerrar,
  statusDeHoje,
  recorteDaSubstituta,
  marcaParaSubstituta,
  avisoDeEncerrado,
};
