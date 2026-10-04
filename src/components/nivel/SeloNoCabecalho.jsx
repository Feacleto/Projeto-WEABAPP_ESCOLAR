import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gem, Medal } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNivel } from '../../hooks/useNivel';
import { FRASE_PARA_FAMILIA } from '../../dominio/identidade/nivel.js';
import Sheet from '../common/Sheet';
import SeloDoNivel from './SeloDoNivel';
import { NOME_DO_NIVEL, chaveDoNivel, posicaoDoNivel } from './rotuloDoNivel';

/**
 * O SELO AO LADO DA MARCA, NO CABEÇALHO (docs/niveis.md, seção 7).
 *
 * DOIS LEITORES, DUAS REGRAS:
 * - MOTORISTA (sem `adminUid`): o selo dele a partir do Bronze, e o toque
 *   leva a "Meu nível" — é lá que moram as missões.
 * - FAMÍLIA (`adminUid` = o motorista da criança ativa): só a partir da
 *   PRATA, e o toque abre uma folha com UMA frase. Nada mais: a família vê o
 *   nível, nunca o motivo (regra 7) — nem missão, nem prazo, nem queda. Quem
 *   cai da Platina volta ao Ouro calado.
 *
 * O selo é sempre o do SERVIDOR (`niveis/{uid}`), nunca um cálculo local.
 */
export default function SeloNoCabecalho({ adminUid = null }) {
  const { user } = useAuth();
  const ehFamilia = !!adminUid;
  const uid = ehFamilia ? adminUid : user?.uid || null;
  const { nivel } = useNivel(uid);
  const navigate = useNavigate();
  const [aberta, setAberta] = useState(false);

  const chave = chaveDoNivel(nivel);
  if (chave === 'sem_nivel') return null;

  if (!ehFamilia) {
    return <SeloDoNivel nivel={chave} tamanho="pequeno" onClick={() => navigate('/tio/nivel')} />;
  }

  // A família só vê a partir da Prata.
  if (posicaoDoNivel(chave) < posicaoDoNivel('prata')) return null;
  const frase = FRASE_PARA_FAMILIA[chave];
  if (!frase) return null;

  return (
    <>
      <SeloDoNivel nivel={chave} tamanho="pequeno" onClick={() => setAberta(true)} />
      <Sheet
        open={aberta}
        onClose={() => setAberta(false)}
        title={`Nível ${NOME_DO_NIVEL[chave]}`}
        icon={chave === 'platina' || chave === 'diamante' ? Gem : Medal}
      >
        <p className="pb-2 text-lg leading-relaxed text-text">{frase}</p>
      </Sheet>
    </>
  );
}
