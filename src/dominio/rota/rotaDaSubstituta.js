/**
 * A ROTA DA SUBSTITUTA DE UM DIA — o lado da tela (F3, 05/10/2026).
 *
 * O servidor (`functions/lib/reguaDaSubstitutaDeUmDia.js`) decide se o link
 * vale e QUAIS campos saem: primeiro nome, horas, escola, status de hoje e a
 * falta do dia. Aqui mora o que a página e a tela do tio fazem com isso:
 *   - a ORDEM DA VIAGEM, pela mesma régua do motorista (`diaCompleto`): a
 *     substituta lê a rota na ordem em que ele a faria;
 *   - a palavra de cada status — o vocabulário do app inteiro;
 *   - a mensagem do WhatsApp que o tio manda com o link;
 *   - qual link de hoje está aberto, para a lista do tio.
 *
 * Puro: sem Firebase e sem React (`npm run testar:substituta-de-um-dia`).
 */

import { diaCompleto, precisaDaPerua, ROTULO_ESTADO, horaCurta } from './horarios.js';

/** As etapas, com os nomes de sempre: Em casa · Na perua · Na escola · Entregue em casa. */
export const PALAVRA_DO_STATUS = Object.freeze({
  home: 'Em casa',
  onboard: 'Na perua',
  atSchool: 'Na escola',
  delivered: 'Entregue em casa',
});

export function palavraDoStatus(status) {
  return PALAVRA_DO_STATUS[status] || PALAVRA_DO_STATUS.home;
}

/** 'AAAA-MM-DD' em Brasília — o mesmo dia que o servidor usa. */
export function chaveDeHoje(agora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora);
}

/**
 * As viagens do dia, na ordem: `[{ direcao, inicio, paradas: [{ chave, nome,
 * hora, escola, status, palavra, fora, motivo }] }]`. `fora` é a criança que
 * não precisa da perua nesta viagem (falta, o pai leva/busca) — a tela risca.
 */
export function viagensDaSubstituta(paradas) {
  const criancas = (paradas || []).map((p) => ({ ...p, id: p.chave, name: p.nome, active: true }));
  const declaracoes = {};
  for (const p of paradas || []) {
    if (p.falta) declaracoes[p.chave] = { type: p.falta };
  }
  return diaCompleto(criancas, { declaracoes }).map((bloco) => ({
    direcao: bloco.direcao,
    inicio: bloco.inicio,
    paradas: bloco.paradas.map((p) => ({
      chave: `${bloco.direcao}-${p.child.chave}`,
      nome: p.child.nome,
      hora: horaCurta(p.hora),
      escola: p.child.escola || null,
      status: p.child.status,
      palavra: palavraDoStatus(p.child.status),
      fora: !precisaDaPerua(p.estado),
      motivo: precisaDaPerua(p.estado) ? null : ROTULO_ESTADO[p.estado] || 'Não vai hoje',
    })),
  }));
}

/** "Oi, Joana! Aqui é o Tio Nino. Hoje a rota é com você: {link}. Vale só hoje." */
export function mensagemDaSubstituta({ nome, marca, link, gender }) {
  const quem = String(nome || '').trim().split(/\s+/)[0];
  const tio = String(marca || '').trim();
  const artigo = gender === 'female' ? 'a' : 'o';
  const fala = tio ? `Aqui é ${artigo} ${tio}.` : `Aqui é ${artigo} motorista da perua.`;
  return `${quem ? `Oi, ${quem}!` : 'Oi!'} ${fala} Hoje a rota é com você: ${link}. Vale só hoje.`;
}

/** "Fale com o Tio Nino." / "Fale com a Tia Lene." / sem marca, com quem mandou. */
export function falaComQuem(marca) {
  return marca?.nome ? `Fale com ${marca.artigo === 'a' ? 'a' : 'o'} ${marca.nome}.` : 'Fale com quem te mandou.';
}

/**
 * O link ABERTO de hoje para esta substituta, ou `null`. O de ontem que
 * ninguém encerrou não conta: ele já morreu pela data.
 */
export function acessoAbertoDeHoje(acessos, substitutaId, hoje) {
  return (acessos || []).find(
    (a) => a && a.substitutaId === substitutaId && a.dateKey === hoje && !a.encerradoEm
  ) || null;
}
