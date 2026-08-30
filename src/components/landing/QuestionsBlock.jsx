import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { ArtChat, ArtCoins, ArtRadar } from './BlockArt';

/**
 * As três perguntas que o motorista ouve todo dia — num bloco só.
 *
 * POR QUE HORIZONTAL, E NÃO TRÊS BLOCOS DE ROLAGEM
 * Cada pergunta já teve a sua própria tela cheia. Funcionava, mas custava
 * três gestos de rolagem numa página que já tem outros sete blocos — e quem
 * está com preguiça de rolar simplesmente não chega no fim. Aqui as três
 * ocupam UMA tela e avançam PRO LADO num toque de botão: o mesmo conteúdo,
 * um terço do caminho, e a mão fica no mesmo lugar.
 *
 * O botão é o caminho principal (é o que se vê e o que se aprende), mas o
 * arraste também funciona — quem já entendeu que dá pra deslizar não precisa
 * procurar o botão.
 *
 * A ÚLTIMA PERGUNTA EMPURRA PRA FRENTE
 * No terceiro card o botão deixa de ser "próxima" e passa a levar pro demo
 * do app. Carrossel que termina em beco sem saída devolve o visitante pro
 * nada; este entrega ele na tela seguinte.
 */

const PERGUNTAS = [
  {
    id: 'rota',
    Art: ArtRadar,
    pergunta: 'Cadê a van?',
    resposta: 'A família acompanha pelo celular.',
    remate: 'Você dirige em paz, sem responder mensagem no volante.',
  },
  {
    id: 'dinheiro',
    Art: ArtCoins,
    pergunta: 'E a mensalidade?',
    resposta: 'O app calcula, manda o PIX e mostra quem pagou.',
    remate: 'Você só confere. Sem print perdido na conversa.',
  },
  {
    id: 'recado',
    Art: ArtChat,
    pergunta: 'E o recado de hoje?',
    resposta: 'Um aviso no app chega em todas as famílias.',
    remate: 'Na hora, e mesmo com o app fechado no celular delas.',
  },
];

