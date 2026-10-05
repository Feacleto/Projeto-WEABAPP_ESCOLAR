/**
 * A COMUNIDADE, do lado do app (05/10/2026, etapa 1) — o que a tela precisa
 * saber antes de pedir ao servidor. Quem DECIDE é
 * `functions/lib/reguaDaComunidade.js`; as constantes daqui são espelho dela
 * (`npm run testar:comunidade` compara as duas).
 *
 * - Foto da turma só com o "sim" de CADA família marcada (LGPD art. 14).
 *   `children.fotoDaTurmaConsentida` é escrito só pela responsável, e
 *   ausente é NÃO.
 * - Para os tios parceiros, nunca criança.
 * - A foto some em `DIAS_DA_FOTO` dias.
 *
 * Puro, sem Firebase nem React.
 */

export const DIAS_DA_FOTO = 30;
export const PUBLICO = Object.freeze({ FAMILIAS: 'familias', PARCEIROS: 'parceiros', COMUNIDADE: 'comunidade' });
/** O alcance do "sim" que cobre a comunidade (espelho do servidor). */
export const ALCANCE_COMUNIDADE = 'comunidade';
export const EPOCAS = Object.freeze([
  'Volta às aulas',
  'Carnaval',
  'Páscoa',
  'Dia das Mães',
  'Festa Junina',
  'Dia dos Pais',
  'Dia das Crianças',
  'Natal',
  'Formatura',
]);
export const LEGENDA_MAX = 80;

/** O "sim" da família: 'sim' | 'nao' | 'sem_resposta' (ausente = sem resposta, e conta como não). */
export function simDaFoto(crianca) {
  if (crianca?.fotoDaTurmaConsentida === true) return 'sim';
  if (crianca?.fotoDaTurmaConsentida === false) return 'nao';
  return 'sem_resposta';
}

/**
 * O "sim" desta criança cobre a COMUNIDADE (05/10/2026)? Só o "sim" dado na
 * pergunta nova, que diz os dois públicos. O antigo vale só para a turma.
 */
export function podeNaComunidade(crianca) {
  return crianca?.fotoDaTurmaConsentida === true && crianca?.fotoDaTurmaAlcance === ALCANCE_COMUNIDADE;
}

/**
 * O que a pergunta da família mostra no Início:
 * 'sem_resposta' e 'perguntar_de_novo' (o "sim" antigo, só da turma) pedem a
 * pergunta; 'sim' e 'nao' não.
 */
export function estadoDaPergunta(crianca) {
  const sim = simDaFoto(crianca);
  if (sim === 'sim' && !podeNaComunidade(crianca)) return 'perguntar_de_novo';
  return sim;
}

/**
 * A PERGUNTA À FAMÍLIA — texto dos jurídicos (05/10/2026), versão do "sim"
 * único escolhida pelo dono. Ela nomeia os DOIS públicos com as palavras
 * dela: é isso que torna o consentimento específico. Não cortar.
 */
export function textoDaPergunta({ marca, nome } = {}) {
  const quem = String(marca || '').trim() || 'a perua';
  const n = String(nome || '').trim().split(/\s+/)[0] || 'seu filho';
  return {
    titulo: 'Seu filho pode aparecer nas fotos da perua?',
    linha: `Numa data especial, ${quem} posta uma foto da turma. Quem vê: as famílias desta perua, os tios parceiros dele e as famílias desses tios. Some em ${DIAS_DA_FOTO} dias.`,
    rodape: `Você muda quando quiser, na ficha de ${n}.`,
  };
}

/**
 * Pode mandar para o servidor? Devolve `{ ok, motivo }` — o mesmo critério
 * do servidor, para a tela dizer o que falta ANTES do toque.
 */
export function prontaParaPublicar({ publico, marcadas = [], turma = [], epoca, todasMarcadas, semCrianca, temFoto }) {
  if (!temFoto) return { ok: false, motivo: 'Escolha a foto.' };
  if (!EPOCAS.includes(epoca)) return { ok: false, motivo: 'Escolha a época.' };
  if (publico === PUBLICO.PARCEIROS) {
    if (marcadas.length) return { ok: false, motivo: 'Para os tios parceiros, só foto sem criança.' };
    if (!semCrianca) return { ok: false, motivo: 'Confirme que não aparece nenhuma criança.' };
    return { ok: true, motivo: null };
  }
  if (publico === PUBLICO.COMUNIDADE) {
    if (!marcadas.length) {
      if (!semCrianca) return { ok: false, motivo: 'Marque quem está na foto, ou confirme que não aparece nenhuma criança.' };
      return { ok: true, motivo: null };
    }
    const porId = new Map(turma.map((c) => [c.id, c]));
    if (marcadas.some((id) => !podeNaComunidade(porId.get(id)))) {
      return { ok: false, motivo: 'Tem criança marcada sem o sim da família para a comunidade.' };
    }
    if (!todasMarcadas) return { ok: false, motivo: 'Confirme que marcou todas as crianças da foto.' };
    return { ok: true, motivo: null };
  }
  if (publico !== PUBLICO.FAMILIAS) return { ok: false, motivo: 'Escolha para quem é a foto.' };
  const porId = new Map(turma.map((c) => [c.id, c]));
  const semSim = marcadas.filter((id) => simDaFoto(porId.get(id)) !== 'sim');
  if (semSim.length) return { ok: false, motivo: 'Tem criança marcada sem o sim da família.' };
  if (!todasMarcadas) return { ok: false, motivo: 'Confirme que marcou todas as crianças da foto.' };
  return { ok: true, motivo: null };
}

