/**
 * A AUXILIAR, DO LADO DO APP — régua pura (05/10/2026).
 *
 * O histórico e a rotatividade que o motorista vê em "Quem já trabalhou
 * comigo", e a mensagem do convite. O vínculo vem de
 * `auxiliares/{motoristaUid}_{auxiliarUid}` — um documento por PAR, com
 * `aceitoEm`, `encerradoEm`, `ativa` e `periodos: [{ de, ate }]`; quem saiu e
 * voltou tem um documento só, com dois períodos. A conta é feita aqui, sem
 * Firebase, para o Node dos testes alcançar.
 *
 * A rotatividade aparece SÓ para o próprio motorista e não compara com
 * ninguém: média da cidade fica para quando houver base.
 */

function ms(valor) {
  if (!valor) return null;
  if (typeof valor.toMillis === 'function') return valor.toMillis();
  if (valor instanceof Date) return valor.getTime();
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

const DIA = 24 * 60 * 60 * 1000;

/** Meses inteiros entre duas datas, no mínimo 1 (quem ficou dias conta 1). */
export function mesesEntre(desdeMs, ateMs) {
  if (desdeMs == null || ateMs == null) return 1;
  return Math.max(1, Math.round((ateMs - desdeMs) / (30.4 * DIA)));
}

/** O id do vínculo do par — o mesmo desenho do servidor (`idDoVinculo`). */
export function idDoVinculo(motoristaUid, auxiliarUid) {
  return `${motoristaUid}_${auxiliarUid}`;
}

/**
 * Dias de vínculo, SOMANDO os períodos (o aberto conta até agora), em dias
 * inteiros para baixo. ⚠️ ESPELHO de `diasDeVinculo` em
 * functions/lib/reguaDoAuxiliar.js — o deploy das functions não alcança
 * `src/`, e `testar:auxiliar` compara os dois caso a caso.
 */
export function diasDeVinculo(periodos, agoraMs) {
  let total = 0;
  for (const p of Array.isArray(periodos) ? periodos : []) {
    const de = ms(p?.de);
    if (de == null) continue;
    const ate = p.ate == null ? agoraMs : ms(p.ate);
    if (ate == null || ate <= de) continue;
    total += ate - de;
  }
  return Math.floor(total / DIA);
}

/** Meses pela soma dos períodos, no mínimo 1 (quem ficou dias conta 1). */
function mesesDeVinculo(dias) {
  return Math.max(1, Math.round(dias / 30.4));
}

/**
 * A lista de "Quem já trabalhou comigo": as ativas primeiro, depois as que
 * saíram, da saída mais recente para a mais antiga.
 */
export function historicoDeAuxiliares(vinculos, agoraMs = Date.now()) {
  const lista = (Array.isArray(vinculos) ? vinculos : []).map((v) => {
    const periodos = Array.isArray(v.periodos) ? v.periodos : [];
    // O período de AGORA (o último), para o "Desde" de quem está ativa; o
    // primeiro aceite, para quando ela chegou pela primeira vez.
    const ultimo = periodos[periodos.length - 1];
    const primeiro = ms(v.aceitoEm) ?? ms(periodos[0]?.de);
    const desde = ms(ultimo?.de) ?? primeiro;
    const ate = v.ativa ? null : ms(v.encerradoEm) ?? ms(ultimo?.ate);
    const dias = diasDeVinculo(periodos, agoraMs);
    return {
      // O uid DELA (o doc é do par; quem desativa, paga e registra falta
      // fala da auxiliar).
      uid: v.auxiliarUid || v.uid,
      nome: v.nome || 'Auxiliar',
      telefone: v.telefone || '',
      // O que ele disse no convite que ia pagar — o botão do pagamento
      // (fase 4) já nasce com ele. Sem valor, a tela pede o valor.
      valorMensal: Number(v.valorMensal) > 0 ? Number(v.valorMensal) : null,
      ativa: !!v.ativa,
      primeiroMs: primeiro,
      desdeMs: desde,
      ateMs: ate,
      dias,
      meses: mesesDeVinculo(dias),
      // Saiu e voltou: um nome só na lista, com o tempo SOMADO.
      voltas: Math.max(0, periodos.length - 1),
    };
  });
  return lista.sort((a, b) => {
    if (a.ativa !== b.ativa) return a.ativa ? -1 : 1;
    return (b.ateMs || 0) - (a.ateMs || 0);
  });
}

/**
 * A rotatividade: quantas no total, quanto tempo as que SAÍRAM ficaram em
 * média, e quantas começaram nos últimos 12 meses. Sem nenhuma que saiu, a
 * média é `null` — a tela não inventa um número.
 */
export function rotatividade(vinculos, agoraMs = Date.now()) {
  const h = historicoDeAuxiliares(vinculos, agoraMs);
  const sairam = h.filter((x) => !x.ativa);
  const media = sairam.length ? Math.round(sairam.reduce((a, x) => a + x.meses, 0) / sairam.length) : null;
  const umAno = agoraMs - 365 * DIA;
  return {
    total: h.length,
    ativas: h.filter((x) => x.ativa).length,
    mediaDeMeses: media,
    ultimos12: h.filter((x) => x.primeiroMs != null && x.primeiroMs >= umAno).length,
  };
}

/** A mensagem do WhatsApp do convite — a marca do motorista e o link. */
export function mensagemDoConviteDeAuxiliar({ marca, nome, link }) {
  const quem = String(marca || 'o seu motorista').trim();
  const primeiro = String(nome || '').trim().split(' ')[0];
  return `Oi${primeiro ? `, ${primeiro}` : ''}! Aqui é ${quem}. Te chamei para ser minha auxiliar no Alô Buzinou. Você vai ver a turma e a rota no seu celular. Crie a sua conta por aqui: ${link}`;
}

/** O link do convite: `/auxiliar/{codigo}` no endereço do app. */
export function urlDoConviteDeAuxiliar(codigo, origem = '') {
  return `${origem}/auxiliar/${codigo}`;
}

/** O WhatsApp da pessoa, com o texto pronto. Telefone só com dígitos e DDD. */
export function linkDoZap(telefone, texto = '') {
  const d = String(telefone || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  const alvo = d.length === 10 || d.length === 11 ? `55${d}` : '';
  return `https://wa.me/${alvo}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`;
}

/**
 * O PAGAMENTO DA AUXILIAR (fase 4, 05/10/2026). O recibo mora em
 * `pagamentosDaAuxiliar/{motoristaUid}_{auxiliarUid}_{AAAA-MM}` e só o
 * servidor escreve (`functions/lib/reguaDoPagamentoDaAuxiliar.js`). Aqui, o
 * que a tela precisa saber dele.
 */
const NOMES_DOS_MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/** "outubro" — o mês do recibo, sem o ano (o cartão já está no ano). */
export function nomeDoMesDoPagamento(mes) {
  const m = Number(String(mes || '').slice(5, 7));
  return NOMES_DOS_MESES[m - 1] || '';
}

/** "outubro de 2026" */
export function mesEAnoDoPagamento(mes) {
  const nome = nomeDoMesDoPagamento(mes);
  return nome ? `${nome} de ${String(mes).slice(0, 4)}` : '';
}

/** "05/10" — o dia em que ele anotou, ou em que ela confirmou. */
export function diaCurto(valor) {
  const t = ms(valor);
  if (t == null) return '';
  const d = new Date(t);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** O id do recibo — o mesmo desenho do servidor. */
export function idDoPagamentoDaAuxiliar(motoristaUid, auxiliarUid, mes) {
  return `${motoristaUid}_${auxiliarUid}_${mes}`;
}

/** O recibo de UMA auxiliar num mês, ou `null`. */
export function pagamentoDoMes(lista, auxiliarUid, mes) {
  return (lista || []).find((p) => p.auxiliarUid === auxiliarUid && p.mes === mes) || null;
}

/** Os recibos do mais novo para o mais velho (a consulta não ordena). */
export function recibosEmOrdem(lista) {
  return [...(lista || [])].sort((a, b) => String(b.mes).localeCompare(String(a.mes)));
}

/** O estado do recibo, como as duas telas o dizem. */
export function estadoDoRecibo(pagamento) {
  if (!pagamento) return 'sem_anotacao';
  return pagamento.recebidoEm ? 'confirmado' : 'esperando';
}
