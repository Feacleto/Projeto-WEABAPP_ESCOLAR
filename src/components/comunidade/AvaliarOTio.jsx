import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { useMarcaDoTio } from '../../hooks/useMarcaDoTio';
import { avaliarOTio, watchMinhaAvaliacao } from '../../services/comunidadeService';

/**
 * A FAMÍLIA AVALIA O TIO (etapa 2 da Comunidade, 05/10/2026, aprovada pelo
 * dono): estrelas, de 1 a 5, uma nota por semestre (ela pode mudar).
 *
 * ⚠️ SÓ O TIO VÊ, E SÓ A MÉDIA: as rules não deixam ele ler nota nenhuma, e
 * a média que ele recebe é a do semestre fechado, com pelo menos cinco
 * respostas. A frase diz isso a ela na própria pergunta, porque a família
 * só dá a nota de verdade se souber que o motorista não vai saber quem foi.
 *
 * No Início (`noInicio`) aparece enquanto ela não respondeu neste semestre,
 * com "Agora não" (some por 14 dias, neste aparelho). Na ficha, sempre.
 */
const CHAVE_ADIADO = 'alobuzinou:avaliacao-do-tio-adiada';
const DIAS_ADIADO = 14;

function adiadoAte() {
  try {
    return Number(localStorage.getItem(CHAVE_ADIADO)) || 0;
  } catch {
    return 0;
  }
}

export default function AvaliarOTio({ child, noInicio = false }) {
  const { user } = useAuth();
  const marca = useMarcaDoTio();
  const adminUid = child?.adminUid;
  const [nota, setNota] = useState(undefined);
  const [salvando, setSalvando] = useState(false);
  const [adiado, setAdiado] = useState(() => adiadoAte() > Date.now());

  useEffect(() => {
    if (!adminUid || !user?.uid) return undefined;
    return watchMinhaAvaliacao(adminUid, user.uid, setNota);
  }, [adminUid, user?.uid]);

  if (!adminUid || !user?.uid || nota === undefined) return null;
  if (noInicio && (nota !== null || adiado)) return null;

  const tio = marca?.nome || 'o motorista';
  const filho = String(child?.name || '').trim().split(/\s+/)[0] || 'seu filho';

  const dar = async (n) => {
    setSalvando(true);
    try {
      await avaliarOTio(adminUid, user.uid, n);
      toast.success('Obrigado. Sua nota foi registrada.');
    } catch {
      toast.error('Não deu para salvar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  };

  const agoraNao = () => {
    try {
      localStorage.setItem(CHAVE_ADIADO, String(Date.now() + DIAS_ADIADO * 86400000));
    } catch {
      // Sem armazenamento, o "Agora não" vale só até recarregar.
    }
    setAdiado(true);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-center">
      <p className="text-base font-bold text-text">Como está o transporte {child?.gender === 'female' ? 'da' : 'do'} {filho}?</p>
      <div className="mt-2 flex justify-center gap-1" role="radiogroup" aria-label="Nota de 1 a 5 estrelas">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={nota === n}
            aria-label={`${n} ${n === 1 ? 'estrela' : 'estrelas'}`}
            disabled={salvando}
            onClick={() => dar(n)}
            className="flex h-12 w-12 items-center justify-center rounded-xl"
          >
            <Star
              size={32}
              className={nota != null && n <= nota ? 'fill-ouro text-ouro' : 'text-borderStrong'}
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
      <p className="mt-2 text-sm text-textMuted">
        Só {tio} vê a média de todas as famílias, sem o seu nome.
        {nota != null ? ' Você pode mudar a nota até o fim do semestre.' : ''}
      </p>
      {noInicio && nota === null && (
        <button type="button" onClick={agoraNao} className="mt-1 min-h-12 px-4 text-base font-semibold text-textMuted">
          Agora não
        </button>
      )}
    </div>
  );
}

