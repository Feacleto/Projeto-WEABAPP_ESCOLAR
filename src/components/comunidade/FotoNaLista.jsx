import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { apagarFotoDaTurma } from '../../services/comunidadeService';
import { quandoSome } from '../../dominio/identidade/comunidade.js';

/**
 * UMA FOTO DA TURMA NA LISTA — a do tio (TioComunidade) e a da auxiliar
 * (AuxFoto) usam a mesma. Saiu de TioComunidade em 05/10/2026 (F1.5).
 *
 * `podeApagar` decide o botão; quem confere de verdade é o servidor
 * (`apagarFotoDaTurma`): o tio apaga tudo o que está no nome dele, a
 * auxiliar só o que ela postou. `postadaPorNome` (o primeiro nome da
 * auxiliar) vira "Postada pela Cida" — é assim que o tio sabe quem postou.
 */
export default function FotoNaLista({ foto, podeApagar = false, onApagada }) {
  const [apagando, setApagando] = useState(false);
  const expira = foto.expiraEm?.toMillis?.() || foto.expiraEmMs || 0;

  const apagar = async () => {
    if (!window.confirm('Apagar esta foto agora? As famílias deixam de ver.')) return;
    setApagando(true);
    try {
      await apagarFotoDaTurma(foto.id);
      toast.success('Foto apagada.');
      onApagada?.(foto.id);
    } catch (err) {
      toast.error(err.message || 'Não deu para apagar.');
      setApagando(false);
    }
  };

  return (
    <li className="overflow-hidden rounded-2xl bg-card">
      <img src={foto.url} alt={`Foto: ${foto.epoca}`} className="h-52 w-full object-cover" loading="lazy" />
      <div className="flex items-center justify-between gap-2 p-3">
        <span className="min-w-0">
          <span className="block truncate text-base font-bold text-text">
            {foto.autor ? `${foto.autor} · ` : ''}
            {foto.epoca}
          </span>
          {foto.legenda && <span className="block text-base text-text">{foto.legenda}</span>}
          {foto.postadaPorNome && (
            <span className="block text-base text-textBody">Postada pela {foto.postadaPorNome}</span>
          )}
          <span className="block text-base text-textMuted">{quandoSome(expira)}</span>
        </span>
        {podeApagar && (
          <button
            type="button"
            onClick={apagar}
            disabled={apagando}
            className="flex min-h-12 shrink-0 items-center gap-1 rounded-xl border-2 border-border px-3 text-base font-bold text-text"
          >
            <Trash2 size={18} aria-hidden="true" />
            Apagar
          </button>
        )}
      </div>
    </li>
  );
}
