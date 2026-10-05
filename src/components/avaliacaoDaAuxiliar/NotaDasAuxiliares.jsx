import { Star } from 'lucide-react';
import { useNotaDasAuxiliares } from '../../hooks/useAvaliacoesDaAuxiliar';
import { textoDaNota } from '../../dominio/identidade/avaliacaoDaAuxiliar.js';

/**
 * A NOTA DAS AUXILIARES — o lado do tio (05/10/2026). Só a MÉDIA, e só com
 * notas de pelo menos 3 auxiliares diferentes; abaixo disso, só quantas
 * responderam. Nenhuma nota sozinha, nenhum nome: ele sabe quem trabalhou
 * com ele, e uma média de uma ou duas pessoas diria quem deu cada nota.
 * Quem garante é o servidor (`minhaNotaDasAuxiliares`); as rules não deixam
 * ele ler documento nenhum.
 *
 * A tela só a monta para quem já teve auxiliar.
 */
export default function NotaDasAuxiliares() {
  const resumo = useNotaDasAuxiliares();
  if (!resumo) return null;
  return (
    <p className="flex min-h-12 items-center gap-2 rounded-2xl bg-card px-4 py-2 text-base font-semibold text-text shadow-rest">
      <Star size={22} className={resumo.media != null ? 'fill-ouro text-ouro' : 'text-borderStrong'} aria-hidden="true" />
      {textoDaNota(resumo)}
    </p>
  );
}
