import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Medal, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNivel } from '../../hooks/useNivel';
import { chaveDoNivel } from './rotuloDoNivel';

/**
 * O AVISO ÚNICO DO BRONZE (docs/niveis.md, seção 3): "Você ganhou o Bronze —
 * toque para ver como subir". Aparece uma vez por conta neste aparelho e só
 * enquanto o nível oficial é Bronze; tocar ou fechar o aposenta.
 *
 * ⚠️ A MEMÓRIA É DO APARELHO (localStorage), e isso é aceitável aqui: o pior
 * caso é ele ver o aviso de novo num celular novo. Leitura e escrita vão em
 * try/catch — aba anônima ou armazenamento bloqueado não podem derrubar o
 * Início; sem memória, o aviso só aparece de novo.
 */
const chaveDoAviso = (uid) => `alobuzinou:avisoDoBronze:${uid}`;

function jaViu(uid) {
  try {
    return window.localStorage.getItem(chaveDoAviso(uid)) === '1';
  } catch {
    return false;
  }
}

function lembrar(uid) {
  try {
    window.localStorage.setItem(chaveDoAviso(uid), '1');
  } catch {
    // sem armazenamento: o aviso volta na próxima abertura, e só isso.
  }
}

export default function AvisoDoBronze({ className = '' }) {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const { nivel } = useNivel(uid);
  const navigate = useNavigate();
  // Fechado NESTA tela; o que vale entre aberturas é o localStorage.
  const [fechado, setFechado] = useState(false);

  if (!uid || fechado || chaveDoNivel(nivel) !== 'bronze' || jaViu(uid)) return null;

  const fechar = () => {
    lembrar(uid);
    setFechado(true);
  };

  return (
    <div className={`flex items-stretch gap-1 rounded-2xl bg-card shadow-rest ${className}`}>
      <button
        type="button"
        onClick={() => {
          lembrar(uid);
          navigate('/tio/nivel');
        }}
        className="tap flex min-h-16 flex-1 items-center gap-3 py-3 pl-4 text-left"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutro">
          <Medal size={22} className="text-textMuted" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-bold text-text">Você ganhou o Bronze</span>
          <span className="block text-sm text-textMuted">Toque para ver como subir</span>
        </span>
        <ChevronRight size={20} className="shrink-0 text-textMuted" aria-hidden />
      </button>
      <button
        type="button"
        onClick={fechar}
        aria-label="Fechar o aviso do Bronze"
        className="tap flex min-h-12 min-w-12 items-center justify-center text-textMuted"
      >
        <X size={20} />
      </button>
    </div>
  );
}
