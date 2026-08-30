import { horariosCombinados, horaCurta } from '../services/horariosService.js';

/**
 * A DECISÃO DE QUANDO AVISAR — separada da tarja que a desenha.
 *
 * Mora em `utils` e não junto do componente por dois motivos. O eslint do
 * projeto recusa arquivo de componente que exporta função solta (quebra o
 * fast refresh), e — o que importa mais — isto é lógica de relógio: ela se lê
 * melhor sem JSX em volta, e é testável sem montar tela nenhuma.
 *
 * O porquê de cada caso está no cabeçalho de `TarjaDeAviso.jsx`.
 *
 * A extensão `.js` no import é deliberada: este arquivo roda no NODE, pelo
 * `scripts/testar-aviso.mjs`, e o resolvedor de ESM do Node não completa
 * extensão como o Vite completa. É o mesmo motivo pelo qual
 * `horariosService` não importa nada — testável fora do bundle.
 */

/** Minutos entre `HH:MM` e agora. Negativo = ainda não chegou a hora. */
function minutosDesde(hhmm, agora) {
  if (!hhmm) return null;
  const [h, m] = String(hhmm).split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const alvo = new Date(agora);
  alvo.setHours(h, m, 0, 0);
  return Math.round((agora - alvo) / 60000);
}

/**
 * Qual aviso mostrar, ou `null`.
 *
 * Exportado separado da tela porque é a parte que decide, e decisão sobre
 * relógio merece ser lida sem JSX em volta.
 */
export function avisoDoMomento({ child, status, presence, ride, absence, agora }) {
  if (!child || absence) return null;

  const { pega, entrega, presumido } = horariosCombinados(child);
  // Sem horário definido não há o que comparar — e horário presumido é chute
  // do app, que esta tela nunca usa pra nada.
  if (presumido) return null;

  // ── 2. O PIOR CASO: a criança consta dentro da perua e o tempo passou.
  //
  // Vem primeiro porque é o mais grave, e porque os dois gatilhos podem
  // valer ao mesmo tempo — duas tarjas empilhadas viram ruído.
  if (status === 'onboard') {
    const atraso = minutosDesde(entrega, agora);
    if (atraso != null && atraso > 20) {
      return {
        nivel: 'grave',
        titulo: ride?.marcos
          ? 'O app não recebe atualização há um tempo'
          : 'Passou da hora de chegar em casa',
        corpo:
          'Isso não quer dizer que algo aconteceu — o motorista pode só não ' +
          'ter marcado a entrega. Se quiser, ligue pra ele.',
      };
    }
  }

  // ── 1. A rota não foi iniciada, e já passou da hora de pegar.
  if (presence?.kind === 'no-route') {
    const atraso = minutosDesde(pega, agora);
    if (atraso != null && atraso > 10) {
      return {
        nivel: 'atencao',
        titulo: `A rota não foi iniciada, e já passou das ${horaCurta(pega)}`,
        corpo:
          'Pode ser só o app dele fechado — muitas vezes a perua está na rua ' +
          'e o rastreamento não. Se ela não chegar, fale com o motorista.',
      };
    }
  }

  return null;
}

