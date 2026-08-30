import {
  ArrowRight,
  Bus,
  Check,
  Handshake,
  Home as HomeIcon,
  MessageSquare,
  Plus,
  School,
  Users,
} from 'lucide-react';

/**
 * Artes animadas do topo de cada bloco da home — desenho, não ilustração.
 *
 * POR QUE CSS E NÃO IMAGEM
 * Cada bloco da home precisa de um sinal visual que diga do que ele trata
 * antes de o visitante ler a primeira palavra. Ilustração em PNG pesaria
 * (são oito), não acompanharia a cor do tema e não teria movimento. Aqui
 * cada arte é uma dúzia de divs com keyframes já declarados no index.css:
 * peso zero, nítido em qualquer tela e vivo.
 *
 * REGRAS QUE TODAS SEGUEM
 * - Faixa de 72–80px de altura, largura total do bloco.
 * - `aria-hidden`: são decoração, quem usa leitor de tela ouve o título.
 * - Movimento em loop lento (2,6s a 6s). Nada pisca mais rápido que isso.
 * - Toda animação morre em prefers-reduced-motion (bloco no fim do
 *   index.css) — a arte fica parada, e continua legível parada.
 */

/* Estradinha com a van cruzando — abre o hero. A promessa em movimento. */
export function ArtRoad() {
  return (
    <div
      aria-hidden
      className="relative h-[72px] rounded-2xl bg-white/[0.04] border border-white/10 overflow-hidden"
    >
      <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-white/20" />
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-onNightAccentFill/20 border border-onNightAccent/30 flex items-center justify-center">
        <HomeIcon size={13} className="text-onNightAccent" />
      </span>
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-escola/20 border border-escolaBorder/30 flex items-center justify-center">
        <School size={13} className="text-escolaBorder" />
      </span>
      <div className="demo-van absolute top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-perua flex items-center justify-center shadow-lg shadow-black/40">
        <Bus size={16} className="text-white" />
      </div>
    </div>
  );
}

/* Radar ao vivo — a van no meio, três halos saindo dela em sequência.
 * É a resposta ao "cadê a van?" desenhada: o app sabe, e não para de saber. */
export function ArtRadar() {
  return (
    <div aria-hidden className="relative h-[80px] flex items-center justify-center">
      <div className="relative w-14 h-14 flex items-center justify-center">
        {[0, 660, 1320].map((d) => (
          <span
            key={d}
            className="demo-ping absolute inset-0 rounded-full bg-onNightAccentFill/35"
            style={{ animationDelay: `${d}ms` }}
          />
        ))}
        <span className="relative w-11 h-11 rounded-2xl bg-perua flex items-center justify-center shadow-lg shadow-black/40">
          <Bus size={20} className="text-white" />
        </span>
      </div>
      {/* Dois celulares recebendo: o sinal vai pra família, não pro vazio. */}
      <span className="absolute left-4 top-3 w-6 h-9 rounded-md border border-white/25 bg-white/[0.06] flex items-start justify-center pt-1">
        <span className="w-1.5 h-1.5 rounded-full bg-onNightAccent demo-ping" />
      </span>
      <span className="absolute right-4 bottom-3 w-6 h-9 rounded-md border border-white/25 bg-white/[0.06] flex items-start justify-center pt-1">
        <span
          className="w-1.5 h-1.5 rounded-full bg-onNightAccent demo-ping"
          style={{ animationDelay: '900ms' }}
        />
      </span>
    </div>
  );
}

/* Moedas caindo na carteira, uma atrás da outra — a mensalidade entrando
 * sozinha. O check aparece no fim: entrou e ficou registrado. */
export function ArtCoins() {
  return (
    <div aria-hidden className="relative h-[80px] flex items-end justify-center">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 flex gap-2">
        {[0, 600, 1200].map((d) => (
          <span
            key={d}
            className="art-coin w-6 h-6 rounded-full bg-ouro text-[9px] font-extrabold text-white flex items-center justify-center shadow-md"
            style={{ animationDelay: `${d}ms` }}
          >
            R$
          </span>
        ))}
      </div>
      <div className="relative w-24 h-10 rounded-xl bg-white/[0.07] border border-white/15 flex items-center justify-center">
        <span className="absolute -top-1 inset-x-3 h-1.5 rounded-full bg-white/10" />
        <span className="w-6 h-6 rounded-full bg-onNightAccentFill/20 border border-onNightAccent/40 flex items-center justify-center">
          <Check size={13} className="text-onNightAccent" />
        </span>
      </div>
    </div>
  );
}

/* Balões de recado saindo em sequência, e o último ainda digitando —
 * um aviso que se multiplica sem o motorista digitar dez vezes. */
