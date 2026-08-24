import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Narração de texto — a IA lendo a tela pra quem não quer ler.
 *
 * POR QUE speechSynthesis, E NÃO UMA API DE VOZ NA NUVEM
 * O pitch da associação existe justamente pra explicar que infraestrutura
 * custa dinheiro. Gastar por play numa API de voz pra contar isso seria
 * piada de mau gosto — e chave de API em cliente público é chave vazada.
 * O `speechSynthesis` é nativo do navegador: custo zero, nada pra servir e
 * nenhuma dependência a mais no bundle.
 *
 * QUEM ESCOLHE A VOZ É QUEM OUVE
 * As vozes disponíveis são as do APARELHO — variam por sistema e por
 * aparelho, e não há como embarcar uma. O que dá pra fazer (e está feito):
 * listar só as de português do Brasil, ordenar colocando as FEMININAS e as
 * neurais na frente (são as menos robotizadas), escolher a melhor
 * automaticamente e deixar a pessoa trocar e testar. A escolha fica
 * guardada.
 *
 * O CAMINHO PRA UMA VOZ DE MARCA
 * Se um dia a voz precisar ser sempre a mesma em todo aparelho, o jeito
 * certo não é TTS ao vivo: é gravar a locução UMA vez e servir MP3 estático.
 * Por isso `speak()` aceita `src`: com áudio gravado ele toca o arquivo, sem
 * arquivo a voz do aparelho lê. Trocar um pelo outro é colocar arquivos numa
 * pasta, sem mexer em componente.
 *
 * LIMITE HONESTO: no iOS a fala precisa vir logo depois de um toque. Como
 * cada tela do pitch avança com um toque, funciona — mas se o navegador
 * recusar, o texto continua na tela e nada quebra.
 */

const MUTE_KEY = 'ab_voice_muted_v1';
const VOICE_KEY = 'ab_voice_name_v1';

/** Frase de teste do seletor de voz. */
export const AMOSTRA_DE_VOZ =
  'Oi! Sou a voz do Alô Buzinou. Vou te explicar a associação em quatro telas.';

// Nomes femininos que aparecem nas vozes pt-BR dos sistemas (iOS, Android,
// Windows e Chrome). Não é elegante, mas a Web Speech API não expõe gênero —
// e uma voz masculina de sintetizador antigo é justo a que soa mais robô.
const FEMININAS =
  /(luciana|francisca|maria|fernanda|camila|vit[oó]ria|helena|joana|catarina|in[eê]s|raquel|let[ií]cia|isabela|thalita|yara|female|mulher)/i;

function ler(chave, padrao = null) {
  try {
    return localStorage.getItem(chave) ?? padrao;
  } catch {
    return padrao;
  }
}

function grava(chave, valor) {
  try {
    localStorage.setItem(chave, valor);
  } catch {
    // Navegador sem storage: a escolha vale só pra esta sessão.
  }
}

/**
 * Rótulo curto da voz, pro botão caber na tela.
 *
 * "Google português do Brasil" vira "Google"; "Microsoft Daniel - Portuguese
 * (Brazil)" vira "Daniel". O nome técnico completo não diz nada pra quem vai
 * escolher — e não cabe.
 */
export function rotuloDaVoz(nome = '') {
  if (/google/i.test(nome)) return 'Google';
  const proprio = nome
    .replace(/microsoft/i, '')
    .match(/[A-ZÀ-Ú][a-zà-ú]{2,}/);
  return proprio ? proprio[0] : nome.split(' ')[0] || 'voz';
}

/**
 * Duas vozes, no máximo — e propositalmente DIFERENTES entre si.
 *
 * A lista do aparelho pode ter meia dúzia de variações da mesma voz, e um
 * seletor com seis nomes técnicos parecidos não é escolha, é confusão. Então:
 * a melhor da fila (a menos robotizada) e a melhor de rótulo DIFERENTE. No
 * Windows isso dá "Google" e "Daniel"; no Android, duas do Google TTS; no
 * iPhone, Luciana e outra. Sempre duas, sempre distinguíveis pelo ouvido.
 */
function vozesPtBr() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  const todas = window.speechSynthesis.getVoices() || [];
  const br = todas.filter((v) => /pt[-_]BR/i.test(v.lang));
  const pt = todas.filter((v) => /^pt/i.test(v.lang) && !br.includes(v));
  const fila = [...ordenar(br), ...ordenar(pt)];
  if (fila.length <= 1) return fila;

  const primeira = fila[0];
  const segunda =
    fila.find((v) => rotuloDaVoz(v.name) !== rotuloDaVoz(primeira.name)) ||
    fila[1];
  return [primeira, segunda];
}

