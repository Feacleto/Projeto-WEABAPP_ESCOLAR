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

/**
 * PEDIR O LINK DE REDEFINIÇÃO — e por que este contexto precisou existir.
 *
 * As três telas que pedem o link chamavam `mensagemDeAuth(err, 'entrar')`, e
 * `ENTRAR` responde "Email ou senha incorretos." a `user-not-found`. Ou seja:
 * quem pedia o link para um e-mail sem conta lia uma frase sobre SENHA num
 * momento em que não digitou senha nenhuma — e voltava ao formulário para
 * tentar de novo, em laço.
 *
 * ⚠️ A DISCRIÇÃO CONTINUA VALENDO AQUI, e por isso `user-not-found` NÃO diz
 * que a conta não existe. Dizer confirmaria ao atacante quem tem conta no app,
 * que é exatamente o que `ENTRAR` foi desenhado para impedir. A frase é a
 * mesma que a pessoa legítima veria — e é verdadeira nos dois casos, porque
 * ela precisa conferir o endereço de qualquer forma.
 *
 * (Com a proteção contra enumeração LIGADA no console — e ela deve ficar —
 * este código nem chega: o Firebase responde sucesso sem enviar nada. É a
 * mesma decisão, aplicada no servidor.)
 *
 * `unauthorized-continue-uri` e companhia são erro de CONFIGURAÇÃO, não da
 * pessoa. Sem eles na tabela, o texto cru do SDK vazava em inglês num toast
 * vermelho — e o motorista concluía que o app estava quebrado.
 */
const RESET = {
  'auth/user-not-found':
    'Se existir conta com esse email, o link chega em alguns minutos. Confira o endereço e o spam.',
  'auth/missing-email': 'Digite seu email primeiro.',
  'auth/unauthorized-continue-uri':
    'Não foi possível enviar o link deste endereço. Avise a gente — é configuração nossa, não sua.',
  'auth/invalid-continue-uri':
    'Não foi possível enviar o link deste endereço. Avise a gente — é configuração nossa, não sua.',
  'auth/missing-continue-uri':
    'Não foi possível enviar o link deste endereço. Avise a gente — é configuração nossa, não sua.',
};

const PADRAO = {
  entrar: 'Erro. Tente novamente.',
  criar: 'Erro. Tente novamente.',
  // O fluxo de link não expõe `err.message`: ali a pessoa chegou de um e-mail
  // e não tem o que fazer com o texto do SDK.
  link: 'Não foi possível concluir. Tente novamente.',
  // Pedir o link também não expõe: os códigos que sobram aqui são de
  // configuração do projeto, e o texto do SDK sobre eles é em inglês.
  reset: 'Não conseguimos enviar o link agora. Tente de novo em um minuto.',
};

/**
 * A frase que a tela mostra.
 *
 * @param err       o erro do Firebase Auth
 * @param contexto  'entrar' (padrão) | 'criar' | 'link' | 'reset'
 *
 * `link`  = a pessoa CLICOU num link de e-mail e ele falhou.
 * `reset` = a pessoa PEDIU um link e o envio falhou. São momentos diferentes,
 *           com frases diferentes — e nenhum dos dois expõe `err.message`.
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

  if (contexto === 'reset') {
    return RESET[code] || COMUNS[code] || PADRAO.reset;
  }

  const especifico = COMUNS[code] || ENTRAR[code];
  if (especifico) return especifico;

  return err?.message || PADRAO[contexto] || PADRAO.entrar;
}
