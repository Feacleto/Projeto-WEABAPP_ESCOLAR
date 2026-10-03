import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * O TEATRO DA PORTA — a apresentação de ~9s que o celular vê na primeira visita.
 *
 * ── POR QUE ISTO EXISTE
 * Quem chegava pelo link via a marca, a lista, o formulário e os cartões do
 * app TODOS DE UMA VEZ, e os cartões pareciam o app de verdade. A pessoa não
 * sabia se já estava dentro. A apresentação conta a tela em ordem: marca →
 * promessa → benefícios → cartão de entrar → o app (marcado como EXEMPLO) →
 * de volta ao cartão, com o resto escuro e o Google pulsando.
 *
 * ── ⚠️ O TOQUE NÃO INTERROMPE, e foi decisão do dono
 * Durante os passos a tela fica travada (rolagem presa + uma película que
 * engole o toque). O controle volta no último passo, que é justamente o que
 * entrega o botão. Por isso ela roda SÓ NA PRIMEIRA VISITA do aparelho, e
 * nunca para quem chega com contexto (sessão expirada, senha redefinida).
 *
 * ── O ESCURO SEGUE A ROLAGEM DEPOIS DO TEATRO
 * Topo da página: normal. Cartão de entrar no meio da tela: escuro. Rolou pra
 * baixo: normal de novo. Só reage ao CRUZAR a faixa, então tocar no escuro
 * para apagá-lo não é desfeito pelo próximo pixel de rolagem.
 *
 * `prefers-reduced-motion` nunca vê o teatro — vê a tela pronta.
 */

const CHAVE_VISTO = 'alobuzinou:teatro-do-login:v1';

/** O momento (ms) em que cada passo acontece. O índice É o número do passo. */
const TEMPOS = [0, 150, 450, 650, 1050, 1500, 1850, 2200, 2550, 3000, 3800, 4800, 5300, 5900, 6500, 8000, 8700];

export const PASSO = {
  logo: 1,
  site: 2,
  frase1: 3,
  frase2: 4,
  beneficio: 5, // 5, 6, 7, 8 — um por benefício
  cartao: 9,
  pulso: 10,
  tira: 11,
  tiraCartao: 12, // 12, 13, 14 — um por cartão da tira
  volta: 15,
  foco: 16,
};
const FIM = PASSO.foco;

function jaViu() {
  try {
    return localStorage.getItem(CHAVE_VISTO) === '1';
  } catch {
    return true; // sem armazenamento, não arrisca prender a pessoa toda vez
  }
}
function marcarVisto() {
  try {
    localStorage.setItem(CHAVE_VISTO, '1');
  } catch {
    /* sem armazenamento: paciência */
  }
}
const movimentoReduzido = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * @param {object} p
 * @param {boolean} p.ativo       o cartão é o do motorista, no celular
 * @param {boolean} p.apresentar  pode haver teatro (sem contexto de retorno)
 * @param {React.RefObject} p.cartaoRef  o cartão de entrar
 * @param {React.RefObject} p.tiraRef    a tira de exemplo do app
 */
export default function useTeatroDoLogin({ ativo, apresentar, cartaoRef, tiraRef }) {
  // Decidido UMA vez, na montagem: trocar de ideia no meio seria pior.
  const [rodar] = useState(
    () => ativo && apresentar && !movimentoReduzido() && !jaViu()
  );
  const [passo, setPasso] = useState(rodar ? 0 : FIM);
  const [escuro, setEscuro] = useState(false);
  const [pulsando, setPulsando] = useState(false);
  const [cartaoFora, setCartaoFora] = useState(false);
  const noFoco = useRef(false);
  const rodando = passo < FIM;

  const alvoDoFoco = useCallback(() => {
    const el = cartaoRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return Math.max(0, r.top + window.scrollY + r.height / 2 - window.innerHeight / 2);
  }, [cartaoRef]);

  const rolar = (top) =>
    window.scrollTo({ top, behavior: movimentoReduzido() ? 'auto' : 'smooth' });

  // ── Os passos ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!rodar) return;
    marcarVisto(); // na largada: quem sai no meio não fica preso de novo
    const raiz = document.documentElement;
    const antes = raiz.style.overflow;
    raiz.style.overflow = 'hidden';
    // O banner de cookies espera o fim (ver CookieBanner.jsx).
    raiz.dataset.teatro = 'rodando';
    const encerrar = () => {
      raiz.style.overflow = antes;
      if (raiz.dataset.teatro) {
        delete raiz.dataset.teatro;
        window.dispatchEvent(new Event('alobuzinou:teatro-fim'));
      }
    };
    window.scrollTo(0, 0);

    const timers = TEMPOS.map((ms, i) =>
      setTimeout(() => {
        setPasso(i);
        if (i === PASSO.tira && tiraRef.current) {
          const r = tiraRef.current.getBoundingClientRect();
          rolar(r.top + window.scrollY - 80);
        }
        if (i === PASSO.volta) rolar(alvoDoFoco());
        if (i === PASSO.foco) {
          encerrar();
          noFoco.current = true;
          setEscuro(true);
          setPulsando(true);
        }
      }, ms + 120)
    );
    return () => {
      timers.forEach(clearTimeout);
      encerrar();
    };
  }, [rodar, tiraRef, alvoDoFoco]);

  // ── Depois do teatro: o escuro e a barra do rodapé seguem a rolagem ──
  useEffect(() => {
    if (!ativo || rodando) return;
    const aoRolar = () => {
      const el = cartaoRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      // "Fora" é o cartão quase todo acima da tela: o centro dele já passou
      // dos 20% de cima. Esperar ele sair INTEIRO não serve — a página do
      // celular é curta, e a barra nunca apareceria.
      setCartaoFora(r.top + r.height / 2 < window.innerHeight * 0.2);
      const centro = r.top + r.height / 2;
      const foco =
        window.scrollY >= 40 &&
        Math.abs(centro - window.innerHeight / 2) < window.innerHeight * 0.22;
      if (foco !== noFoco.current) setEscuro(foco);
      noFoco.current = foco;
    };
    window.addEventListener('scroll', aoRolar, { passive: true });
    return () => window.removeEventListener('scroll', aoRolar);
  }, [ativo, rodando, cartaoRef]);

  return {
    /** `true` quando o passo já aconteceu — sem teatro, tudo já aconteceu. */
    visto: (p) => passo >= p,
    passo,
    rodando,
    escuro: ativo && escuro,
    apagarEscuro: () => setEscuro(false),
    pulsando: ativo && pulsando,
    pararPulso: () => setPulsando(false),
    cartaoFora: ativo && !rodando && cartaoFora,
  };
}
