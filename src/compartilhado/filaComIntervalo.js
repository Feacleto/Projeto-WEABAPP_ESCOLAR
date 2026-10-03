/**
 * UMA FILA QUE SOLTA UM PEDIDO POR VEZ, COM INTERVALO MÍNIMO ENTRE ELES
 * (03/10/2026) — feita para o Nominatim.
 *
 * A política de uso do Nominatim é de 1 requisição por segundo POR
 * APLICAÇÃO, e o app chamava direto do `fetch`: o cadastro da criança, o
 * "editar onde mora", a escola nova e o primeiro acesso do motorista
 * disparavam sem fila nenhuma — dois toques rápidos em "buscar" eram duas
 * chamadas no mesmo segundo, e quem infringe a política é bloqueado sem aviso
 * (o mapa ficaria sem ponto para todo cadastro ao mesmo tempo).
 *
 *   - INTERVALO: cada pedido sai pelo menos `intervaloMs` depois do anterior.
 *   - MESMA CHAVE EM VOO devolve a MESMA promessa — o toque duplo vira uma
 *     chamada só.
 *   - CACHE PEQUENO das respostas boas: o mesmo endereço consultado de novo
 *     (voltar um passo do cadastro) não sai de casa. Erro NÃO fica no cache —
 *     senão uma queda de rede viraria "endereço não encontrado" para sempre.
 *
 * Sem regra de domínio e sem rede: quem executa é a função que o chamador
 * passa. Relógio e espera são injetáveis, e é assim que `testar:endereco` mede
 * o intervalo sem esperar segundo nenhum.
 */
export function criarFilaComIntervalo({
  intervaloMs = 1000,
  agora = () => Date.now(),
  esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  guardar = 20,
} = {}) {
  let proximaSaida = 0;
  const emVoo = new Map();
  const cache = new Map();

  return function pedir(chave, executar) {
    if (cache.has(chave)) return Promise.resolve(cache.get(chave));
    if (emVoo.has(chave)) return emVoo.get(chave);

    // A vaga é RESERVADA na hora do pedido, não na hora da saída: três
    // pedidos simultâneos saem em 0, 1 s e 2 s, e não os três depois de 1 s.
    const t = agora();
    const saida = Math.max(t, proximaSaida);
    proximaSaida = saida + intervaloMs;

    const promessa = (async () => {
      if (saida > t) await esperar(saida - t);
      const resultado = await executar();
      cache.set(chave, resultado);
      if (cache.size > guardar) cache.delete(cache.keys().next().value);
      return resultado;
    })().finally(() => emVoo.delete(chave));

    emVoo.set(chave, promessa);
    return promessa;
  };
}