export function ArtChat() {
  return (
    <div aria-hidden className="relative h-[80px] flex items-center justify-center gap-2">
      <span className="w-10 h-10 rounded-xl bg-onNightAccentFill/15 border border-onNightAccent/25 flex items-center justify-center shrink-0">
        <MessageSquare size={18} className="text-onNightAccent" />
      </span>
      <div className="flex flex-col gap-1.5">
        {[0, 420, 840].map((d, i) => (
          <span
            key={d}
            className="art-pop rounded-full bg-white/[0.09] border border-white/15 h-5 flex items-center gap-1 px-2"
            style={{ animationDelay: `${d}ms`, width: `${64 + i * 22}px` }}
          >
            {i === 2 ? (
              <>
                {[0, 160, 320].map((td) => (
                  <span
                    key={td}
                    className="art-typing w-1 h-1 rounded-full bg-onNightAccent"
                    style={{ animationDelay: `${td}ms` }}
                  />
                ))}
              </>
            ) : (
              <>
                <span className="h-1 flex-1 rounded-full bg-white/25" />
                <span className="h-1 w-3 rounded-full bg-white/15" />
              </>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

/* Três telas flutuando fora de fase — o app tem mais de uma cara, e você
 * pode folhear. Anuncia o demo clicável logo abaixo. */
export function ArtScreens() {
  return (
    <div aria-hidden className="relative h-[76px] flex items-end justify-center gap-2">
      {[
        { d: 0, r: '-7deg', h: 'h-12' },
        { d: 400, r: '0deg', h: 'h-16' },
        { d: 800, r: '7deg', h: 'h-12' },
      ].map(({ d, r, h }) => (
        <span
          key={d}
          className={`art-lift ${h} w-9 rounded-lg bg-white/[0.08] border border-white/20 flex flex-col items-center justify-start gap-1 pt-1.5`}
          style={{ animationDelay: `${d}ms`, '--r': r }}
        >
          <span className="w-4 h-[3px] rounded-full bg-white/30" />
          <span className="w-6 h-[3px] rounded-full bg-white/15" />
          <span className="w-6 h-[3px] rounded-full bg-white/15" />
          <span className="mt-auto mb-1.5 w-5 h-1 rounded-full bg-onNightAccent/70" />
        </span>
      ))}
    </div>
  );
}

/* Três paradas ligadas por uma linha, com um ponto viajando de uma à
 * outra — a sequência de começar, desenhada como percurso. */
export function ArtSteps() {
  return (
    <div aria-hidden className="relative h-[72px] flex items-center">
      <div className="relative w-full h-8">
        <div className="absolute inset-x-4 top-1/2 border-t border-dashed border-white/20" />
        {/* As três paradas ficam com o CENTRO em 16px, 50% e 100%−16px, que
          * é exatamente onde a linha tracejada (inset-x-4) começa, cruza e
          * termina — e onde o ponto viajante para. */}
        {[
          ['1', '0px'],
          ['2', 'calc(50% - 16px)'],
          ['3', 'calc(100% - 32px)'],
        ].map(([n, left]) => (
          <span
            key={n}
            className="absolute top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-white/[0.08] border border-white/20 font-mono text-[11px] font-bold text-onNightAccent flex items-center justify-center"
            style={{ left }}
          >
            {n}
          </span>
        ))}
        <span className="art-travel absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-onNightAccentFill shadow-lg shadow-emerald-500/40" />
      </div>
    </div>
  );
}

/* Aperto de mão com dois pontos orbitando — parceria, e o "de perto" que
 * a seção promete. O halo pulsa devagar pra não competir com o texto. */
export function ArtBadge() {
  return (
    <div aria-hidden className="relative h-[76px] flex items-center justify-center">
      <span className="absolute w-16 h-16 rounded-full bg-onNightAccentFill/20 demo-ping" />
      <span className="art-orbit absolute w-[74px] h-[74px]">
        <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-onNightAccent" />
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-ouro" />
      </span>
      <span className="relative w-12 h-12 rounded-2xl bg-white/[0.09] border border-white/20 flex items-center justify-center">
        <Handshake size={22} className="text-onNightAccent" />
      </span>
    </div>
  );
}


/* Quatro lugares: três ocupados, um piscando com um "+". É o "vagas por
 * convite" sem precisar de texto — e o convite pra ser o quarto. */
export function ArtSeats() {
  return (
    <div aria-hidden className="relative h-[76px] flex items-center justify-center gap-2">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-10 h-12 rounded-xl bg-white/[0.08] border border-white/20 flex items-center justify-center"
        >
          <Users size={16} className="text-white/45" />
        </span>
      ))}
      <span className="art-blink w-10 h-12 rounded-xl border-2 border-dashed border-onNightAccent/70 bg-onNightAccentFill/10 flex items-center justify-center">
        <Plus size={18} className="text-onNightAccent" />
      </span>
      <ArrowRight size={16} className="text-onNightAccent/60" />
    </div>
  );
}
