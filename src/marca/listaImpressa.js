/**
 * OS TEXTOS DA LISTA IMPRESSA (RC2, 14/11/2026) — a régua está em
 * `dominio/rota/listaImpressa.js`, a tela em `pages/tio/TioListaImpressa.jsx`.
 * Puro, sem React (`npm run testar:lista-impressa`).
 *
 * ── A REGRA, IGUAL À DE `valorDoConvite.js`
 * Toda afirmação carrega `sustenta` (a funcionalidade que a faz verdade HOJE).
 * A única afirmação desta tela é a de que telefone e saúde não vão para o
 * papel — e ela só é verdade enquanto `CAMPOS_DA_LINHA` for fechada e o teste
 * a provar com dado de verdade. Sem número solto além da contagem e da data.
 */
import { nomeDoMes } from './contratosQueVencem.js';

export const TITULO_DA_TELA = 'Imprimir a lista';
export const ROTULO_DA_FOLHA = 'Lista da turma';
export const BOTAO_IMPRIMIR = 'Imprimir ou salvar em PDF';
export const SEM_CRIANCAS = 'Cadastre as crianças para imprimir a lista.';
export const NOME_PADRAO = 'Minha turma';

/** O que a folha deixa de fora — a única afirmação da tela. */
export const AVISO_DO_PAPEL = {
  texto: 'Não vão para o papel: telefone, WhatsApp e saúde.',
  sustenta: 'lista-so-com-quatro-campos',
};

/** 'novembro de 2026' — o mês da folha, para ele saber qual é a versão que tem na mão. */
export function mesDaFolha(data = new Date()) {
  const aaaamm = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
  return `${nomeDoMes(aaaamm)} de ${data.getFullYear()}`;
}

const criancas = (n) => (n === 1 ? '1 criança' : `${n} crianças`);

/** A linha embaixo do nome da turma: o mês e quantas crianças. */
export function subtituloDaFolha(total, data = new Date()) {
  return `${mesDaFolha(data)} · ${criancas(total)}`;
}

/** O título de cada escola na folha. */
export function tituloDoGrupo(escola, n) {
  return `${escola} · ${criancas(n)}`;
}

/** As afirmações com a origem, para o teste varrer. */
export function todasAsAfirmacoes() {
  return [
    { id: 'aviso', ...AVISO_DO_PAPEL },
    { id: 'botao', texto: BOTAO_IMPRIMIR, sustenta: 'window-print' },
    { id: 'titulo', texto: TITULO_DA_TELA, sustenta: 'window-print' },
    { id: 'rotulo', texto: ROTULO_DA_FOLHA, sustenta: 'window-print' },
    { id: 'semCriancas', texto: SEM_CRIANCAS, sustenta: 'window-print' },
    { id: 'subtitulo', texto: subtituloDaFolha(14, new Date(2026, 10, 14)), sustenta: 'window-print' },
    { id: 'subtituloUma', texto: subtituloDaFolha(1, new Date(2026, 10, 14)), sustenta: 'window-print' },
    { id: 'grupo', texto: tituloDoGrupo('Escola Alvorada', 5), sustenta: 'window-print' },
  ];
}
