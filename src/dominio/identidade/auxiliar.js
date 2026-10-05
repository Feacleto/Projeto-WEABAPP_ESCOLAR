/**
 * A AUXILIAR, DO LADO DO APP — régua pura (05/10/2026).
 *
 * O histórico e a rotatividade que o motorista vê em "Quem já trabalhou
 * comigo", e a mensagem do convite. O vínculo vem de `auxiliares/{uid}`
 * (`desde`, `ate`, `ativa`); a conta é feita aqui, sem Firebase, para o Node
 * dos testes alcançar.
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

/**
 * A lista de "Quem já trabalhou comigo": as ativas primeiro, depois as que
 * saíram, da saída mais recente para a mais antiga.
 */
export function historicoDeAuxiliares(vinculos, agoraMs = Date.now()) {
  const lista = (Array.isArray(vinculos) ? vinculos : []).map((v) => {
    const desde = ms(v.desde);
    const ate = v.ativa ? null : ms(v.ate);
    return {
      uid: v.uid,
      nome: v.nome || 'Auxiliar',
      telefone: v.telefone || '',
      ativa: !!v.ativa,
      desdeMs: desde,
      ateMs: ate,
      meses: mesesEntre(desde, ate ?? agoraMs),
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
    ultimos12: h.filter((x) => x.desdeMs != null && x.desdeMs >= umAno).length,
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
