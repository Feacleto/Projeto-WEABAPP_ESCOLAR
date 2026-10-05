import { formatBRL } from '../../compartilhado/formatters';
import { diaCurto, nomeDoMesDaChave, resumoDoMes } from '../../dominio/identidade/faltaDaAuxiliar.js';

/**
 * "CONTROLE DE {MÊS}" (fase 5): as faltas de cada auxiliar no mês, cada
 * substituição (dia, nome, valor) e o gasto com substitutas. "O tio precisa
 * registrar auxiliar substituto e isso entrar no controle."
 *
 * Só o que foi registrado: o app não calcula desconto no pagamento dela — o
 * número daqui é para a conversa dos dois, não uma conta pronta.
 */
export default function ControleDoMes({ faltas, monthKey }) {
  if (faltas === null) return null;
  const r = resumoDoMes(faltas, monthKey);
  const mes = nomeDoMesDaChave(monthKey);

  return (
    <section className="space-y-3 rounded-2xl bg-card p-5 shadow-rest">
      <h2 className="font-display text-lg font-bold text-text">Controle de {mes}</h2>
      {r.totalDeFaltas === 0 ? (
        <p className="text-base text-textBody">Nenhuma falta em {mes}.</p>
      ) : (
        <>
          <ul className="space-y-1">
            {r.porAuxiliar.map((a) => (
              <li key={a.auxiliarUid} className="flex items-baseline justify-between gap-3 text-base">
                <span className="text-text">{a.nome}</span>
                <span className="font-bold text-text">
                  {a.faltas} {a.faltas === 1 ? 'falta' : 'faltas'}
                </span>
              </li>
            ))}
          </ul>
          {r.substituicoes.length > 0 && (
            <ul className="space-y-1 border-t border-border pt-3">
              {r.substituicoes.map((s) => (
                <li key={`${s.dateKey}_${s.auxiliarUid}`} className="flex items-baseline justify-between gap-3 text-base">
                  <span className="text-textBody">{diaCurto(s.dateKey)} · {s.nome}</span>
                  <span className="text-text">{formatBRL(s.valor)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <p className="border-t border-border pt-3 text-base font-bold text-text">
        Gasto com substitutas no mês: {formatBRL(r.total)}
      </p>
    </section>
  );
}
