/**
 * A DECLARAÇÃO DE AUTORIZAÇÃO DO RESPONSÁVEL — camada 1 do consentimento
 * (ver `docs/consentimento-saude.md`).
 *
 * Ela NÃO é o consentimento da família: é a afirmação do MOTORISTA de que
 * tem autorização dela para cadastrar nome, endereço de embarque e contato.
 * Existe porque a criança é cadastrada ANTES do convite, e a responsável pode
 * nunca resgatá-lo.
 *
 * ⚠️ O REGISTRO É POR CRIANÇA, A PERGUNTA É QUE PODE SER UMA VEZ POR SESSÃO.
 * Quem cadastra a turma inteira marca uma vez e segue; mas cada documento de
 * criança nasce com os TRÊS campos — `autorizacaoDeclarada`, a data
 * (`autorizacaoDeclaradaEm`) e QUEM declarou (`autorizacaoDeclaradaPor`). Um
 * booleano sozinho não diz quando nem quem, e é o quando-e-quem que faz dela
 * uma declaração em vez de uma caixa marcada.
 *
 * ⚠️ NUNCA SE GRAVA `true` SEM QUE A PESSOA TENHA DECLARADO. Por isso a função
 * abaixo devolve `null` (e o serviço recusa salvar) quando a declaração não
 * veio — em vez de completar o silêncio com um `true` conveniente. Os três
 * caminhos de cadastro (formulário completo, cadastro rápido do primeiro
 * acesso e vaga rápida da perua) passam por aqui.
 *
 * Puro de propósito (sem Firebase): a data chega por parâmetro, e é o serviço
 * que passa o `serverTimestamp()`.
 */

/**
 * O texto que a pessoa lê antes de marcar. Em três pedaços porque o do meio
 * vai em destaque na tela — e uma única fonte, para as três telas dizerem
 * exatamente a mesma coisa ao mesmo motorista.
 *
 * Fala só dos dados OPERACIONAIS (nome, endereço, contato) e não menciona
 * saúde: consentimento para dado sensível é da responsável, na tela dela.
 */
export const TEXTO_DA_DECLARACAO = {
  antes: 'Confirmo que tenho ',
  destaque: 'autorização do responsável legal',
  depois:
    ' desta criança para cadastrar no Alô Buzinou o nome, o endereço de embarque e os dados de contato, com a finalidade de operar o transporte escolar.',
};

/** A mensagem de quando a caixa não foi marcada (as três telas usam a mesma). */
export const ERRO_DA_DECLARACAO = 'Confirme que você tem autorização do responsável.';

/**
 * Os três campos que toda criança carrega, ou `null` se não há declaração
 * válida: `declarada` precisa ser exatamente `true`, `uid` precisa existir e
 * `quando` (o carimbo de tempo, que o serviço injeta) também.
 */
export function camposDaDeclaracao({ declarada, uid, quando } = {}) {
  if (declarada !== true) return null;
  if (typeof uid !== 'string' || uid === '') return null;
  if (quando == null) return null;
  return {
    autorizacaoDeclarada: true,
    autorizacaoDeclaradaEm: quando,
    autorizacaoDeclaradaPor: uid,
  };
}

/**
 * A memória da SESSÃO de cadastro: quem já declarou nesta abertura do app.
 *
 * Mora em memória de módulo, e não em `localStorage`, de propósito: fechar o
 * app apaga a declaração, e a pergunta volta. E vale POR USUÁRIO — o mesmo
 * navegador, com outro motorista logado depois, pergunta de novo.
 */
const declaradaNestaSessao = new Set();

export function jaDeclarouNestaSessao(uid) {
  return typeof uid === 'string' && uid !== '' && declaradaNestaSessao.has(uid);
}

export function lembrarDaDeclaracao(uid) {
  if (typeof uid === 'string' && uid !== '') declaradaNestaSessao.add(uid);
}

/** Só para teste (e para o logout, se um dia precisar). */
export function esquecerDeclaracoes() {
  declaradaNestaSessao.clear();
}
