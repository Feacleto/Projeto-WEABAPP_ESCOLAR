import { useMemo, useState } from 'react';
import { CalendarX2, ChevronLeft, ChevronRight } from 'lucide-react';
import Sheet from '../common/Sheet';
import { addMonths, formatBRL, formatMonthLabel } from '../../compartilhado/formatters';
import { getDateKey } from '../../dominio/rota/horarios.js';
import { calendarioDaAuxiliar, calendarioDaSubstituta } from '../../dominio/identidade/calendarioDaAuxiliar.js';

/**
 * O CALENDÁRIO DE FALTAS DA AUXILIAR — e, com `substituta`, o dos dias que
 * a substituta cobriu (05/10/2026, pedido do dono). Numa FOLHA, por cima de
 * `/tio/finance/auxiliar`: é uma consulta de passagem, e tela nova seria
 * pedágio de ida e volta.
 *
 * O MESMO ROSTO DO CALENDÁRIO DA CRIANÇA (`FaltasDaCrianca`, na ficha): as
 * duas setas de 48px, o número do mês no meio com o nome do mês embaixo, e
 * só anda para trás a partir do mês corrente — mês à frente seria sempre
 * vazio e pareceria tela quebrada. Aqui o mês ganha a grade dos dias, porque
 * a pergunta do tio é "em que dias", e tocar num dia diz o que houve.
 *
 * ⚠️ AS FALTAS VÊM POR PROP, da escuta que a tela já tem (`useSubstitutas`,
 * que lê TODAS as faltas do tio). Uma segunda escuta sobre `faltasDaAuxiliar`
 * leria o mesmo histórico duas vezes.
 *
 * ⚠️ VALOR EM REAIS: a folha só abre de telas embaixo de `/tio/finance`
 * (atrás da senha). `ocultarValores` existe para a tela que tiver o olho de
 * esconder valores; `/tio/finance/auxiliar` não tem, e o "Controle do mês"
 * logo abaixo já mostra os mesmos números.
 *
 * O mês começa no mesmo `getDateKey` com que a falta é gravada.
 *
 * Props: open, onClose, faltas, motoristaUid, e UMA das duas —
 * `auxiliar` ({ uid, nome }) ou `substituta` ({ id, nome }).
 */
export default function CalendarioDaAuxiliar({
  open,
  onClose,
  faltas,
  motoristaUid,
  auxiliar = null,
  substituta = null,
  ocultarValores = false,
}) {
  const mesAtual = getDateKey().slice(0, 7);
  const [mes, setMes] = useState(mesAtual);
  const [escolhido, setEscolhido] = useState(null);

  const cal = useMemo(() => {
    if (substituta) {
      return calendarioDaSubstituta(faltas, { motoristaUid, substitutaId: substituta.id, monthKey: mes });
    }
    return calendarioDaAuxiliar(faltas, { motoristaUid, auxiliarUid: auxiliar?.uid, monthKey: mes });
  }, [faltas, motoristaUid, auxiliar?.uid, substituta, mes]);

  const podeAvancar = mes < mesAtual;
  const trocarMes = (delta) => {
    setMes((m) => addMonths(m, delta));
    setEscolhido(null);
  };
  const doDia = cal.dias.find((d) => d.dateKey === escolhido) || null;
  const nome = (substituta?.nome || auxiliar?.nome || '').trim().split(/\s+/)[0];
  const contagem = substituta ? cal.totais.dias : cal.totais.faltas;
  const rotulo = substituta
    ? `${contagem === 1 ? 'dia coberto' : 'dias cobertos'} em`
    : `${contagem === 1 ? 'falta' : 'faltas'} em`;
  const reais = (v) => (ocultarValores ? 'R$ ••••' : formatBRL(v));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      icon={CalendarX2}
      title={substituta ? `Dias que ${nome || 'ela'} cobriu` : `Faltas de ${nome || 'auxiliar'}`}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => trocarMes(-1)}
            aria-label="Mês anterior"
            className="tap flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border text-textMuted"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-center">
            <p className="text-xl font-extrabold leading-none tabular-nums text-text">{faltas === null ? '…' : contagem}</p>
            <p className="mt-1 text-sm leading-tight text-textMuted">
              {rotulo} <span className="capitalize">{formatMonthLabel(mes)}</span>
            </p>
          </div>
          <button
            type="button"
            disabled={!podeAvancar}
            onClick={() => podeAvancar && trocarMes(1)}
            aria-label="Próximo mês"
            className="tap flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border text-textMuted disabled:opacity-30"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div role="grid" aria-label={`Calendário de ${formatMonthLabel(mes)}`} className="space-y-1">
          <div role="row" className="grid grid-cols-7 gap-1 text-center text-sm font-bold text-textMuted">
            {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
              <span key={i} role="columnheader">{d}</span>
            ))}
          </div>
          {cal.semanas.map((semana, i) => (
            <div key={i} role="row" className="grid grid-cols-7 gap-1">
              {semana.map((c, j) =>
                !c ? (
                  <span key={j} />
                ) : c.marcado ? (
                  <button
                    key={j}
                    type="button"
                    role="gridcell"
                    aria-pressed={escolhido === c.dateKey}
                    aria-label={`${c.dia}: ${c.linha}`}
                    onClick={() => setEscolhido(c.dateKey)}
                    className={`tap flex h-12 items-center justify-center rounded-xl border-2 text-base font-bold tabular-nums ${
                      escolhido === c.dateKey
                        ? 'border-primary bg-primary text-white'
                        : 'border-primaryBorder bg-primaryChip text-primary'
                    }`}
                  >
                    {c.dia}
                  </button>
                ) : (
                  <span
                    key={j}
                    role="gridcell"
                    className="flex h-12 items-center justify-center text-base tabular-nums text-textMuted"
                  >
                    {c.dia}
                  </span>
                )
              )}
            </div>
          ))}
        </div>

        <div className="min-h-16 rounded-2xl bg-surface p-4">
          {doDia ? (
            <>
              <p className="text-base font-bold capitalize text-text">{doDia.quando}</p>
              <p className="text-base text-textBody">
                {doDia.linha}
                {doDia.valor ? ` · ${reais(doDia.valor)}` : ''}
              </p>
            </>
          ) : (
            <p className="text-base text-textBody">
              {cal.dias.length === 0
                ? substituta ? 'Ela não cobriu nenhum dia neste mês.' : 'Nenhuma falta neste mês.'
                : 'Toque num dia marcado.'}
            </p>
          )}
        </div>

        {cal.totais.gasto > 0 && (
          <p className="text-base font-bold text-text">
            {substituta ? 'Pago a ela no mês' : 'Gasto com substitutas no mês'}: {reais(cal.totais.gasto)}
          </p>
        )}
      </div>
    </Sheet>
  );
}
