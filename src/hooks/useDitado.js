import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A ESCUTA DO MICROFONE DOS CAMPOS (04/10/2026).
 *
 * Usa o reconhecimento de voz do NAVEGADOR (Web Speech API). O áudio vai ao
 * serviço do fabricante do aparelho — Google no Android, Apple no iPhone — e
 * isso está declarado na Política (seção 2b). O app não grava o áudio.
 *
 * ⚠️ SEM SUPORTE, `suportado` É FALSE E O BOTÃO NÃO EXISTE. No iPhone com o
 * app instalado na tela de início o reconhecimento às vezes falta; aí o
 * microfone some em vez de virar um botão que falha (mesma regra do
 * CampoDeValor). O microfone do teclado continua lá.
 *
 * Um ditado por vez: começar outro encerra o anterior, e sair da tela no
 * meio da escuta não deixa o microfone aberto.
 */

function Reconhecimento() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function useDitado() {
  const [ouvindo, setOuvindo] = useState(false);
  const [naoEntendi, setNaoEntendi] = useState(false);
  const atual = useRef(null);
  const suportado = !!Reconhecimento();

  useEffect(() => () => atual.current?.abort?.(), []);

  const parar = useCallback(() => {
    atual.current?.stop?.();
  }, []);

  /** Começa a ouvir; `onTexto(textoBruto)` recebe o que foi entendido. */
  const comecar = useCallback((onTexto) => {
    const R = Reconhecimento();
    if (!R) return;
    atual.current?.abort?.();
    setNaoEntendi(false);
    const r = new R();
    r.lang = 'pt-BR';
    r.interimResults = false;
    r.maxAlternatives = 1;
    let entendeu = false;
    r.onresult = (ev) => {
      const texto = Array.from(ev.results || [])
        .map((res) => res[0]?.transcript || '')
        .join(' ')
        .trim();
      if (texto) {
        entendeu = true;
        onTexto(texto);
      }
    };
    r.onerror = () => setNaoEntendi(true);
    r.onend = () => {
      setOuvindo(false);
      if (!entendeu) setNaoEntendi(true);
    };
    atual.current = r;
    try {
      r.start();
      setOuvindo(true);
    } catch {
      setOuvindo(false);
    }
  }, []);

  return { suportado, ouvindo, naoEntendi, comecar, parar };
}
