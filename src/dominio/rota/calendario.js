/**
 * DIA SEM ROTA — fim de semana e feriado NACIONAL (03/10/2026, pedido do dono).
 *
 * O app não distinguia: no sábado a família podia ler "a rota não foi
 * iniciada" e o Início do motorista anunciava a viagem das 6h40. Agora:
 *   - o lugar do "INICIAR ROTA" diz QUE DIA É ("Hoje é sábado", "Feriado:
 *     Tiradentes") — e "Rodar mesmo assim" continua lá: tem escola com aula no
 *     sábado, reposição, passeio. Bloquear prenderia o motorista;
 *   - os avisos de rota atrasada calam (aqui e no espelho do servidor).
 *
 * FERIADO MUNICIPAL E ESTADUAL o app não sabe — e não finge saber. O caminho é
 * o motorista "Avisar que não tem aula", que marca a falta de todos e cala os
 * avisos do mesmo jeito.
 *
 * Puro, sem import: espelho em `functions/lib/reguaDoCalendario.js`, comparado
 * ano a ano em `npm run testar:viagem`.
 */

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano). */
export function pascoa(ano) {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

const p2 = (n) => String(n).padStart(2, '0');
const chave = (d) => `${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const mais = (d, dias) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + dias);

/**
 * Os feriados nacionais do ano, 'MM-DD' → nome. Carnaval e Corpus Christi são
 * ponto facultativo pela lei — mas escola não abre, e é isso que importa aqui.
 * Consciência Negra é feriado nacional desde 2024 (Lei 14.759/2023).
 */
export function feriadosNacionais(ano) {
  const p = pascoa(ano);
  const lista = {
    '01-01': 'Confraternização Universal',
    '04-21': 'Tiradentes',
    '05-01': 'Dia do Trabalho',
    '09-07': 'Independência do Brasil',
    '10-12': 'Nossa Senhora Aparecida',
    '11-02': 'Finados',
    '11-15': 'Proclamação da República',
    '12-25': 'Natal',
  };
  if (ano >= 2024) lista['11-20'] = 'Dia da Consciência Negra';
  lista[chave(mais(p, -48))] = 'Carnaval';
  lista[chave(mais(p, -47))] = 'Carnaval';
  lista[chave(mais(p, -2))] = 'Sexta-feira Santa';
  lista[chave(mais(p, 60))] = 'Corpus Christi';
  return lista;
}

/**
 * Por que hoje não tem rota combinada — `{ tipo, nome }` — ou `null` num dia
 * de aula comum.
 */
export function diaSemRota(data = new Date()) {
  const feriado = feriadosNacionais(data.getFullYear())[chave(data)];
  if (feriado) return { tipo: 'feriado', nome: feriado };
  const d = data.getDay();
  if (d === 6) return { tipo: 'fim-de-semana', nome: 'sábado' };
  if (d === 0) return { tipo: 'fim-de-semana', nome: 'domingo' };
  return null;
}

export function ehDiaDeAula(data = new Date()) {
  return diaSemRota(data) === null;
}

/** A frase do lugar do botão: "Hoje é sábado" / "Feriado: Tiradentes". */
export function fraseDoDiaSemRota(motivo) {
  if (!motivo) return null;
  return motivo.tipo === 'feriado' ? `Feriado: ${motivo.nome}` : `Hoje é ${motivo.nome}`;
}
