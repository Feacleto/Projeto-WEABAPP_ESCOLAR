/**
 * O CRM DO DONO — cada motorista numa coluna, e a próxima conversa.
 *
 * ── A PERGUNTA É "EM QUE PÉ ESTÁ A RELAÇÃO", NÃO "QUANTO ELE PAGA"
 * A carteira (`carteira.js`) responde em que degrau de CONTA ele está; aqui o
 * quadro responde com quem o dono precisa falar e o que ficou combinado. Por
 * isso a coluna é uma função pura, UMA por motorista, e a ordem das regras é
 * parte da regra.
 *
 * ── AS CINCO COLUNAS, NA ORDEM EM QUE SÃO DECIDIDAS
 *   suspenso    `suspenso === true` — quem suspendeu foi o dono.
 *   risco       o termômetro (`risco.js`) acima de 'nenhum', ou parado há
 *               7+ dias depois de ter rodado, ou conta BLOQUEADA (teste
 *               vencido ou atraso; não suspensa). Bloqueado entra aqui porque
 *               o termômetro o ignora de propósito e, no quadro, ele ficaria
 *               sem dono — a conversa mais urgente da relação.
 *   cadastrou   nunca rodou rota (sem `ultimaRota` e sem `trialInicio`).
 *   assinante   plano válido.
 *   rodando     o resto: rodou nos últimos 7 dias e ainda não tem plano.
 *
 * ── O HISTÓRICO É APPEND-ONLY
 * `contatosDoDono` nunca é editado nem apagado; a "última conversa" é só o
 * documento mais novo daquele motorista, e o "retomar em" vale o do contato
 * mais novo que o trouxe — marcar uma nova data substitui a anterior, e um
 * contato novo SEM data não cancela a anterior (ele pode ser só uma anotação).
 *
 * ── LGPD
 * O motorista é titular: pode pedir, pelo art. 18, o que foi anotado sobre
 * ele, pelo contato@alobuzinou.com, como no registroDoDono. O texto que cita
 * terceiros sai editado ao responder.
 *
 * ESTE ARQUIVO NÃO IMPORTA FIREBASE. O "agora" entra por parâmetro; datas
 * 'AAAA-MM-DD' são comparadas como texto, no fuso de Brasília.
 */

import { degrauDo } from './carteira.js';
import { planoValido } from './planos.js';
import { DIAS_SEM_RODAR, diasSemRodar, riscoDo } from './risco.js';

export const COLUNAS = [
  { id: 'cadastrou', rotulo: 'Cadastrou' },
  { id: 'rodando', rotulo: 'Rodando' },
  { id: 'assinante', rotulo: 'Assinante' },
  { id: 'risco', rotulo: 'Em risco' },
  { id: 'suspenso', rotulo: 'Suspenso' },
];

export const CANAIS = [
  { id: 'whatsapp', rotulo: 'WhatsApp' },
  { id: 'ligacao', rotulo: 'Ligação' },
  { id: 'email', rotulo: 'E-mail' },
  { id: 'presencial', rotulo: 'Presencial' },
];

export const LIMITE_DO_TEXTO = 1000;

const MS_POR_DIA = 24 * 60 * 60 * 1000;

