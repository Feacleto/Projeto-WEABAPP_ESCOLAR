import { useState } from 'react';
import { Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { avaliarTio } from '../../services/avaliacoesDaAuxiliarService';

/**
 * "COMO É TRABALHAR COM O …?" — a nota que a auxiliar dá ao tio (05/10/2026,
 * decisão do dono). Uma linha por tio com quem ela trabalha ou já trabalhou;
 * uma nota por par, que ela pode mudar.
 *
 * ⚠️ SÓ A EQUIPE DO ALÔ BUZINOU VÊ A NOTA, e a frase diz isso na própria
 * pergunta: ela só é sincera sobre quem paga o salário dela se souber que
 * ele não vai saber. O tio vê só a média, e só com 3 auxiliares diferentes.
 *
 * Nem ela relê a nota no banco (as rules abrem o documento só ao dono): a
 * estrela marcada é lembrada NESTE aparelho, e se ela trocar de celular a
 * linha volta vazia — tocar de novo só substitui a nota.
 */
const CHAVE = 'alobuzinou:nota-ao-tio:';

function lembrada(motoristaUid) {
  try {
    const n = Number(localStorage.getItem(CHAVE + motoristaUid));
    return n >= 1 && n <= 5 ? n : null;
  } catch {
    return null;
  }
}

export default function EstrelasParaOTio({ motoristaUid, marca }) {
  const [nota, setNota] = useState(() => lembrada(motoristaUid));
  const [salvando, setSalvando] = useState(false);
  const quem = marca || 'o motorista';

  async function dar(n) {
    setSalvando(true);
    try {
      await avaliarTio(motoristaUid, n);
      setNota(n);
      try {
        localStorage.setItem(CHAVE + motoristaUid, String(n));
      } catch {
        // Sem armazenamento, a estrela marcada vale até recarregar.
      }
      toast.success('Obrigado. Sua nota foi registrada.');
    } catch (err) {
      toast.error(err?.message || 'Não deu para salvar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="rounded-2xl bg-card p-5 text-center shadow-rest">
      <p className="text-base font-bold text-text">Como é trabalhar com {quem}?</p>
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
            className="tap flex h-12 w-12 items-center justify-center rounded-xl"
          >
            <Star size={36} className={nota != null && n <= nota ? 'fill-ouro text-ouro' : 'text-borderStrong'} aria-hidden="true" />
          </button>
        ))}
      </div>
      <p className="mt-2 text-sm text-textMuted">
        Só a equipe do Alô Buzinou vê a sua nota.{nota != null ? ' Você pode mudar quando quiser.' : ''}
      </p>
    </div>
  );
}
