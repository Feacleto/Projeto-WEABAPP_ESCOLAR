import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useNivel } from '../../hooks/useNivel';
import SeloDoNivel from './SeloDoNivel';
import { chaveDoNivel } from './rotuloDoNivel';

/**
 * O SELO AO LADO DA MARCA, NO CABEÇALHO (docs/niveis.md, seção 7).
 *
 * SÓ O MOTORISTA VÊ, e só o dele: a partir do Bronze, e o toque leva a "Meu
 * nível" — é lá que moram as missões.
 *
 * ⚠️ A FAMÍLIA NÃO VÊ MAIS (decisão do dono, 04/10/2026). Ela via a partir
 * da Prata, com uma frase ("Seu tio é engajado…"). Nível é sobre o uso que
 * ELE faz do app; mostrado à família, vira nota do motorista diante do
 * cliente dele — e a família não tem como ler o que o nível mede. As rules
 * fecharam `niveis/{uid}` para ela na mesma alteração.
 *
 * O selo é sempre o do SERVIDOR (`niveis/{uid}`), nunca um cálculo local.
 */
export default function SeloNoCabecalho() {
  const { user } = useAuth();
  const { nivel } = useNivel(user?.uid || null);
  const navigate = useNavigate();

  const chave = chaveDoNivel(nivel);
  if (chave === 'sem_nivel') return null;
  return <SeloDoNivel nivel={chave} tamanho="pequeno" onClick={() => navigate('/tio/nivel')} />;
}
