/**
 * UMA LEITURA GUARDADA POR UM TEMPO — e a mesma ida ao banco para quem pedir
 * junto.
 *
 * ── POR QUE EXISTE (03/10/2026)
 * O painel do dono lia a lista de motoristas TRÊS vezes na abertura — a visão
 * geral, a carteira e a aba Mês, cada uma com a própria consulta — e as
 * últimas 500 avaliações DUAS. As abas desmontam ao trocar, então cada toque
 * na barra repetia tudo. Com 100 motoristas isso já é dinheiro; com a base que
 * o plano mira, é a tela ficando mais lenta quanto mais o dono trabalha nela.
 *
 * `carregarConsole` já tinha um cache de 60 segundos, mas só dele: as outras
 * duas leituras da mesma lista não o enxergavam. Este arquivo é aquele cache
 * tirado de dentro da função, para as três pedirem ao mesmo lugar.
 *
 * ── GUARDA A PROMESSA, NÃO O RESULTADO
 * Duas abas montando no mesmo instante recebem a MESMA promessa, e o banco é
 * consultado uma vez. Guardar o resultado só funcionaria depois de a primeira
 * leitura terminar — exatamente o momento em que a segunda já saiu.
 *
 * ── A FALHA NÃO FICA GUARDADA
 * Se a leitura falha, o cache se esvazia: a próxima tela tenta de novo em vez
 * de receber o mesmo erro por um minuto sem ter tentado nada.
 *
 * ── `forcar` É PARA QUEM ACABOU DE ESCREVER
 * Ler cache logo depois de suspender um motorista ou conceder um desconto
 * mostraria a tela contradizendo a ação que a pessoa acabou de fazer — e ela
 * repetiria a ação.
 *
 * ── SEM FIREBASE, SEM REACT, E O RELÓGIO ENTRA POR PARÂMETRO
 * Mora em `compartilhado/` porque não sabe nada do domínio: guarda qualquer
 * leitura. O relógio injetável é o que deixa `testar:leituras-do-dono` medir a
 * validade sem esperar um minuto de verdade.
 */

/** A leitura guardada em `guardadaEm` ainda vale em `agora`? */
export function aindaValido(guardadaEm, agora, validadeMs) {
  if (!Number.isFinite(guardadaEm) || !Number.isFinite(agora)) return false;
  if (!(validadeMs > 0)) return false;
  const idade = agora - guardadaEm;
  // Idade negativa é relógio que andou para trás (fuso trocado, ajuste do
  // sistema). Tratar como válido seria guardar para sempre.
  return idade >= 0 && idade < validadeMs;
}

export function criarCacheComValidade({ validadeMs, relogio = () => Date.now() } = {}) {
  let promessa = null;
  let guardadaEm = 0;

  const esquecer = () => {
    promessa = null;
    guardadaEm = 0;
  };

  return {
    /**
     * Devolve a leitura guardada, ou chama `buscar` e guarda a promessa.
     * `buscar` pode lançar ou rejeitar: o erro chega a quem chamou e o cache
     * fica vazio.
     */
    obter(buscar, { forcar = false } = {}) {
      const agora = relogio();
      if (!forcar && promessa && aindaValido(guardadaEm, agora, validadeMs)) {
        return promessa;
      }
      // `Promise.resolve().then` também captura o `throw` síncrono de buscar.
      const atual = Promise.resolve().then(buscar);
      promessa = atual;
      guardadaEm = agora;
      atual.catch(() => {
        // Só esvazia se ninguém já tiver posto uma leitura mais nova no lugar.
        if (promessa === atual) esquecer();
      });
      return atual;
    },
    esquecer,
  };
}
