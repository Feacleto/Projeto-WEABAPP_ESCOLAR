import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Header sticky comum às páginas autenticadas.
 *
 * Props:
 *   - title:    string
 *   - showBack: bool — mostra seta de voltar (usa navigate(-1))
 *   - action:   ReactNode — ícone/botão à direita (logout, +, etc.)
 */
export default function Header({ title, showBack = false, action = null }) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-20 bg-card border-b border-gray-100 h-14 px-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        {showBack && (
          <button
            onClick={() => navigate(-1)}
            aria-label="Voltar"
            className="-ml-1 p-1 tap text-textMuted"
          >
            <ArrowLeft size={22} />
          </button>
        )}
        <h1 className="text-base font-semibold text-text truncate">{title}</h1>
      </div>
      {action}
    </header>
  );
}
