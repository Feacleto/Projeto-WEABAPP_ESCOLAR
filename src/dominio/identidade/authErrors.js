/**
 * O ERRO DE AUTENTICAÇÃO EM PORTUGUÊS — uma tabela só.
 *
 * POR QUE ISTO EXISTE
 * `mapAuthError` estava escrita em QUATRO arquivos: `Login.jsx`,
 * `LoginSheet.jsx`, `FirstAccess.jsx` e `AuthAction.jsx`. Duas eram idênticas
 * byte a byte, a terceira acrescentava dois casos, e a quarta cobria outro
 * conjunto (os códigos de link de ação).
 *
 * A divergência tinha efeito visível, e ela caía justamente em quem está
 * criando conta: quem tentava se cadastrar com um e-mail já usado lia
 * *"Este email já tem conta"* em `/first-access` e recebia a `err.message`
 * CRUA, em inglês, pela folha de login da home. Mesma pessoa, mesmo erro,
 * duas respostas — e uma delas nem em português.
 *
 * UMA TABELA, DOIS CONTEXTOS
 * Entrar e criar conta compartilham quase todos os códigos; o que muda é o
 * DEFAULT e um punhado de casos. Em vez de duas funções que vão divergir de
 * novo, `mensagemDeAuth(err, contexto)` escolhe o texto certo pelo contexto,
 * e o conjunto de códigos continua num lugar só.
 *
 * Este arquivo não importa nada — é o que o mantém testável
 * (`npm run testar:auth`).
 */

/** Códigos que significam a mesma coisa em qualquer tela. */
const COMUNS = {
  'auth/invalid-email': 'Email inválido.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos.',
  'auth/network-request-failed': 'Sem conexão com a internet.',
  'auth/popup-blocked':
    'Popup bloqueado pelo navegador. Habilite e tente novamente.',
  'auth/popup-closed-by-user': 'Login cancelado.',
  'auth/account-exists-with-different-credential':
    'Já existe conta com outro método de login pra este email.',
  'auth/user-disabled':
    'Esta conta foi desativada. Entre em contato com o motorista.',
  'auth/weak-password': 'Senha muito curta. Use ao menos 6 caracteres.',
  'auth/email-already-in-use':
    'Este email já tem conta. Use "Já tenho conta".',
};

/**
 * Entrar: credencial errada é UMA mensagem só, de propósito.
 *
 * `user-not-found` e `wrong-password` dizem coisas diferentes ao atacante —
 * a primeira confirma que o e-mail NÃO está cadastrado, a segunda confirma
 * que está. Responder igual às duas é o que impede descobrir quem tem conta
 * no app testando e-mails.
 */
const ENTRAR = {
  'auth/user-not-found': 'Email ou senha incorretos.',
  'auth/wrong-password': 'Email ou senha incorretos.',
  'auth/invalid-credential': 'Email ou senha incorretos.',
};

/** Links de redefinição e verificação, que têm modos de falha próprios. */
const LINK = {
  'auth/expired-action-code':
    'O link expirou. Solicite um novo email de redefinição.',
  'auth/invalid-action-code':
    'Link inválido ou já utilizado. Solicite um novo email.',
  'auth/user-not-found': 'Usuário não encontrado.',
};

const PADRAO = {
  entrar: 'Erro. Tente novamente.',
  criar: 'Erro. Tente novamente.',
  // O fluxo de link não expõe `err.message`: ali a pessoa chegou de um e-mail
  // e não tem o que fazer com o texto do SDK.
  link: 'Não foi possível concluir. Tente novamente.',
};

/**
 * A frase que a tela mostra.
 *
 * @param err       o erro do Firebase Auth
 * @param contexto  'entrar' (padrão) | 'criar' | 'link'
 *
 * Em `entrar` e `criar`, um código desconhecido cai em `err.message` antes do
 * texto genérico — é informação a mais para quem está depurando, e o SDK
 * costuma ser legível. Em `link`, não: ver o comentário em `PADRAO`.
 */
export function mensagemDeAuth(err, contexto = 'entrar') {
  const code = err?.code || '';

  if (contexto === 'link') {
    return LINK[code] || COMUNS[code] || PADRAO.link;
  }

  const especifico = COMUNS[code] || ENTRAR[code];
  if (especifico) return especifico;

  return err?.message || PADRAO[contexto] || PADRAO.entrar;
}