export default function QuestionsBlock({ onFinish }) {
  const [i, setI] = useState(0);
  const ultima = i === PERGUNTAS.length - 1;

  // Arraste: o eixo é travado no primeiro movimento pra não roubar a rolagem
  // vertical da página.
  const [dx, setDx] = useState(0);
  const gesto = useRef(null);
  const trilhoRef = useRef(null);
  // Arrastar termina com o dedo levantando em cima do bloco — o que o
  // navegador entende como clique. Sem esta marca, todo arraste avançava DUAS
  // perguntas: uma pelo gesto, outra pelo "clique".
  const arrastou = useRef(false);

  const avancar = () => (ultima ? onFinish?.() : setI((v) => v + 1));
  const voltar = () => setI((v) => Math.max(0, v - 1));

  /**
   * Toque no bloco = próxima pergunta, e na última volta pra primeira.
   *
   * O botão "Ver o app" continua levando pra frente (é o caminho da página);
   * o toque no bloco é o gesto de quem está FOLHEANDO e quer reler. Por isso
   * um dá a volta e o outro segue: são duas intenções diferentes no mesmo
   * bloco, e cada uma tem o seu alvo.
   */
  const tocarNoBloco = () => {
    if (arrastou.current) {
      arrastou.current = false;
      return;
    }
    setI((v) => (v + 1) % PERGUNTAS.length);
  };

  const onTouchStart = (e) => {
    const t = e.touches[0];
    arrastou.current = false;
    gesto.current = { x: t.clientX, y: t.clientY, eixo: null };
  };

  const onTouchMove = (e) => {
    const g = gesto.current;
    if (!g) return;
    const t = e.touches[0];
    const ddx = t.clientX - g.x;
    const ddy = t.clientY - g.y;
    if (!g.eixo) {
      if (Math.abs(ddx) < 8 && Math.abs(ddy) < 8) return;
      g.eixo = Math.abs(ddx) > Math.abs(ddy) ? 'x' : 'y';
    }
    if (g.eixo !== 'x') return;
    arrastou.current = true;
    // Nas pontas o arraste não passa da borda.
    const limite =
      (i === 0 && ddx > 0) || (ultima && ddx < 0) ? ddx * 0.25 : ddx;
    setDx(limite);
  };

  const onTouchEnd = () => {
    const g = gesto.current;
    gesto.current = null;
    const largura = trilhoRef.current?.offsetWidth || 320;
    if (g?.eixo === 'x' && Math.abs(dx) > largura * 0.2) {
      if (dx < 0 && !ultima) setI((v) => v + 1);
      if (dx > 0 && i > 0) setI((v) => v - 1);
    }
    setDx(0);
  };

  const arrastando = dx !== 0;

  return (
    <div>
      <div
        ref={trilhoRef}
        className="-mx-6 overflow-hidden px-6"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="flex w-[300%] touch-pan-y items-start gap-0"
          style={{
            transform: `translateX(calc(${-i * (100 / 3)}% + ${dx}px))`,
            transition: arrastando
              ? 'none'
              : 'transform 380ms cubic-bezier(.2,.8,.2,1)',
          }}
        >
          {PERGUNTAS.map((p, idx) => {
            const Art = p.Art;
            const ativa = idx === i;
            return (
              <div
                key={p.id}
                // role/tabIndex em vez de <button>: dentro do bloco há um
                // título e parágrafos, e título dentro de botão é HTML
                // inválido (além de virar um nome enorme no leitor de tela).
                role={ativa ? 'button' : undefined}
                tabIndex={ativa ? 0 : -1}
                onClick={ativa ? tocarNoBloco : undefined}
                onKeyDown={
                  ativa
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          tocarNoBloco();
                        }
                      }
                    : undefined
                }
                aria-label={
                  ativa ? 'Toque para ver a próxima pergunta' : undefined
                }
                className={`w-1/3 shrink-0 pr-6 transition-opacity duration-300 ${
                  ativa
                    ? 'cursor-pointer opacity-100'
                    : 'pointer-events-none opacity-40'
                }`}
                aria-hidden={!ativa}
              >
                <Art />

                <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.18em] text-onNightAccent/70">
                  {idx + 1} de 3
                </p>
                <h3 className="mt-2 text-[1.6rem] font-extrabold leading-[1.15] tracking-tight">
                  “{p.pergunta}”
                </h3>

                <div className="mt-4 flex items-start gap-3 rounded-3xl border border-white/10 bg-white/[0.055] p-5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-onNightAccent/30 bg-onNightAccentFill/20">
                    <Check size={16} className="text-onNightAccent" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-lg font-extrabold leading-tight tracking-tight">
                      {p.resposta}
                    </p>
                    <p className="mt-1.5 text-sm leading-snug text-white/60">
                      {p.remate}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-3 text-center text-[11px] text-white/40">
        toque na pergunta pra ver a próxima
      </p>

      {/* Controles: o botão é o caminho principal. */}
      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={voltar}
          disabled={i === 0}
          aria-label="Pergunta anterior"
          className="tap flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white/70 disabled:opacity-30"
        >
          <ArrowLeft size={17} />
        </button>

        <div className="flex flex-1 items-center gap-1.5" aria-hidden>
          {PERGUNTAS.map((p, idx) => (
            <span
              key={p.id}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === i ? 'w-5 bg-onNightAccent' : 'w-1.5 bg-white/20'
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={avancar}
          className="tap cta-shine-white relative inline-flex h-11 items-center gap-2 overflow-hidden rounded-full bg-onNightAccentFill px-5 text-sm font-extrabold text-[#0B1210]"
        >
          {ultima ? 'Ver o app' : 'Próxima'}
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
