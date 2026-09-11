/**
 * O CADASTRO DO MOTORISTA ESTÁ COMPLETO? — regra pura.
 *
 * Desde 11/09/2026 a conta nasce com três campos (e-mail, WhatsApp, senha) e
 * o resto é pedido no primeiro acesso, do lado de dentro do app. Alguém
 * precisa dizer se ele já respondeu — e esse alguém é uma função pura, porque
 * ela decide um DESVIO DE ROTA: errar aqui ou prende quem já preencheu, ou
 * deixa passar quem não preencheu.
 *
 * ── ⚠️ TRÊS CAMPOS TRAVAM, E OS OUTROS DOIS NÃO — A DIFERENÇA É O CONTRATO
 * `name` e `city` viram a PARTE em `contratoAssociacao.js`, e `regiao` é o
 * que o dono usa para saber onde ele roda. Sem os dois primeiros o contrato
 * nasce com a parte em branco, e documento assinado sem quem assinou não é
 * documento. `marcaNome` e `criancasEstimadas` não entram em nada disso:
 * bloquear por eles seria cobrar pedágio por conveniência.
 *
 * ── ⚠️ E "AUSENTE" NÃO É "VAZIO"
 * `inscreverAssociado` OMITE os campos que não foram perguntados, em vez de
 * gravar `''`. A distinção é o que faz esta função funcionar: string vazia
 * significaria "perguntei e ele deixou em branco", e aí prender seria errado.
 * Como ela trata os dois do mesmo jeito, a omissão é o que mantém a intenção
 * legível no banco para quem for ler depois.
 *
 * ── POR QUE NÃO MORA NA TELA
 * Morava — e o lint recusou, pela mesma regra que tirou `indiceDaAba` do
 * `BottomNav`: arquivo de componente que exporta função solta quebra o fast
 * refresh. O empurrão foi bom: aqui ela é testável sem montar tela nenhuma.
 */

/** Os três que travam a entrada. */
export const CAMPOS_OBRIGATORIOS = ['name', 'city', 'regiao'];

function vazio(v) {
  return !String(v || '').trim();
}

/**
 * `true` quando o motorista ainda deve o primeiro acesso.
 *
 * Responde `false` para quem não é motorista e para perfil ausente — quem
 * decide o desvio não pode desviar a mãe, nem quem ainda está carregando.
 */
export function faltaCompletarCadastro(profile) {
  if (!profile) return false;
  if (profile.role !== 'admin') return false;
  return CAMPOS_OBRIGATORIOS.some((campo) => vazio(profile[campo]));
}
