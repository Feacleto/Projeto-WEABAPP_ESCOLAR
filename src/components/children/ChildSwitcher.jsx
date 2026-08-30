import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { getChild } from '../../services/childrenService';
import { useAuth } from '../../hooks/useAuth';
import { AddChildSheet } from '../../pages/pai/AddChild';

/**
 * Troca entre os filhos do responsável.
 *
 * NÃO RENDERIZA com um filho só — quem tem uma criança vê a tela
 * exactamente como era antes da Fase 2. Ninguém paga pela complexidade que
 * não usa.
 *
 * Busca os nomes com getChild (leitura pontual, não onSnapshot): o nome de
 * uma criança não muda durante a sessão, e um listener por filho só pra
 * preencher um rótulo seria desperdício.
 */
export default function ChildSwitcher({ className = '' }) {
  const { childIds, activeChildId, setActiveChildId } = useAuth();
  const [names, setNames] = useState({});
  // Adicionar filho é interrupção da troca de filho, não destino.
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    if (childIds.length < 2) return;
    let alive = true;
    Promise.all(childIds.map((id) => getChild(id).catch(() => null))).then(
      (list) => {
        if (!alive) return;
        const map = {};
        list.forEach((c) => {
          if (c) map[c.id] = String(c.name || '').split(/\s+/)[0] || 'Criança';
        });
        setNames(map);
      },
    );
    return () => {
      alive = false;
    };
  }, [childIds]);

  if (childIds.length < 2) return null;

  return (
    <>
      <div
        className={`flex items-center gap-1 p-1 bg-neutro rounded-2xl ${className}`}
      >
        {childIds.map((id) => {
          const active = id === activeChildId;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveChildId(id)}
              aria-pressed={active}
              className={`tap flex-1 min-w-0 py-2.5 px-2 text-sm font-semibold rounded-xl truncate transition-colors ${
                active ? 'bg-card text-text shadow-sm' : 'text-textMuted'
              }`}
            >
              {names[id] || '...'}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          aria-label="Adicionar outro filho"
          className="tap w-10 h-10 rounded-xl text-textMuted flex items-center justify-center shrink-0"
        >
          <Plus size={18} />
        </button>
      </div>

      <AddChildSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}
