/**
 * QUEM ASSINA — o CPF/CNPJ que a assinatura exige, e a regra "um documento,
 * uma conta" (decisão do dono, 05/10/2026).
 *
 * ── POR QUE ASSINAR PASSOU A EXIGIR O DOCUMENTO
 * Dois controles dependem de saber que duas contas são a MESMA pessoa, e o
 * e-mail não diz isso (abrir outro custa trinta segundos):
 *   - a INDICAÇÃO: ninguém indica a si mesmo com uma segunda conta;
 *   - o DESCONTO DE FECHAMENTO: ninguém o repete abrindo outra conta.
 * E é o documento que amarra a conta ao alvará da prefeitura, que é emitido
 * no CPF/CNPJ de quem dirige.
 *
 * ── O QUE ESTE ARQUIVO DECIDE (E O QUE NÃO)
 * Decide se o documento serve e qual vale, e se o registro existente é dele
 * ou de outra conta. Não escreve nada e não calcula hash — quem faz isso é
 * `contratacao.js`, dentro de uma transação. Aqui é régua pura.
 *
 * ⚠️ SEM `require` DO SDK — é RÉGUA (ver CLAUDE.md e `testar:imports`). O
 * único import é `cobrancaDaTaxa.js`, que também é puro: a conta dos dígitos
 * verificadores é UMA no servidor, e o gateway e a assinatura não podem
 * discordar sobre o que é um CPF válido.
 *
 * O espelho no cliente é `documentoValido` em `src/compartilhado/masks.js`
 * (a tela que decide se abre o passo do CPF), e `npm run testar:assinante`
 * compara os dois caso a caso.
 */

const { documentoValido } = require('./cobrancaDaTaxa');

/** O documento na forma que a pessoa lê, igual à máscara do cliente. */
function formatarDocumento(digitos) {
  const d = String(digitos || '');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  return d;
}

/**
 * Qual documento esta assinatura usa.
 *
 *   { ok: true, digitos, documento, gravarNoPerfil }
 *   { ok: false, erro: 'falta' | 'invalido' | 'diferente-do-perfil' }
 *
 * ⚠️ A FONTE É O PERFIL (`users.companyDocument`), não o que a tela manda.
 * É o mesmo número que já qualifica o motorista no contrato com as FAMÍLIAS,
 * e dois documentos diferentes — um para elas, outro para a plataforma —
 * seriam duas verdades sobre quem ele é. O `enviado` só existe para quem
 * ainda não tem um válido no perfil: aí a tela pede, e o SERVIDOR grava (só
 * depois de saber que o número é livre — gravado antes, o perfil ficaria
 * com o documento de outra conta).
 *
 * ⚠️ PERFIL VÁLIDO E ENVIADO DIFERENTE É RECUSA, não troca calada. Trocar
 * aqui mudaria em silêncio a parte do contrato com as famílias; quem quer
 * corrigir o CPF corrige no Perfil, à vista.
 */
function documentoDoAssinante({ enviado = null, doPerfil = null } = {}) {
  const perfil = documentoValido(doPerfil);
  const tela = enviado == null || String(enviado).trim() === '' ? null : documentoValido(enviado);

  if (perfil) {
    if (tela && tela !== perfil) return { ok: false, erro: 'diferente-do-perfil' };
    if (enviado != null && String(enviado).trim() !== '' && !tela) {
      return { ok: false, erro: 'invalido' };
    }
    return {
      ok: true,
      digitos: perfil,
      // O texto do perfil, como está: é ele que o contrato com as famílias
      // já imprime, e a rule do contrato da assinatura compara strings.
      documento: String(doPerfil).trim(),
      gravarNoPerfil: false,
    };
  }

  if (enviado == null || String(enviado).trim() === '') return { ok: false, erro: 'falta' };
  if (!tela) return { ok: false, erro: 'invalido' };
  return { ok: true, digitos: tela, documento: formatarDocumento(tela), gravarNoPerfil: true };
}

/**
 * O registro `documentosDeAssinante/{hash}` já existe — de quem é?
 *   'livre'  ninguém registrou
 *   'meu'    esta mesma conta (troca de plano, renovação): segue
 *   'outro'  outra conta: recusa
 */
function donoDoDocumento(registro, uid) {
  if (!registro || !registro.uid) return 'livre';
  return registro.uid === uid ? 'meu' : 'outro';
}

/**
 * A frase de cada recusa. ⚠️ A de 'outro' NÃO DIZ DE QUEM É: confirmar que um
 * CPF tem conta, e qual, entregaria a qualquer um um oráculo de cadastro.
 */
const FRASE_DA_RECUSA = {
  falta: 'O contrato precisa do seu CPF ou CNPJ.',
  invalido: 'CPF ou CNPJ inválido. Confira os números.',
  'diferente-do-perfil':
    'Este CPF ou CNPJ é diferente do que está no seu perfil. Corrija no Perfil e tente de novo.',
  outro:
    'Este CPF ou CNPJ já está ligado a outra conta do app. Fale com o suporte para resolver.',
};

module.exports = {
  documentoValido,
  formatarDocumento,
  documentoDoAssinante,
  donoDoDocumento,
  FRASE_DA_RECUSA,
};
