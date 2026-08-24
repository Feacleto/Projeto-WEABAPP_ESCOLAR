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

/** Este erro é "a função não está publicada"? */
export function estaForaDoAr(err) {
  return FORA_DO_AR.includes(err?.code || '');
}
