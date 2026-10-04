import { Gem, Medal } from 'lucide-react';
import { NOME_DO_NIVEL, chaveDoNivel } from './rotuloDoNivel';
import { gradienteDoMetal } from '../../config/paletaCategorica';

/**
 * O SELO DO NÍVEL — uma pílula de METAL com o ícone e o nome (docs/niveis.md,
 * seção 7; modelo D2, 04/10/2026).
 *
 * ── CROMADO, E O PORQUÊ DE PODER SER
 * Até 04/10/2026 o selo era de token (Bronze e Prata neutros, Platina e
 * Diamante na cor do motorista), justamente para não inventar paleta. O dono
 * pediu o metal de verdade — o selo é o prêmio, e prêmio que parece etiqueta
 * não faz ninguém querer o próximo. Os metais moram em
 * `config/paletaCategorica.js` (`METAL_DO_NIVEL`), o endereço com licença
 * para cor que só precisa diferir da vizinha: o nome continua ESCRITO, o
 * metal só ajuda a reconhecer.
 *
 * ⚠️ Âmbar NÃO entra aqui: âmbar é aviso, e um selo não pede nada. O Ouro é
 * metal, não o token de aviso.
 *
 * ── O REFLEXO É A TERCEIRA EXCEÇÃO DE MOVIMENTO
 * O design system só deixa mexer o que é "ao vivo"; o reflexo que atravessa o
 * selo a cada 4 s é exceção NOMEADA (docs/design-system.md e
 * `animation.selo-brilho` no tailwind.config.js). Quem pede "reduzir
 * movimento" no aparelho vê o selo parado.
 *
 * Props: { nivel, tamanho: 'pequeno' | 'grande', onClick }
 * `nivel` pode ser a chave ou o documento de `niveis/{uid}`.
 */
export default function SeloDoNivel({ nivel, tamanho = 'pequeno', onClick }) {
  const chave = chaveDoNivel(nivel);
  const fundo = gradienteDoMetal(chave);
  if (!fundo) return null; // sem_nivel: nada

  const Icone = chave === 'platina' || chave === 'diamante' ? Gem : Medal;
  const grande = tamanho === 'grande';
  const nome = NOME_DO_NIVEL[chave];

  const pilula = (
    <span
      className={`relative inline-flex items-center overflow-hidden rounded-full font-bold text-text ${
        grande ? 'h-14 gap-2.5 px-6 font-display text-2xl' : 'h-8 gap-1.5 px-3 text-sm'
      }`}
      style={{
        background: fundo,
        textShadow: '0 1px 0 rgb(255 255 255 / 0.55)',
        boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.7), inset 0 -1px 0 rgb(0 0 0 / 0.25), 0 1px 3px rgb(0 0 0 / 0.25)',
      }}
    >
      <Icone size={grande ? 28 : 16} className="relative shrink-0" aria-hidden />
      <span className="relative">{nome}</span>
      {/* O reflexo: uma faixa clara inclinada que atravessa e some. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-2 -top-2 w-2/5 -skew-x-[20deg] animate-selo-brilho motion-reduce:hidden"
        style={{
          left: '-60%',
          background: 'linear-gradient(100deg, transparent, rgb(255 255 255 / 0.85), transparent)',
        }}
      />
    </span>
  );

  if (!onClick) return pilula;

  // O toque é de 48px mesmo com a pílula de 32: piso de toque do app.
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Nível ${nome}`}
      className="tap inline-flex min-h-12 shrink-0 items-center justify-center"
    >
      {pilula}
    </button>
  );
}
