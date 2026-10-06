import { useEffect, useState } from 'react';
import { Leaf, Users, Landmark } from 'lucide-react';
import Spinner from '../common/Spinner';
import { getRetratoDaBase } from '../../services/adminMetricsService';
import { carregarTotaisDeContas } from '../../services/pessoasDoPainelService';
import { listarRegistro } from '../../services/registroDoDonoService';
import {
  carrosAMenos,
  contagemDoRegistro,
  criancasPorPerua,
  LINHA_SOCIAL_FIXA,
  PENDENCIAS_DE_GOVERNANCA,
  RODAPE_DO_ESG,
  TEXTO_DA_ESTIMATIVA,
} from '../../dominio/associacao/esgDoPainel.js';

/**
 * A ABA ESG — três cartões (E, S, G), só leitura, com o que o painel já tem.
 * As contas moram em `esgDoPainel.js`. Número que não veio é "—", nunca zero;
 * estimativa leva o rótulo. Simples de propósito (pedido do dono).
 */
const traco = (v) => (v === null || v === undefined ? '—' : v);

function Cartao({ id, icone: Icone, titulo, linhas, children }) {
  return (
    <section aria-labelledby={id} className="rounded-2xl border border-border bg-card p-4">
      <h2 id={id} className="flex items-center gap-2 text-sm font-bold text-text">
        <Icone size={16} aria-hidden /> {titulo}
      </h2>
      <dl className="mt-2 divide-y divide-border">
        {linhas.map(([rotulo, valor]) => (
          <div key={rotulo} className="flex min-h-[40px] items-baseline justify-between gap-3 py-2">
            <dt className="text-xs text-textMuted">{rotulo}</dt>
            <dd className="text-sm font-bold tabular-nums text-text">{traco(valor)}</dd>
          </div>
        ))}
      </dl>
      {children}
    </section>
  );
}

export default function EsgTab() {
  const [dados, setDados] = useState(null);

  useEffect(() => {
    let vivo = true;
    Promise.all([
      getRetratoDaBase().catch(() => null),
      carregarTotaisDeContas().catch(() => null),
      listarRegistro().catch(() => null),
    ]).then(([base, contas, registro]) => vivo && setDados({ base, contas, registro }));
    return () => {
      vivo = false;
    };
  }, []);

  if (!dados) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  const r = dados.base?.retrato || {};
  const reg = contagemDoRegistro(dados.registro);
  const entrada = { criancasAtivas: r.criancasAtivas, rodaram: r.rodaram };

  return (
    <div className="space-y-4">
      <Cartao
        id="esg-e"
        icone={Leaf}
        titulo="Ambiental"
        linhas={[
          ['Crianças por perua', criancasPorPerua(entrada)],
          ['Carros a menos no portão (estimativa)', carrosAMenos(entrada)],
          ['Contratos no app, não no papel', null],
          ['Km das rotas', null],
        ]}
      >
        <p className="mt-2 text-xs text-textMuted">{TEXTO_DA_ESTIMATIVA}</p>
      </Cartao>

      <Cartao
        id="esg-s"
        icone={Users}
        titulo="Social"
        linhas={[
          ['Famílias atendidas', dados.contas?.totalFamilias ?? null],
          ['Motoristas autônomos com gestão', r.motoristas ?? null],
          ['Auxiliares com recibo', null],
        ]}
      >
        <p className="mt-2 text-xs text-textMuted">{LINHA_SOCIAL_FIXA}</p>
      </Cartao>

      <Cartao
        id="esg-g"
        icone={Landmark}
        titulo="Governança"
        linhas={[
          ['Ações registradas', reg.acoes],
          ['Suspensões com motivo', reg.suspensoesComMotivo],
        ]}
      >
        <ul className="mt-2 space-y-1 text-xs font-semibold text-warningText">
          {PENDENCIAS_DE_GOVERNANCA.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </Cartao>

      <p className="text-xs leading-relaxed text-textMuted">{RODAPE_DO_ESG}</p>
    </div>
  );
}
