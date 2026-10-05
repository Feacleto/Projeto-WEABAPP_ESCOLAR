/**
 * ESPELHO de `src/dominio/identidade/destinoDoAviso.js` — o motivo e a forma
 * estão lá. PURO, sem require: `testar:imports` derruba a bateria se uma
 * régua alcançar o SDK. `npm run testar:notificacoes` compara os dois.
 */

'use strict';

const PAINEL = { parent: '/pai', admin: '/tio', owner: '/admin', auxiliar: '/aux' };

const DESTINO_DO_AVISO = {
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

  absence_declared: { parent: '/pai/faltas', admin: '/tio/children/{childId}' },
  school_no_class: { parent: '/pai', admin: '/tio/semana' },
  agenda_entry: { parent: '/pai', admin: '/tio/agenda' },
  agenda_school_entry: { parent: '/pai', admin: '/tio/agenda' },
  agenda_broadcast: { parent: '/pai', admin: '/tio/agenda' },
  chamado_respondido: { parent: '/pai/profile', admin: '/tio/profile' },

  contrato_pronto: '/pai/contrato',
  payment_confirmed: '/pai/finance',
  payment_due_5d: '/pai/finance',
  payment_due_3d: '/pai/finance',
  payment_due_0d: '/pai/finance',
  payment_overdue_3d: '/pai/finance',
  payment_overdue_7d: '/pai/finance',

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

  parceiro_indicou_voce: '/tio/comunidade',
  transferencia_pedida: '/tio/comunidade',
  transferencia_respondida: '/tio/children/{childId}',
  transferencia_concluida: '/tio/children/{childId}',
  familia_pede_outro_tio: '/tio/children/{childId}',

  recomendacao_recebida: '/aux/perfil',

  lead_investidor: '/admin',
};

function papelDe(papel) {
  return papel === 'parent' || papel === 'admin' || papel === 'owner' || papel === 'auxiliar' ? papel : 'parent';
}

function destinoDoAviso(aviso, papel) {
  const p = papelDe(papel);
  const reserva = PAINEL[p];
  const proprio = aviso && (aviso.destino || aviso.url);
  if (typeof proprio === 'string' && proprio.startsWith('/') && !proprio.startsWith('//')) {
    return proprio;
  }
  const regra = DESTINO_DO_AVISO[String((aviso && aviso.type) || '')];
  let caminho = typeof regra === 'string' ? regra : regra && regra[p];
  if (!caminho) return reserva;
  if (!caminho.startsWith(reserva)) return reserva;
  if (caminho.includes('{childId}')) {
    if (!aviso || !aviso.childId) return reserva;
    caminho = caminho.replace('{childId}', encodeURIComponent(aviso.childId));
  }
  return caminho;
}

/**
 * ⚠️ O PUSH PRECISA DO ENDEREÇO INTEIRO. O `fcmOptions.link` era "/pai": o
 * FCM recusa link que não é HTTPS absoluto, e a recusa (`invalid-argument`)
 * era lida como token morto — o envio APAGAVA o aparelho da pessoa.
 * `APP_URL` existe para o emulador; em produção o app é o `.com`.
 */
const ORIGEM_DO_APP = String(process.env.APP_URL || 'https://alobuzinou.com').replace(/\/+$/, '');

function urlDoAviso(aviso, papel) {
  return ORIGEM_DO_APP + destinoDoAviso(aviso, papel);
}

module.exports = { PAINEL, DESTINO_DO_AVISO, destinoDoAviso, urlDoAviso, ORIGEM_DO_APP };
