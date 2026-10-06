import { useEffect, useState } from 'react';
import { lerJornadaDoMotorista } from '../../services/pessoasDoPainelService';
import { jornadaDoMotorista } from '../../dominio/identidade/retratoDasPessoas.js';
import { NOME_DO_NIVEL, chaveDoNivel } from '../nivel/rotuloDoNivel.js';

/**
 * "JORNADA NO APP" — o bloco da ficha do motorista que mostra o nível dele.
 *
 * ⚠️ DECISÃO 23: nível é USO DO APP, nunca plano, pagamento ou número de
 * crianças. Por isso este bloco é SEPARADO e a ficha deve montá-lo longe do
 * plano, das faturas e da nota das famílias — nunca na mesma linha ou cartão.
 * Juntar os dois faria o nível parecer critério de cobrança.
 *
 * Lê só `niveis/{uid}` (o dono pode); sem documento é "ainda sem nível".
 */
export default function JornadaNaFicha({ uid }) {
  const [j, setJ] = useState(undefined);

  useEffect(() => {
    let vivo = true;
    lerJornadaDoMotorista(uid).then((doc) => {
      if (vivo) setJ(jornadaDoMotorista(doc, Date.now()));
    });
    return () => {
      vivo = false;
    };
  }, [uid]);

  return (
    <section className="rounded-2xl border border-border bg-card p-3">
      <h3 className="text-sm font-bold text-text">Jornada no app</h3>
      {j === undefined ? (
        <p className="mt-1 text-xs text-textMuted">Carregando…</p>
      ) : j === null ? (
        <p className="mt-1 text-xs text-textMuted">Ainda sem nível: não terminou a primeira rota.</p>
      ) : (
        <dl className="mt-2 space-y-1.5 text-xs">
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-textMuted">Nível</dt>
            <dd className="font-bold text-text">
              {NOME_DO_NIVEL[chaveDoNivel(j.nivel)]}
              {j.feitas !== null && j.total !== null ? ` · ${j.feitas} de ${j.total} missões` : ''}
            </dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-textMuted">Próxima missão</dt>
            <dd className="font-bold text-text">{j.proxima || '—'}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-textMuted">Última missão feita</dt>
            <dd className="font-bold text-text">
              {j.diasDesdeAUltima === null
                ? '—'
                : j.diasDesdeAUltima === 0
                  ? 'hoje'
                  : `há ${j.diasDesdeAUltima} ${j.diasDesdeAUltima === 1 ? 'dia' : 'dias'}`}
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}
