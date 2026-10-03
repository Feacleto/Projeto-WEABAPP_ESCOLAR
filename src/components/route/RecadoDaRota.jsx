import { useState } from 'react';
import { NotebookPen, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import AppSheet from '../common/AppSheet';
import Button from '../common/Button';
import { AGENDA_TYPES, createChildEntry } from '../../services/agendaService';

/**
 * RECADO NO CADERNO, DE DENTRO DA ROTA (03/10/2026).
 *
 * Duas crianças brigaram, uma passou mal no caminho, a professora pediu algo
 * no portão: o recado nasce na rota. Ele existia, mas a três toques e fora
 * desta tela — e o motorista anotava no WhatsApp, onde não fica no caderno da
 * família. Vai SÓ para a família desta criança (`createChildEntry`): o recado
 * sobre uma briga não é assunto da turma inteira.
 */
const TIPOS = ['sick', 'conflict', 'read_agenda', 'other'];

export default function RecadoDaRota({ open, onClose, child, adminUid, tipoInicial = 'conflict' }) {
  const nome = String(child?.name || '').trim().split(/\s+/)[0] || 'A criança';
  const [tipo, setTipo] = useState(tipoInicial);
  const [texto, setTexto] = useState(AGENDA_TYPES[tipoInicial].template(nome));
  const [enviando, setEnviando] = useState(false);

  const escolher = (t) => {
    setTipo(t);
    setTexto(AGENDA_TYPES[t].template(nome));
  };

  const enviar = async () => {
    setEnviando(true);
    try {
      await createChildEntry({ adminUid, child, type: tipo, message: texto });
      toast.success(
        child?.parentUid
          ? 'Recado enviado para a família.'
          : 'Recado salvo no caderno. A família vê quando entrar no app.'
      );
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Não deu pra enviar. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <AppSheet
      open={open}
      onClose={enviando ? () => {} : onClose}
      title={`Recado sobre ${nome}`}
      icon={NotebookPen}
    >
      <div className="space-y-4 px-5 pb-6">
        <div className="flex flex-wrap gap-2">
          {TIPOS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => escolher(t)}
              aria-pressed={tipo === t}
              className={`tap min-h-11 rounded-full border px-4 text-sm font-semibold ${
                tipo === t ? 'border-primary bg-primary text-white' : 'border-border bg-card text-text'
              }`}
            >
              {AGENDA_TYPES[t].label}
            </button>
          ))}
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-text">O recado</span>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={4}
            className="w-full rounded-xl border-2 border-border bg-card p-3 text-base text-text focus:border-primary focus:outline-none"
          />
        </label>
        <p className="text-sm text-textMuted">Vai só para a família de {nome}, no caderno.</p>
        <Button icon={Send} loading={enviando} disabled={!texto.trim()} onClick={enviar}>
          Enviar recado
        </Button>
      </div>
    </AppSheet>
  );
}
