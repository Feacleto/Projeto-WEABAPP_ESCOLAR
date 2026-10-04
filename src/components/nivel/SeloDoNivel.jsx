import { Gem, Medal } from 'lucide-react';
import { NOME_DO_NIVEL, chaveDoNivel } from './rotuloDoNivel';

/**
 * O SELO DO NÍVEL — uma pílula com o ícone e o nome (docs/niveis.md, seção 7).
 *
 * ── AS CORES SÃO DE TOKEN, E NENHUMA É NOVA
 * Bronze e Prata são NEUTROS (o nome é que diz qual é): inventar um cobre e um
 * cinza-prata seria a quarta paleta de licença do projeto, para enfeite. O
 * Ouro usa a exceção nomeada `ouro` (estrela, moeda, enfeite) só no ÍCONE —
 * como texto ela não se lê. Platina e Diamante usam a cor do motorista
 * (`primary*`), que é a cor do app dele e das famílias dele.
 *
 * ⚠️ Âmbar NÃO entra aqui: âmbar é aviso, e um selo não pede nada.
 *
 * ── PARADO
 * Sem brilho, sem pulso: o design system só deixa mexer o que responde a um
 * toque ou a um dado ao vivo, e o nível não é nenhum dos dois.
 *
 * Props: { nivel, tamanho: 'pequeno' | 'grande', onClick }
 * `nivel` pode ser a chave ou o documento de `niveis/{uid}`.
 */
const ESTILO = {
  bronze: { icone: Medal, pilula: 'bg-neutro text-text', tinta: 'text-textMuted' },
  prata: { icone: Medal, pilula: 'bg-surface border border-borderStrong text-text', tinta: 'text-textMuted' },
  ouro: { icone: Medal, pilula: 'bg-card border border-border text-text', tinta: 'text-ouro' },
  platina: { icone: Gem, pilula: 'bg-primaryChip text-primary', tinta: 'text-primary' },
  diamante: { icone: Gem, pilula: 'bg-primary text-white', tinta: 'text-white' },
};

export default function SeloDoNivel({ nivel, tamanho = 'pequeno', onClick }) {
  const chave = chaveDoNivel(nivel);
  const estilo = ESTILO[chave];
  if (!estilo) return null; // sem_nivel: nada

  const Icone = estilo.icone;
  const grande = tamanho === 'grande';
  const nome = NOME_DO_NIVEL[chave];

  const pilula = (
    <span
      className={`inline-flex items-center rounded-full font-bold ${estilo.pilula} ${
        grande ? 'h-14 gap-2.5 px-6 font-display text-2xl' : 'h-8 gap-1.5 px-3 text-sm'
      }`}
    >
      <Icone size={grande ? 28 : 16} className={`shrink-0 ${estilo.tinta}`} aria-hidden />
      {nome}
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
