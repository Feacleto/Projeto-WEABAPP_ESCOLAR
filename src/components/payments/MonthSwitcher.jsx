import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatMonthLabel, getCurrentMonthKey, addMonths } from '../../compartilhado/formatters';
import { MESES_NAVEGAVEIS_ATRAS } from '../../dominio/cobranca/retencao.js';

/**
 * Navegação de mês, compartilhada pelas telas de dinheiro.
 *
 * Estava definida dentro do TioFinance. Saiu de lá quando a tela de despesas
 * passou a precisar do mesmo controle — duas cópias do mesmo seletor de mês
 * divergiriam na primeira mudança de regra — o limite para trás, por
 * exemplo, que existe pra casar com a retenção de pagamentos.
 *
 * Não avança além do mês corrente: não há o que ver no futuro.
 */
export default function MonthSwitcher({ monthKey, onChange }) {
  const current = getCurrentMonthKey();
  const canGoNext = monthKey < current;

  // ⚠️ O LIMITE SAI DA RETENÇÃO, E ELE ESTAVA ESCRITO À MÃO EM 12.
  //
  // A retenção foi para 60 meses quando alguém notou que a Política de
  // Privacidade promete cinco anos — e esta linha ficou. O comentário dizia
  // "alinhado com a retenção", que era justamente o que ele tinha deixado de
  // estar: 48 meses de mensalidade existiam no banco e a tela não deixava
  // chegar neles, na conversa sobre atraso e na conferência fiscal.
  const minMonth = addMonths(current, -MESES_NAVEGAVEIS_ATRAS);
  const canGoPrev = monthKey > minMonth;

  return (
    <div className="flex items-center justify-between bg-card rounded-2xl shadow-sm p-2">
      <button
        type="button"
        onClick={() => onChange(addMonths(monthKey, -1))}
        disabled={!canGoPrev}
        aria-label="Mês anterior"
        className="tap w-10 h-10 rounded-xl flex items-center justify-center text-text disabled:opacity-30"
      >
        <ChevronLeft size={20} />
      </button>
      <p className="text-base font-bold text-text capitalize">
        {formatMonthLabel(monthKey)}
      </p>
      <button
        type="button"
        onClick={() => onChange(addMonths(monthKey, 1))}
        disabled={!canGoNext}
        aria-label="Próximo mês"
        className="tap w-10 h-10 rounded-xl flex items-center justify-center text-text disabled:opacity-30"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
