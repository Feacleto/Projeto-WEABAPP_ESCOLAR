/**
 * O TRANSPORTE ATÉ O GATEWAY — só chamada HTTP, nenhuma decisão.
 *
 * O que cobrar, de quem e quando está em `cobrancaDaTaxa.js`, que é puro e
 * testado. Aqui só existe o caminho da chamada: montar a URL, pôr a chave no
 * cabeçalho, traduzir o erro. A separação é a mesma de `asaasWebhook.js` e
 * `eventoDeCobranca.js`, e pelo mesmo motivo: o pedaço que decide dinheiro
 * precisa rodar sem rede.
 *
 * ── A CHAVE NUNCA APARECE, NEM NO ERRO
 * A chave da API vale mais que qualquer senha do projeto: quem a tem cobra em
 * nome da plataforma. Ela vive em `functions:secrets`, entra por parâmetro e
 * nunca é concatenada em mensagem, log ou retorno. Os erros abaixo carregam o
 * status HTTP e a descrição do gateway — jamais o cabeçalho que foi enviado.
 *
 * ── ELA TAMBÉM NÃO PODE SACAR
 * No painel do Asaas a chave é gerada SEM permissão de transferência. Isso não
 * se garante em código, e é justamente por isso que está escrito aqui: se um
 * dia esta função vazar em log, o estrago é cobrança indevida — que se estorna
 * — e não dinheiro saindo da conta, que não volta.
 *
 * ── O AMBIENTE VEM DE FORA E O PADRÃO É O SANDBOX
 * Chave de sandbox só funciona no host de sandbox, e vice-versa: errar o par
 * devolve 401, que é falha barulhenta e portanto segura. Ainda assim o padrão
 * é o sandbox, porque a falha na outra direção — apontar para produção sem
 * querer — cobra gente de verdade.
 */

const SANDBOX = 'https://api-sandbox.asaas.com/v3';
const PRODUCAO = 'https://api.asaas.com/v3';

/** Quinze segundos: passou disso, a chamada não vai voltar boa. */
const ESPERA_MAXIMA = 15000;

function urlDoAmbiente(ambiente) {
  return String(ambiente || '').trim().toLowerCase() === 'producao' ? PRODUCAO : SANDBOX;
}

/**
 * Erro de gateway com o bastante para depurar e nada além.
 *
 * `descricao` é a frase que o Asaas devolve ("CPF/CNPJ inválido", "cliente não
 * encontrado") — é ela que vira mensagem de tela. `status` separa o que
 * adianta repetir (5xx, rede) do que não adianta (4xx).
 */
class ErroDoGateway extends Error {
  constructor(status, descricao, codigo = null) {
    super(descricao || `Gateway respondeu ${status}`);
    this.name = 'ErroDoGateway';
    this.status = status;
    this.descricao = descricao || null;
    this.codigo = codigo;
  }
}

/**
 * Uma chamada. Devolve o corpo já em objeto.
 *
 * O Asaas responde erro como `{ errors: [{ code, description }] }`, e é a
 * PRIMEIRA descrição que interessa — as seguintes costumam ser detalhe do
 * mesmo problema.
 */
async function chamar({ ambiente, apiKey }, metodo, caminho, corpo = null) {
  if (!apiKey) throw new ErroDoGateway(0, 'Chave da API não configurada.');

  let resposta;
  try {
    resposta = await fetch(`${urlDoAmbiente(ambiente)}${caminho}`, {
      method: metodo,
      headers: {
        access_token: apiKey,
        'Content-Type': 'application/json',
        // O Asaas usa este cabeçalho para identificar a integração no
        // suporte. Sem ele, um chamado sobre cobrança some no meio das outras.
        'User-Agent': 'alobuzinou',
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: AbortSignal.timeout(ESPERA_MAXIMA),
    });
  } catch (err) {
    // Rede, DNS, estouro de tempo. Status 0 = nem chegou lá; repetir pode
    // resolver, e quem chama precisa distinguir isso de uma recusa.
    throw new ErroDoGateway(0, err?.name === 'TimeoutError' ? 'O gateway não respondeu a tempo.' : 'Falha de rede ao falar com o gateway.');
  }

  const texto = await resposta.text();
  let dados;
  try {
    dados = texto ? JSON.parse(texto) : null;
  } catch {
    dados = null;
  }

  if (!resposta.ok) {
    const primeiro = Array.isArray(dados?.errors) ? dados.errors[0] : null;
    throw new ErroDoGateway(
      resposta.status,
      primeiro?.description || `Gateway respondeu ${resposta.status}.`,
      primeiro?.code || null
    );
  }

  return dados;
}

/**
 * O cliente deste motorista no gateway, se já existir.
 *
 * A busca é pelo DOCUMENTO, não pelo nome: nome repete, e um cliente duplicado
 * fatia o histórico de cobrança do mesmo motorista em dois cadastros.
 */
async function acharClientePorDocumento(cfg, cpfCnpj) {
  const dados = await chamar(cfg, 'GET', `/customers?cpfCnpj=${encodeURIComponent(cpfCnpj)}&limit=1`);
  return dados?.data?.[0] || null;
}

/** Cria o cliente. `dados` sai de `dadosDoCliente()`. */
async function criarCliente(cfg, dados) {
  return await chamar(cfg, 'POST', '/customers', dados);
}

/**
 * A cobrança desta fatura, se ela já existir lá.
 *
 * É A GUARDA CONTRA COBRAR DUAS VEZES, e ela precisa perguntar ao gateway em
 * vez de olhar o nosso banco — ver o cabeçalho de `cobrancaDaTaxa.js`. O
 * `externalReference` é o id da fatura, um por motorista por mês.
 *
 * Cobrança REMOVIDA no painel continua aparecendo na busca com
 * `deleted: true`, e ela não vale como "já cobrado": o dono apagou justamente
 * para refazer. Por isso o filtro.
 */
async function acharCobrancaPorReferencia(cfg, referencia) {
  const dados = await chamar(
    cfg,
    'GET',
    `/payments?externalReference=${encodeURIComponent(referencia)}&limit=10`
  );
  const lista = Array.isArray(dados?.data) ? dados.data : [];
  return lista.find((c) => c?.deleted !== true) || null;
}

/** Cria a cobrança. `dados` sai de `dadosDaCobranca()`. */
async function criarCobranca(cfg, dados) {
  return await chamar(cfg, 'POST', '/payments', dados);
}

module.exports = {
  SANDBOX,
  PRODUCAO,
  ErroDoGateway,
  urlDoAmbiente,
  acharClientePorDocumento,
  criarCliente,
  acharCobrancaPorReferencia,
  criarCobranca,
};
