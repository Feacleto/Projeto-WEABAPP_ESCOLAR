import { useEffect, useRef, useState } from 'react';

/**
 * Os três passos de "como começa", acendendo um por vez.
 *
 * O QUE ELE FAZ
 * Quando o bloco entra na tela, o passo 1 pulsa com a frase dele, depois o 2,
 * depois o 3 — e para. Quem rola pra longe e volta vê a sequência de novo.
 *
 * POR QUE ISSO E NÃO UMA LISTA PARADA
 * Uma lista de três itens é lida como três coisas SOLTAS; acesa em sequência,
 * ela é lida como um CAMINHO — que é exatamente o argumento ("começar é
 * simples, são três passos e nesta ordem"). O movimento aqui não é enfeite,
 * é a gramática da informação.
 *
 * E POR QUE ELE PARA
 * Animação em loop numa lista de texto é o inimigo da leitura: o olho volta
 * pro que se move em vez de acompanhar a frase. Então a sequência roda uma
 * vez, apaga o realce e devolve os três passos com o mesmo peso, pra quem
 * quiser reler no próprio ritmo.
 *
 * `once: false` no observer de propósito — o replay ao voltar é o pedido, e
 * também é o que salva quem passou rápido na primeira vez.
 *
 * Em prefers-reduced-motion nada acende e nada apaga: os três passos já
 * nascem legíveis, com o mesmo contraste do fim da sequência.
 */

const PASSOS = [
  {
    n: '1',
    titulo: 'Você entra na lista',
    texto: 'A gente chama, conversa e configura junto com você.',
  },
  {
    n: '2',
    titulo: 'Suas crianças no app',
    texto:
      'Cadastro assistido: Endereço, escola e valor. Uma vez só, com ajuda.',
  },
  {
    n: '3',
    titulo: 'Você envia o link no WhatsApp',
    texto:
      'Cada família passa a acompanhar a rota pelo próprio celular, sem precisar te ligar.',
  },
];

// 1,2s por passo: tempo de ler a frase curta sem o próximo atropelar.
const PASSO_MS = 1200;

export default function StepsSequence() {
  const ref = useRef(null);
  // -1 = parado (todos com o mesmo peso). 0..2 = passo aceso.
  const [aceso, setAceso] = useState(-1);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduzido =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduzido) return;

    let timers = [];
    const limpar = () => {
      timers.forEach(clearTimeout);
      timers = [];
    };

    const io = new IntersectionObserver(
      ([entrada]) => {
        limpar();
        if (!entrada.isIntersecting) {
          setAceso(-1);
          return;
        }
        setAceso(0);
        timers = [
          setTimeout(() => setAceso(1), PASSO_MS),
          setTimeout(() => setAceso(2), PASSO_MS * 2),
          setTimeout(() => setAceso(-1), PASSO_MS * 3),
        ];
      },
      { threshold: 0.4 }
    );
    io.observe(node);
    return () => {
      io.disconnect();
      limpar();
    };
  }, []);

  const parado = aceso === -1;

  return (
    <ol ref={ref} className="space-y-4">
      {PASSOS.map((p, i) => {
        const ativo = aceso === i;
        return (
          <li
            key={p.n}
            className={`flex items-start gap-3 transition-opacity duration-500 ${
              parado || ativo ? 'opacity-100' : 'opacity-40'
            }`}
          >
            <span
              className={`relative flex h-6 w-6 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold transition-all duration-300 ${
                ativo
                  ? 'scale-110 bg-onNightAccentFill text-[#0B1210]'
                  : 'bg-onNightAccentFill/15 text-onNightAccent'
              } mt-0.5`}
            >
              {ativo && (
                <span
                  aria-hidden
                  className="demo-ping absolute inset-0 rounded-lg bg-onNightAccentFill/40"
                />
              )}
              <span className="relative">{p.n}</span>
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight">{p.titulo}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-white/60">
                {p.texto}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
