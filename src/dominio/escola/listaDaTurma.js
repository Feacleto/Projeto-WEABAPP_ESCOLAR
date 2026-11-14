/**
 * A LISTA DA TURMA (RC2, 14/11/2026) — as regras da tela em que o motorista
 * adiciona, vê, completa, convida e tira as crianças, sem trocar de tela.
 * Especificação: docs/analise/11-lista-da-turma.md (com as seções corrigidas
 * depois dos inventários 13a e 13b).
 *
 * Puro de propósito (decisão 17): sem Firebase e sem React. O relógio chega
 * por parâmetro (`agoraMs`), e é isso que deixa `npm run testar:lista-da-turma`
 * medir o convite vencido sem esperar quinze dias.
 *
 * ── O ESTADO DO CONVITE SAI DO QUE O BANCO JÁ GUARDA
 * Nada novo é gravado para saber em que pé está cada família:
 *   - `parentUid`         a família entrou (o `redeemInvite` grava);
 *   - `conviteEnviadoEm`  ele tocou em mandar (`marcarConviteEnviado`, no
 *                         mesmo toque que abre o WhatsApp);
 *   - `inviteCriadoEm`    de quando o link vale — 15 dias
 *                         (`validadeDoConvite.js`, espelho do servidor);
 *   - `parentPhone`       se há número para abrir a conversa certa.
 *
 * ⚠️ "ENVIADO" É O TOQUE DELE, NUNCA "A FAMÍLIA RECEBEU". O app não sabe se a
 * mensagem saiu do WhatsApp nem se ela leu. Por isso o estado se chama
 * ENVIADO e a tela não diz "recebeu" (a mesma correção do aviso de convite
 * parado, 13b).
 *
 * ⚠️ O ENVIO MAIS VELHO QUE O LINK NÃO CONTA. "Gerar link novo" regrava
 * `inviteCriadoEm` e o link antigo para de abrir. Um `conviteEnviadoEm`
 * anterior a isso fala de um link morto: a linha volta a pedir convite.
 */
import { conviteVencido } from '../identidade/validadeDoConvite.js';
import { normalizaHora, horaCurta, emMinutos, deMinutos } from '../rota/horarios.js';

export const CONVITE = {
  ENTROU: 'entrou',
  VENCIDO: 'vencido',
  ENVIADO: 'enviado',
  SEM_TELEFONE: 'semTelefone',
  SEM_CONVITE: 'semConvite',
};

