import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';

/**
 * Checkbox de aceite reutilizado no FirstAccess (pai) e FirstAdmin (tio).
 * Único checkbox que cobre Termos + Política — ambos linkáveis.
 *
 * Por que um só checkbox em vez de dois? Pra UX mobile mais fluida.
 * O texto deixa claro que cobre os dois documentos.
 *
 * Props:
 *   - checked:  bool
 *   - onChange: (bool) => void
 *   - error:    string opcional (mostra em vermelho se preenchido)
 */
export default function LegalAcceptCheckbox({ checked, onChange, error }) {
  return (
    <div className="space-y-1">
      <label className="flex items-start gap-3 cursor-pointer p-2 -m-2 rounded-lg">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-1 w-5 h-5 accent-primary shrink-0"
        />
        <span className="text-xs text-text leading-snug">
          Li e aceito os{' '}
          <Link
            to="/termos"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary font-semibold underline inline-flex items-center gap-0.5"
          >
            Termos de Uso
            <ExternalLink size={10} />
          </Link>{' '}
          e a{' '}
          <Link
            to="/privacidade"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary font-semibold underline inline-flex items-center gap-0.5"
          >
            Política de Privacidade
            <ExternalLink size={10} />
          </Link>
          . Autorizo o tratamento de dados pessoais nos termos da LGPD.
        </span>
      </label>
      {error && <p className="text-xs text-danger ml-7">{error}</p>}
    </div>
  );
}
