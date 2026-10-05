import MiniPerua from './MiniPerua';
import RostoDaVaga from './RostoDaVaga';
import { useVagasDaPerua } from '../../hooks/useVagasDaPerua';
import { nomeDoMes } from '../payments/estadoDaMensalidade';
import {
  criancasDoMovimento,
  frasesDoMovimento,
  INICIO_DAS_SAIDAS,
} from '../../dominio/identidade/movimentoDaTurma.js';
import { frasesDaPerua } from '../../dominio/identidade/vagasDaPerua.js';

/**
 * "TURMA DE OUTUBRO" — a perua do mês, na Turma e contratos (05/10/2026,
 * decisão do dono).
 *
 * A mesma miniatura do Início, com quem ENTROU no mês aceso e o resto apagado;
 * quem SAIU fica embaixo, tracejado e com o nome. A conta de quem entrou e
 * saiu é a de sempre (`movimentoDaTurma.js`): antes de outubro de 2026 a
 * saída não tem data, e aqui ela simplesmente não aparece.
 *
 * Mora atrás da senha (é a Carteira), junto do dinheiro que a turma explica.
 */
export default function PeruaDoMes({ criancas = [], mes }) {
  const { vagas } = useVagasDaPerua();
  if (typeof vagas !== 'number') return null;
  const ativas = criancas.filter((c) => c?.active === true);
  const quem = criancasDoMovimento({ criancas, mes });
  const saidasContadas = mes >= INICIO_DAS_SAIDAS;
  const sairam = saidasContadas ? quem.sairam : [];
  const entrou = new Set(quem.entraram.map((c) => c.id));
  const frases = frasesDoMovimento({
    entraram: quem.entraram.length,
    sairam: saidasContadas ? sairam.length : null,
  });

  return (
    <section className="rounded-3xl bg-card p-4 shadow-rest">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-text">Turma de {nomeDoMes(mes)}</h2>
        <span className="text-base text-textMuted">{frasesDaPerua({ vagas, criancas: ativas }).contagem}</span>
      </div>
      <p className="text-base text-textBody">
        {[frases.entraram, frases.sairam].filter(Boolean).join(' · ')}
      </p>
      <div className="mt-3">
        <MiniPerua vagas={vagas} criancas={ativas} acesa={(c) => entrou.has(c.id)} />
      </div>
      {sairam.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {sairam.map((c) => (
            <span
              key={c.id}
              className="flex items-center gap-2 rounded-xl border-2 border-dashed border-borderStrong px-2 py-1.5"
            >
              <RostoDaVaga crianca={c} className="h-8 w-8 opacity-40 grayscale" />
              <span className="text-base text-textBody">
                <b className="text-text">{c.name || 'Sem nome'}</b> saiu
              </span>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