function paraData(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  if (typeof valor?.toDate === 'function') return paraData(valor.toDate());
  if (typeof valor === 'number' || typeof valor === 'string') {
    const d = new Date(valor);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** 'AAAA-MM-DD' de hoje no fuso de Brasília (UTC-3, sem horário de verão). */
export function hojeEmBrasilia(agora = new Date()) {
  const d = paraData(agora) || new Date();
  return new Date(d.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** A coluna deste motorista. Uma, sempre. */
export function colunaDo({ motorista, faturas = [], nota = null, agora = new Date() } = {}) {
  if (motorista?.suspenso === true) return 'suspenso';

  const degrau = degrauDo(motorista, agora);
  if (degrau === 'bloqueado') return 'risco';

  const rodou = Boolean(motorista?.ultimaRota || motorista?.trialInicio);
  if (!rodou) return 'cadastrou';

  const { nivel } = riscoDo({ motorista, faturas, nota, degrau, agora });
  if (nivel !== 'nenhum') return 'risco';
  const parado = diasSemRodar(motorista, agora);
  if (parado !== null && parado >= DIAS_SEM_RODAR) return 'risco';

  if (planoValido(motorista?.plano)) return 'assinante';

  return 'rodando';
}

/** Desde quando está nesta coluna — melhor esforço, `null` sem data. */
export function desdeQuando(coluna, motorista) {
  const campo =
    coluna === 'cadastrou'
      ? motorista?.createdAt
      : coluna === 'assinante'
        ? motorista?.contratadoEm
        : coluna === 'suspenso'
          ? motorista?.suspensoEm
          : coluna === 'risco'
            ? motorista?.ultimaRota
            : motorista?.trialInicio;
  return paraData(campo) || paraData(motorista?.createdAt);
}

/** Dias inteiros desde `data`; `null` sem data. */
export function diasDesde(data, agora = new Date()) {
  const d = paraData(data);
  const hoje = paraData(agora);
  if (!d || !hoje) return null;
  return Math.max(0, Math.floor((hoje.getTime() - d.getTime()) / MS_POR_DIA));
}

/**
 * Por motorista: o contato mais novo e o "retomar em" vigente.
 * `contatos` vem em qualquer ordem; o `em` decide. Sem `em` (a escrita ainda
 * não voltou do servidor), o contato conta como o mais novo.
 */
export function contatosPorMotorista(contatos = []) {
  const por = {};
  const lista = (Array.isArray(contatos) ? contatos : []).filter((c) => c?.motoristaUid);
  const tempo = (c) => paraData(c.em)?.getTime() ?? Infinity;
  [...lista]
    .sort((a, b) => tempo(a) - tempo(b))
    .forEach((c) => {
      const atual = (por[c.motoristaUid] ||= { ultimo: null, retomarEm: null });
      atual.ultimo = c;
      if (typeof c.retomarEm === 'string' && c.retomarEm) atual.retomarEm = c.retomarEm;
    });
  return por;
}

/** 'hoje' ou 'atrasado' se o retomar já chegou; `null` se não. */
export function situacaoDoRetomar(retomarEm, agora = new Date()) {
  if (!retomarEm) return null;
  const hoje = hojeEmBrasilia(agora);
  if (retomarEm < hoje) return 'atrasado';
  if (retomarEm === hoje) return 'hoje';
  return null;
}

/** Quantos motoristas pedem conversa hoje (retomar hoje ou já vencido). */
export function retomarHoje(contatos, agora = new Date()) {
  const por = contatosPorMotorista(contatos);
  return Object.values(por).filter((p) => situacaoDoRetomar(p.retomarEm, agora)).length;
}

/**
 * O quadro: `{ colunas: { id: [cartão] }, retomarHoje }`.
 * Em cada coluna, quem pede conversa hoje vem primeiro, depois quem está há
 * mais tempo ali.
 */
export function montarQuadro({
  parceiros = [],
  faturas = {},
  notas = {},
  contatos = [],
  agora = new Date(),
} = {}) {
  const por = contatosPorMotorista(contatos);
  const colunas = Object.fromEntries(COLUNAS.map((c) => [c.id, []]));

  (Array.isArray(parceiros) ? parceiros : []).forEach((m) => {
    if (!m?.uid) return;
    const coluna = colunaDo({
      motorista: m,
      faturas: faturas?.[m.uid] || [],
      nota: notas?.[m.uid] || null,
      agora,
    });
    const c = por[m.uid] || { ultimo: null, retomarEm: null };
    colunas[coluna].push({
      uid: m.uid,
      nome: m.marcaNome || m.name || 'Sem nome',
      coluna,
      dias: diasDesde(desdeQuando(coluna, m), agora),
      ultimo: c.ultimo,
      retomarEm: c.retomarEm,
      situacao: situacaoDoRetomar(c.retomarEm, agora),
    });
  });

  Object.values(colunas).forEach((l) =>
    l.sort(
      (a, b) =>
        Number(Boolean(b.situacao)) - Number(Boolean(a.situacao)) ||
        (b.dias ?? -1) - (a.dias ?? -1)
    )
  );

  // Só conta quem está no quadro: contato de motorista que já saiu da lista
  // não pode inflar o "para retomar hoje".
  const doQuadro = new Set(Object.values(colunas).flat().map((x) => x.uid));
  const hoje = Object.entries(por).filter(
    ([uid, p]) => doQuadro.has(uid) && situacaoDoRetomar(p.retomarEm, agora)
  ).length;
  return { colunas, retomarHoje: hoje };
}

/**
 * Agrupa o histórico para a tela: cada anotação com as correções logo abaixo.
 * Append-only: a anotação errada continua lá; a correção é outra anotação com
 * `corrige` = id da errada. Correção cujo alvo não está na lista (já saiu do
 * limite) aparece sozinha, no seu lugar de data.
 */
export function agruparCorrecoes(contatos = []) {
  const lista = Array.isArray(contatos) ? contatos : [];
  const ids = new Set(lista.map((c) => c.id));
  const filhas = {};
  lista.forEach((c) => {
    if (c.corrige && ids.has(c.corrige)) (filhas[c.corrige] ||= []).push(c);
  });
  return lista
    .filter((c) => !(c.corrige && ids.has(c.corrige)))
    .map((c) => ({ ...c, correcoes: (filhas[c.id] || []).slice().reverse() }));
}

/** Valida o que a folha vai gravar; devolve `null` se está bom, senão a frase. */
export function erroDoContato({ motoristaUid, canal, texto, retomarEm } = {}) {
  if (!motoristaUid) return 'Escolha o motorista.';
  if (!CANAIS.some((c) => c.id === canal)) return 'Escolha o canal.';
  const t = String(texto || '').trim();
  if (!t) return 'Escreva o que foi combinado.';
  if (t.length > LIMITE_DO_TEXTO) return `O texto passa de ${LIMITE_DO_TEXTO} letras.`;
  if (retomarEm != null && retomarEm !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(retomarEm)) {
    return 'A data de retomar está errada.';
  }
  return null;
}
