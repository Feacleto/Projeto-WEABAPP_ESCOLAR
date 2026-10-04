import { useState } from 'react';
import { StickyNote, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import AppSheet from '../common/AppSheet';
import Button from '../common/Button';
import { updateChild } from '../../services/childrenService';
import BotaoDeFalar from '../common/BotaoDeFalar';

/**
 * ESCREVER OU MUDAR AS OBSERVAÇÕES DA PARADA, DEPOIS DO CADASTRO
 * (03/10/2026).
 *
 * `children.notes` é o texto que a rota mostra na parada da criança
 * (OperacaoDaRota) — "portão de trás", "tocar o interfone". Só dava para
 * escrever no cadastro, e é na segunda semana de rota que o motorista
 * descobre essas coisas.
 *
 * ⚠️ O MESMO AVISO DO CADASTRO: nada de saúde aqui. Dado de saúde é da
 * família (`saudeNotas`, com o consentimento dela) e as rules o proíbem ao
 * motorista — este campo ele escreve sozinho, sem consentimento de ninguém.
 */
export default function EditarNotasSheet({ open, onClose, child }) {
  const [texto, setTexto] = useState(child?.notes || '');
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    setSalvando(true);
    try {
      await updateChild(child.id, { notes: texto.trim() });
      toast.success(texto.trim() ? 'Observação salva.' : 'Observação apagada.');
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Não deu pra salvar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <AppSheet
      open={open}
      onClose={salvando ? () => {} : onClose}
      title="Observações da parada"
      icon={StickyNote}
    >
      <div className="space-y-3 pb-1">
        <p className="text-sm text-textBody">
          Aparece na rota, na parada de {String(child?.name || 'esta criança').split(' ')[0]}.
        </p>
        {/* Falar em vez de escrever (04/10/2026): o ditado se soma ao texto. */}
        <BotaoDeFalar valor={texto} onChange={setTexto} />
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={4}
          maxLength={300}
          placeholder="Digite aqui"
          className="w-full rounded-xl border-2 border-border bg-card p-3 text-base text-text placeholder:text-textMuted focus:border-primary focus:outline-none focus:ring-4 focus:ring-accent/25"
        />
        <p className="text-sm leading-relaxed text-textMuted">
          Só o que ajuda na rota. Saúde, remédio ou alergia você combina direto
          com a família — este campo não é o lugar de guardar isso.
        </p>
        <Button icon={Save} onClick={salvar} loading={salvando}>
          Salvar
        </Button>
      </div>
    </AppSheet>
  );
}
