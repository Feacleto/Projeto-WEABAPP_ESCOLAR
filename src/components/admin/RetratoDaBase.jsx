import { useEffect, useState } from 'react';
import { getRetratoDaBase } from '../../services/adminMetricsService';
import { formatCurrency } from '../../compartilhado/formatters.js';
import { DIAS_DE_USO } from '../../dominio/associacao/retratoDaBase.js';
import EvolucaoDaBase from './EvolucaoDaBase';

/**
 * O RETRATO DA BASE — o topo do Hoje (05/10/2026, desenho aprovado pelo dono
 * no canvas "Painel do dono").
 *
 * A fila responde "com quem eu falo hoje"; isto responde a pergunta de antes
 * dela: "o app está sendo usado?". Com a cobrança desligada, era a pergunta
 * que o painel não respondia — a aba Números mostrava MRR e receita zerados.
 *
 * ⚠️ "PAGARIA" NÃO É RECEITA, e a tela diz isso no próprio cartão: é o que a
 * base de hoje pagaria se a cobrança ligasse agora. A conta e o que entra nela
 * estão em `dominio/associacao/retratoDaBase.js`.
 *
 * Onde o número não veio, "—", nunca zero.
 */
function numero(v) {
  return v === null || v === undefined ? '—' : String(v);
}

function Ficha({ rotulo, valor, detalhe }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4">
      <span className="text-xs text-textMuted">{rotulo}</span>
      <span className="font-display text-2xl font-extrabold tabular-nums text-text">{valor}</span>
      {detalhe && <span className="text-xs text-textMuted">{detalhe}</span>}
    </div>
  );
}

export default function RetratoDaBase() {
  const [dados, setDados] = useState(null);

  useEffect(() => {
    let vivo = true;
    getRetratoDaBase()
      .then((d) => vivo && setDados(d.retrato))
      .catch((err) => {
        console.error('[admin] retrato da base não carregou:', err);
        if (vivo) setDados(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  if (dados === false) {
    return (
      <p className="rounded-2xl border border-dangerBorder bg-dangerSoft p-4 text-xs text-dangerText">
        Não deu pra montar o retrato da base.
      </p>
    );
  }
  if (dados === null) return null;

  const r = dados;
  const topo = r.funil[0]?.n || 0;

  return (
    <section aria-labelledby="retrato" className="space-y-3">
      <h2 id="retrato" className="rotulo">
        O app está sendo usado?
      </h2>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Ficha
          rotulo={`Rodaram em ${DIAS_DE_USO} dias`}
          valor={`${r.rodaramNaSemana} de ${r.motoristas}`}
          detalhe={r.nuncaRodaram > 0 ? `${r.nuncaRodaram} nunca rodaram` : null}
        />
        <Ficha
          rotulo="Assinantes com plano"
          valor={`${r.assinantes} de ${r.motoristas}`}
          detalhe={`${r.planos.teste} ainda em teste`}
        />
        <Ficha rotulo="Crianças ativas" valor={numero(r.criancasAtivas)} detalhe="a unidade de cobrança" />
        <Ficha
          rotulo="Crianças com a família no app"
          valor={r.fracaoComFamilia === null ? '—' : `${Math.round(r.fracaoComFamilia * 100)}%`}
          detalhe={
            r.criancasComFamilia === null ? null : `${r.criancasComFamilia} de ${r.criancasAtivas}`
          }
        />
        <Ficha
          rotulo="Mensalidades com baixa no mês"
          valor={numero(r.baixasNoMes)}
          detalhe="quantas, não quanto"
        />
        <Ficha
          rotulo="A base pagaria por mês"
          valor={r.pagariaPorMes === null ? '—' : formatCurrency(r.pagariaPorMes)}
          detalhe="potencial, não é receita"
        />
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="text-sm font-bold text-text">Do cadastro ao uso de verdade</h3>
        <ul className="mt-3 space-y-2.5">
          {r.funil.map((d) => (
            <li key={d.rotulo} className="text-xs">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-text">{d.rotulo}</span>
                <span className="font-bold tabular-nums text-text">{d.n}</span>
              </div>
              {/* A barra é a comparação; o número é o dado. */}
              <span aria-hidden className="mt-1 block h-2 overflow-hidden rounded-full bg-sunken">
                <span
                  className="block h-full rounded-full bg-primary"
                  style={{ width: `${topo > 0 ? Math.max(2, (d.n / topo) * 100) : 0}%` }}
                />
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-textMuted">
          Onde a barra cai mais é onde está a próxima conversa.
        </p>
      </div>

      <EvolucaoDaBase />
    </section>
  );
}