/** "Some em 28 dias" / "Some amanhã" / "Some hoje". */
export function quandoSome(expiraEmMs, agoraMs = Date.now()) {
  const dias = Math.ceil((expiraEmMs - agoraMs) / 86400000);
  if (dias <= 0) return 'Some hoje';
  if (dias === 1) return 'Some amanhã';
  return `Some em ${dias} dias`;
}

/** "Você indicou" / "Indicou você". */
export function rotuloDoParceiro(papel) {
  return papel === 'indicou_voce' ? 'Indicou você' : 'Você indicou';
}

/* ── A AVALIAÇÃO DO TIO PELA FAMÍLIA (etapa 2) — espelho de
 * functions/lib/reguaDaComunidade.js. Só a família avalia, uma nota por
 * semestre (mudável), e o tio vê só a média do semestre FECHADO, com pelo
 * menos MIN_RESPOSTAS: a do semestre corrente denunciaria quem deu cada nota.
 */
export const MIN_RESPOSTAS = 5;

/** "2026-2", em UTC (o relógio das rules). */
export function semestreDe(agora = new Date()) {
  const d = agora instanceof Date ? agora : new Date(agora);
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1 <= 6 ? 1 : 2}`;
}

/** "1º semestre de 2026". */
export function semestrePorExtenso(semestre) {
  const [ano, s] = String(semestre).split('-');
  return `${s === '1' ? '1º' : '2º'} semestre de ${ano}`;
}

/** O id do documento da nota: uma por família, por motorista, por semestre. */
export function idDaAvaliacao(adminUid, familiaUid, semestre) {
  return `${adminUid}_${familiaUid}_${semestre}`;
}

/* ── O PEDIDO DO "SIM" DA FOTO (fase 1 da rede, 05/10/2026) ─────────────
 *
 * O tio pergunta às famílias que ainda não responderam. Quem responde é
 * SEMPRE ela, no Início dela: o aviso só leva até lá. Família sem conta no
 * app não recebe (não há celular para tocar), e a tela diz quantas são.
 *
 * ⚠️ UM PEDIDO POR CRIANÇA POR MÊS. O id do aviso carrega o mês: tocar de
 * novo no botão não toca de novo no celular dela, e insistir toda semana
 * numa autorização é pressão, não pergunta.
 */

/** As crianças ativas cuja família tem conta e ainda não respondeu. */
export function quemFaltaResponder(turma = []) {
  return turma.filter((c) => c && c.active !== false && c.parentUid && ['sem_resposta', 'perguntar_de_novo'].includes(estadoDaPergunta(c)));
}

/** As crianças sem resposta e sem conta da família (não dá para perguntar pelo app). */
export function semContaParaPerguntar(turma = []) {
  return turma.filter((c) => c && c.active !== false && !c.parentUid && ['sem_resposta', 'perguntar_de_novo'].includes(estadoDaPergunta(c)));
}

/** 'AAAA-MM' no fuso de Brasília. */
function mesEmBrasilia(agora = new Date()) {
  const d = new Date((agora instanceof Date ? agora.getTime() : agora) - 3 * 3600000);
  return d.toISOString().slice(0, 7);
}

export function idDoPedidoDaFoto(childId, agora = new Date()) {
  return `simfoto_${childId}_${mesEmBrasilia(agora)}`;
}

export function pedidoDaFoto({ marca, nomeCrianca } = {}) {
  const quem = String(marca || '').trim() || 'A perua';
  const nome = String(nomeCrianca || '').trim().split(/\s+/)[0] || 'seu filho';
  return {
    type: 'pedido_sim_da_foto',
    title: `${quem} pergunta: ${nome} pode aparecer nas fotos da perua?`,
    body: 'Responda no Início do app. Você pode mudar quando quiser.',
  };
}
