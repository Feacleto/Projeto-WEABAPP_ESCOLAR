import { useNavigate } from 'react-router-dom';
import { FileSignature, ChevronRight } from 'lucide-react';
import { estadoDoContrato } from '../../dominio/cobranca/contratoDaFamilia.js';

/**
 * UM CONTRATO NOVO PARA ASSINAR — o aviso no Início da família (02/10/2026).
 * Para ela não há "mudança": há um contrato novo, que ela lê e assina
 * (decisão do dono, 03/10/2026).
 *
 * Não bloqueia nada: até ela aceitar, vale o contrato de antes, e ela precisa
 * do app inteiro enquanto lê com calma. Mas também não pode morar só no sino,
 * que some com o tempo: enquanto a mudança espera, o aviso fica aqui.
 */
export default function AvisoDeMudancaNoContrato({ child }) {
  const navigate = useNavigate();
  if (estadoDoContrato(child) !== 'mudanca') return null;
  return (
    <button
      type="button"
      onClick={() => navigate('/pai/contrato')}
      className="tap flex w-full items-center gap-3 rounded-2xl border border-warningBorder bg-warningSoft p-4 text-left"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-card text-warningText">
        <FileSignature size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold text-warningText">
          Você tem um contrato novo para assinar
        </span>
        <span className="mt-0.5 block text-sm text-warningText">
          Toque para ler e assinar.
        </span>
      </span>
      <ChevronRight size={20} className="shrink-0 text-warningText" />
    </button>
  );
}
