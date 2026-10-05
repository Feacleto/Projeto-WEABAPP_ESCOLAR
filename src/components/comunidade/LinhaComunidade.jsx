import { useNavigate } from 'react-router-dom';
import { ChevronRight, Users } from 'lucide-react';

/**
 * A porta da Comunidade no Início do tio (05/10/2026), no molde da linha
 * "Meu transporte" logo acima. Fica no Início, e não na Central, porque
 * quem posta a foto da turma costuma ser a auxiliar, sem a senha do
 * Financeiro. Some durante a rota: ali o Início é só "Abrir rota".
 */
export default function LinhaComunidade() {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate('/tio/comunidade')}
      className="tap flex min-h-14 w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-left"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primaryChip text-primary">
        <Users size={20} />
      </div>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-semibold text-text">Comunidade</span>
        <span className="block truncate text-sm text-textMuted">Foto da turma e tios parceiros</span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-textMuted" />
    </button>
  );
}
