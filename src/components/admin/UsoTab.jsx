import { useEffect, useState } from 'react';
import { getUsoDoApp } from '../../services/usoDoAppService';
import { SUGESTAO, resumoDoUso } from '../../dominio/associacao/usoDoApp.js';

/**
 * O USO DO APP (05/10/2026) — do recurso mais usado ao menos usado, para o
 * dono decidir o que manter e o que melhorar. A conta é a do servidor, feita
 * de noite sobre o que o app já grava (`usoDoApp`); a ordem e a sugestão saem
 * da régua. Pouco texto, de propósito: uma tabela e o aviso.
 *
 * ⚠️ Onde há 1 ou 2 motoristas a régua devolve "menos de 3" e esconde o
 * percentual e as vezes: numa base pequena o número aponta uma pessoa.
 */
const SELO = {
  manter: 'bg-primarySoft text-accentText',
  melhorar: 'bg-warningSoft text-warningText',
  avaliar: 'bg-dangerSoft text-dangerText',
  cedo: 'bg-sunken text-textMuted',
};

export default function UsoTab() {
  const [dados, setDados] = useState(undefined);

  useEffect(() => {
    let vivo = true;
    getUsoDoApp().then((d) => vivo && setDados(d));
    return () => {
      vivo = false;
    };
  }, []);

  const linhas = dados ? resumoDoUso(dados.recursos, dados.baseMotoristas) : [];

  return (
    <section aria-labelledby="uso" className="space-y-3">
      <h2 id="uso" className="rotulo">
        O que o motorista usa
      </h2>
      <p className="rounded-2xl border border-border bg-card p-4 text-sm text-textMuted">
        Números agregados do que o app já grava. Nenhum clique é rastreado.
      </p>

      {dados === null && (
        <p className="rounded-2xl border border-border bg-card p-4 text-sm text-text">
          O primeiro retrato do uso sai na primeira noite depois de publicar.
        </p>
      )}

      {dados && (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[480px] text-left text-sm">
            <caption className="p-4 text-left text-xs text-textMuted">
              Últimos {dados.janelaDias} dias · {dados.baseMotoristas} motoristas rodaram
            </caption>
            <thead>
              <tr className="border-b border-border text-xs text-textMuted">
                <th className="px-4 py-2 font-semibold">Recurso</th>
                <th className="px-2 py-2 font-semibold">Motoristas</th>
                <th className="px-2 py-2 text-right font-semibold">Vezes</th>
                <th className="px-4 py-2 font-semibold">Sugestão</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-text">{l.rotulo}</td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-2">
                      <span aria-hidden className="block h-2 w-20 overflow-hidden rounded-full bg-sunken">
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{ width: `${l.fracao === null ? 0 : Math.max(2, l.fracao * 100)}%` }}
                        />
                      </span>
                      <span className="font-bold tabular-nums text-text">
                        {l.fracao === null ? l.motoristasTexto : `${Math.round(l.fracao * 100)}%`}
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums text-text">
                    {l.vezes === null ? '—' : l.vezes}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${SELO[l.sugestao]}`}>
                      {SUGESTAO[l.sugestao]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
