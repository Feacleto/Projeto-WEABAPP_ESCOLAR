import { CalendarRange } from 'lucide-react';
import Input from '../common/Input';
import {
  parcelasDaVigencia,
  dataBR,
  dataISO,
} from '../../dominio/cobranca/contratoDaFamilia.js';

/**
 * A VIGÊNCIA DO CONTRATO — quem escolhe é o motorista (02/10/2026).
 *
 * Duas datas e dois atalhos. O atalho existe porque quase todo contrato é um
 * destes dois ("até o fim do ano" ou "um ano a partir de hoje"), e escolher
 * duas datas num calendário de celular é o pedaço mais demorado do cadastro.
 *
 * O RESULTADO APARECE SOZINHO, EM DESTAQUE (pedido do dono): "Contrato de 3
 * meses" assim que as duas datas existem. Ele escolhe DATAS, mas pensa em
 * MESES — e é o número de parcelas que a família vai ler na cláusula 7ª.
 * As datas ficam uma embaixo da outra: lado a lado, em 360px, o campo cortava
 * o ano ("02/10/202").
 */
export default function CampoVigencia({ inicio, fim, onChange, erro }) {
  const parcelas = parcelasDaVigencia(inicio, fim);
  const anoDoInicio = Number(String(inicio || '').slice(0, 4)) || new Date().getFullYear();

  const umAno = () => {
    const [a, m, d] = String(inicio).split('-').map(Number);
    if (!a) return;
    const f = new Date(a + 1, m - 1, d - 1);
    onChange({ inicio, fim: dataISO(f) });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        <Input
          type="date"
          label="Começa em"
          value={inicio || ''}
          onChange={(e) => onChange({ inicio: e.target.value, fim })}
        />
        <Input
          type="date"
          label="Termina em"
          value={fim || ''}
          onChange={(e) => onChange({ inicio, fim: e.target.value })}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange({ inicio, fim: `${anoDoInicio}-12-31` })}
          className="tap min-h-11 rounded-full border border-border bg-card px-4 text-sm font-semibold text-text"
        >
          Até 31/12/{anoDoInicio}
        </button>
        <button
          type="button"
          onClick={umAno}
          className="tap min-h-11 rounded-full border border-border bg-card px-4 text-sm font-semibold text-text"
        >
          12 meses
        </button>
      </div>
      {erro ? (
        <p className="text-sm font-semibold text-dangerText">{erro}</p>
      ) : (
        parcelas > 0 && (
          <div
            aria-live="polite"
            className="flex items-center gap-3 rounded-2xl border border-primaryBorder bg-primarySoft p-4"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-card text-primary">
              <CalendarRange size={22} />
            </span>
            <span className="min-w-0">
              <span className="block text-lg font-extrabold leading-tight text-text">
                Contrato de {parcelas} {parcelas === 1 ? 'mês' : 'meses'}
              </span>
              <span className="mt-0.5 block text-sm text-textMuted">
                De {dataBR(inicio)} a {dataBR(fim)} · {parcelas}{' '}
                {parcelas === 1 ? 'parcela' : 'parcelas'}, inclusive nas férias
              </span>
            </span>
          </div>
        )
      )}
    </div>
  );
}
