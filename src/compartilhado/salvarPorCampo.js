/**
 * O ESTADO DE "SALVAR" DE CADA CAMPO, COM VERSÃO — puro, sem React e sem
 * Firebase (`npm run testar:lista-da-turma`, bloco 12). Quem grava chega
 * injetado: cada `salvar` recebe a função que faz a escrita.
 *
 * Nasceu na Lista da turma (RC2), onde cada campo grava sozinho ao sair dele.
 * O estado morava DENTRO da linha, e se perdia quando a linha fechava ou pulava
 * de lugar (a criança muda de escola e vai para outro grupo); uma resposta
 * atrasada de uma escrita velha acendia "salvo ✓" sobre uma escrita mais nova
 * ainda pendente; e sem sinal o campo ficava "salvando…" para sempre.
 *
 * ── AS FASES DE UMA CHAVE
 *   'salvando'  a escrita saiu;
 *   'esperando' passou `esperaMs` sem resposta — sem sinal, quase sempre (o
 *               Firestore guarda a escrita e só resolve quando o servidor
 *               confirma);
 *   'salvo'     a escrita MAIS NOVA desta chave foi confirmada;
 *   'erro'      a escrita mais nova foi recusada. Guarda a mudança (para o
 *               "Tentar de novo" reenviar a mesma) e o que estava digitado
 *               (para o campo não voltar ao valor antigo).
 *
 * ⚠️ CADA CHAVE CONTA VERSÕES. Só a resposta da versão mais nova muda a fase:
 * a resposta atrasada de uma escrita velha — sucesso ou erro — é ignorada.
 *
 * ⚠️ UM SOM POR RAJADA, NÃO UM POR CAMPO. `aoTerminarRajada` é chamado quando
 * a última escrita pendente termina e pelo menos uma deu certo — quem preenche
 * cinco campos seguidos ouve um "salvo", não cinco.
 */

export const FASE = {
  SALVANDO: 'salvando',
  ESPERANDO: 'esperando',
  SALVO: 'salvo',
  ERRO: 'erro',
};

const PENDENTE = new Set([FASE.SALVANDO, FASE.ESPERANDO]);

export function criarSalvadorPorCampo({
  esperaMs = 6000,
  agendar = (fn, ms) => setTimeout(fn, ms),
  cancelar = (id) => clearTimeout(id),
  aoTerminarRajada = null,
} = {}) {
  const chaves = new Map(); // chave -> { versao, fase, mudanca, executar, digitado, timer }
  const ouvintes = new Set();
  let instantaneo = 0;
  let acertouNaRajada = false;

  const avisar = () => {
    instantaneo += 1;
    ouvintes.forEach((fn) => fn());
  };

  const pendentes = () => [...chaves.values()].filter((e) => PENDENTE.has(e.fase)).length;

  function terminar(chave, versao, ok, err) {
    const e = chaves.get(chave);
    if (!e || e.versao !== versao) return; // resposta de uma escrita velha
    if (e.timer != null) cancelar(e.timer);
    e.timer = null;
    if (ok) {
      e.fase = FASE.SALVO;
      e.digitado = undefined;
      acertouNaRajada = true;
    } else {
      e.fase = FASE.ERRO;
      e.motivo = err?.code || 'erro';
    }
    if (pendentes() === 0) {
      if (acertouNaRajada) aoTerminarRajada?.();
      acertouNaRajada = false;
    }
    avisar();
  }

  /**
   * Grava. `executar` faz a escrita e devolve uma promessa; `mudanca` é o que
   * será reenviado no "Tentar de novo"; `digitado` é o texto do campo.
   * Devolve `true` se ESTA escrita deu certo (mesmo que outra mais nova a
   * tenha superado), `false` se não.
   */
  function salvar(chave, executar, { mudanca = null, digitado } = {}) {
    const anterior = chaves.get(chave);
    if (anterior?.timer != null) cancelar(anterior.timer);
    const versao = (anterior?.versao || 0) + 1;
    const e = { versao, fase: FASE.SALVANDO, mudanca, executar, digitado, timer: null };
    chaves.set(chave, e);
    e.timer = agendar(() => {
      const atual = chaves.get(chave);
      if (atual && atual.versao === versao && atual.fase === FASE.SALVANDO) {
        atual.fase = FASE.ESPERANDO;
        atual.timer = null;
        avisar();
      }
    }, esperaMs);
    avisar();
    let promessa;
    try {
      promessa = Promise.resolve(executar());
    } catch (err) {
      promessa = Promise.reject(err);
    }
    return promessa.then(
      () => {
        terminar(chave, versao, true);
        return true;
      },
      (err) => {
        terminar(chave, versao, false, err);
        return false;
      }
    );
  }

  /** Reenvia a MESMA escrita que falhou (ou que segue esperando sinal). */
  function tentarDeNovo(chave) {
    const e = chaves.get(chave);
    if (!e || !(e.fase === FASE.ERRO || e.fase === FASE.ESPERANDO)) return Promise.resolve(false);
    return salvar(chave, e.executar, { mudanca: e.mudanca, digitado: e.digitado });
  }

  /** `{ fase, mudanca, digitado }` da chave, ou null. */
  function ler(chave) {
    const e = chaves.get(chave);
    return e ? { fase: e.fase, mudanca: e.mudanca, digitado: e.digitado } : null;
  }

  /** As chaves pendentes que começam com `prefixo` (ex.: o id da criança). */
  function pendentesDe(prefixo) {
    return [...chaves.entries()].filter(([k, e]) => k.startsWith(prefixo) && PENDENTE.has(e.fase)).length;
  }

  /** As escritas que passaram do tempo sem resposta (a faixa do topo). */
  function esperandoSinal(prefixo = '') {
    return [...chaves.entries()].filter(([k, e]) => k.startsWith(prefixo) && e.fase === FASE.ESPERANDO).length;
  }

  return {
    salvar,
    tentarDeNovo,
    ler,
    pendentes,
    pendentesDe,
    esperandoSinal,
    assinar(fn) {
      ouvintes.add(fn);
      return () => ouvintes.delete(fn);
    },
    instantaneo: () => instantaneo,
  };
}