function emMs(valor) {
  if (valor == null) return null;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  if (typeof valor.toMillis === 'function') return valor.toMillis();
  if (valor instanceof Date) return valor.getTime();
  if (typeof valor === 'string') {
    const t = Date.parse(valor);
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

const digitos = (v) => String(v || '').replace(/\D/g, '');

/** Tem um WhatsApp que abre a conversa certa (DDD + número)? */
export function temTelefone(crianca) {
  return digitos(crianca?.parentPhone).length >= 10;
}

/**
 * O estado do convite de UMA criança. A ordem das perguntas é a regra:
 *  1. entrou — nada a fazer;
 *  2. vencido — o link não abre mais, e mandar de novo sem gerar outro seria
 *     mandar um link morto (vale também para quem já tinha recebido);
 *  3. enviado — ele tocou em mandar depois do link atual;
 *  4. sem telefone — nunca mandou, e sem o número o WhatsApp abre a escolha
 *     de contato (o convite funciona igual);
 *  5. sem convite — nunca mandou.
 */
export function estadoDoConvite(crianca, agoraMs, tocouAgora = false) {
  if (!crianca) return CONVITE.SEM_CONVITE;
  if (crianca.parentUid) return CONVITE.ENTROU;
  if (conviteVencido(crianca, agoraMs)) return CONVITE.VENCIDO;
  // O carimbo do servidor ainda a caminho (`serverTimestamp` pendente) chega
  // como null: nesse instante quem diz "Enviado" é a própria linha, que
  // lembra o toque (o estado volta a sair do banco assim que ele responde).
  const enviado = emMs(crianca.conviteEnviadoEm);
  if (enviado != null) {
    const link = emMs(crianca.inviteCriadoEm);
    if (link == null || enviado >= link) return CONVITE.ENVIADO;
  }
  // O toque desta abertura da tela, antes de o banco responder.
  if (tocouAgora) return CONVITE.ENVIADO;
  return temTelefone(crianca) ? CONVITE.SEM_CONVITE : CONVITE.SEM_TELEFONE;
}

/** O que a linha pede: mandar (ou gerar link novo e mandar). */
export function precisaDeConvite(estado) {
  return estado === CONVITE.SEM_CONVITE || estado === CONVITE.SEM_TELEFONE || estado === CONVITE.VENCIDO;
}

/**
 * O CONTADOR DO TOPO — separado por estado, nunca misturado.
 * `faltam` é quem não entrou; `aMandar` é quem pede um toque hoje (nunca
 * recebeu, ou o link venceu). Quem já recebeu e não entrou fica em `enviados`:
 * mandar de novo é escolha dele, não pendência.
 */
const tocou = (tocados, id) => !!tocados && typeof tocados.has === 'function' && tocados.has(id);

/** `tocados`: os ids em que ele tocou em mandar nesta abertura da tela. */
export function resumoDosConvites(criancas, agoraMs, tocados = null) {
  const r = { total: 0, entraram: 0, faltam: 0, aMandar: 0, enviados: 0, vencidos: 0, semTelefone: 0 };
  for (const c of criancas || []) {
    if (!c || c.active === false) continue;
    r.total += 1;
    const e = estadoDoConvite(c, agoraMs, tocou(tocados, c.id));
    if (e === CONVITE.ENTROU) r.entraram += 1;
    else r.faltam += 1;
    if (precisaDeConvite(e)) r.aMandar += 1;
    if (e === CONVITE.ENVIADO) r.enviados += 1;
    if (e === CONVITE.VENCIDO) r.vencidos += 1;
    if (e === CONVITE.SEM_TELEFONE) r.semTelefone += 1;
  }
  return r;
}

/** O número do "Para resolver" do Início: só quem pede um toque. */
export function contarConvitesAMandar(criancas, agoraMs) {
  return resumoDosConvites(criancas, agoraMs).aMandar;
}

/**
 * "MANDAR CONVITE PARA QUEM FALTA" — a próxima criança que pede convite, na
 * ordem da lista. Com `depoisDe` (o id da última atendida), a busca começa
 * depois dela e dá a volta: ele não fica preso na mesma linha se não mandou.
 */
export function proximaParaConvidar(criancas, agoraMs, depoisDe = null, tocados = null) {
  const lista = (criancas || []).filter((c) => c && c.active !== false);
  if (!lista.length) return null;
  const inicio = depoisDe ? lista.findIndex((c) => c.id === depoisDe) + 1 : 0;
  for (let i = 0; i < lista.length; i++) {
    const c = lista[(inicio + i) % lista.length];
    if (precisaDeConvite(estadoDoConvite(c, agoraMs, tocou(tocados, c.id)))) return c;
  }
  return null;
}

// ============================================================================
// O que falta em cada criança
// ============================================================================

/**
 * As faltas, na ordem em que a tela as cita. Só a HORA DE PEGAR é aviso
 * (âmbar): é ela que decide se a criança entra na rota. O resto é dado para
 * completar quando ele souber — falta de dado não é alarme.
 */
export const FALTA = {
  HORA: 'hora',
  RUA: 'rua',
  NUMERO: 'numero',
  WHATSAPP: 'whatsapp',
  MENSALIDADE: 'mensalidade',
};

const ORDEM_DAS_FALTAS = [FALTA.HORA, FALTA.RUA, FALTA.NUMERO, FALTA.WHATSAPP, FALTA.MENSALIDADE];

export const NOME_DA_FALTA = {
  [FALTA.HORA]: 'hora de pegar',
  [FALTA.RUA]: 'rua',
  [FALTA.NUMERO]: 'número da casa',
  [FALTA.WHATSAPP]: 'WhatsApp da mãe',
  [FALTA.MENSALIDADE]: 'mensalidade',
};

export function temHoraDePegar(crianca) {
  return !!normalizaHora(crianca?.horaPega);
}

export function temRua(crianca) {
  return String(crianca?.address || '').trim() !== '';
}

/** Sem valor, a mensalidade não é gerada (`functions/lib/billing.js`). */
export function semValor(crianca) {
  return !(Number(crianca?.monthlyFee) > 0);
}

/** O que falta nesta criança, em ordem. */
export function oQueFalta(crianca) {
  if (!crianca) return [];
  const faltas = [];
  if (!temHoraDePegar(crianca)) faltas.push(FALTA.HORA);
  if (!temRua(crianca)) faltas.push(FALTA.RUA);
  // O número só é pedido de quem tem a rua: sem rua, falta a rua.
  else if (crianca.numeroPendente === true) faltas.push(FALTA.NUMERO);
  // Com a família dentro, o número dela já não decide o convite.
  if (!temTelefone(crianca) && !crianca.parentUid) faltas.push(FALTA.WHATSAPP);
  if (semValor(crianca)) faltas.push(FALTA.MENSALIDADE);
  return faltas.sort((a, b) => ORDEM_DAS_FALTAS.indexOf(a) - ORDEM_DAS_FALTAS.indexOf(b));
}

function juntar(partes) {
  if (partes.length <= 1) return partes.join('');
  return `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`;
}

/**
 * A FRASE DE ESTADO da linha fechada: `{ faltaHora, texto }`.
 * `faltaHora` vai em âmbar (afeta a rota); `texto` é o resto, neutro. Cita no
 * máximo duas faltas e conta as outras — a linha tem uma frase, não um
 * inventário.
 */
export function fraseDeEstado(crianca) {
  const faltas = oQueFalta(crianca);
  const faltaHora = faltas.includes(FALTA.HORA);
  const resto = faltas.filter((f) => f !== FALTA.HORA).map((f) => NOME_DA_FALTA[f]);
  let texto = '';
  if (resto.length) {
    const citadas = resto.slice(0, 2);
    const outras = resto.length - citadas.length;
    texto = `falta ${juntar(citadas)}${outras ? ` (+${outras})` : ''}`;
  }
  return { faltaHora, texto };
}

/** "Rua das Flores, 120, Centro, São Paulo" → "Rua das Flores, 120". */
export function ruaCurta(endereco) {
  // `montarEndereco` separa a rua do bairro com " — ": o que vem antes é a rua.
  const antesDoBairro = String(endereco || '').split(' — ')[0];
  const partes = antesDoBairro.split(',').map((p) => p.trim()).filter(Boolean);
  if (!partes.length) return '';
  if (partes.length >= 2 && /^\d|^s\/?n/i.test(partes[1])) return `${partes[0]}, ${partes[1]}`;
  return partes[0];
}

/** A segunda linha: escola · hora · rua — só o que existe. */
export function resumoDaLinha(crianca) {
  return [
    String(crianca?.school || '').trim(),
    temHoraDePegar(crianca) ? horaCurta(crianca.horaPega) : '',
    ruaCurta(crianca?.address),
  ]
    .filter(Boolean)
    .join(' · ');
}

// ============================================================================
// Fora da rota
// ============================================================================

/**
 * A criança posta pela linha "+ Nome" nasce `cadastroRapido: true`, a mesma
 * marca da vaga rápida — e `blocosDaDirecao` (dominio/rota/horarios.js) deixa
 * essa criança FORA da viagem. É isso que faz a frase da tela ("fora da rota
 * até ter rua e hora de pegar") ser verdade, e não um desejo.
 */
export function foraDaRota(crianca) {
  return crianca?.cadastroRapido === true;
}

/** Tem o que a rota precisa: a rua e a hora de pegar. */
export function completaParaARota(crianca) {
  return temRua(crianca) && temHoraDePegar(crianca);
}

/**
 * O que gravar quando um campo muda: a mudança e, se com ela a criança
 * passou a ter rua e hora de pegar, o fim do `cadastroRapido` — no MESMO
 * write. Separados, haveria um instante (ou uma queda de rede) em que a
 * criança completa continuaria fora da rota sem ninguém saber por quê.
 */
export function camposAoSalvar(crianca, mudanca) {
  const depois = { ...(crianca || {}), ...(mudanca || {}) };
  if (crianca?.cadastroRapido === true && completaParaARota(depois)) {
    return { ...mudanca, cadastroRapido: false };
  }
  return { ...mudanca };
}

// ============================================================================
// Agrupar por escola
// ============================================================================

export const SEM_ESCOLA = 'sem-escola';

const chaveDoNome = (nome) =>
  String(nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/**
 * Os grupos da lista: `[{ chave, escolaId, nome, criancas, horaEntrada }]`.
 * A escola cadastrada agrupa pelo id; a escrita à mão (cadastro antigo, sem
 * `schoolId`) agrupa pelo nome; quem não tem escola fica num grupo no FIM.
 * A ordem das crianças dentro do grupo é a da lista recebida.
 */
export function agruparPorEscola(criancas, escolas = []) {
  const porId = new Map((escolas || []).map((e) => [e.id, e]));
  const grupos = new Map();
  for (const c of criancas || []) {
    if (!c) continue;
    const escola = c.schoolId ? porId.get(c.schoolId) : null;
    const nomeDaCrianca = String(c.school || '').trim();
    let chave;
    if (c.schoolId && escola) chave = `id:${c.schoolId}`;
    else if (nomeDaCrianca) chave = `nome:${chaveDoNome(nomeDaCrianca)}`;
    else chave = SEM_ESCOLA;
    if (!grupos.has(chave)) {
      grupos.set(chave, {
        chave,
        escolaId: escola ? escola.id : null,
        nome: escola?.nome || nomeDaCrianca || '',
        horaEntrada: normalizaHora(escola?.horaEntrada) || null,
        escola: escola || null,
        criancas: [],
      });
    }
    grupos.get(chave).criancas.push(c);
  }
  return [...grupos.values()].sort((a, b) => {
    if (a.chave === SEM_ESCOLA) return 1;
    if (b.chave === SEM_ESCOLA) return -1;
    return a.nome.localeCompare(b.nome, 'pt-BR');
  });
}

// ============================================================================
// A caixa "A completar"
// ============================================================================

/**
 * Os grupos da caixa: `[{ falta, criancas }]`, só os que têm alguém, na
 * ordem de `ORDEM_DAS_FALTAS`. A mensalidade é a fila de "sem valor": sem
 * valor, a mensalidade do mês não nasce.
 */
export function gruposACompletar(criancas) {
  const porFalta = new Map(ORDEM_DAS_FALTAS.map((f) => [f, []]));
  for (const c of criancas || []) {
    if (!c || c.active === false) continue;
    for (const f of oQueFalta(c)) porFalta.get(f).push(c);
  }
  return ORDEM_DAS_FALTAS.filter((f) => porFalta.get(f).length).map((f) => ({ falta: f, criancas: porFalta.get(f) }));
}

// ============================================================================
// A hora de pegar PROPOSTA pela entrada da escola
// ============================================================================

const KMH_URBANO = 18; // a mesma velocidade conservadora de `horarios.js`
const MARGEM_ANTES_DA_ENTRADA = 10;
const PASSO_MINIMO = 5;

function distanciaKm(a, b) {
  if (!a || !b || a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  const R = 6371;
  const rad = (g) => (Number(g) * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Minutos de carro, arredondados para cima no passo de 5 (nunca menos de 5). */
function minutosDeCarro(km) {
  if (km == null) return PASSO_MINIMO;
  const min = Math.ceil((km / KMH_URBANO) * 60) + 1;
  return Math.max(PASSO_MINIMO, Math.ceil(min / PASSO_MINIMO) * PASSO_MINIMO);
}

const pontoDa = (c) => (c?.lat == null || c?.lng == null ? null : { lat: Number(c.lat), lng: Number(c.lng) });

/**
 * PROPÕE a hora de pegar de quem está SEM ela, a partir da ENTRADA da escola.
 *
 * ⚠️ O `horaPega` é a hora na PORTA de cada casa (doc 13a, item c). Aplicar a
 * mesma hora ao grupo dispararia "seu horário mudou" às famílias com um
 * chute, e N casas na mesma hora fazem a rota dizer que não fecha. Então:
 *  - só quem está SEM hora recebe proposta (quem tem, ele já combinou);
 *  - a ordem é da casa mais LONGE da escola para a mais perto (quem tem
 *    coordenada); quem não tem fica no começo, pela ordem da lista;
 *  - a última casa é pega `MARGEM_ANTES_DA_ENTRADA` minutos antes da entrada,
 *    menos o caminho até a escola; cada anterior, o caminho até a seguinte;
 *  - o passo é de 5 em 5 e nunca zero: NENHUMA hora se repete;
 *  - não atravessa a meia-noite para trás: quem não cabe fica sem proposta.
 *
 * Devolve `[{ child, hora }]`. É PROPOSTA: a tela mostra cada hora num campo
 * editável e só grava o que ele confirmar.
 */
export function proporHorasDePegar({ criancas, escola, entrada }) {
  const minEntrada = emMinutos(entrada);
  if (minEntrada == null) return [];
  const sem = (criancas || []).filter((c) => c && c.active !== false && !temHoraDePegar(c));
  if (!sem.length) return [];
  const pontoDaEscola = pontoDa(escola);

  const comPonto = sem
    .map((c, i) => ({ c, i, km: distanciaKm(pontoDa(c), pontoDaEscola) }))
    .filter((x) => x.km != null)
    .sort((a, b) => b.km - a.km || a.i - b.i);
  const semPonto = sem.filter((c) => !comPonto.some((x) => x.c === c));
  const ordem = [...semPonto, ...comPonto.map((x) => x.c)];

  // De trás para a frente: a última casa primeiro.
  const horas = new Array(ordem.length);
  let t = minEntrada - MARGEM_ANTES_DA_ENTRADA - minutosDeCarro(distanciaKm(pontoDa(ordem[ordem.length - 1]), pontoDaEscola));
  t = Math.floor(t / PASSO_MINIMO) * PASSO_MINIMO;
  for (let i = ordem.length - 1; i >= 0; i--) {
    if (i < ordem.length - 1) {
      t -= minutosDeCarro(distanciaKm(pontoDa(ordem[i]), pontoDa(ordem[i + 1])));
    }
    horas[i] = t;
  }
  return ordem
    .map((child, i) => ({ child, minutos: horas[i] }))
    .filter((p) => p.minutos >= 0)
    .map(({ child, minutos }) => ({ child, hora: deMinutos(minutos) }));
}

// ============================================================================
// O valor da mensalidade é obrigatório no cadastro (decisão do dono, 14/11/2026)
// ============================================================================

/**
 * "VALOR ZERO NÃO." Ao CADASTRAR uma criança (a linha "+ Nome" da lista e o
 * cadastro rápido do card do primeiro acesso), o tio diz o valor da
 * mensalidade. Sem valor a mensalidade do mês não nasce (`billing.js` pula
 * `fee <= 0`) e o contrato sairia de R$ 0,00.
 *
 * Devolve `true` quando o valor FALTA (vazio, zero, negativo, lixo) — a mesma
 * direção de `valorDaMensalidadeFalta(child)`, a régua irmã que mora em
 * `src/dominio/cobranca/` na branch feat/ux. Para unificar: esta passa a
 * chamar aquela com `{ monthlyFee: valor }` (ou some, e os chamadores usam a
 * de cobrança), mantendo o caso exato `> 0` — o teste reprova `>= 0`.
 *
 * ⚠️ ISENTOS, DE PROPÓSITO: a VAGA RÁPIDA da perua (FolhaDaVagaRapida) é só
 * um lugar na perua, não é contrato nem matrícula; e o "Salvar e completar
 * depois" do formulário completo é rascunho. Os dois caem no grupo "sem valor"
 * da caixa "A completar".
 */
export function valorObrigatorioNoCadastro(valor) {
  const n = Number(valor);
  return !(Number.isFinite(n) && n > 0);
}
