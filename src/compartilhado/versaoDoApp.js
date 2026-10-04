/**
 * A VERSÃO DO APP — UMA POR PUBLICAÇÃO, AMARRADA AO COMMIT (04/10/2026,
 * decisão do dono).
 *
 * Quem usa vê "Versão 1.12 · 4 de outubro". O número depois do ponto sobe de
 * um em um a cada vez que o app vai para PRODUÇÃO — não a cada commit, que
 * pularia números (1.384 → 1.391) e não diria a ninguém o que chegou no
 * celular. O número da frente (1, 2, 3…) só muda por decisão do dono, num
 * marco do produto.
 *
 * Quem guarda a versão é uma MARCA (tag) do git no commit publicado: `v1.12`.
 * É ela que amarra "o que o motorista tem no celular" a "qual código é esse"
 * — e o suporte lê os dois juntos: "1.12 · commit 391 (abc1234)".
 *
 * Puro de propósito: o vite.config.js, o script de publicar e o app usam as
 * mesmas regras, e `npm run testar:versoes` as mede.
 */

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/** 'v1.12' → { maior: 1, menor: 12 }; o que não for marca de versão → null. */
export function lerMarca(marca) {
  const m = /^v(\d+)\.(\d+)$/.exec(String(marca || '').trim());
  if (!m) return null;
  return { maior: Number(m[1]), menor: Number(m[2]) };
}

/** 'v1.12' → '1.12'. */
export function nomeDaVersao(marca) {
  const v = lerMarca(marca);
  return v ? `${v.maior}.${v.menor}` : null;
}

/** A mais nova primeiro, comparando NÚMERO (v1.10 vem depois de v1.9). */
export function ordenarMarcas(marcas) {
  return (marcas || [])
    .filter((m) => lerMarca(m))
    .sort((a, b) => {
      const x = lerMarca(a);
      const y = lerMarca(b);
      return y.maior - x.maior || y.menor - x.menor;
    });
}

/**
 * A próxima marca depois da última. `maior` é a decisão do dono de virar o
 * número da frente: v1.37 → v2.0.
 *
 * ⚠️ SEM NENHUMA MARCA, A PRIMEIRA É v1.1, NÃO v1.0. O "1.0" é o número fixo
 * que o app mostrou até 04/10/2026 — e o que estava no ar naquele dia não era
 * um commit exato (havia publicação feita com arquivo sem commit). Marcar a
 * 1.0 num commit antigo seria afirmar o que não se sabe.
 */
export const VERSAO_ANTES_DA_NUMERACAO = '1.0';

export function proximaMarca(ultima, { maior = false } = {}) {
  const v = lerMarca(ultima);
  if (!v) return 'v1.1';
  return maior ? `v${v.maior + 1}.0` : `v${v.maior}.${v.menor + 1}`;
}

/** "4 de outubro" — a data como a pessoa fala. Data inválida → null. */
export function dataPorExtenso(valor) {
  const d = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getDate()} de ${MESES[d.getMonth()]}`;
}

/**
 * O texto que vai no chamado de suporte e nos detalhes da tela de erro:
 * "1.12 · commit 391 (abc1234)". As rules limitam `version` a 40 letras, e
 * isto cabe com folga.
 */
export function textoParaSuporte({ versao, commit, hash } = {}) {
  const partes = [versao || 'dev'];
  if (commit) partes.push(`commit ${commit}${hash ? ` (${hash})` : ''}`);
  return partes.join(' · ').slice(0, 40);
}
