/**
 * QUANDO UM CONTATO DO DONO DEVE SAIR (`contatosDoDono`) — régua pura.
 *
 * Prazo (revisão jurídica): guardar enquanto a conta existir e 5 anos depois de
 * encerrada. Esta régua NÃO faz `require` de SDK (`npm run testar:imports`).
 *
 * "Encerrada" é a conta SEM documento em `users`, ou com
 * `renovacaoAutomatica === false` e `assinaturaAte` há mais de 5 anos.
 * Sem documento não há data de encerramento para contar: o contato conta a
 * partir do próprio `em`. Pode apagar um pouco mais tarde que o ideal, nunca
 * antes — o erro do lado seguro. Sem `em` ou sem `assinaturaAte`: NÃO sai.
 */
const ANOS_DE_GUARDA = 5;

function paraData(v) {
  if (!v) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v.toDate === 'function') return paraData(v.toDate());
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function corteDeCincoAnos(agora) {
  const c = new Date(agora.getTime());
  c.setUTCFullYear(c.getUTCFullYear() - ANOS_DE_GUARDA);
  return c;
}

/** `motorista` é o documento de users, ou null se não existe. */
function deveSair({ contato, motorista, agora = new Date() } = {}) {
  const corte = corteDeCincoAnos(agora);
  if (!motorista) {
    const em = paraData(contato?.em);
    return Boolean(em && em.getTime() < corte.getTime());
  }
  if (motorista.renovacaoAutomatica !== false) return false;
  const ate = paraData(motorista.assinaturaAte);
  return Boolean(ate && ate.getTime() < corte.getTime());
}

/**
 * O REGISTRO DE AÇÕES DO DONO segue o mesmo prazo (pedido da revisão
 * jurídica, 05/10/2026): enquanto a conta existir, e 5 anos depois de
 * encerrada. `conta` é o documento de users do ALVO, ou null.
 *
 * - conta que não existe mais: 5 anos a partir do `em` da linha (apaga depois
 *   do ideal, nunca antes — não há data de encerramento para contar);
 * - FAMÍLIA: encerrada é `bloqueio.grau == 'encerramento'`, contada do
 *   `bloqueio.desde`; família ativa ou só suspensa guarda;
 * - MOTORISTA: a mesma regra dos contatos (renovação desligada e assinatura
 *   vencida há mais de 5 anos).
 */
function deveSairDoRegistro({ linha, conta, agora = new Date() } = {}) {
  const corte = corteDeCincoAnos(agora);
  if (!conta) {
    const em = paraData(linha?.em);
    return Boolean(em && em.getTime() < corte.getTime());
  }
  if (conta.role === 'parent') {
    if (conta.bloqueio?.grau !== 'encerramento') return false;
    const desde = paraData(conta.bloqueio.desde);
    return Boolean(desde && desde.getTime() < corte.getTime());
  }
  return deveSair({ contato: linha, motorista: conta, agora });
}

module.exports = { ANOS_DE_GUARDA, deveSair, deveSairDoRegistro, corteDeCincoAnos };
