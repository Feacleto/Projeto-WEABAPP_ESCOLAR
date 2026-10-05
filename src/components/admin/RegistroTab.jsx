import { useEffect, useState } from 'react';
import Spinner from '../common/Spinner';
import { listarRegistro, LINHAS_DO_REGISTRO_NO_PAINEL } from '../../services/registroDoDonoService';
import { formatDate, formatDateTime } from '../../compartilhado/formatters.js';
import { ACAO } from '../../dominio/identidade/registroDoDono.js';

/**
 * A ABA "REGISTRO" — quem fez o quê, quando e por quê (05/10/2026, painel do
 * dono, lote 2).
 *
 * SÓ LÊ. Cada linha foi gravada pela callable `suspenderConta` na mesma
 * transação da ação, e as rules recusam qualquer escrita pelo cliente, dono
 * incluído: ninguém edita nem apaga uma linha. É a memória que dois donos
 * precisam para não se contradizerem, e a prova se a decisão for contestada.
 */
const ROTULO_DA_ACAO = {
  [ACAO.SUSPENDER]: ['Suspensão', 'bg-dangerChip text-dangerText'],
  [ACAO.REATIVAR]: ['Reativação', 'bg-primaryChip text-accentText'],
  [ACAO.AVISO]: ['Aviso', 'bg-warningChip text-warningText'],
  [ACAO.RESPOSTA]: ['Resposta', 'bg-infoChip text-infoText'],
};

const FILTROS = [
  ['todos', 'Tudo'],
  [ACAO.SUSPENDER, 'Suspensões'],
  [ACAO.AVISO, 'Avisos'],
  [ACAO.REATIVAR, 'Reativações'],
];

export default function RegistroTab() {
  const [linhas, setLinhas] = useState(null);
  const [filtro, setFiltro] = useState('todos');

  useEffect(() => {
    let vivo = true;
    listarRegistro()
      .then((l) => vivo && setLinhas(l))
      .catch((err) => {
        console.error('[admin] registro não carregou:', err);
        if (vivo) setLinhas(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  if (linhas === false) {
    return (
      <p className="rounded-2xl border border-dangerBorder bg-dangerSoft p-4 text-xs text-dangerText">
        Não deu pra carregar o registro.
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

  const visiveis = filtro === 'todos' ? linhas : linhas.filter((l) => l.acao === filtro);

  return (
    <section aria-labelledby="registro" className="space-y-3">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="registro" className="rotulo">
          Registro de ações
        </h2>
        <p className="text-xs text-textMuted">
          ninguém edita nem apaga uma linha · as {LINHAS_DO_REGISTRO_NO_PAINEL} mais recentes
        </p>
      </header>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar">
        {FILTROS.map(([id, rotulo]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFiltro(id)}
            aria-pressed={filtro === id}
            className={`tap min-h-[40px] rounded-full border px-3.5 text-xs font-bold ${
              filtro === id ? 'border-primary bg-primary text-white' : 'border-border bg-card text-text'
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {visiveis.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-textMuted">
          Nenhuma ação registrada ainda. Suspender, avisar e reativar um motorista aparecem aqui.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead>
              <tr className="border-b border-border text-textMuted">
                <th className="px-4 py-2.5 font-semibold">Quando</th>
                <th className="px-3 py-2.5 font-semibold">Quem decidiu</th>
                <th className="px-3 py-2.5 font-semibold">Ação</th>
                <th className="px-3 py-2.5 font-semibold">Sobre</th>
                <th className="px-3 py-2.5 font-semibold">Motivo</th>
                <th className="px-4 py-2.5 font-semibold">Resposta até</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((l) => {
                const [rotulo, cor] = ROTULO_DA_ACAO[l.acao] || [l.acao, 'bg-neutro text-textMuted'];
                return (
                  <tr key={l.id} className="border-b border-border align-top last:border-0">
                    <td className="px-4 py-2.5 text-textMuted">{l.em ? formatDateTime(l.em) : '—'}</td>
                    <td className="px-3 py-2.5 font-bold text-text">{l.donoNome || 'Dono'}</td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded-full px-2.5 py-1 font-bold ${cor}`}>{rotulo}</span>
                      {l.ate && <span className="mt-1 block text-textMuted">até {formatDate(`${l.ate}T12:00:00`)}</span>}
                      {l.grau === 'encerramento' && <span className="mt-1 block text-textMuted">encerramento</span>}
                      {l.urgente && <span className="mt-1 block font-semibold text-dangerText">urgente</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="block text-text">{l.alvoNome || l.alvoUid}</span>
                      <span className="block text-textMuted">{l.alvoPapel}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="block text-text">{l.motivoRotulo || l.motivo}</span>
                      {l.evidencia && <span className="mt-1 block text-textMuted">{l.evidencia}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-textMuted">
                      {l.respostaAte ? formatDate(`${l.respostaAte}T12:00:00`) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs leading-relaxed text-textMuted">
        Quem foi suspenso pode pedir a linha dele por contato@alobuzinou.com (LGPD). A evidência
        que cita outra pessoa vai editada.
      </p>
    </section>
  );
}
