import { useRef, useState } from 'react';
import { Paperclip, FileText, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { STORAGE_ENABLED } from '../../config/capabilities';

const MAX_BYTES = 2 * 1024 * 1024; // igual ao limite das storage.rules

/**
 * Escolha do comprovante antes de avisar que pagou.
 *
 * Aceita foto (print da tela do banco) e PDF (o arquivo que o banco gera).
 * Não sobe nada aqui: só devolve o File pro pai da tela, que sobe junto do
 * "confirmar" — assim quem desiste no meio não deixa arquivo órfão no
 * Storage.
 *
 * Props:
 *   - file:     File | null
 *   - onChange: (File | null) => void
 */
export default function ReceiptPicker({ file, onChange }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);

  // Sem Storage não existe onde guardar o anexo, então o botão não
  // aparece. Isto NÃO quebra o fluxo: anexar sempre foi opcional, e
  // avisar que pagou funciona com o arquivo nulo — é o mesmo caminho de
  // quem escolhe não anexar. O que se perde é a prova junto do aviso,
  // não o aviso.
  //
  // Devolver null em vez de um botão desabilitado é deliberado: botão
  // apagado convida a tocar e a procurar o motivo. Ausência não.
  if (!STORAGE_ENABLED) return null;

  const pick = (e) => {
    const chosen = e.target.files?.[0];
    if (!chosen) return;

    const isPdf = chosen.type === 'application/pdf';
    const isImage = chosen.type.startsWith('image/');
    if (!isPdf && !isImage) {
      toast.error('Anexe uma foto ou um PDF.');
      return;
    }
    // PDF não passa por compressão, então o limite vale direto pra ele.
    if (isPdf && chosen.size > MAX_BYTES) {
      toast.error('O PDF passou de 2 MB. Tente o print da tela.');
      return;
    }

    onChange(chosen);
    setPreview(isImage ? URL.createObjectURL(chosen) : null);
  };

  const clear = () => {
    onChange(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  if (file) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-3">
        {preview ? (
          <img
            src={preview}
            alt="Prévia do comprovante"
            className="w-12 h-12 rounded-lg object-cover shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <FileText size={22} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text flex items-center gap-1">
            <Check size={14} className="text-emerald-600" />
            Comprovante anexado
          </p>
          <p className="text-xs text-textMuted truncate">{file.name}</p>
        </div>
        <button
          type="button"
          onClick={clear}
          aria-label="Remover comprovante"
          className="tap w-9 h-9 rounded-lg text-textMuted flex items-center justify-center shrink-0"
        >
          <X size={18} />
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="tap w-full h-12 rounded-xl bg-card border-2 border-dashed border-borderStrong text-textMuted text-sm font-semibold inline-flex items-center justify-center gap-2"
      >
        <Paperclip size={16} />
        Anexar comprovante (opcional)
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        onChange={pick}
        className="hidden"
      />
    </>
  );
}
