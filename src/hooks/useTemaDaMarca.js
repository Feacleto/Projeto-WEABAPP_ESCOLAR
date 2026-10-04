import { useEffect } from 'react';
import { paletaDaMarca, canais } from '../marca/corDaMarca.js';

/**
 * PINTA O APP COM A COR DO MOTORISTA enquanto o painel está montado
 * (03/10/2026). Troca as variáveis `--tema-*` no `<html>` — as classes do
 * Tailwind (`bg-primary`, `text-primary`…) já leem delas — e as devolve ao
 * verde da casa ao desmontar: sair para o login, para o `/admin` ou para a
 * porta não pode levar a cor de um motorista junto.
 *
 * Cor que não serve (sem cor, hex inválido, ausente) não pinta nada: o app
 * fica no verde do Alô Buzinou. Ver `marca/corDaMarca.js`.
 */
export function useTemaDaMarca(cor) {
  useEffect(() => {
    const paleta = paletaDaMarca(cor);
    if (!paleta || typeof document === 'undefined') return undefined;
    const raiz = document.documentElement;
    const nomes = Object.keys(paleta);
    for (const nome of nomes) raiz.style.setProperty(`--tema-${nome}`, canais(paleta[nome]));
    // `data-marca`: o motorista TEM cor. É o que liga a faixa da marca no
    // cabeçalho do Início e o filete das outras telas (index.css) — sem cor,
    // o cabeçalho continua branco como sempre foi.
    raiz.dataset.marca = '1';
    return () => {
      for (const nome of nomes) raiz.style.removeProperty(`--tema-${nome}`);
      delete raiz.dataset.marca;
    };
  }, [cor]);
}
