/**
 * PARA ONDE CADA AVISO LEVA — o sino e o push respondem igual (03/10/2026).
 *
 * ── O DEFEITO QUE ISTO FECHA
 * Eram duas tabelas: o `onClickNotif` do sino (oito ramos) e o `URL_BY_TYPE`
 * do push. Os dois diziam que se espelhavam, e não se espelhavam: mais de
 * vinte tipos não levavam a lugar nenhum quando tocados no sino, e no push
 * vários caíam em "/" — que manda para o login. Aviso que não leva a lugar
 * nenhum ensina a não tocar em aviso.
 *
 * ── A FORMA
 * Cada tipo aponta um caminho, ou um caminho POR PAPEL quando o mesmo aviso
 * vai aos dois lados (o recado da agenda abre o caderno da família e a agenda
 * do motorista). `{childId}` é trocado pelo da criança do aviso; sem ele, vale
 * o caminho de reserva do papel.
 *
 * Espelho em `functions/lib/destinoDoAviso.js` — o deploy das functions não
 * alcança `src/`. `npm run testar:notificacoes` compara os dois e exige
 * destino para todo tipo que tem espécie em `avisos.js`.
 */

export const PAINEL = { parent: '/pai', admin: '/tio', owner: '/admin', auxiliar: '/aux' };

export const DESTINO_DO_AVISO = {
  // ── A ROTA, para a família
  rota_iniciada: '/pai',
  proxima_parada: '/pai',
  perua_chegando: '/pai',
  perua_chegou: '/pai',
  buzina: '/pai',
  child_onboard: '/pai',
  child_arrived_school: '/pai',
  child_arrived_home: '/pai',
  nao_embarcou: '/pai',
  rota_atrasada: '/pai',
  absence_confirm: '/pai',
  schedule_changed: '/pai/child',
  irmao_vinculado: '/pai',
  acesso_aprovado: '/pai',
  acesso_recusado: '/pai',
  // A foto da turma e a pergunta dela moram no Início da família.
  foto_da_turma: '/pai',
  pedido_sim_da_foto: '/pai',
  transferencia_para_aceitar: '/pai',

  // ── DOS DOIS LADOS
  absence_declared: { parent: '/pai/faltas', admin: '/tio/children/{childId}' },
  school_no_class: { parent: '/pai', admin: '/tio/semana' },
  agenda_entry: { parent: '/pai', admin: '/tio/agenda' },
  agenda_school_entry: { parent: '/pai', admin: '/tio/agenda' },
  agenda_broadcast: { parent: '/pai', admin: '/tio/agenda' },
  chamado_respondido: { parent: '/pai/profile', admin: '/tio/profile' },

  // ── O DINHEIRO DA FAMÍLIA
  contrato_pronto: '/pai/contrato',
  payment_confirmed: '/pai/finance',
  payment_due_5d: '/pai/finance',
  payment_due_3d: '/pai/finance',
  payment_due_0d: '/pai/finance',
  payment_overdue_3d: '/pai/finance',
  payment_overdue_7d: '/pai/finance',

  // ── PARA O MOTORISTA
  payment_claimed: '/tio/finance',
  contract_accepted: '/tio/children/{childId}/contract',
  numero_da_casa: '/tio/children/{childId}',
  alt_pickup: '/tio/children/{childId}',
  irmao_recusado: '/tio/children/{childId}',
  convite_parado: '/tio/children/{childId}',
  pedido_de_acesso: '/tio',
  acesso_temporario: '/tio/children/{childId}',
  indicacao_cadastrou: '/tio/indicar',
  indicacao_ativou: '/tio/indicar',
  oferta_primeira_rota: '/tio/planos',
  comercial_teste_comecou: '/tio/planos',
  comercial_degrau_vira: '/tio/planos',
  comercial_retorno: '/tio/planos',
  comercial_indicacao: '/tio/indicar',
  fatura_vence: '/tio/taxa',
  alvara_vence: '/tio/selo',
  encerramento_30d: '/tio/encerrar',
  encerramento_7d: '/tio/encerrar',
  encerramento_fim: '/tio/encerrar',
  auxiliar_confirmou_pagamento: '/tio/finance/auxiliar',

  // ── A REDE DE PARCEIROS
  parceiro_indicou_voce: '/tio/comunidade',
  transferencia_pedida: '/tio/comunidade',
  transferencia_respondida: '/tio/children/{childId}',
  transferencia_concluida: '/tio/children/{childId}',
  familia_pede_outro_tio: '/tio/children/{childId}',

  // ── PARA A AUXILIAR
  recomendacao_recebida: '/aux/perfil',

  // ── PARA O DONO
  lead_investidor: '/admin',
};

function papelDe(papel) {
  return papel === 'parent' || papel === 'admin' || papel === 'owner' || papel === 'auxiliar' ? papel : 'parent';
}

/**
 * O caminho (relativo) para onde o toque leva. Nunca devolve vazio: o pior
 * caso é o painel de quem recebeu, nunca o login.
 *
 *   aviso — { type, childId?, url?, destino? }
 *   papel — 'parent' | 'admin' | 'owner' | 'auxiliar' (o `role` de quem recebeu)
 */
export function destinoDoAviso(aviso, papel) {
  const p = papelDe(papel);
  const reserva = PAINEL[p];
  const proprio = aviso?.destino || aviso?.url;
  if (typeof proprio === 'string' && proprio.startsWith('/') && !proprio.startsWith('//')) {
    return proprio;
  }
  const regra = DESTINO_DO_AVISO[String(aviso?.type || '')];
  let caminho = typeof regra === 'string' ? regra : regra?.[p];
  if (!caminho) return reserva;
  // Um aviso do motorista nunca leva a família a uma tela do motorista, e
  // vice-versa: o caminho tem que ser do painel de quem tocou.
  if (!caminho.startsWith(reserva)) return reserva;
  if (caminho.includes('{childId}')) {
    if (!aviso?.childId) return reserva;
    caminho = caminho.replace('{childId}', encodeURIComponent(aviso.childId));
  }
  return caminho;
}
