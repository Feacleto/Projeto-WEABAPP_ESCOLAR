import { CLOUD_FUNCTIONS_ENABLED } from '../config/capabilities';

/**
 * Traduz erro de Cloud Function pra frase que a pessoa entende.
 *
 * POR QUE ISTO EXISTE
 * Quando a função não está publicada — o caso de todo ambiente sem o plano
 * Blaze — o SDK devolve `functions/not-found` ou `functions/internal`, e o
 * texto que chega na tela é "internal" ou "NOT FOUND". Vários lugares faziam
 * `toast.error(err.message)`, então era isso que o motorista lia.
 *
 * Um erro assim não é só feio: ele manda a pessoa pro lugar errado. Quem lê
 * "internal" tenta de novo, troca de rede, reinicia o celular. Nada disso tem
 * a ver com o problema, que é do servidor não existir.
 *
 * O QUE ESTA CAMADA NÃO FAZ
 * Não esconde o erro nem finge sucesso. Ela diz o que aconteceu na linguagem
 * de quem está lendo, e deixa o código original no console pra quem for
 * depurar. Erro que o app entende continua passando com a mensagem do próprio
 * servidor — as functions escrevem mensagens boas de propósito.
 */

/**
 * Códigos que significam "esta função não está no ar".
 *
 * `not-found` é o caso limpo. `internal` entra porque o SDK cai nele quando a
 * chamada nem chega a ser roteada — o que, na prática, é o mesmo sintoma.
 */
const FORA_DO_AR = ['functions/not-found', 'functions/internal'];

const MENSAGENS = {
  'functions/unauthenticated': 'Faça login de novo pra continuar.',
  'functions/permission-denied': 'Sua conta não tem acesso a esta ação.',
  'functions/resource-exhausted':
    'Muitas tentativas em pouco tempo. Espere alguns minutos.',
  'functions/deadline-exceeded':
    'O servidor demorou demais pra responder. Tente de novo.',
  'functions/unavailable':
    'Sem conexão com o servidor. Confira a internet e tente de novo.',
};

/**
 * Devolve a frase pra mostrar na tela.
 *
 * @param {unknown} err        o erro que veio do callable
 * @param {string}  [oQueFazia] o que estava sendo feito, pra frase ficar
 *                              específica: "gerar as cobranças", "girar a
 *                              roleta". Entra na mensagem de fora-do-ar.
 */
export function mensagemDeErro(err, oQueFazia) {
  const code = err?.code || '';

  if (FORA_DO_AR.includes(code)) {
    // Deixa o rastro pra quem for depurar — a tela fica limpa, o console não.
    console.error('Cloud Function indisponível:', code, err);
    const alvo = oQueFazia ? `${oQueFazia} ` : '';
    return (
      `Não deu pra ${alvo}agora: esta parte do sistema ainda não está ` +
      'publicada. Não é problema da sua internet.'
    );
  }

  if (MENSAGENS[code]) return MENSAGENS[code];

  // Erro que a própria function escreveu (HttpsError com mensagem nossa).
  // Essas mensagens são escritas pra serem lidas, então passam direto.
  if (err?.message && !/^internal$|^unknown$/i.test(err.message)) {
    return err.message;
  }

  console.error('Erro não mapeado em callable:', err);
  return 'Algo deu errado. Tente de novo em alguns instantes.';
}

/**
 * RECUSA A CHAMADA ANTES DE FAZÊ-LA, quando o cloud está desligado.
 *
 * O PROBLEMA QUE ISTO FECHA
 * `CLOUD_FUNCTIONS_ENABLED` documentava, com nome e sobrenome, quais recursos
 * dependem do Blaze. Só que sete dos oito lugares que chamam um callable não
 * consultavam a bandeira: o app disparava assim mesmo, o navegador barrava no
 * CORS (a API desativada responde sem `Access-Control-Allow-Origin`), e o que
 * chegava na tela era erro de rede. Foi o que o convite fez.
 *
 * O sintoma engana duas vezes. Pra quem usa, parece internet ruim — e ele
 * troca de rede, reinicia o celular, tenta de novo. Pra quem depura, parece
 * configuração de CORS — e o conserto verdadeiro é ligar o faturamento.
 *
 * E ELE CORROMPE A MENSAGEM CERTA. `lookupInvite` traduz `functions/not-found`
 * para "convite não encontrado ou já usado" — o que é verdade quando o
 * servidor existe. Com a função fora do ar, o MESMO código chega, e o app
 * acusava um convite perfeitamente válido de não existir. O responsável então
 * pede outro link ao motorista, que gera outro, que também não funciona.
 *
 * Por isso o guarda vem ANTES do `try`: depois dele, `not-found` volta a
 * significar uma coisa só.
 *
 * UMA LINHA POR CHAMADA, e de propósito. Um invólucro que engolisse a chamada
 * inteira obrigaria a reescrever o tratamento de erro cuidadoso que cada um
 * desses lugares já tem — e é justamente esse tratamento que faz a diferença
 * entre "convite já usado" e "código digitado errado".
 */
export function exigirCloud(oQueFazia) {
  if (CLOUD_FUNCTIONS_ENABLED) return;
  const alvo = oQueFazia ? `${oQueFazia} ` : '';
  const erro = new Error(
    `Não deu pra ${alvo}agora: esta parte do sistema ainda não está ` +
      'publicada. Não é problema da sua internet.'
  );
  // Marca pra quem quiser distinguir "desligado" de "falhou de verdade".
  erro.code = 'app/cloud-desligado';
  throw erro;
}

/** Este erro é "a função não está publicada"? */
export function estaForaDoAr(err) {
  return FORA_DO_AR.includes(err?.code || '');
}
