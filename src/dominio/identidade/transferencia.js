/**
 * PASSAR A FAMÍLIA PARA OUTRO TIO, do lado do app (fase 2 da rede,
 * 05/10/2026). Quem DECIDE é `functions/lib/reguaDaTransferencia.js`; daqui
 * sai o que a tela precisa para dizer as coisas ANTES do toque. As
 * constantes são espelho (`npm run testar:transferencia` compara).
 *
 * Puro, sem Firebase nem React.
 */

export const DIAS_PARA_RESPONDER = 7;

export const ESTADO = Object.freeze({
  PEDIDO: 'pedido',
  PARCEIRO_ACEITOU: 'parceiro_aceitou',
  CONCLUIDA: 'concluida',
  RECUSADA_PARCEIRO: 'recusada_parceiro',
  CANCELADA: 'cancelada',
  EXPIRADA: 'expirada',
});

export const ABERTOS = Object.freeze([ESTADO.PEDIDO, ESTADO.PARCEIRO_ACEITOU]);

function emMs(v) {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (v instanceof Date) return v.getTime();
  return null;
}

/** O estado que vale agora: pedido aberto e vencido é EXPIRADA. */
export function estadoEfetivo(t, agoraMs = Date.now()) {
  if (!t) return null;
  if (ABERTOS.includes(t.estado)) {
    const expira = emMs(t.expiraEm);
    if (expira != null && expira <= agoraMs) return ESTADO.EXPIRADA;
  }
  return t.estado;
}

export function estaAberta(t, agoraMs = Date.now()) {
  return ABERTOS.includes(estadoEfetivo(t, agoraMs));
}

/**
 * O que a FAMÍLIA lê antes do "Aceito" — em palavras dela, a mesma lista
 * fechada do servidor (`CAMPOS_QUE_VAO` / `CAMPOS_QUE_NUNCA_VAO`).
 */
export const O_QUE_VAI = Object.freeze([
  'O nome, o aniversário, a turma e a professora',
  'O endereço de casa e a escola',
  'O seu nome e o seu WhatsApp (e o do segundo responsável)',
]);

export const O_QUE_NAO_VAI = Object.freeze([
  'Mensalidades e pagamentos',
  'O contrato de agora',
  'A foto e os dados de saúde',
  'Horários e o histórico da rota',
]);

/** "Responder até 12/10" — o prazo do pedido, em dd/mm. */
export function prazoDoPedido(t) {
  const ms = emMs(t?.expiraEm);
  if (ms == null) return null;
  const d = new Date(ms - 3 * 3600000);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** A frase do estado, para a ficha do tio de agora. */
export function fraseDoEstado(t, agoraMs = Date.now()) {
  const para = t?.marcaPara || 'o parceiro';
  switch (estadoEfetivo(t, agoraMs)) {
    case ESTADO.PEDIDO: return `Esperando ${para} responder.`;
    case ESTADO.PARCEIRO_ACEITOU: return `${para} aceitou. Falta a família aceitar.`;
    case ESTADO.CONCLUIDA: return `A família aceitou. Agora está com ${para}.`;
    case ESTADO.RECUSADA_PARCEIRO: return `${para} não pode receber.`;
    case ESTADO.CANCELADA: return 'Você cancelou o pedido.';
    case ESTADO.EXPIRADA: return 'O pedido venceu sem resposta.';
    default: return '';
  }
}

/**
 * O PEDIDO DA FAMÍLIA (F2.6): ela pede ao tio DELA para ser passada a outro
 * tio. O app nunca mostra uma lista de tios a ela (declaração 5 da marca):
 * quem escolhe o parceiro é o tio. Um pedido por criança por mês.
 */
export function idDoPedidoDaFamilia(childId, agora = new Date()) {
  const d = new Date((agora instanceof Date ? agora.getTime() : agora) - 3 * 3600000);
  return `outrotio_${childId}_${d.toISOString().slice(0, 7)}`;
}

export function pedidoDaFamilia({ nomeCrianca } = {}) {
  const nome = String(nomeCrianca || '').trim().split(/\s+/)[0] || 'A criança';
  return {
    type: 'familia_pede_outro_tio',
    title: `A família de ${nome} pediu para passar a outro tio`,
    body: 'Se fizer sentido, escolha um tio parceiro na ficha da criança.',
  };
}
