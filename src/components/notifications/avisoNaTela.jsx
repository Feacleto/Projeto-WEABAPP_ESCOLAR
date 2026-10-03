import toast from 'react-hot-toast';
import { Bell } from 'lucide-react';
import { destinoDoAviso } from '../../dominio/identidade/destinoDoAviso.js';

/**
 * O AVISO COM O APP ABERTO (03/10/2026).
 *
 * Com o app aberto, o push não aparece — o navegador entrega a mensagem à
 * página, e ninguém a mostrava. O aviso só chegava ao número do sininho: a
 * mãe com o app aberto no Início não ficava sabendo que "Pedro chegou na
 * escola" até abrir a lista. Agora todo aviso NOVO vira um cartão no topo,
 * com o título e a frase do push, e o toque leva ao mesmo lugar que o push
 * levaria (`destinoDoAviso`).
 *
 * Fica de fora a BUZINA: ela já cobre a tela inteira, com toque e vibração.
 *
 * `abrir` é o `navigate` de quem mostra: este arquivo não conhece o router.
 */
const SEM_CARTAO = new Set(['buzina']);
const mostrados = new Set();

export function avisoNaTela(aviso, { papel, abrir }) {
  if (!aviso?.id || SEM_CARTAO.has(aviso.type) || mostrados.has(aviso.id)) return;
  // Um cartão por aviso. Era a defesa contra os vários cabeçalhos ouvindo ao
  // mesmo tempo; desde 03/10/2026 a escuta é uma só (`NotificacoesProvider`),
  // e a trava fica contra o mesmo aviso chegando em dois snapshots.
  mostrados.add(aviso.id);
  const caminho = destinoDoAviso(aviso, papel);
  toast.custom(
    (t) => (
      <button
        type="button"
        onClick={() => {
          toast.dismiss(t.id);
          abrir?.(caminho);
        }}
        className={`tap w-[min(92vw,420px)] text-left rounded-2xl bg-card border border-border shadow-float p-4 flex gap-3 items-start transition-opacity ${
          t.visible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <span className="mt-0.5 w-9 h-9 shrink-0 rounded-xl bg-primaryChip text-primary flex items-center justify-center">
          <Bell size={18} />
        </span>
        <span className="min-w-0">
          <span className="block font-bold text-text leading-snug">{aviso.title}</span>
          {aviso.body && (
            <span className="block mt-0.5 text-sm text-textMuted leading-snug">{aviso.body}</span>
          )}
        </span>
      </button>
    ),
    { id: `aviso-${aviso.id}`, duration: aviso.type === 'perua_chegou' ? 12000 : 7000, position: 'top-center' }
  );
}
