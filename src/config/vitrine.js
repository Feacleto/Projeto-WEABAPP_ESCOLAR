/**
 * O PISO DOS CONTADORES DE VITRINE — o número que as duas portas nunca furam.
 *
 * A home do motorista mostra "N famílias atendidas"; a porta da família mostra
 * "N responsáveis usam". Os dois passam por aqui, e nenhum dos dois exibe
 * menos que `PISO_DA_VITRINE`.
 *
 * ISTO NÃO É O NÚMERO REAL, E QUEM MEXER AQUI PRECISA SABER DISSO
 * Enquanto a base for menor que o piso, a tela mostra o piso. Foi decisão de
 * produto, pedida explicitamente, e está escrita aqui por um motivo prático:
 * `src/config/rodada.js` documenta a regra OPOSTA — lá o contador de vagas é
 * real por exigência do CDC art. 37, e diz em letras que contador que não
 * corresponde ao real é propaganda enganosa. Sem este registro, quem ler
 * aquele arquivo depois vai tratar este piso como bug e "consertar". Não é
 * bug; é escolha, e ela é diferente da de lá.
 *
 * A diferença entre os dois casos, pra quem precisar decidir de novo: vaga é
 * PROMESSA (quem chega depois não entra), e promessa falsa é o que o CDC
 * alcança. Contador de uso é REPUTAÇÃO. Continua sendo afirmação sobre a
 * realidade, e o risco não é zero — mas ninguém toma decisão de compra
 * baseada em ser o 24º ou o 27º.
 *
 * COMO SAIR DO PISO
 * Baixar para 0 desliga: `comPiso` vira identidade e as duas telas passam a
 * mostrar só o real. É um número, num arquivo — igual ao de `rodada.js`, e
 * pelo mesmo motivo: constante que mora sozinha continua recebendo merge pra
 * sempre, lógica espalhada em duas páginas diverge na primeira mudança.
 */
export const PISO_DA_VITRINE = 27;

/**
 * O número que vai pra tela.
 *
 * `null` entra e `null` sai — e essa é a parte que não pode se perder numa
 * refatoração. Sem resposta da vitrine (callable falhou, ou ainda está
 * carregando) NÃO existe contador: o piso vale sobre um número que chegou,
 * nunca sobre a ausência dele. Mostrar 27 com o backend fora do ar seria
 * exibir um número sem nenhum dado atrás — e aí não sobra nem a escolha de
 * produto, só o palpite.
 */
export function comPiso(valor) {
  if (valor === null || valor === undefined) return null;
  return Math.max(Number(valor) || 0, PISO_DA_VITRINE);
}