/** Menos robotizada primeiro: feminina > neural/Google > remota > resto. */
function ordenar(lista) {
  const pontos = (v) => {
    const n = (v.name || '').toLowerCase();
    let p = 0;
    if (FEMININAS.test(n)) p += 8;
    if (n.includes('google')) p += 4;
    if (n.includes('neural') || n.includes('natural')) p += 3;
    if (v.localService === false) p += 2;
    return p;
  };
  return [...lista].sort((a, b) => pontos(b) - pontos(a));
}

export default function useSpeech() {
  const suportado = typeof window !== 'undefined' && !!window.speechSynthesis;

  const [mudo, setMudo] = useState(() => ler(MUTE_KEY) === '1');
  const [vozes, setVozes] = useState([]);
  const [vozNome, setVozNome] = useState(() => ler(VOICE_KEY));
  const [falando, setFalando] = useState(false);

  const audioRef = useRef(null);
  // A fala precisa ler a seleção mais recente mesmo quando o clique e o
  // speak acontecem no mesmo tick (é o caso do botão "testar").
  const vozesRef = useRef([]);
  const vozNomeRef = useRef(vozNome);
  // E precisa ler o MUDO do ref, não do closure: com o valor capturado, uma
  // função `speak` criada antes do clique continuava achando que o som
  // estava ligado — era esse o bug de "não consigo deixar mudo".
  const mudoRef = useRef(mudo);
  // Geração do pedido de fala: invalida cancelamentos atrasados que já não
  // valem mais (ver `silenciar`).
  const geracao = useRef(0);
  // Fala pedida ANTES de o navegador entregar a lista de vozes. Guardada pra
  // sair assim que as vozes chegarem — é o que faz a primeira tela falar.
  const pendente = useRef(null);
  // `speak` num ref: o carregador de vozes precisa chamá-lo, e ele é
  // declarado depois. Ref evita dependência circular no useCallback.
  const falarRef = useRef(null);

  // As vozes chegam de forma assíncrona no Chrome: sem esperar o evento, a
  // primeira fala sai com a voz padrão do sistema (às vezes em inglês).
  useEffect(() => {
    if (!suportado) return;
    const carregar = () => {
      const lista = vozesPtBr();
      if (!lista.length) return;
      vozesRef.current = lista;
      setVozes(lista);

      // Tinha alguém esperando pra falar? Agora dá.
      const espera = pendente.current;
      if (espera && !mudoRef.current) {
        pendente.current = null;
        falarRef.current?.(espera.texto, {
          voiceName: espera.voiceName,
          rate: espera.rate,
          pitch: espera.pitch,
        });
      }
    };
    const raf = requestAnimationFrame(carregar);
    window.speechSynthesis.addEventListener?.('voiceschanged', carregar);
    return () => {
      cancelAnimationFrame(raf);
      window.speechSynthesis.removeEventListener?.('voiceschanged', carregar);
    };
  }, [suportado]);

  /**
   * Cancela agora, sem reagendar nada.
   *
   * BUG QUE ISSO CONSERTA: a versão anterior do `stop()` pedia um segundo
   * cancelamento num setTimeout(0) pra contornar um bug do Chrome (cancel
   * ignorado no instante em que a fala começa). Só que `speak()` chama
   * `stop()` antes de enfileirar a frase nova — então aquele cancelamento
   * atrasado chegava DEPOIS da nova fala entrar na fila e matava justamente
   * ela. Era por isso que a primeira tela do pitch ficava muda: ela era
   * cancelada pelo próprio "limpar antes de falar".
   *
   * A solução do bug do Chrome continua existindo, mas mora em `silenciar()`
   * — que é usado quando a intenção é calar de vez, não quando é trocar de
   * frase. E cada tentativa carrega uma GERAÇÃO: se alguém pediu pra falar
   * no meio do caminho, o cancelamento atrasado se aposenta sozinho.
   */
  const cancelarAgora = () => {
    try {
      window.speechSynthesis?.cancel();
    } catch {
      // sem suporte: nada a cancelar
    }
  };

  const stop = useCallback(() => {
    geracao.current += 1;
    cancelarAgora();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setFalando(false);
  }, []);

  /**
   * Cala de vez — pra sair da tela, fechar a folha ou trocar de aba.
   *
   * Insiste algumas vezes em janelas curtas porque o Chrome ignora o
   * `cancel()` que chega junto com o `onstart` da fala. Sem essa insistência,
   * fechar a folha no meio de uma frase deixava a voz falando sozinha com a
   * tela já fora do ar — que é o pior comportamento possível deste recurso.
   */
  const silenciar = useCallback(() => {
    const g = ++geracao.current;
    cancelarAgora();
    [60, 180, 400].forEach((ms) =>
      setTimeout(() => {
        // Se alguém pediu pra falar nesse meio-tempo, esta tentativa morre.
        if (g !== geracao.current) return;
        const sintese =
          typeof window !== 'undefined' ? window.speechSynthesis : null;
        if (sintese && (sintese.speaking || sintese.pending)) cancelarAgora();
      }, ms)
    );
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setFalando(false);
  }, []);

  /**
   * Fala um texto (ou toca um áudio gravado, se `src` vier).
   *
   * `rate` levemente acima de 1 deixa a leitura solta em vez de arrastada —
   * é o que separa "alguém explicando" de "aviso de aeroporto".
   */
  const speak = useCallback(
    (texto, { src = null, voiceName = null, rate = 1.05, pitch = 1.05 } = {}) => {
      if (mudoRef.current || !texto) return;
      stop();

      if (src) {
        const a = new Audio(src);
        audioRef.current = a;
        a.onended = () => setFalando(false);
        a.onerror = () => setFalando(false);
        a.play()
          .then(() => setFalando(true))
          .catch(() => setFalando(false));
        return;
      }

      if (!suportado) return;
      const lista = vozesRef.current;

      // As vozes chegam de forma assíncrona: no primeiro render a lista está
      // vazia, e falar aqui sai mudo (ou na voz errada, em inglês). Então a
      // frase fica guardada e sai sozinha quando a lista chegar.
      if (!lista.length) {
        pendente.current = { texto, voiceName, rate, pitch };
        return;
      }

      const alvo = voiceName || vozNomeRef.current;
      const voz =
        (alvo && lista.find((v) => v.name === alvo)) || lista[0] || null;

      geracao.current += 1;
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = voz?.lang || 'pt-BR';
      u.rate = rate;
      u.pitch = pitch;
      if (voz) u.voice = voz;
      u.onstart = () => setFalando(true);
      u.onend = () => setFalando(false);
      u.onerror = () => setFalando(false);
      try {
        window.speechSynthesis.speak(u);
      } catch {
        setFalando(false);
      }
    },
    // Sem `mudo` nas dependências de propósito: a decisão de calar é lida do
    // ref na hora da chamada, então esta função pode ter identidade estável.
    [stop, suportado]
  );

  // `speak` num efeito, não no corpo do render: render pode ser descartado
  // pelo React (modo concorrente), e ref escrito ali fica com valor de um
  // render que nunca existiu.
  useEffect(() => {
    falarRef.current = speak;
  }, [speak]);

  /** Troca a voz e guarda a escolha. Devolve o nome pra quem quiser testar. */
  const escolherVoz = useCallback((nome) => {
    vozNomeRef.current = nome;
    setVozNome(nome);
    grava(VOICE_KEY, nome);
    return nome;
  }, []);

  /**
   * Passa pra próxima voz da lista (que tem no máximo duas) e devolve o nome
   * escolhido, pra quem chamou poder falar na hora com a voz nova — é o que
   * transforma o botão em "clicou, ouviu a diferença".
   */
  const alternarVoz = useCallback(() => {
    const lista = vozesRef.current;
    if (lista.length < 2) return vozNomeRef.current;
    const i = lista.findIndex((v) => v.name === vozNomeRef.current);
    const proxima = lista[(i + 1) % lista.length];
    return escolherVoz(proxima.name);
  }, [escolherVoz]);

  /**
   * Liga/desliga a narração.
   *
   * O efeito colateral (parar a fala) acontece FORA do updater do setState:
   * updater roda na fase de render e pode ser chamado duas vezes em modo
   * estrito — cancelar áudio ali é pedir comportamento imprevisível.
   */
  const toggleMudo = useCallback(() => {
    const novo = !mudoRef.current;
    mudoRef.current = novo;
    setMudo(novo);
    grava(MUTE_KEY, novo ? '1' : '0');
    if (novo) silenciar();
  }, [silenciar]);

  // Sair da tela — ou trocar de aba, ou minimizar o navegador — com a voz
  // falando é o pior comportamento possível deste recurso.
  useEffect(() => {
    const aoEsconder = () => {
      if (document.visibilityState === 'hidden') silenciar();
    };
    document.addEventListener('visibilitychange', aoEsconder);
    window.addEventListener('pagehide', silenciar);
    return () => {
      document.removeEventListener('visibilitychange', aoEsconder);
      window.removeEventListener('pagehide', silenciar);
      silenciar();
    };
  }, [silenciar]);

  return {
    speak,
    stop,
    silenciar,
    falando,
    mudo,
    toggleMudo,
    suportado,
    vozes,
    vozNome: vozNome || vozes[0]?.name || null,
    escolherVoz,
    alternarVoz,
  };
}
