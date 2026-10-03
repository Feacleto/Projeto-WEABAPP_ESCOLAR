/**
 * A REGRA PURA DA CHAVE MESTRA E DOS MÓDULOS DE COBRANÇA — sem Firebase.
 *
 * É o espelho de src/dominio/associacao/cobrancaLigada.js e
 * modulosDeCobranca.js para o Node das functions, que não importa o `src/`.
 * Mora separada de `cobrancaLigada.js` (que lê o banco) para o teste alcançá-la
 * sem o SDK: `npm run testar:modulos` confere que os dois lados respondem
 * igual. Módulo novo lá precisa entrar em `MODULOS` aqui também.
 *
 * Regras (decisões do dono, 02/10/2026):
 *   - a mestra (`cobrancaLigada`) ausente é DESLIGADA, e ela É a base;
 *   - cada módulo (`modulos.{id}`) ausente é DESLIGADO e liga sozinho;
 *   - desconto sem a base não vale;
 *   - `{ ativo, de, ate }` limita o módulo a um período ('AAAA-MM-DD').
 */

/** O espelho de `MODULOS_DE_COBRANCA` — só o que a regra precisa. */
const MODULOS = {
  plano: { base: true },
  escada: {},
  indicacao: {},
};

/** A chave mestra — a mesma regra do cliente. */
function estaLigada(config) {
  return config?.cobrancaLigada === true;
}

/** 'AAAA-MM-DD' no calendário de São Paulo, não no UTC do servidor. */
function hojeISO(agora) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora);
}

/** Um módulo vale agora? A mesma regra de `moduloAtivo` no cliente. */
function moduloEstaAtivo(config, id, agora = new Date()) {
  if (!estaLigada(config)) return false;
  const modulo = MODULOS[id];
  if (!modulo) return false;
  if (modulo.base) return true;

  const bruto = config?.modulos?.[id];
  if (bruto === undefined || bruto === null) return false;
  if (typeof bruto === 'boolean') return bruto;
  if (typeof bruto === 'object') {
    if (bruto.ativo === false) return false;
    const hoje = hojeISO(agora);
    if (bruto.de && hoje < bruto.de) return false;
    if (bruto.ate && hoje > bruto.ate) return false;
  }
  return true;
}

module.exports = { MODULOS, estaLigada, moduloEstaAtivo };
