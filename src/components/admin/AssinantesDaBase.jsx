import { useEffect, useMemo, useState } from 'react';
import Spinner from '../common/Spinner';
import { getRetratoDaBase } from '../../services/adminMetricsService';
import { formatCurrency, formatDate } from '../../compartilhado/formatters.js';

/**
 * OS ASSINANTES E O PLANO DE CADA UM — o topo da aba Financeiro (05/10/2026,
 * pedido do dono: "quero ver a quantidade de assinantes e qual o plano de cada
 * usuário").
 *
 * Uma linha por motorista: plano, desde quando, crianças, o desconto travado e
 * quanto ele PAGARIA por mês hoje. Com a cobrança desligada ninguém paga —
 * "pagaria" é a mesma conta da "Fatura de R$ 0,00" que o tio vê, nunca receita.
 *
 * Lê o mesmo retrato do Hoje (cacheado): nenhuma consulta nova.
 */
const ROTULO_DO_PLANO = {
  vitalicio: 'Vitalício',
  mensal: 'Mensal',
  anual: 'Anual',
  teste: 'Em teste',
};

const COR_DO_PLANO = {
  vitalicio: 'bg-infoChip text-infoText',
  mensal: 'bg-primaryChip text-accentText',
  anual: 'bg-infoChip text-infoText',
  teste: 'bg-neutro text-textMuted',
};

const FILTROS = [
  ['todos', 'Todos'],
  ['teste', 'Em teste'],
  ['mensal', 'Mensal'],
  ['anual', 'Anual'],
  ['vitalicio', 'Vitalício'],
];

function estadoDaLinha(l) {
  if (l.degrau === 'suspenso') return ['Suspensa', 'bg-dangerChip text-dangerText'];
  if (l.degrau === 'bloqueado') return ['Bloqueada', 'bg-dangerChip text-dangerText'];
  if (l.degrau === 'nao_comecou') return ['Nunca rodou', 'bg-neutro text-textMuted'];
  if (!l.rodouNaSemana) return ['Parada na semana', 'bg-warningChip text-warningText'];
  return ['Rodando', 'bg-primaryChip text-accentText'];
}

export default function AssinantesDaBase() {
  const [linhas, setLinhas] = useState(null);
  const [filtro, setFiltro] = useState('todos');

  useEffect(() => {
    let vivo = true;
    getRetratoDaBase()
      .then((d) => vivo && setLinhas(d.assinantes))
      .catch((err) => {
        console.error('[admin] assinantes não carregaram:', err);
        if (vivo) setLinhas(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  const contagem = useMemo(() => {
    const c = { todos: 0, teste: 0, mensal: 0, anual: 0, vitalicio: 0 };
    (linhas || []).forEach((l) => {
      c.todos += 1;
      c[l.plano] += 1;
    });
    return c;
  }, [linhas]);

  if (linhas === false) {
    return (
      <p className="rounded-2xl border border-dangerBorder bg-dangerSoft p-4 text-xs text-dangerText">
        Não deu pra carregar os assinantes.
      </p>
    );
  }
  if (linhas === null) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  const visiveis = filtro === 'todos' ? linhas : linhas.filter((l) => l.plano === filtro);

  return (
    <section aria-labelledby="assinantes" className="space-y-3">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="assinantes" className="rotulo">
          Assinantes e o plano de cada um
        </h2>
        <p className="text-xs text-textMuted">pagaria = tabela de hoje, não é receita</p>
      </header>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por plano">
        {FILTROS.map(([id, rotulo]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFiltro(id)}
            aria-pressed={filtro === id}
            className={`tap min-h-[40px] rounded-full border px-3.5 text-xs font-bold ${
              filtro === id
                ? 'border-primary bg-primary text-white'
                : 'border-border bg-card text-text'
            }`}
          >
            {rotulo} {contagem[id]}
          </button>
        ))}
      </div>

      {visiveis.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-textMuted">
          Ninguém neste plano.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead>
              <tr className="border-b border-border text-textMuted">
                <th className="px-4 py-2.5 font-semibold">Motorista</th>
                <th className="px-3 py-2.5 font-semibold">Plano</th>
                <th className="px-3 py-2.5 font-semibold">Desde</th>
                <th className="px-3 py-2.5 text-right font-semibold">Crianças</th>
                <th className="px-3 py-2.5 font-semibold">Desconto travado</th>
                <th className="px-3 py-2.5 text-right font-semibold">Pagaria por mês</th>
                <th className="px-4 py-2.5 font-semibold">Conta</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((l) => {
                const [estado, corDoEstado] = estadoDaLinha(l);
                return (
                  <tr key={l.uid} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5">
                      <span className="block font-bold text-text">{l.nome}</span>
                      {(l.nomeCivil || l.lugar) && (
                        <span className="block text-textMuted">
                          {[l.nomeCivil, l.lugar].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded-full px-2.5 py-1 font-bold ${COR_DO_PLANO[l.plano]}`}>
                        {ROTULO_DO_PLANO[l.plano]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-textMuted">{l.desde ? formatDate(l.desde) : '—'}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{l.criancas}</td>
                    <td className="px-3 py-2.5 text-textMuted">
                      {l.descontoTravado ? `${Math.round(l.descontoTravado * 100)}% sem prazo` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {l.pagaria === null ? '—' : formatCurrency(l.pagaria)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2.5 py-1 font-bold ${corDoEstado}`}>{estado}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
