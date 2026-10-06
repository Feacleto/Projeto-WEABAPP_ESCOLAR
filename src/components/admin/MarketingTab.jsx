import { useEffect, useMemo, useState } from 'react';
import Spinner from '../common/Spinner';
import { parceirosDoDono } from '../../services/userService';
import { contarPorCanal } from '../../dominio/identidade/origem.js';
import { resumoDeMarketing, retencaoPorCanal } from '../../dominio/associacao/vendasDoPainel.js';

/**
 * MARKETING — "por onde o motorista chega, e qual porta traz quem fica"
 * (05/10/2026).
 *
 * Duas tabelas da MESMA lista de motoristas: de onde vieram (`contarPorCanal`)
 * e, por canal, quantos rodaram a 1ª rota e quantos rodam agora. É a segunda
 * que diz se um canal traz gente ou só cadastro.
 *
 * ⚠️ "Sem origem" não significa "ninguém indicou": é quem não deixou link para
 * rastrear (adesivo na van, boca a boca). E canal com poucos cadastros dá
 * percentual instável — o `n` vem ao lado.
 *
 * ⚠️ Onde o número não existe, "—", nunca zero. Visitas ao site não são
 * contadas: a landing não tem analytics, e a caixa tracejada diz o que falta.
 */
function Ficha({ rotulo, valor, detalhe }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4">
      <span className="text-xs text-textMuted">{rotulo}</span>
      <span className="font-display text-2xl font-extrabold tabular-nums text-text">{valor}</span>
      {detalhe && <span className="text-xs text-textMuted">{detalhe}</span>}
    </div>
  );
}

const pct = (v) => (v === null || v === undefined ? '—' : `${v}%`);

export default function MarketingTab() {
  const [parceiros, setParceiros] = useState(null);

  useEffect(() => {
    let vivo = true;
    parceirosDoDono()
      .then((l) => vivo && setParceiros(l))
      .catch((err) => {
        console.error('[admin] marketing não carregou:', err);
        if (vivo) setParceiros(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  const dados = useMemo(() => {
    if (!Array.isArray(parceiros)) return null;
    const agora = new Date();
    return {
      resumo: resumoDeMarketing(parceiros, agora),
      canais: contarPorCanal(parceiros),
      retencao: retencaoPorCanal(parceiros, agora),
    };
  }, [parceiros]);

  if (parceiros === false) {
    return (
      <p className="rounded-2xl border border-dangerBorder bg-dangerSoft p-4 text-xs text-dangerText">
        Não deu pra carregar o marketing.
      </p>
    );
  }
  if (!dados) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  const { resumo, canais, retencao } = dados;

  return (
    <div className="space-y-5">
      <section className="space-y-3" aria-labelledby="mkt-titulo">
        <h2 id="mkt-titulo" className="rotulo">
          Por onde o motorista chega
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Ficha
            rotulo="Cadastros no mês"
            valor={resumo.cadastrosNoMes === null ? '—' : resumo.cadastrosNoMes}
          />
          <Ficha
            rotulo="Vieram por indicação"
            valor={pct(resumo.percentualPorIndicacao)}
            detalhe="dos cadastros do mês"
          />
          <Ficha rotulo="Visitas ao site" valor="—" detalhe="o site não conta" />
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="mkt-vieram">
        <h2 id="mkt-vieram" className="rotulo">
          De onde vieram
        </h2>
        {!canais ? (
          <p className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-textMuted">
            —
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {canais.linhas.map((l) => (
              <li key={l.canal} className="flex items-baseline justify-between gap-3 px-4 py-3 text-sm">
                <span className="text-text">{l.rotulo}</span>
                <span className="font-bold tabular-nums text-text">
                  {l.quantos} <span className="text-xs font-normal text-textMuted">({l.percentual}%)</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="mkt-ficam">
        <h2 id="mkt-ficam" className="rotulo">
          Qual porta traz quem fica
        </h2>
        {!retencao ? (
          <p className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-textMuted">
            —
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead>
                <tr className="text-xs text-textMuted">
                  <th className="px-4 py-3 font-medium">Canal</th>
                  <th className="px-2 py-3 text-right font-medium">Cadastros</th>
                  <th className="px-2 py-3 text-right font-medium">Rodou a 1ª rota</th>
                  <th className="px-4 py-3 text-right font-medium">Roda na semana</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {retencao.map((l) => (
                  <tr key={l.canal}>
                    <td className="px-4 py-3 text-text">{l.rotulo}</td>
                    <td className="px-2 py-3 text-right tabular-nums text-text">{l.n}</td>
                    <td className="px-2 py-3 text-right font-bold tabular-nums text-text">{pct(l.percentualRodou)}</td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-text">{pct(l.percentualNaSemana)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs leading-relaxed text-textMuted">
          Canal com poucos cadastros muda muito com uma pessoa só. &quot;Sem origem&quot; inclui quem veio pelo
          adesivo ou pelo boca a boca, que não deixam rastro.
        </p>
      </section>

      <div className="rounded-2xl border border-dashed border-border p-4">
        <h3 className="text-sm font-bold text-text">Para estes números existirem</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-textMuted">
          <li>Contar as aberturas do cartão do link (hoje a função responde e não registra).</li>
          <li>Contar as visitas ao site: ele não tem contador, e de propósito não usa Google Analytics.</li>
          <li>Medir quantas visitas viram cadastro, para comparar a porta de entrada com a de quem fica.</li>
        </ul>
      </div>
    </div>
  );
}
