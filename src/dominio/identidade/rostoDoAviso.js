/**
 * DE QUEM É O ROSTO QUE ACOMPANHA UM AVISO (03/10/2026, pedido do dono).
 *
 * O sino mostrava o mesmo sino cinza em todo aviso, e o público de 40+ lê
 * ROSTO antes de ler frase: "Felipe não vai em 14/10" e "Contrato aceito"
 * pareciam a mesma coisa até a pessoa ler as duas linhas. Com o rosto da
 * criança, ela sabe de quem é o assunto antes de ler — é o mesmo atalho que o
 * WhatsApp usa.
 *
 * Três respostas, nesta ordem:
 *   1. CRIANÇA — o aviso é sobre uma criança que esta pessoa enxerga.
 *   2. MOTORISTA — o aviso chegou à FAMÍLIA vindo do motorista dela (recado,
 *      "não tem aula", rota iniciada…) e não aponta para uma criança.
 *   3. ÍCONE — o resto: o que vem da PLATAFORMA (chamado, indicação, fatura)
 *      e, para o motorista, o que não é de criança nenhuma. Pôr o rosto do
 *      motorista no próprio sino dele seria ele se avisando.
 *
 * ⚠️ O NOME SÓ CASA QUANDO É ÚNICO. Vários avisos guardam só `childName`
 * (contrato aceito, pagamento informado). Casar pelo nome é exibição, não
 * permissão — mas duas "Maria" na mesma turma dariam o rosto de uma no aviso
 * da outra, que é exatamente o erro que o rosto existe para evitar. Nome
 * repetido (ou ausente) cai no ícone.
 *
 * Puro: a lista de crianças vem por parâmetro, de quem já a tem carregada.
 */

// Avisos que a PLATAFORMA manda — nunca levam o rosto do motorista, mesmo
// quando chegam à família.
const DA_PLATAFORMA = new Set([
  'chamado_respondido',
  'indicacao_ativou',
  'indicacao_cadastrou',
  'lead_investidor',
  'fatura_vence',
]);

function normalizar(nome) {
  return String(nome || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

/** Acha a criança pelo id; sem id, pelo nome, e só quando ele é único. */
export function criancaDoAviso(aviso, criancas = []) {
  if (!aviso) return null;
  if (aviso.childId) {
    const porId = criancas.find((c) => c?.id === aviso.childId);
    if (porId) return porId;
  }
  const alvo = normalizar(aviso.childName);
  if (!alvo) return null;
  const iguais = criancas.filter((c) => normalizar(c?.name) === alvo);
  if (iguais.length === 1) return iguais[0];
  // Nome curto no aviso ("Felipe") contra nome completo no cadastro
  // ("Felipe Anacleto"): casa pelo primeiro nome, também só se for único.
  const primeiro = criancas.filter(
    (c) => normalizar(c?.name).split(/\s+/)[0] === alvo
  );
  return primeiro.length === 1 ? primeiro[0] : null;
}

/**
 * @param aviso    documento de `notifications`
 * @param criancas crianças que quem lê enxerga (a turma, ou os filhos)
 * @param papel    'admin' (motorista) | 'parent'
 * @returns {{ tipo: 'crianca', crianca } | { tipo: 'motorista' } | { tipo: 'icone' }}
 */
export function rostoDoAviso(aviso, criancas = [], papel) {
  const crianca = criancaDoAviso(aviso, criancas);
  if (crianca) return { tipo: 'crianca', crianca };
  if (papel === 'parent' && aviso && !DA_PLATAFORMA.has(aviso.type)) {
    return { tipo: 'motorista' };
  }
  return { tipo: 'icone' };
}
